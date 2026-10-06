from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.application import Application
from app.models.candidate_evaluation import (
    CandidateEvaluation,
    CandidateEvaluationStatus,
    CandidateRecommendation,
)
from app.models.interview import Interview
from app.models.job_posting import JobPosting
from app.models.recruiter_profile import RecruiterProfile
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole
from app.schemas.candidate_evaluation import (
    CandidateEvaluationCreate,
    CandidateEvaluationUpdate,
)


def calculate_candidate_overall_score(
    t: Optional[int],
    p: Optional[int],
    c: Optional[int],
    r: Optional[int],
) -> Optional[float]:
    """
    Deterministic server-side overall score calculation.
    Returns average of all provided scores rounded to 2 decimal places.
    """
    scores = [t, p, c, r]
    provided = [s for s in scores if s is not None]
    if not provided:
        return None
    return round(sum(provided) / float(len(provided)), 2)


def populate_candidate_evaluation_metadata(
    db: Session, evaluations: List[CandidateEvaluation]
) -> None:
    """
    Attach metadata (job title, student name/email, recruiter company/name)
    to CandidateEvaluation instances in-memory for response serialization.
    """
    if not evaluations:
        return

    app_ids = list({e.application_id for e in evaluations})
    applications = db.scalars(
        select(Application)
        .options(
            joinedload(Application.job_posting),
            joinedload(Application.student),
        )
        .where(Application.id.in_(app_ids))
    ).all()
    app_map = {a.id: a for a in applications}

    student_ids = list({a.student_id for a in applications})
    student_profiles = db.scalars(
        select(StudentProfile).where(StudentProfile.user_id.in_(student_ids))
    ).all()
    student_map = {sp.user_id: sp.full_name for sp in student_profiles}

    recruiter_ids = list({e.recruiter_id for e in evaluations})
    recruiter_profiles = db.scalars(
        select(RecruiterProfile).where(RecruiterProfile.user_id.in_(recruiter_ids))
    ).all()
    recruiter_map = {rp.user_id: rp for rp in recruiter_profiles}

    for ev in evaluations:
        app = app_map.get(ev.application_id)
        if app:
            ev.student_id = app.student_id
            ev.student_name = student_map.get(app.student_id) or (
                app.student.email if app.student else None
            )
            ev.student_email = app.student.email if app.student else None

            if app.job_posting:
                ev.job_id = app.job_posting.id
                ev.job_title = app.job_posting.title

        rec_prof = recruiter_map.get(ev.recruiter_id)
        if rec_prof:
            ev.recruiter_name = rec_prof.contact_name or (
                ev.recruiter.email if ev.recruiter else None
            )
            ev.company_name = rec_prof.company_name
        else:
            ev.recruiter_name = ev.recruiter.email if ev.recruiter else None
            ev.company_name = None


class CandidateEvaluationService:
    """
    Domain service layer managing structured Recruiter candidate evaluations and scorecards.
    Enforces recruiter ownership, scoring validation, lifecycle rules, and candidate privacy boundaries.
    """

    @staticmethod
    def create_evaluation(
        db: Session,
        application_id: int,
        recruiter_user: User,
        payload: CandidateEvaluationCreate,
    ) -> CandidateEvaluation:
        """
        Create a new CandidateEvaluation for a candidate application.
        Validates:
        - Recruiter role (403)
        - Application exists (404)
        - Recruiter owns the associated job posting (403)
        - Interview belongs to this application if interview_id is provided (400)
        - Unique evaluation per interview or application (409)
        - 1-5 score boundaries & overall score computation
        - Submission constraints if is_submitted is True
        """
        if recruiter_user.role != UserRole.RECRUITER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only recruiters can create candidate evaluations.",
            )

        application = db.scalar(
            select(Application)
            .options(
                joinedload(Application.job_posting),
                joinedload(Application.student),
            )
            .where(Application.id == application_id)
        )
        if not application:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application not found",
            )

        if application.job_posting.recruiter_id != recruiter_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to evaluate candidates for this job posting",
            )

        # Validate interview_id if provided
        if payload.interview_id is not None:
            interview = db.scalar(
                select(Interview).where(Interview.id == payload.interview_id)
            )
            if not interview:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Interview not found",
                )
            if interview.application_id != application_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Interview does not belong to the specified application",
                )

            # Prevent duplicate evaluation for the same interview
            existing_interview_eval = db.scalar(
                select(CandidateEvaluation).where(
                    CandidateEvaluation.interview_id == payload.interview_id,
                    CandidateEvaluation.recruiter_id == recruiter_user.id,
                )
            )
            if existing_interview_eval:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An evaluation already exists for this interview round",
                )
        else:
            # Prevent duplicate application-level evaluation without interview_id
            existing_app_eval = db.scalar(
                select(CandidateEvaluation).where(
                    CandidateEvaluation.application_id == application_id,
                    CandidateEvaluation.interview_id.is_(None),
                    CandidateEvaluation.recruiter_id == recruiter_user.id,
                )
            )
            if existing_app_eval:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An application-level evaluation already exists for this candidate",
                )

        # Submission validation
        if payload.is_submitted:
            if any(
                s is None
                for s in (
                    payload.technical_score,
                    payload.problem_solving_score,
                    payload.communication_score,
                    payload.role_fit_score,
                )
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="All four dimension scores (technical, problem solving, communication, role fit) are required for submission.",
                )
            if payload.recommendation is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Recommendation is required for submission.",
                )
            eval_status = CandidateEvaluationStatus.SUBMITTED
            submitted_at = datetime.now(timezone.utc)
        else:
            eval_status = CandidateEvaluationStatus.DRAFT
            submitted_at = None

        overall_score = calculate_candidate_overall_score(
            payload.technical_score,
            payload.problem_solving_score,
            payload.communication_score,
            payload.role_fit_score,
        )

        evaluation = CandidateEvaluation(
            application_id=application_id,
            interview_id=payload.interview_id,
            recruiter_id=recruiter_user.id,
            status=eval_status,
            technical_score=payload.technical_score,
            problem_solving_score=payload.problem_solving_score,
            communication_score=payload.communication_score,
            role_fit_score=payload.role_fit_score,
            overall_score=overall_score,
            recommendation=payload.recommendation,
            strengths=payload.strengths,
            areas_for_growth=payload.areas_for_growth,
            summary_notes=payload.summary_notes,
            submitted_at=submitted_at,
        )
        db.add(evaluation)
        db.commit()
        db.refresh(evaluation)

        populate_candidate_evaluation_metadata(db, [evaluation])
        return evaluation

    @staticmethod
    def update_evaluation(
        db: Session,
        evaluation_id: int,
        recruiter_user: User,
        payload: CandidateEvaluationUpdate,
    ) -> CandidateEvaluation:
        """
        Update an existing CandidateEvaluation draft.
        Finalized (SUBMITTED) evaluations cannot be modified.
        """
        if recruiter_user.role != UserRole.RECRUITER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only recruiters can update candidate evaluations.",
            )

        evaluation = db.scalar(
            select(CandidateEvaluation)
            .options(
                joinedload(CandidateEvaluation.application).joinedload(
                    Application.job_posting
                )
            )
            .where(CandidateEvaluation.id == evaluation_id)
        )
        if not evaluation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Candidate evaluation not found",
            )

        if (
            evaluation.recruiter_id != recruiter_user.id
            or evaluation.application.job_posting.recruiter_id != recruiter_user.id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this candidate evaluation",
            )

        if evaluation.status == CandidateEvaluationStatus.SUBMITTED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Submitted candidate evaluations are finalized and cannot be modified.",
            )

        # Update interview_id if requested
        if payload.interview_id is not None and payload.interview_id != evaluation.interview_id:
            interview = db.scalar(
                select(Interview).where(Interview.id == payload.interview_id)
            )
            if not interview:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Interview not found",
                )
            if interview.application_id != evaluation.application_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Interview does not belong to the specified application",
                )
            # Check duplicate on new interview
            existing_interview_eval = db.scalar(
                select(CandidateEvaluation).where(
                    CandidateEvaluation.interview_id == payload.interview_id,
                    CandidateEvaluation.recruiter_id == recruiter_user.id,
                    CandidateEvaluation.id != evaluation_id,
                )
            )
            if existing_interview_eval:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An evaluation already exists for this interview round",
                )
            evaluation.interview_id = payload.interview_id

        # Update scores and notes
        if payload.technical_score is not None:
            evaluation.technical_score = payload.technical_score
        if payload.problem_solving_score is not None:
            evaluation.problem_solving_score = payload.problem_solving_score
        if payload.communication_score is not None:
            evaluation.communication_score = payload.communication_score
        if payload.role_fit_score is not None:
            evaluation.role_fit_score = payload.role_fit_score
        if payload.recommendation is not None:
            evaluation.recommendation = payload.recommendation
        if payload.strengths is not None:
            evaluation.strengths = payload.strengths
        if payload.areas_for_growth is not None:
            evaluation.areas_for_growth = payload.areas_for_growth
        if payload.summary_notes is not None:
            evaluation.summary_notes = payload.summary_notes

        evaluation.overall_score = calculate_candidate_overall_score(
            evaluation.technical_score,
            evaluation.problem_solving_score,
            evaluation.communication_score,
            evaluation.role_fit_score,
        )

        # Finalize submission if is_submitted is True
        if payload.is_submitted is True:
            if any(
                s is None
                for s in (
                    evaluation.technical_score,
                    evaluation.problem_solving_score,
                    evaluation.communication_score,
                    evaluation.role_fit_score,
                )
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="All four dimension scores (technical, problem solving, communication, role fit) are required for submission.",
                )
            if evaluation.recommendation is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Recommendation is required for submission.",
                )
            evaluation.status = CandidateEvaluationStatus.SUBMITTED
            evaluation.submitted_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(evaluation)

        populate_candidate_evaluation_metadata(db, [evaluation])
        return evaluation

    @staticmethod
    def submit_evaluation(
        db: Session,
        evaluation_id: int,
        recruiter_user: User,
    ) -> CandidateEvaluation:
        """
        Finalize and submit a draft CandidateEvaluation.
        """
        if recruiter_user.role != UserRole.RECRUITER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only recruiters can submit candidate evaluations.",
            )

        evaluation = db.scalar(
            select(CandidateEvaluation)
            .options(
                joinedload(CandidateEvaluation.application).joinedload(
                    Application.job_posting
                )
            )
            .where(CandidateEvaluation.id == evaluation_id)
        )
        if not evaluation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Candidate evaluation not found",
            )

        if (
            evaluation.recruiter_id != recruiter_user.id
            or evaluation.application.job_posting.recruiter_id != recruiter_user.id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to submit this candidate evaluation",
            )

        if evaluation.status == CandidateEvaluationStatus.SUBMITTED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Candidate evaluation is already submitted and finalized.",
            )

        if any(
            s is None
            for s in (
                evaluation.technical_score,
                evaluation.problem_solving_score,
                evaluation.communication_score,
                evaluation.role_fit_score,
            )
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="All four dimension scores (technical, problem solving, communication, role fit) are required for submission.",
            )
        if evaluation.recommendation is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Recommendation is required for submission.",
            )

        evaluation.status = CandidateEvaluationStatus.SUBMITTED
        evaluation.submitted_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(evaluation)

        populate_candidate_evaluation_metadata(db, [evaluation])
        return evaluation

    @staticmethod
    def get_evaluation_by_id(
        db: Session,
        evaluation_id: int,
        current_user: User,
    ) -> CandidateEvaluation:
        """
        Retrieve a single candidate evaluation with strict authorization checks.
        Students receive 403 (candidate scorecards are private recruiter assessments).
        Cross-recruiter access receives 403.
        """
        if current_user.role == UserRole.STUDENT:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Candidate evaluations are internal recruiter assessment records.",
            )

        evaluation = db.scalar(
            select(CandidateEvaluation)
            .options(
                joinedload(CandidateEvaluation.application).joinedload(
                    Application.job_posting
                )
            )
            .where(CandidateEvaluation.id == evaluation_id)
        )
        if not evaluation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Candidate evaluation not found",
            )

        if current_user.role == UserRole.RECRUITER:
            if (
                evaluation.recruiter_id != current_user.id
                and evaluation.application.job_posting.recruiter_id != current_user.id
            ):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to view this candidate evaluation",
                )

        populate_candidate_evaluation_metadata(db, [evaluation])
        return evaluation

    @staticmethod
    def list_application_evaluations(
        db: Session,
        application_id: int,
        current_user: User,
    ) -> List[CandidateEvaluation]:
        """
        Retrieve all candidate evaluations for a specific application.
        Students receive 403.
        Cross-recruiter access receives 403.
        """
        if current_user.role == UserRole.STUDENT:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Candidate evaluations are internal recruiter assessment records.",
            )

        application = db.scalar(
            select(Application)
            .options(joinedload(Application.job_posting))
            .where(Application.id == application_id)
        )
        if not application:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application not found",
            )

        if current_user.role == UserRole.RECRUITER:
            if application.job_posting.recruiter_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to view evaluations for this application",
                )

        evaluations = db.scalars(
            select(CandidateEvaluation)
            .where(CandidateEvaluation.application_id == application_id)
            .order_by(CandidateEvaluation.created_at.desc())
        ).all()

        populate_candidate_evaluation_metadata(db, evaluations)
        return list(evaluations)

    @staticmethod
    def list_recruiter_evaluations(
        db: Session,
        recruiter_user: User,
    ) -> List[CandidateEvaluation]:
        """
        List all evaluations submitted or drafted by the authenticated recruiter.
        """
        if recruiter_user.role != UserRole.RECRUITER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only recruiters can access candidate evaluations.",
            )

        evaluations = db.scalars(
            select(CandidateEvaluation)
            .where(CandidateEvaluation.recruiter_id == recruiter_user.id)
            .order_by(CandidateEvaluation.created_at.desc())
        ).all()

        populate_candidate_evaluation_metadata(db, evaluations)
        return list(evaluations)
