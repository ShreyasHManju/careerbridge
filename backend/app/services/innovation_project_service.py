import math
import re
import uuid
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.innovation_project import (
    InnovationProject,
    ProjectSkill,
    ProjectStatus,
    ProjectType,
    ProjectVisibility,
)
from app.models.student_profile import StudentProfile
from app.models.user import User, UserRole
from app.schemas.innovation_project import InnovationProjectCreate, InnovationProjectUpdate
from app.services.skill_service import sync_project_skills_from_text


def generate_project_slug(title: str, db: Session) -> str:
    """
    Generate a normalized, deterministic URL-safe slug for a project.
    If a slug collision occurs, appends a short unique hex suffix.
    """
    if not title or not title.strip():
        base = "project"
    else:
        base = title.strip().lower()
        base = re.sub(r"[^a-z0-9]+", "-", base).strip("-")
        base = base or "project"

    candidate = base[:150]
    existing = db.scalar(select(InnovationProject.id).where(InnovationProject.slug == candidate))
    if not existing:
        return candidate

    suffix = uuid.uuid4().hex[:6]
    return f"{base[:140]}-{suffix}"


def populate_owner_names(db: Session, projects: List[InnovationProject]) -> None:
    """
    Attach owner_name from student_profile or user email to projects in-memory for response.
    """
    if not projects:
        return
    student_ids = list({p.student_id for p in projects})
    profiles = db.scalars(
        select(StudentProfile).where(StudentProfile.user_id.in_(student_ids))
    ).all()
    profile_map = {p.user_id: p.full_name for p in profiles}

    for p in projects:
        if p.student_id in profile_map:
            p.owner_name = profile_map[p.student_id]
        else:
            p.owner_name = None


class InnovationProjectService:
    @staticmethod
    def create_project(
        db: Session,
        student_id: int,
        payload: InnovationProjectCreate,
    ) -> InnovationProject:
        """
        Create a new InnovationProject owned by the authenticated student.
        """
        data = payload.model_dump()
        raw_skills = data.pop("skills", None)
        slug = generate_project_slug(payload.title, db)

        project = InnovationProject(
            student_id=student_id,
            slug=slug,
            **data,
        )
        db.add(project)
        db.flush()

        sync_project_skills_from_text(db, project, raw_skills)
        db.commit()
        db.refresh(project)

        # Populate owner name
        populate_owner_names(db, [project])
        return project

    @staticmethod
    def get_project_by_id(
        db: Session,
        project_id: int,
        current_user: Optional[User] = None,
    ) -> Optional[InnovationProject]:
        """
        Retrieve project by ID with visibility and ownership security checks.
        Returns None if private project is accessed by unauthorized user.
        """
        project = db.scalar(
            select(InnovationProject)
            .options(
                selectinload(InnovationProject.project_skills).joinedload(ProjectSkill.skill),
                selectinload(InnovationProject.milestones),
            )
            .where(InnovationProject.id == project_id)
        )
        if not project:
            return None

        # Visibility Guard: private projects are strictly invisible to non-owners (unless admin)
        if project.visibility == ProjectVisibility.PRIVATE:
            is_owner = current_user is not None and current_user.id == project.student_id
            is_admin = current_user is not None and current_user.role == UserRole.ADMIN
            if not (is_owner or is_admin):
                return None

        populate_owner_names(db, [project])
        return project

    @staticmethod
    def list_student_projects(
        db: Session,
        student_id: int,
        status_filter: Optional[ProjectStatus] = None,
    ) -> List[InnovationProject]:
        """
        Retrieve all projects created by a specific student, newest first.
        """
        stmt = (
            select(InnovationProject)
            .options(
                selectinload(InnovationProject.project_skills).joinedload(ProjectSkill.skill),
                selectinload(InnovationProject.milestones),
            )
            .where(InnovationProject.student_id == student_id)
        )
        if status_filter is not None:
            stmt = stmt.where(InnovationProject.status == status_filter)

        stmt = stmt.order_by(InnovationProject.created_at.desc())
        projects = list(db.scalars(stmt).all())
        populate_owner_names(db, projects)
        return projects

    @staticmethod
    def list_public_projects(
        db: Session,
        q: Optional[str] = None,
        project_type: Optional[ProjectType] = None,
        skill: Optional[str] = None,
        page: int = 1,
        page_size: int = 10,
    ) -> Tuple[List[InnovationProject], int, int]:
        """
        Candidate project discovery: Returns active, public projects matching filters.
        """
        filters = [
            InnovationProject.visibility == ProjectVisibility.PUBLIC,
            InnovationProject.status == ProjectStatus.ACTIVE,
        ]

        if q and q.strip():
            term = f"%{q.strip()}%"
            filters.append(
                or_(
                    InnovationProject.title.ilike(term),
                    InnovationProject.short_description.ilike(term),
                    InnovationProject.description.ilike(term),
                    InnovationProject.skills.ilike(term),
                )
            )

        if project_type is not None:
            filters.append(InnovationProject.project_type == project_type)

        if skill and skill.strip():
            filters.append(InnovationProject.skills.ilike(f"%{skill.strip()}%"))

        total = db.scalar(select(func.count(InnovationProject.id)).where(*filters)) or 0
        total_pages = math.ceil(total / page_size) if total > 0 else 0
        offset = (page - 1) * page_size

        stmt = (
            select(InnovationProject)
            .options(
                selectinload(InnovationProject.project_skills).joinedload(ProjectSkill.skill),
                selectinload(InnovationProject.milestones),
            )
            .where(*filters)
            .order_by(InnovationProject.created_at.desc(), InnovationProject.id.desc())
            .offset(offset)
            .limit(page_size)
        )
        projects = list(db.scalars(stmt).all())
        populate_owner_names(db, projects)
        return projects, total, total_pages

    @staticmethod
    def update_project(
        db: Session,
        project_id: int,
        student_id: int,
        payload: InnovationProjectUpdate,
    ) -> InnovationProject:
        """
        Update an innovation project owned by student_id.
        """
        project = db.scalar(
            select(InnovationProject)
            .options(selectinload(InnovationProject.project_skills).joinedload(ProjectSkill.skill))
            .where(InnovationProject.id == project_id)
        )
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Innovation project not found",
            )

        if project.student_id != student_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to modify this project",
            )

        data = payload.model_dump(exclude_unset=True)
        # Prevent mutating immutable identifiers
        data.pop("student_id", None)
        data.pop("id", None)
        data.pop("slug", None)

        has_skills_update = "skills" in payload.model_fields_set
        raw_skills = data.pop("skills", None)

        # Update title and slug if changed
        if "title" in data and data["title"] != project.title:
            project.slug = generate_project_slug(data["title"], db)

        for field, value in data.items():
            setattr(project, field, value)

        if has_skills_update:
            sync_project_skills_from_text(db, project, raw_skills)

        db.commit()
        db.refresh(project)
        populate_owner_names(db, [project])
        return project

    @staticmethod
    def delete_project(
        db: Session,
        project_id: int,
        student_id: int,
    ) -> None:
        """
        Permanently delete an innovation project owned by student_id.
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
                detail="Not enough permissions to delete this project",
            )

        db.delete(project)
        db.commit()
