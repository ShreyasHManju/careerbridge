"""create innovation projects and project skills tables

Revision ID: c4b8e21a9f05
Revises: f1a8c9032d17
Create Date: 2026-09-24 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4b8e21a9f05'
down_revision: Union[str, Sequence[str], None] = 'f1a8c9032d17'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create innovation_projects table
    op.create_table(
        'innovation_projects',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=150), nullable=False),
        sa.Column('slug', sa.String(length=160), nullable=False),
        sa.Column('short_description', sa.String(length=300), nullable=True),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('project_type', sa.String(length=50), server_default='software', nullable=False),
        sa.Column('status', sa.String(length=20), server_default='active', nullable=False),
        sa.Column('visibility', sa.String(length=20), server_default='public', nullable=False),
        sa.Column('skills', sa.Text(), nullable=True),
        sa.Column('repository_url', sa.String(length=255), nullable=True),
        sa.Column('live_demo_url', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_innovation_projects_student_id', 'innovation_projects', ['student_id'], unique=False)
    op.create_index('ix_innovation_projects_slug', 'innovation_projects', ['slug'], unique=False)
    op.create_index(
        'ix_innovation_projects_visibility_status',
        'innovation_projects',
        ['visibility', 'status'],
        unique=False,
    )

    # 2. Create project_skills association table
    op.create_table(
        'project_skills',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('innovation_project_id', sa.Integer(), nullable=False),
        sa.Column('skill_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['innovation_project_id'], ['innovation_projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['skill_id'], ['skills.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('innovation_project_id', 'skill_id', name='uq_project_skill'),
    )
    op.create_index('ix_project_skills_innovation_project_id', 'project_skills', ['innovation_project_id'], unique=False)
    op.create_index('ix_project_skills_skill_id', 'project_skills', ['skill_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_project_skills_skill_id', table_name='project_skills')
    op.drop_index('ix_project_skills_innovation_project_id', table_name='project_skills')
    op.drop_table('project_skills')

    op.drop_index('ix_innovation_projects_visibility_status', table_name='innovation_projects')
    op.drop_index('ix_innovation_projects_slug', table_name='innovation_projects')
    op.drop_index('ix_innovation_projects_student_id', table_name='innovation_projects')
    op.drop_table('innovation_projects')
