"""add_performance_indexes

Revision ID: c3f88a91b24d
Revises: 6a1607782c51
Create Date: 2026-09-20 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3f88a91b24d'
down_revision: Union[str, Sequence[str], None] = '6a1607782c51'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - add composite performance indexes."""
    op.create_index(
        'ix_job_postings_is_active_created_at',
        'job_postings',
        ['is_active', 'created_at'],
        unique=False,
    )
    op.create_index(
        'ix_applications_student_id_created_at',
        'applications',
        ['student_id', 'created_at'],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema - drop composite performance indexes."""
    op.drop_index('ix_applications_student_id_created_at', table_name='applications')
    op.drop_index('ix_job_postings_is_active_created_at', table_name='job_postings')
