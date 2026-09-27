from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.innovation_project import InnovationProject, ProjectVisibility
from app.models.project_evidence import ProjectEvidence
from app.models.project_milestone import ProjectMilestone
from app.models.user import User, UserRole
from app.schemas.project_evidence import (
    ProjectEvidenceCreate,
    ProjectEvidenceListResponse,
    ProjectEvidenceResponse,
    ProjectEvidenceUpdate,
)


class ProjectEvidenceService:
    """
    Business logic and access control for Student Project Evidence artifacts.
    Enforces strict ownership, milestone consistency, and privacy boundaries.
    """

    @staticmethod
    def create_evidence(
        db: Session,
        project_id: int,
        student_id: int,
        payload: ProjectEvidenceCreate,
    ) -> ProjectEvidence:
        project = db.get(InnovationProject, project_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Innovation project not found",
            )

        if project.student_id != student_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to attach evidence to this project",
            )

        if payload.milestone_id is not None:
            milestone = db.get(ProjectMilestone, payload.milestone_id)
            if not milestone or milestone.innovation_project_id != project_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="The specified milestone does not belong to this project",
                )

        evidence = ProjectEvidence(
            innovation_project_id=project_id,
            milestone_id=payload.milestone_id,
            title=payload.title,
            description=payload.description,
            evidence_type=payload.evidence_type,
            url=payload.url,
        )

        db.add(evidence)
        db.commit()
        db.refresh(evidence)
        return evidence

    @staticmethod
    def list_project_evidence(
        db: Session,
        project_id: int,
        current_user: User,
        milestone_id: Optional[int] = None,
    ) -> ProjectEvidenceListResponse:
        project = db.get(InnovationProject, project_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Innovation project not found",
            )

        # Privacy guard: private projects can only be viewed by owner or admin
        if project.visibility == ProjectVisibility.PRIVATE:
            if current_user.role != UserRole.ADMIN and project.student_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Innovation project not found",
                )

        stmt = select(ProjectEvidence).where(ProjectEvidence.innovation_project_id == project_id)
        if milestone_id is not None:
            stmt = stmt.where(ProjectEvidence.milestone_id == milestone_id)
        stmt = stmt.order_by(ProjectEvidence.created_at.asc())

        items = list(db.scalars(stmt).all())
        return ProjectEvidenceListResponse(
            project_id=project_id,
            total_count=len(items),
            items=[ProjectEvidenceResponse.model_validate(item) for item in items],
        )

    @staticmethod
    def get_evidence(
        db: Session,
        project_id: int,
        evidence_id: int,
        current_user: User,
    ) -> ProjectEvidence:
        project = db.get(InnovationProject, project_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Innovation project not found",
            )

        if project.visibility == ProjectVisibility.PRIVATE:
            if current_user.role != UserRole.ADMIN and project.student_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Innovation project not found",
                )

        evidence = db.scalar(
            select(ProjectEvidence).where(
                ProjectEvidence.id == evidence_id,
                ProjectEvidence.innovation_project_id == project_id,
            )
        )
        if not evidence:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project evidence not found",
            )
        return evidence

    @staticmethod
    def update_evidence(
        db: Session,
        project_id: int,
        evidence_id: int,
        student_id: int,
        payload: ProjectEvidenceUpdate,
    ) -> ProjectEvidence:
        project = db.get(InnovationProject, project_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Innovation project not found",
            )

        if project.student_id != student_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to update evidence on this project",
            )

        evidence = db.scalar(
            select(ProjectEvidence).where(
                ProjectEvidence.id == evidence_id,
                ProjectEvidence.innovation_project_id == project_id,
            )
        )
        if not evidence:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project evidence not found",
            )

        update_data = payload.model_dump(exclude_unset=True)
        if "milestone_id" in update_data and update_data["milestone_id"] is not None:
            milestone = db.get(ProjectMilestone, update_data["milestone_id"])
            if not milestone or milestone.innovation_project_id != project_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="The specified milestone does not belong to this project",
                )

        for key, value in update_data.items():
            setattr(evidence, key, value)

        db.commit()
        db.refresh(evidence)
        return evidence

    @staticmethod
    def delete_evidence(
        db: Session,
        project_id: int,
        evidence_id: int,
        student_id: int,
    ) -> None:
        project = db.get(InnovationProject, project_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Innovation project not found",
            )

        if project.student_id != student_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to delete evidence from this project",
            )

        evidence = db.scalar(
            select(ProjectEvidence).where(
                ProjectEvidence.id == evidence_id,
                ProjectEvidence.innovation_project_id == project_id,
            )
        )
        if not evidence:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project evidence not found",
            )

        db.delete(evidence)
        db.commit()
