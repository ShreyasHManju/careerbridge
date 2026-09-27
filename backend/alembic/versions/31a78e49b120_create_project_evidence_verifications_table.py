"""create_project_evidence_verifications_table

Revision ID: 31a78e49b120
Revises: 23d1824b3816
Create Date: 2026-09-27 08:57:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '31a78e49b120'
down_revision: Union[str, Sequence[str], None] = '23d1824b3816'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'project_evidence_verifications',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('evidence_id', sa.Integer(), nullable=False),
        sa.Column('verifier_id', sa.Integer(), nullable=True),
        sa.Column('status', sa.Enum('pending', 'verified', 'rejected', name='evidence_verification_status', native_enum=False), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['evidence_id'], ['project_evidence.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['verifier_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_project_evidence_verifications_evidence_id'), 'project_evidence_verifications', ['evidence_id'], unique=True)
    op.create_index(op.f('ix_project_evidence_verifications_verifier_id'), 'project_evidence_verifications', ['verifier_id'], unique=False)
    op.create_index('ix_evidence_verifications_status', 'project_evidence_verifications', ['status'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_evidence_verifications_status', table_name='project_evidence_verifications')
    op.drop_index(op.f('ix_project_evidence_verifications_verifier_id'), table_name='project_evidence_verifications')
    op.drop_index(op.f('ix_project_evidence_verifications_evidence_id'), table_name='project_evidence_verifications')
    op.drop_table('project_evidence_verifications')
