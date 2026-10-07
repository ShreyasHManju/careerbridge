"""create passport_shares table

Revision ID: f3a1b2c4d5e6
Revises: c8f3e1a2b4d9
Create Date: 2026-10-07 22:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3a1b2c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'c8f3e1a2b4d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'passport_shares',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('label', sa.String(length=128), nullable=True),
        sa.Column('allow_contact_info', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('allow_unverified_projects', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('view_count', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('last_accessed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token_hash', name='uq_passport_shares_token_hash'),
    )
    op.create_index(op.f('ix_passport_shares_token_hash'), 'passport_shares', ['token_hash'], unique=True)
    op.create_index(op.f('ix_passport_shares_student_id'), 'passport_shares', ['student_id'], unique=False)
    op.create_index(op.f('ix_passport_shares_is_active'), 'passport_shares', ['is_active'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_passport_shares_is_active'), table_name='passport_shares')
    op.drop_index(op.f('ix_passport_shares_student_id'), table_name='passport_shares')
    op.drop_index(op.f('ix_passport_shares_token_hash'), table_name='passport_shares')
    op.drop_table('passport_shares')
