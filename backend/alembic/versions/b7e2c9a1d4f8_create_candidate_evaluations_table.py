"""create candidate_evaluations table

Revision ID: b7e2c9a1d4f8
Revises: 8d9e0f1a2b3c
Create Date: 2026-10-05 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7e2c9a1d4f8'
down_revision: Union[str, Sequence[str], None] = '8d9e0f1a2b3c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'candidate_evaluations',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('application_id', sa.Integer(), nullable=False),
        sa.Column('interview_id', sa.Integer(), nullable=True),
        sa.Column('recruiter_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.Enum('draft', 'submitted', name='candidate_evaluation_status', native_enum=False), nullable=False),
        sa.Column('technical_score', sa.Integer(), nullable=True),
        sa.Column('problem_solving_score', sa.Integer(), nullable=True),
        sa.Column('communication_score', sa.Integer(), nullable=True),
        sa.Column('role_fit_score', sa.Integer(), nullable=True),
        sa.Column('overall_score', sa.Numeric(precision=3, scale=2), nullable=True),
        sa.Column('recommendation', sa.Enum('strong_hire', 'hire', 'no_hire', 'strong_no_hire', name='candidate_recommendation', native_enum=False), nullable=True),
        sa.Column('strengths', sa.Text(), nullable=True),
        sa.Column('areas_for_growth', sa.Text(), nullable=True),
        sa.Column('summary_notes', sa.Text(), nullable=True),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['application_id'], ['applications.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['interview_id'], ['interviews.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['recruiter_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_candidate_evaluations_application_id'), 'candidate_evaluations', ['application_id'], unique=False)
    op.create_index(op.f('ix_candidate_evaluations_interview_id'), 'candidate_evaluations', ['interview_id'], unique=False)
    op.create_index(op.f('ix_candidate_evaluations_recruiter_id'), 'candidate_evaluations', ['recruiter_id'], unique=False)
    op.create_index(op.f('ix_candidate_evaluations_status'), 'candidate_evaluations', ['status'], unique=False)
    op.create_index(
        'uq_candidate_evaluations_application_level',
        'candidate_evaluations',
        ['application_id', 'recruiter_id'],
        unique=True,
        sqlite_where=sa.text('interview_id IS NULL'),
        postgresql_where=sa.text('interview_id IS NULL'),
    )
    op.create_index(
        'uq_candidate_evaluations_interview_level',
        'candidate_evaluations',
        ['interview_id', 'recruiter_id'],
        unique=True,
        sqlite_where=sa.text('interview_id IS NOT NULL'),
        postgresql_where=sa.text('interview_id IS NOT NULL'),
    )


def downgrade() -> None:
    op.drop_index('uq_candidate_evaluations_interview_level', table_name='candidate_evaluations')
    op.drop_index('uq_candidate_evaluations_application_level', table_name='candidate_evaluations')
    op.drop_index(op.f('ix_candidate_evaluations_status'), table_name='candidate_evaluations')
    op.drop_index(op.f('ix_candidate_evaluations_recruiter_id'), table_name='candidate_evaluations')
    op.drop_index(op.f('ix_candidate_evaluations_interview_id'), table_name='candidate_evaluations')
    op.drop_index(op.f('ix_candidate_evaluations_application_id'), table_name='candidate_evaluations')
    op.drop_table('candidate_evaluations')
