"""create project_blueprints tables and link to innovation_projects

Revision ID: a7b8c9d0e1f2
Revises: f3a1b2c4d5e6
Create Date: 2026-10-08 01:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, Sequence[str], None] = 'f3a1b2c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create project_blueprints table
    op.create_table(
        'project_blueprints',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('title', sa.String(length=150), nullable=False),
        sa.Column('slug', sa.String(length=160), nullable=False),
        sa.Column('version', sa.Integer(), server_default=sa.text('1'), nullable=False),
        sa.Column('summary', sa.String(length=300), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('learning_objectives', sa.Text(), nullable=False),
        sa.Column('project_type', sa.String(length=30), server_default='software', nullable=False),
        sa.Column('difficulty_level', sa.String(length=20), server_default='intermediate', nullable=False),
        sa.Column('estimated_hours', sa.Integer(), server_default=sa.text('20'), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='published', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug', name='uq_project_blueprints_slug'),
    )
    op.create_index(op.f('ix_project_blueprints_slug'), 'project_blueprints', ['slug'], unique=True)
    op.create_index(op.f('ix_project_blueprints_status'), 'project_blueprints', ['status'], unique=False)
    op.create_index(
        'ix_project_blueprints_type_diff',
        'project_blueprints',
        ['project_type', 'difficulty_level', 'status'],
        unique=False,
    )

    # 2. Create project_blueprint_skills table
    op.create_table(
        'project_blueprint_skills',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('blueprint_id', sa.Integer(), nullable=False),
        sa.Column('skill_id', sa.Integer(), nullable=False),
        sa.Column('is_primary', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['blueprint_id'], ['project_blueprints.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['skill_id'], ['skills.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('blueprint_id', 'skill_id', name='uq_blueprint_skill'),
    )
    op.create_index(op.f('ix_project_blueprint_skills_blueprint_id'), 'project_blueprint_skills', ['blueprint_id'], unique=False)
    op.create_index(op.f('ix_project_blueprint_skills_skill_id'), 'project_blueprint_skills', ['skill_id'], unique=False)

    # 3. Create project_blueprint_milestones table
    op.create_table(
        'project_blueprint_milestones',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('blueprint_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=150), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('expected_deliverable', sa.String(length=300), nullable=False),
        sa.Column('recommended_evidence_type', sa.String(length=30), server_default='repository', nullable=False),
        sa.Column('evidence_guidance', sa.Text(), nullable=True),
        sa.Column('display_order', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['blueprint_id'], ['project_blueprints.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_blueprint_milestones_blueprint_order',
        'project_blueprint_milestones',
        ['blueprint_id', 'display_order'],
        unique=False,
    )

    # 4. Add lineage columns to innovation_projects
    op.add_column(
        'innovation_projects',
        sa.Column('source_blueprint_id', sa.Integer(), nullable=True),
    )
    op.add_column(
        'innovation_projects',
        sa.Column('source_blueprint_version', sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        'fk_innovation_projects_source_blueprint_id',
        'innovation_projects',
        'project_blueprints',
        ['source_blueprint_id'],
        ['id'],
        ondelete='RESTRICT',
    )
    op.create_index(
        op.f('ix_innovation_projects_source_blueprint_id'),
        'innovation_projects',
        ['source_blueprint_id'],
        unique=False,
    )


def downgrade() -> None:
    # 1. Drop lineage columns from innovation_projects
    op.drop_index(op.f('ix_innovation_projects_source_blueprint_id'), table_name='innovation_projects')
    op.drop_constraint('fk_innovation_projects_source_blueprint_id', 'innovation_projects', type_='foreignkey')
    op.drop_column('innovation_projects', 'source_blueprint_version')
    op.drop_column('innovation_projects', 'source_blueprint_id')

    # 2. Drop project_blueprint_milestones
    op.drop_index('ix_blueprint_milestones_blueprint_order', table_name='project_blueprint_milestones')
    op.drop_table('project_blueprint_milestones')

    # 3. Drop project_blueprint_skills
    op.drop_index(op.f('ix_project_blueprint_skills_skill_id'), table_name='project_blueprint_skills')
    op.drop_index(op.f('ix_project_blueprint_skills_blueprint_id'), table_name='project_blueprint_skills')
    op.drop_table('project_blueprint_skills')

    # 4. Drop project_blueprints
    op.drop_index('ix_project_blueprints_type_diff', table_name='project_blueprints')
    op.drop_index(op.f('ix_project_blueprints_status'), table_name='project_blueprints')
    op.drop_index(op.f('ix_project_blueprints_slug'), table_name='project_blueprints')
    op.drop_table('project_blueprints')
