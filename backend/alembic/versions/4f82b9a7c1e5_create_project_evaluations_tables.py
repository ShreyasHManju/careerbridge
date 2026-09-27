"""create_project_evaluations_tables

Revision ID: 4f82b9a7c1e5
Revises: 31a78e49b120
Create Date: 2026-09-27 15:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4f82b9a7c1e5'
down_revision: Union[str, Sequence[str], None] = '31a78e49b120'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'project_evaluations',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('recruiter_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.Enum('draft', 'submitted', 'withdrawn', name='evaluation_status', native_enum=False), nullable=False),
        sa.Column('technical_quality_score', sa.Integer(), nullable=True),
        sa.Column('problem_solving_score', sa.Integer(), nullable=True),
        sa.Column('execution_score', sa.Integer(), nullable=True),
        sa.Column('communication_documentation_score', sa.Integer(), nullable=True),
        sa.Column('evidence_quality_score', sa.Integer(), nullable=True),
        sa.Column('overall_score', sa.Numeric(precision=3, scale=2), nullable=True),
        sa.Column('recommendation', sa.Enum('not_recommended', 'developing', 'recommended', 'strongly_recommended', name='evaluation_recommendation', native_enum=False), nullable=True),
        sa.Column('strengths', sa.Text(), nullable=True),
        sa.Column('improvement_areas', sa.Text(), nullable=True),
        sa.Column('feedback', sa.Text(), nullable=True),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['innovation_projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['recruiter_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('project_id', 'recruiter_id', name='uq_project_recruiter_evaluation')
    )
    op.create_index('ix_project_evaluations_project_id', 'project_evaluations', ['project_id'], unique=False)
    op.create_index('ix_project_evaluations_student_id', 'project_evaluations', ['student_id'], unique=False)
    op.create_index('ix_project_evaluations_recruiter_id', 'project_evaluations', ['recruiter_id'], unique=False)
    op.create_index('ix_project_evaluations_status', 'project_evaluations', ['status'], unique=False)

    op.create_table(
        'evaluation_skill_assessments',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('evaluation_id', sa.Integer(), nullable=False),
        sa.Column('skill_id', sa.Integer(), nullable=False),
        sa.Column('proficiency', sa.Enum('not_observed', 'basic', 'intermediate', 'advanced', name='skill_assessment_proficiency', native_enum=False), nullable=False),
        sa.Column('comments', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['evaluation_id'], ['project_evaluations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['skill_id'], ['skills.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('evaluation_id', 'skill_id', name='uq_evaluation_skill')
    )
    op.create_index('ix_evaluation_skill_assessments_evaluation_id', 'evaluation_skill_assessments', ['evaluation_id'], unique=False)
    op.create_index('ix_evaluation_skill_assessments_skill_id', 'evaluation_skill_assessments', ['skill_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_evaluation_skill_assessments_skill_id', table_name='evaluation_skill_assessments')
    op.drop_index('ix_evaluation_skill_assessments_evaluation_id', table_name='evaluation_skill_assessments')
    op.drop_table('evaluation_skill_assessments')

    op.drop_index('ix_project_evaluations_status', table_name='project_evaluations')
    op.drop_index('ix_project_evaluations_recruiter_id', table_name='project_evaluations')
    op.drop_index('ix_project_evaluations_student_id', table_name='project_evaluations')
    op.drop_index('ix_project_evaluations_project_id', table_name='project_evaluations')
    op.drop_table('project_evaluations')
