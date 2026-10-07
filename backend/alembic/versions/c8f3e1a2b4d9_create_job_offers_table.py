"""create job_offers table

Revision ID: c8f3e1a2b4d9
Revises: b7e2c9a1d4f8
Create Date: 2026-10-07 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c8f3e1a2b4d9'
down_revision: Union[str, Sequence[str], None] = 'b7e2c9a1d4f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'job_offers',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('application_id', sa.Integer(), nullable=False),
        sa.Column('recruiter_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.Enum('draft', 'offered', 'accepted', 'rejected', 'withdrawn', 'expired', name='offer_status', native_enum=False), nullable=False),
        sa.Column('title', sa.String(length=150), nullable=False),
        sa.Column('compensation', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('currency', sa.String(length=10), server_default='USD', nullable=False),
        sa.Column('start_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expiration_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('terms', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['application_id'], ['applications.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['recruiter_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('application_id', name='uq_job_offers_application_id'),
    )
    op.create_index(op.f('ix_job_offers_application_id'), 'job_offers', ['application_id'], unique=True)
    op.create_index(op.f('ix_job_offers_recruiter_id'), 'job_offers', ['recruiter_id'], unique=False)
    op.create_index(op.f('ix_job_offers_status'), 'job_offers', ['status'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_job_offers_status'), table_name='job_offers')
    op.drop_index(op.f('ix_job_offers_recruiter_id'), table_name='job_offers')
    op.drop_index(op.f('ix_job_offers_application_id'), table_name='job_offers')
    op.drop_table('job_offers')
