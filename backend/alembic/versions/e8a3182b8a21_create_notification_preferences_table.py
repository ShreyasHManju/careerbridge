"""create_notification_preferences_table

Revision ID: e8a3182b8a21
Revises: c3f88a91b24d
Create Date: 2026-09-22 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8a3182b8a21'
down_revision: Union[str, Sequence[str], None] = 'c3f88a91b24d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - create notification_preferences table."""
    op.create_table(
        'notification_preferences',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column(
            'frequency',
            sa.Enum('instant', 'digest', name='notification_frequency', native_enum=False),
            server_default='instant',
            nullable=False,
        ),
        sa.Column(
            'email_notifications',
            sa.Boolean(),
            server_default=sa.text('true'),
            nullable=False,
        ),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', name='uq_notification_preferences_user_id'),
    )
    op.create_index(
        'ix_notification_preferences_user_id',
        'notification_preferences',
        ['user_id'],
        unique=True,
    )


def downgrade() -> None:
    """Downgrade schema - drop notification_preferences table."""
    op.drop_index('ix_notification_preferences_user_id', table_name='notification_preferences')
    op.drop_table('notification_preferences')
