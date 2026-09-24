"""create project milestones table

Revision ID: d7e9f12b3c48
Revises: c4b8e21a9f05
Create Date: 2026-09-24 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd7e9f12b3c48'
down_revision: Union[str, Sequence[str], None] = 'c4b8e21a9f05'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'project_milestones',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('innovation_project_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=150), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='todo', nullable=False),
        sa.Column('display_order', sa.Integer(), server_default='0', nullable=False),
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['innovation_project_id'], ['innovation_projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_project_milestones_innovation_project_id', 'project_milestones', ['innovation_project_id'], unique=False)
    op.create_index(
        'ix_project_milestones_project_order',
        'project_milestones',
        ['innovation_project_id', 'display_order'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_project_milestones_project_order', table_name='project_milestones')
    op.drop_index('ix_project_milestones_innovation_project_id', table_name='project_milestones')
    op.drop_table('project_milestones')
