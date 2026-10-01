"""add google authentication fields

Revision ID: 5b7c9d1e2f30
Revises: 4f82b9a7c1e5
Create Date: 2026-09-28 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "5b7c9d1e2f30"
down_revision: Union[str, Sequence[str], None] = "4f82b9a7c1e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add fields required for Google authentication."""

    # Existing email/password users keep their password hashes.
    # Google-only accounts will have a NULL password_hash.
    op.alter_column(
        "users",
        "password_hash",
        existing_type=sa.String(length=255),
        nullable=True,
    )

    op.add_column(
        "users",
        sa.Column(
            "auth_provider",
            sa.String(length=20),
            nullable=False,
            server_default="local",
        ),
    )

    op.add_column(
        "users",
        sa.Column(
            "google_subject",
            sa.String(length=255),
            nullable=True,
        ),
    )

    op.create_index(
        "ix_users_google_subject",
        "users",
        ["google_subject"],
        unique=True,
    )


def downgrade() -> None:
    """Remove Google authentication fields."""

    op.drop_index(
        "ix_users_google_subject",
        table_name="users",
    )

    op.drop_column("users", "google_subject")

    op.drop_column("users", "auth_provider")

    # This is only safe if no Google-only accounts exist.
    op.alter_column(
        "users",
        "password_hash",
        existing_type=sa.String(length=255),
        nullable=False,
    )