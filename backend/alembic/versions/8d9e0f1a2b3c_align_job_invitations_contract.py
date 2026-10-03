"""align job invitations contract

Revision ID: 8d9e0f1a2b3c
Revises: 7c8d9e0f1a2b
Create Date: 2026-10-03 13:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8d9e0f1a2b3c'
down_revision: Union[str, Sequence[str], None] = '7c8d9e0f1a2b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        'job_invitations',
        'status',
        existing_type=sa.VARCHAR(length=30),
        type_=sa.Enum('pending', 'accepted', 'declined', name='invitation_status', native_enum=False),
        existing_nullable=False,
        existing_server_default=sa.text("'pending'::character varying"),
    )
    op.drop_index('ix_job_invitations_id', table_name='job_invitations')


def downgrade() -> None:
    op.create_index('ix_job_invitations_id', 'job_invitations', ['id'], unique=False)
    op.alter_column(
        'job_invitations',
        'status',
        existing_type=sa.Enum('pending', 'accepted', 'declined', name='invitation_status', native_enum=False),
        type_=sa.VARCHAR(length=30),
        existing_nullable=False,
        existing_server_default=sa.text("'pending'::character varying"),
    )
