"""create job invitations table

Revision ID: 7c8d9e0f1a2b
Revises: 5b7c9d1e2f30
Create Date: 2026-10-03 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7c8d9e0f1a2b"
down_revision: Union[str, Sequence[str], None] = "5b7c9d1e2f30"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "job_invitations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("job_id", sa.Integer(), nullable=False),
        sa.Column("recruiter_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=30), server_default="pending", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["job_id"], ["job_postings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["recruiter_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_job_invitations_id", "job_invitations", ["id"], unique=False)
    op.create_index("ix_job_invitations_job_id", "job_invitations", ["job_id"], unique=False)
    op.create_index("ix_job_invitations_recruiter_id", "job_invitations", ["recruiter_id"], unique=False)
    op.create_index("ix_job_invitations_student_id", "job_invitations", ["student_id"], unique=False)
    op.create_index("ix_job_invitations_status", "job_invitations", ["status"], unique=False)
    op.create_index("ix_job_invitations_created_at", "job_invitations", ["created_at"], unique=False)
    op.create_index("ix_job_invitations_student_id_status", "job_invitations", ["student_id", "status"], unique=False)
    op.create_index("ix_job_invitations_recruiter_id_created_at", "job_invitations", ["recruiter_id", "created_at"], unique=False)
    op.create_index("ix_job_invitations_job_id_student_id", "job_invitations", ["job_id", "student_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_job_invitations_job_id_student_id", table_name="job_invitations")
    op.drop_index("ix_job_invitations_recruiter_id_created_at", table_name="job_invitations")
    op.drop_index("ix_job_invitations_student_id_status", table_name="job_invitations")
    op.drop_index("ix_job_invitations_created_at", table_name="job_invitations")
    op.drop_index("ix_job_invitations_status", table_name="job_invitations")
    op.drop_index("ix_job_invitations_student_id", table_name="job_invitations")
    op.drop_index("ix_job_invitations_recruiter_id", table_name="job_invitations")
    op.drop_index("ix_job_invitations_job_id", table_name="job_invitations")
    op.drop_index("ix_job_invitations_id", table_name="job_invitations")
    op.drop_table("job_invitations")
