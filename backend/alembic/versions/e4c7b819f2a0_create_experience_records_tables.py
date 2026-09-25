"""create experience records tables

Revision ID: e4c7b819f2a0
Revises: d7e9f12b3c48
Create Date: 2026-09-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e4c7b819f2a0'
down_revision: Union[str, Sequence[str], None] = 'd7e9f12b3c48'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create experience_records table
    op.create_table(
        'experience_records',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=150), nullable=False),
        sa.Column('organization_name', sa.String(length=150), nullable=True),
        sa.Column('experience_type', sa.String(length=50), server_default='work', nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('is_current', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=30), server_default='claimed', nullable=False),
        sa.Column('verification_source', sa.String(length=30), server_default='self_claimed', nullable=False),
        sa.Column('innovation_project_id', sa.Integer(), nullable=True),
        sa.Column('verifier_id', sa.Integer(), nullable=True),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('verification_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['innovation_project_id'], ['innovation_projects.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['verifier_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_experience_records_student_id', 'experience_records', ['student_id'], unique=False)
    op.create_index('ix_experience_records_status', 'experience_records', ['status'], unique=False)
    op.create_index('ix_experience_records_student_status', 'experience_records', ['student_id', 'status'], unique=False)
    op.create_index('ix_experience_records_innovation_project_id', 'experience_records', ['innovation_project_id'], unique=False)
    op.create_index('ix_experience_records_verifier_id', 'experience_records', ['verifier_id'], unique=False)

    # 2. Create experience_skills association table
    op.create_table(
        'experience_skills',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('experience_record_id', sa.Integer(), nullable=False),
        sa.Column('skill_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['experience_record_id'], ['experience_records.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['skill_id'], ['skills.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('experience_record_id', 'skill_id', name='uq_experience_skill'),
    )
    op.create_index('ix_experience_skills_experience_record_id', 'experience_skills', ['experience_record_id'], unique=False)
    op.create_index('ix_experience_skills_skill_id', 'experience_skills', ['skill_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_experience_skills_skill_id', table_name='experience_skills')
    op.drop_index('ix_experience_skills_experience_record_id', table_name='experience_skills')
    op.drop_table('experience_skills')

    op.drop_index('ix_experience_records_verifier_id', table_name='experience_records')
    op.drop_index('ix_experience_records_innovation_project_id', table_name='experience_records')
    op.drop_index('ix_experience_records_student_status', table_name='experience_records')
    op.drop_index('ix_experience_records_status', table_name='experience_records')
    op.drop_index('ix_experience_records_student_id', table_name='experience_records')
    op.drop_table('experience_records')
