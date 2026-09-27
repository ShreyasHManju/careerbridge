from datetime import datetime, timezone
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.innovation_project import InnovationProject, ProjectVisibility
from app.models.project_evidence import ProjectEvidence
from app.models.project_evidence_verification import EvidenceVerification, EvidenceVerificationStatus
from app.models.user import User, UserRole
from app.schemas.project_evidence_verification import (
    EvidenceVerificationCreate,
    EvidenceVerificationResponse,
    EvidenceVerificationUpdate,
)


class ProjectEvidenceVerificationService:
    """
    Business logic and administrative authority for Project Evidence Verification.
    Enforces strict RBAC (admin only), prevents student self-verification,
    and protects private project boundaries.
    """

    @staticmethod
    def get_verification(
        db: Session,
        project_id: int,
        evidence_id: int,
        current_user: User,
    ) -> EvidenceVerificationResponse:
        project = db.get(InnovationProject, project_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Innovation project not found",
            )

        # Privacy guard for private projects
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

        verification = db.scalar(
            select(EvidenceVerification).where(EvidenceVerification.evidence_id == evidence_id)
        )

        if not verification:
            # Return virtual pending status representation
            return EvidenceVerificationResponse(
                id=0,
                evidence_id=evidence_id,
                verifier_id=None,
                status=EvidenceVerificationStatus.PENDING,
                notes=None,
                verified_at=None,
                created_at=evidence.created_at,
                updated_at=evidence.updated_at,
            )

        return EvidenceVerificationResponse.model_validate(verification)

    @staticmethod
    def create_or_update_verification(
        db: Session,
        project_id: int,
        evidence_id: int,
        current_user: User,
        payload: EvidenceVerificationCreate | EvidenceVerificationUpdate,
    ) -> EvidenceVerification:
        project = db.get(InnovationProject, project_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Innovation project not found",
            )

        # Privacy guard for private projects
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

        # Authorization check: Student cannot self-verify own evidence
        if project.student_id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Students cannot self-verify their own project evidence",
            )

        # Authorization check: Only platform administrators can verify evidence
        if current_user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only platform administrators have permission to verify project evidence",
            )

        verification = db.scalar(
            select(EvidenceVerification).where(EvidenceVerification.evidence_id == evidence_id)
        )

        target_status = payload.status or EvidenceVerificationStatus.VERIFIED
        target_notes = payload.notes

        now = datetime.now(timezone.utc)

        if not verification:
            verification = EvidenceVerification(
                evidence_id=evidence_id,
                verifier_id=current_user.id,
                status=target_status,
                notes=target_notes,
                verified_at=now if target_status in (EvidenceVerificationStatus.VERIFIED, EvidenceVerificationStatus.REJECTED) else None,
            )
            db.add(verification)
        else:
            verification.status = target_status
            if payload.notes is not None or not isinstance(payload, EvidenceVerificationUpdate):
                verification.notes = target_notes
            verification.verifier_id = current_user.id
            if target_status in (EvidenceVerificationStatus.VERIFIED, EvidenceVerificationStatus.REJECTED):
                verification.verified_at = now
            else:
                verification.verified_at = None

        db.commit()
        db.refresh(verification)
        return verification
