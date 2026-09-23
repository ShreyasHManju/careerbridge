import re
from typing import List, Optional
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.skill import JobSkill, Skill, StudentSkill
from app.models.student_profile import StudentProfile
from app.models.job_posting import JobPosting


def generate_skill_slug(name: str) -> str:
    """
    Generate a normalized, deterministic URL-safe slug from a skill name.
    Examples:
        'React' -> 'react'
        'React.js' -> 'react-js'
        'Node.js' -> 'node-js'
        'C++' -> 'c'
        'Machine Learning' -> 'machine-learning'
    """
    if not name or not name.strip():
        return "skill"
    # Convert to lowercase
    slug = name.strip().lower()
    # Replace any non-alphanumeric characters with a single hyphen
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    # Strip leading and trailing hyphens
    slug = slug.strip("-")
    return slug or "skill"


def parse_skills_text(skills_text: Optional[str]) -> List[str]:
    """
    Parse a comma-delimited skills string into a deduplicated list of clean skill names.
    Preserves original token casing of the first occurrence while deduplicating case-insensitively.
    """
    if not skills_text or not skills_text.strip():
        return []

    tokens = [token.strip() for token in skills_text.split(",") if token.strip()]
    seen_lower = set()
    deduped = []
    for token in tokens:
        # Bounded token length
        clean_token = token[:100].strip()
        lower = clean_token.lower()
        if clean_token and lower not in seen_lower:
            seen_lower.add(lower)
            deduped.append(clean_token)
    return deduped


def format_skills_string(skill_names: List[str]) -> Optional[str]:
    """
    Format a list of skill names into a deterministic comma-separated string representation.
    Returns None if the list is empty.
    """
    if not skill_names:
        return None
    return ", ".join(skill_names)


def get_or_create_skill(
    db: Session,
    name: str,
    category: Optional[str] = None,
    is_verified: bool = True,
) -> Optional[Skill]:
    """
    Retrieve an existing Skill by slug/name or create a new canonical Skill record.
    Ensures absolute uniqueness and normalization without duplicate key violations.
    Returns None if name is empty or invalid.
    """
    if not name or not name.strip():
        return None

    clean_name = name.strip()[:100]
    slug = generate_skill_slug(clean_name)
    if not slug:
        return None

    # Search existing by slug or exact lowercase name
    existing = db.scalar(
        select(Skill).where(or_(Skill.slug == slug, Skill.name.ilike(clean_name)))
    )
    if existing:
        return existing

    # Create new canonical skill
    new_skill = Skill(
        name=clean_name,
        slug=slug,
        category=category.strip()[:50] if category and category.strip() else None,
        is_verified=is_verified,
    )
    db.add(new_skill)
    db.flush()
    return new_skill


def sync_student_skills_from_text(
    db: Session,
    student_profile: StudentProfile,
    skills_text: Optional[str],
) -> List[StudentSkill]:
    """
    Synchronize a student profile's structured student_skills associations with a skills text string.
    - Parses and normalizes the input string.
    - Creates or retrieves canonical Skill records.
    - Adds missing StudentSkill association rows.
    - Removes obsolete StudentSkill association rows.
    - Updates student_profile.skills with the deterministic canonical representation.
    """
    skill_names = parse_skills_text(skills_text)
    if not skill_names:
        student_profile.student_skills.clear()
        student_profile.skills = None
        return []

    canonical_skills = [
        s for s in (get_or_create_skill(db, name) for name in skill_names) if s is not None
    ]
    target_skill_ids = {s.id for s in canonical_skills}

    # Remove associations no longer present
    for ass in list(student_profile.student_skills):
        if ass.skill_id not in target_skill_ids:
            student_profile.student_skills.remove(ass)

    # Add new associations
    existing_skill_ids = {ass.skill_id for ass in student_profile.student_skills}
    for skill in canonical_skills:
        if skill.id not in existing_skill_ids:
            student_profile.student_skills.append(
                StudentSkill(
                    student_profile_id=student_profile.id,
                    skill_id=skill.id,
                )
            )

    # Maintain deterministic legacy string
    student_profile.skills = format_skills_string([s.name for s in canonical_skills])
    return student_profile.student_skills


def sync_job_skills_from_text(
    db: Session,
    job_posting: JobPosting,
    skills_text: Optional[str],
) -> List[JobSkill]:
    """
    Synchronize a job posting's structured job_skills associations with a skills text string.
    - Parses and normalizes the input string.
    - Creates or retrieves canonical Skill records.
    - Adds missing JobSkill association rows.
    - Removes obsolete JobSkill association rows.
    - Updates job_posting.skills with the deterministic canonical representation.
    """
    skill_names = parse_skills_text(skills_text)
    if not skill_names:
        job_posting.job_skills.clear()
        job_posting.skills = None
        return []

    canonical_skills = [
        s for s in (get_or_create_skill(db, name) for name in skill_names) if s is not None
    ]
    target_skill_ids = {s.id for s in canonical_skills}

    # Remove associations no longer present
    for ass in list(job_posting.job_skills):
        if ass.skill_id not in target_skill_ids:
            job_posting.job_skills.remove(ass)

    # Add new associations
    existing_skill_ids = {ass.skill_id for ass in job_posting.job_skills}
    for skill in canonical_skills:
        if skill.id not in existing_skill_ids:
            job_posting.job_skills.append(
                JobSkill(
                    job_posting_id=job_posting.id,
                    skill_id=skill.id,
                    is_required=True,
                )
            )

    # Maintain deterministic legacy string
    job_posting.skills = format_skills_string([s.name for s in canonical_skills])
    return job_posting.job_skills


def search_canonical_skills(
    db: Session,
    q: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 20,
) -> List[Skill]:
    """
    Query the canonical master skills catalog with case-insensitive search and bounded pagination.
    """
    stmt = select(Skill)
    filters = []

    if q and q.strip():
        term = f"%{q.strip()}%"
        slug_term = f"%{generate_skill_slug(q.strip())}%"
        filters.append(or_(Skill.name.ilike(term), Skill.slug.ilike(slug_term)))

    if category and category.strip():
        filters.append(Skill.category.ilike(f"%{category.strip()}%"))

    if filters:
        stmt = stmt.where(*filters)

    # Bounded query
    bounded_limit = max(1, min(100, limit))
    stmt = stmt.order_by(Skill.name.asc()).limit(bounded_limit)

    return list(db.scalars(stmt).all())
