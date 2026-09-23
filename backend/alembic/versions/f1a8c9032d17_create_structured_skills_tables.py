"""create structured skills tables and backfill legacy skills

Revision ID: f1a8c9032d17
Revises: e8a3182b8a21
Create Date: 2026-09-23 23:45:00.000000

"""
import re
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a8c9032d17'
down_revision: Union[str, Sequence[str], None] = 'e8a3182b8a21'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def generate_slug(name: str) -> str:
    """Generate normalized URL slug from skill name."""
    if not name or not name.strip():
        return "skill"
    slug = name.strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    return slug or "skill"


def parse_tokens(text_val: str) -> list[str]:
    """Parse comma-separated skill tokens."""
    if not text_val or not text_val.strip():
        return []
    tokens = [t.strip() for t in text_val.split(",") if t.strip()]
    seen = set()
    deduped = []
    for t in tokens:
        clean = t[:100].strip()
        lower = clean.lower()
        if clean and lower not in seen:
            seen.add(lower)
            deduped.append(clean)
    return deduped


def upgrade() -> None:
    # 1. Create skills master catalog table
    op.create_table(
        'skills',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('slug', sa.String(length=100), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=True),
        sa.Column('is_verified', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name', name='uq_skills_name'),
    )
    op.create_index('ix_skills_slug', 'skills', ['slug'], unique=True)

    # 2. Create student_skills association table
    op.create_table(
        'student_skills',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('student_profile_id', sa.Integer(), nullable=False),
        sa.Column('skill_id', sa.Integer(), nullable=False),
        sa.Column('proficiency', sa.String(length=20), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['student_profile_id'], ['student_profiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['skill_id'], ['skills.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('student_profile_id', 'skill_id', name='uq_student_skill'),
    )
    op.create_index('ix_student_skills_student_profile_id', 'student_skills', ['student_profile_id'], unique=False)
    op.create_index('ix_student_skills_skill_id', 'student_skills', ['skill_id'], unique=False)

    # 3. Create job_skills association table
    op.create_table(
        'job_skills',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('job_posting_id', sa.Integer(), nullable=False),
        sa.Column('skill_id', sa.Integer(), nullable=False),
        sa.Column('is_required', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['job_posting_id'], ['job_postings.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['skill_id'], ['skills.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('job_posting_id', 'skill_id', name='uq_job_skill'),
    )
    op.create_index('ix_job_skills_job_posting_id', 'job_skills', ['job_posting_id'], unique=False)
    op.create_index('ix_job_skills_skill_id', 'job_skills', ['skill_id'], unique=False)

    # 4. Data backfill from existing student_profiles and job_postings
    bind = op.get_bind()

    # Cache for skill slugs to IDs
    slug_to_id = {}

    # Query existing skills from DB if any
    existing_skills = bind.execute(sa.text("SELECT id, slug FROM skills;")).fetchall()
    for row in existing_skills:
        slug_to_id[row[1]] = row[0]

    def get_or_insert_skill(name: str) -> int:
        slug = generate_slug(name)
        if slug in slug_to_id:
            return slug_to_id[slug]
        # Insert new skill
        res = bind.execute(
            sa.text("INSERT INTO skills (name, slug, is_verified, created_at) VALUES (:name, :slug, true, now()) RETURNING id;"),
            {"name": name[:100], "slug": slug[:100]},
        )
        new_id = res.scalar()
        slug_to_id[slug] = new_id
        return new_id

    # Backfill student profiles
    student_rows = bind.execute(
        sa.text("SELECT id, skills FROM student_profiles WHERE skills IS NOT NULL AND trim(skills) != '';")
    ).fetchall()
    for s_id, s_skills in student_rows:
        tokens = parse_tokens(s_skills)
        for token in tokens:
            skill_id = get_or_insert_skill(token)
            # Insert association if not exists
            bind.execute(
                sa.text("""
                    INSERT INTO student_skills (student_profile_id, skill_id, created_at)
                    VALUES (:sp_id, :sk_id, now())
                    ON CONFLICT ON CONSTRAINT uq_student_skill DO NOTHING;
                """),
                {"sp_id": s_id, "sk_id": skill_id},
            )

    # Backfill job postings
    job_rows = bind.execute(
        sa.text("SELECT id, skills FROM job_postings WHERE skills IS NOT NULL AND trim(skills) != '';")
    ).fetchall()
    for j_id, j_skills in job_rows:
        tokens = parse_tokens(j_skills)
        for token in tokens:
            skill_id = get_or_insert_skill(token)
            # Insert association if not exists
            bind.execute(
                sa.text("""
                    INSERT INTO job_skills (job_posting_id, skill_id, is_required, created_at)
                    VALUES (:jp_id, :sk_id, true, now())
                    ON CONFLICT ON CONSTRAINT uq_job_skill DO NOTHING;
                """),
                {"jp_id": j_id, "sk_id": skill_id},
            )


def downgrade() -> None:
    op.drop_index('ix_job_skills_skill_id', table_name='job_skills')
    op.drop_index('ix_job_skills_job_posting_id', table_name='job_skills')
    op.drop_table('job_skills')

    op.drop_index('ix_student_skills_skill_id', table_name='student_skills')
    op.drop_index('ix_student_skills_student_profile_id', table_name='student_skills')
    op.drop_table('student_skills')

    op.drop_index('ix_skills_slug', table_name='skills')
    op.drop_table('skills')
