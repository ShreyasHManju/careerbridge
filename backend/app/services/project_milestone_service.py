from datetime import datetime, timezone
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.innovation_project import InnovationProject, ProjectVisibility
from app.models.project_milestone import MilestoneStatus, ProjectMilestone
from app.models.user import User, UserRole
from app.schemas.project_milestone import (
    ProjectMilestoneCreate,
    ProjectMilestoneListResponse,
    ProjectMilestoneResponse,
    ProjectMilestoneUpdate,
)


class ProjectMilestoneService:
    @staticmethod
    def create_milestone(
        db: Session,
        project_id: int,
        student_id: int,
        payload: ProjectMilestoneCreate,
    ) -> ProjectMilestone:
        """
        Create a new milestone under an innovation project.
        Enforces student ownership of the parent project.
        """
        project = db.scalar(
            select(InnovationProject).where(InnovationProject.id == project_id)
        )
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Innovation project not found",
            )

        if project.student_id != student_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to add milestones to this project",
            )

        data = payload.model_dump()
        milestone_status = data.get("status", MilestoneStatus.TODO)
        completed_at = None
        if milestone_status == MilestoneStatus.COMPLETED or milestone_status == "completed":
            completed_at = datetime.now(timezone.utc)

        milestone = ProjectMilestone(
            innovation_project_id=project_id,
            completed_at=completed_at,
            **data,
        )
        db.add(milestone)
        db.commit()
        db.refresh(milestone)
        return milestone

    @staticmethod
    def list_milestones(
        db: Session,
        project_id: int,
        current_user: Optional[User] = None,
    ) -> ProjectMilestoneListResponse:
        """
        Retrieve all milestones for a project in display order.
        Respects project visibility guards (private projects return 404 to unauthorized viewers).
        """
        project = db.scalar(
            select(InnovationProject).where(InnovationProject.id == project_id)
        )
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Innovation project not found",
            )

        # Visibility Guard: private projects are strictly invisible to non-owners (unless admin)
        if project.visibility == ProjectVisibility.PRIVATE:
            is_owner = current_user is not None and current_user.id == project.student_id
            is_admin = current_user is not None and current_user.role == UserRole.ADMIN
            if not (is_owner or is_admin):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Innovation project not found",
                )

        stmt = (
            select(ProjectMilestone)
            .where(ProjectMilestone.innovation_project_id == project_id)
            .order_by(ProjectMilestone.display_order.asc(), ProjectMilestone.id.asc())
        )
        milestones = list(db.scalars(stmt).all())

        total = len(milestones)
        completed = sum(
            1
            for m in milestones
            if (hasattr(m.status, "value") and m.status.value == "completed") or m.status == "completed"
        )
        progress_percentage = round((completed / total) * 100) if total > 0 else 0

        return ProjectMilestoneListResponse(
            items=[ProjectMilestoneResponse.model_validate(m) for m in milestones],
            total=total,
            completed=completed,
            progress_percentage=progress_percentage,
        )

    @staticmethod
    def update_milestone(
        db: Session,
        project_id: int,
        milestone_id: int,
        student_id: int,
        payload: ProjectMilestoneUpdate,
    ) -> ProjectMilestone:
        """
        Update an existing milestone.
        Enforces ownership of the parent project and verifies project-milestone relationship.
        Handles completed_at status transitions.
        """
        project = db.scalar(
            select(InnovationProject).where(InnovationProject.id == project_id)
        )
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Innovation project not found",
            )

        if project.student_id != student_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to modify milestones on this project",
            )

        milestone = db.scalar(
            select(ProjectMilestone).where(
                ProjectMilestone.id == milestone_id,
                ProjectMilestone.innovation_project_id == project_id,
            )
        )
        if not milestone:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project milestone not found",
            )

        data = payload.model_dump(exclude_unset=True)
        # Prevent mutating immutable identifiers
        data.pop("id", None)
        data.pop("innovation_project_id", None)

        if "status" in data:
            new_status = data["status"]
            old_status = milestone.status
            new_val = new_status.value if hasattr(new_status, "value") else new_status
            old_val = old_status.value if hasattr(old_status, "value") else old_status

            if new_val == "completed" and old_val != "completed":
                milestone.completed_at = datetime.now(timezone.utc)
            elif new_val in ("todo", "in_progress") and old_val == "completed":
                milestone.completed_at = None
            # If status unchanged or transition between todo <-> in_progress, completed_at is left as-is

        for field, value in data.items():
            setattr(milestone, field, value)

        db.commit()
        db.refresh(milestone)
        return milestone

    @staticmethod
    def delete_milestone(
        db: Session,
        project_id: int,
        milestone_id: int,
        student_id: int,
    ) -> None:
        """
        Permanently delete a milestone.
        Enforces ownership of the parent project and verifies project-milestone relationship.
        """
        project = db.scalar(
            select(InnovationProject).where(InnovationProject.id == project_id)
        )
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Innovation project not found",
            )

        if project.student_id != student_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to delete milestones on this project",
            )

        milestone = db.scalar(
            select(ProjectMilestone).where(
                ProjectMilestone.id == milestone_id,
                ProjectMilestone.innovation_project_id == project_id,
            )
        )
        if not milestone:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project milestone not found",
            )

        db.delete(milestone)
        db.commit()
