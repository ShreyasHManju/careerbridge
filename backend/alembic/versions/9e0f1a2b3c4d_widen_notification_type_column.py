"""widen notification type column to support experience verification

Revision ID: 9e0f1a2b3c4d
Revises: 8d9e0f1a2b3c
Create Date: 2026-10-03 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9e0f1a2b3c4d'
down_revision: Union[str, Sequence[str], None] = '8d9e0f1a2b3c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        'notifications',
        'notification_type',
        existing_type=sa.VARCHAR(length=30),
        type_=sa.VARCHAR(length=64),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        'notifications',
        'notification_type',
        existing_type=sa.VARCHAR(length=64),
        type_=sa.VARCHAR(length=30),
        existing_nullable=False,
    )
