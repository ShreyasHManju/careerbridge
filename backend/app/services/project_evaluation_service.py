from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.application import Application
from app.models.innovation_project import InnovationProject, ProjectStatus, ProjectVisibility
from app.models.notification import NotificationType
from app.models.project_evaluation import (
    EvaluationRecommendation,
    EvaluationSkillAssessment,
    EvaluationStatus,
    ProjectEvaluation,
    SkillAssessmentProficiency,
)
from app.models.recruiter_profile import RecruiterProfile
from app.models.skill import Skill
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole
from app.schemas.project_evaluation import (
    EvaluationSkillAssessmentResponse,
    ProjectEvaluationCreate,
    ProjectEvaluationResponse,
    ProjectEvaluationUpdate,
)
from app.services.notification_service import NotificationService


def calculate_overall_score(
    t: Optional[int],
    p: Optional[int],
    e: Optional[int],
    c: Optional[int],
    ev: Optional[int],
) -> Optional[float]:
    """
    Deterministic server-side overall score calculation.
    Returns average rounded to 2 decimal places if all 5 component scores are provided.
    """
    scores = [t, p, e, c, ev]
    if any(s is None for s in scores):
        # If any required score is missing, return partial average if some exist or None
        provided = [s for s in scores if s is not None]
        if not provided:
            return None
        return round(sum(provided) / float(len(provided)), 2)
    return round(sum(scores) / 5.0, 2)


def populate_evaluation_metadata(db: Session, evaluations: List[ProjectEvaluation]) -> None:
    """
    Attach metadata (project title, student name, recruiter company/name, skill names)
    to ProjectEvaluation instances in-memory for response serialization.
    """
    if not evaluations:
        return

    student_ids = list({e.student_id for e in evaluations})
    recruiter_ids = list({e.recruiter_id for e in evaluations})

    student_profiles = db.scalars(
        select(StudentProfile).where(StudentProfile.user_id.in_(student_ids))
    ).all()
    student_map = {sp.user_id: sp.full_name for sp in student_profiles}

    recruiter_profiles = db.scalars(
        select(RecruiterProfile).where(RecruiterProfile.user_id.in_(recruiter_ids))
    ).all()
    recruiter_map = {rp.user_id: rp for rp in recruiter_profiles}

    for ev in evaluations:
        ev.project_title = ev.project.title if ev.project else None
        ev.student_name = student_map.get(ev.student_id) or (ev.student.email if ev.student else None)

        rec_prof = recruiter_map.get(ev.recruiter_id)
        if rec_prof:
            ev.recruiter_name = rec_prof.contact_name or (ev.recruiter.email if ev.recruiter else None)
            ev.company_name = rec_prof.company_name
        else:
            ev.recruiter_name = ev.recruiter.email if ev.recruiter else None
            ev.company_name = None

        # Populate skill metadata on assessments
        if ev.skill_assessments:
            for sa in ev.skill_assessments:
                if sa.skill:
                    sa.skill_name = sa.skill.name
                    sa.skill_slug = sa.skill.slug
                    sa.skill_category = sa.skill.category


class ProjectEvaluationService:
    """
    Domain service layer managing structured Recruiter evaluations of student Innovation Projects.
    Enforces candidate relationship authorization, unique recruiter evaluation constraints,
    server-side scoring calculations, lifecycle transitions, and student notifications.
    """

    @staticmethod
    def check_recruiter_authorization(
        db: Session, recruiter_id: int, project: InnovationProject
    ) -> None:
        """
        Verify that the recruiter has a legitimate candidate/application relationship
        with the student, or that the project is an active public project.
        Private projects strictly require an application relationship with the recruiter's jobs.
        """
        # 1. Candidate Application Relationship: Student applied to a job posted by this recruiter
        has_application = db.scalar(
            select(Application.id)
            .join(Application.job_posting)
            .where(
                Application.student_id == project.student_id,
                Application.job_posting.property.mapper.class_.recruiter_id == recruiter_id,
            )
        )

        if has_application:
            return

        # 2. Public Project Discovery: Active public project can be reviewed by active recruiter
        if project.visibility == ProjectVisibility.PUBLIC and project.status == ProjectStatus.ACTIVE:
            return

        # If private and no candidate application exists, recruiter is forbidden
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Recruiter is not authorized to evaluate this candidate's project.",
        )

    @staticmethod
    def create_evaluation(
        db: Session,
        project_id: int,
        recruiter_user: User,
        payload: ProjectEvaluationCreate,
    ) -> ProjectEvaluation:
        """
        Create a new ProjectEvaluation in DRAFT status for an InnovationProject.
        Enforces recruiter role, project visibility, candidate authorization, and uniqueness.
        """
        if recruiter_user.role != UserRole.RECRUITER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only recruiters can create project evaluations.",
            )

        project = db.scalar(
            select(InnovationProject)
            .where(InnovationProject.id == project_id)
            .options(selectinload(InnovationProject.project_skills))
        )
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Innovation project not found.",
            )

        if project.student_id == recruiter_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot evaluate your own project.",
            )

        # Enforce recruiter authorization
        ProjectEvaluationService.check_recruiter_authorization(db, recruiter_user.id, project)

        # Enforce uniqueness: one evaluation per recruiter per project
        existing = db.scalar(
            select(ProjectEvaluation).where(
                ProjectEvaluation.project_id == project_id,
                ProjectEvaluation.recruiter_id == recruiter_user.id,
            )
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An evaluation for this project by this recruiter already exists.",
            )

        overall = calculate_overall_score(
            payload.technical_quality_score,
            payload.problem_solving_score,
            payload.execution_score,
            payload.communication_documentation_score,
            payload.evidence_quality_score,
        )

        evaluation = ProjectEvaluation(
            project_id=project_id,
            student_id=project.student_id,
            recruiter_id=recruiter_user.id,
            status=EvaluationStatus.DRAFT,
            technical_quality_score=payload.technical_quality_score,
            problem_solving_score=payload.problem_solving_score,
            execution_score=payload.execution_score,
            communication_documentation_score=payload.communication_documentation_score,
            evidence_quality_score=payload.evidence_quality_score,
            overall_score=overall,
            recommendation=payload.recommendation,
            strengths=payload.strengths,
            improvement_areas=payload.improvement_areas,
            feedback=payload.feedback,
        )
        db.add(evaluation)
        db.flush()

        # Handle skill assessments if supplied
        if payload.skill_assessments:
            for sa_item in payload.skill_assessments:
                # Verify skill exists
                skill = db.scalar(select(Skill).where(Skill.id == sa_item.skill_id))
                if not skill:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Skill with ID {sa_item.skill_id} not found.",
                    )
                assessment = EvaluationSkillAssessment(
                    evaluation_id=evaluation.id,
                    skill_id=sa_item.skill_id,
                    proficiency=sa_item.proficiency,
                    comments=sa_item.comments,
                )
                db.add(assessment)

        db.commit()
        db.refresh(evaluation)

        # Eagerly load relationships for response
        evaluation = db.scalar(
            select(ProjectEvaluation)
            .where(ProjectEvaluation.id == evaluation.id)
            .options(
                selectinload(ProjectEvaluation.project),
                selectinload(ProjectEvaluation.student),
                selectinload(ProjectEvaluation.recruiter),
                selectinload(ProjectEvaluation.skill_assessments).selectinload(
                    EvaluationSkillAssessment.skill
                ),
            )
        )
        populate_evaluation_metadata(db, [evaluation])
        return evaluation

    @staticmethod
    def get_evaluation_by_id(
        db: Session, evaluation_id: int, current_user: User
    ) -> ProjectEvaluation:
        """
        Retrieve a single evaluation by ID with strict visibility rules:
        - DRAFT: visible only to owning recruiter.
        - SUBMITTED / WITHDRAWN: visible to recruiter owner, project student owner, or admin.
        """
        evaluation = db.scalar(
            select(ProjectEvaluation)
            .where(ProjectEvaluation.id == evaluation_id)
            .options(
                selectinload(ProjectEvaluation.project),
                selectinload(ProjectEvaluation.student),
                selectinload(ProjectEvaluation.recruiter),
                selectinload(ProjectEvaluation.skill_assessments).selectinload(
                    EvaluationSkillAssessment.skill
                ),
            )
        )
        if not evaluation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project evaluation not found.",
            )

        is_recruiter_owner = current_user.id == evaluation.recruiter_id
        is_student_owner = current_user.id == evaluation.student_id
        is_admin = current_user.role == UserRole.ADMIN

        # Draft evaluations are strictly invisible to students and other recruiters
        if evaluation.status == EvaluationStatus.DRAFT:
            if not is_recruiter_owner:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Project evaluation not found.",
                )
        else:
            if not (is_recruiter_owner or is_student_owner or is_admin):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have permission to view this evaluation.",
                )

        populate_evaluation_metadata(db, [evaluation])
        return evaluation

    @staticmethod
    def list_project_evaluations(
        db: Session, project_id: int, current_user: User
    ) -> List[ProjectEvaluation]:
        """
        List evaluations for a given project based on viewer role:
        - Student owner: only sees SUBMITTED (and WITHDRAWN) evaluations. Never drafts.
        - Recruiter: sees their own evaluation for this project (draft or submitted).
        - Admin: sees all submitted/withdrawn evaluations.
        """
        project = db.scalar(select(InnovationProject).where(InnovationProject.id == project_id))
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Innovation project not found.",
            )

        is_student_owner = current_user.id == project.student_id
        is_recruiter = current_user.role == UserRole.RECRUITER
        is_admin = current_user.role == UserRole.ADMIN

        stmt = (
            select(ProjectEvaluation)
            .where(ProjectEvaluation.project_id == project_id)
            .options(
                selectinload(ProjectEvaluation.project),
                selectinload(ProjectEvaluation.student),
                selectinload(ProjectEvaluation.recruiter),
                selectinload(ProjectEvaluation.skill_assessments).selectinload(
                    EvaluationSkillAssessment.skill
                ),
            )
            .order_by(ProjectEvaluation.created_at.desc())
        )

        if is_student_owner:
            # Student only sees submitted evaluations
            stmt = stmt.where(ProjectEvaluation.status.in_([EvaluationStatus.SUBMITTED, EvaluationStatus.WITHDRAWN]))
        elif is_recruiter:
            # Recruiter only sees their own evaluation
            stmt = stmt.where(ProjectEvaluation.recruiter_id == current_user.id)
        elif is_admin:
            # Admin sees all submitted or withdrawn evaluations
            stmt = stmt.where(ProjectEvaluation.status.in_([EvaluationStatus.SUBMITTED, EvaluationStatus.WITHDRAWN]))
        else:
            # Other students/guests cannot view project evaluations
            return []

        evaluations = list(db.scalars(stmt).all())
        populate_evaluation_metadata(db, evaluations)
        return evaluations

    @staticmethod
    def update_evaluation(
        db: Session,
        evaluation_id: int,
        recruiter_user: User,
        payload: ProjectEvaluationUpdate,
    ) -> ProjectEvaluation:
        """
        Update a project evaluation. Only the owning recruiter can update their own DRAFT.
        Submitted or withdrawn evaluations cannot be modified.
        """
        evaluation = db.scalar(
            select(ProjectEvaluation)
            .where(ProjectEvaluation.id == evaluation_id)
            .options(
                selectinload(ProjectEvaluation.project),
                selectinload(ProjectEvaluation.student),
                selectinload(ProjectEvaluation.recruiter),
                selectinload(ProjectEvaluation.skill_assessments).selectinload(
                    EvaluationSkillAssessment.skill
                ),
            )
        )
        if not evaluation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project evaluation not found.",
            )

        if evaluation.recruiter_id != recruiter_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update your own evaluation.",
            )

        if evaluation.status != EvaluationStatus.DRAFT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot modify an evaluation that has already been submitted or withdrawn.",
            )

        update_data = payload.model_dump(exclude_unset=True)
        skill_assessments_data = update_data.pop("skill_assessments", None)

        for field, value in update_data.items():
            setattr(evaluation, field, value)

        # Recalculate overall score
        evaluation.overall_score = calculate_overall_score(
            evaluation.technical_quality_score,
            evaluation.problem_solving_score,
            evaluation.execution_score,
            evaluation.communication_documentation_score,
            evaluation.evidence_quality_score,
        )

        # Handle skill assessments update
        if skill_assessments_data is not None:
            # Remove old assessments
            evaluation.skill_assessments.clear()
            db.flush()
            for sa_item in skill_assessments_data:
                skill = db.scalar(select(Skill).where(Skill.id == sa_item["skill_id"]))
                if not skill:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Skill with ID {sa_item['skill_id']} not found.",
                    )
                new_sa = EvaluationSkillAssessment(
                    evaluation_id=evaluation.id,
                    skill_id=sa_item["skill_id"],
                    proficiency=sa_item.get("proficiency", SkillAssessmentProficiency.NOT_OBSERVED),
                    comments=sa_item.get("comments"),
                )
                db.add(new_sa)

        db.commit()
        db.refresh(evaluation)
        populate_evaluation_metadata(db, [evaluation])
        return evaluation

    @staticmethod
    def submit_evaluation(
        db: Session, evaluation_id: int, recruiter_user: User
    ) -> ProjectEvaluation:
        """
        Submit a DRAFT evaluation.
        Validates that all 5 dimensional scores and a recommendation are provided.
        Calculates final overall score, transitions status to SUBMITTED,
        and generates an in-app notification for the student.
        """
        evaluation = db.scalar(
            select(ProjectEvaluation)
            .where(ProjectEvaluation.id == evaluation_id)
            .options(
                selectinload(ProjectEvaluation.project),
                selectinload(ProjectEvaluation.student),
                selectinload(ProjectEvaluation.recruiter),
                selectinload(ProjectEvaluation.skill_assessments).selectinload(
                    EvaluationSkillAssessment.skill
                ),
            )
        )
        if not evaluation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project evaluation not found.",
            )

        if evaluation.recruiter_id != recruiter_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only submit your own evaluation.",
            )

        if evaluation.status != EvaluationStatus.DRAFT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Evaluation is already submitted or withdrawn.",
            )

        # Validation: All 5 scoring dimensions are required for submission
        required_scores = [
            evaluation.technical_quality_score,
            evaluation.problem_solving_score,
            evaluation.execution_score,
            evaluation.communication_documentation_score,
            evaluation.evidence_quality_score,
        ]
        if any(s is None for s in required_scores):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="All 5 scoring dimensions (1 to 5) are required to submit an evaluation.",
            )

        # Validation: Recommendation is required
        if not evaluation.recommendation:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A recommendation is required to submit an evaluation.",
            )

        # Calculate final overall score
        evaluation.overall_score = calculate_overall_score(
            evaluation.technical_quality_score,
            evaluation.problem_solving_score,
            evaluation.execution_score,
            evaluation.communication_documentation_score,
            evaluation.evidence_quality_score,
        )
        evaluation.status = EvaluationStatus.SUBMITTED
        evaluation.submitted_at = datetime.now(timezone.utc)

        # Generate in-app notification for the student
        rec_profile = db.scalar(
            select(RecruiterProfile).where(RecruiterProfile.user_id == recruiter_user.id)
        )
        recruiter_display = (
            rec_profile.company_name
            if (rec_profile and rec_profile.company_name)
            else (rec_profile.contact_name if rec_profile else recruiter_user.email)
        )
        project_title = evaluation.project.title if evaluation.project else "your project"

        NotificationService.create_notification(
            db,
            user_id=evaluation.student_id,
            notification_type=NotificationType.PROJECT_EVALUATION_SUBMITTED,
            title="Project Evaluated",
            message=f"{recruiter_display} submitted a structured evaluation for your project '{project_title}'.",
            commit=False,
        )

        db.commit()
        db.refresh(evaluation)
        populate_evaluation_metadata(db, [evaluation])
        return evaluation

    @staticmethod
    def withdraw_evaluation(
        db: Session, evaluation_id: int, current_user: User
    ) -> ProjectEvaluation:
        """
        Withdraw an evaluation. Allowed only for the owning recruiter or an admin.
        """
        evaluation = db.scalar(
            select(ProjectEvaluation)
            .where(ProjectEvaluation.id == evaluation_id)
            .options(
                selectinload(ProjectEvaluation.project),
                selectinload(ProjectEvaluation.student),
                selectinload(ProjectEvaluation.recruiter),
                selectinload(ProjectEvaluation.skill_assessments).selectinload(
                    EvaluationSkillAssessment.skill
                ),
            )
        )
        if not evaluation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project evaluation not found.",
            )

        is_owner = current_user.id == evaluation.recruiter_id
        is_admin = current_user.role == UserRole.ADMIN

        if not (is_owner or is_admin):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to withdraw this evaluation.",
            )

        if evaluation.status == EvaluationStatus.WITHDRAWN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Evaluation is already withdrawn.",
            )

        evaluation.status = EvaluationStatus.WITHDRAWN
        db.commit()
        db.refresh(evaluation)
        populate_evaluation_metadata(db, [evaluation])
        return evaluation
