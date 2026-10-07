from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.skill import SkillResponse


class PassportIdentity(BaseModel):
    """Identity and academic metadata for an Experience Passport."""
    user_id: int
    email: str
    full_name: Optional[str] = None
    college: Optional[str] = None
    degree: Optional[str] = None
    branch: Optional[str] = None
    graduation_year: Optional[int] = None
    bio: Optional[str] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    profile_image_url: Optional[str] = None
    is_verified: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PassportEvaluationItem(BaseModel):
    """Safe recruiter project evaluation metadata for public and recruiter presentation."""
    id: int
    recruiter_id: int
    recruiter_company: Optional[str] = None
    recruiter_name: Optional[str] = None
    overall_score: Optional[float] = None
    technical_score: Optional[int] = None
    problem_solving_score: Optional[int] = None
    execution_score: Optional[int] = None
    communication_score: Optional[int] = None
    evidence_score: Optional[int] = None
    recommendation: Optional[str] = None
    strengths: Optional[str] = None
    assessed_skills: List[SkillResponse] = Field(default_factory=list)
    submitted_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PassportSummary(BaseModel):
    """Aggregate metric counts derived from verified evidence."""
    verified_experiences_count: int = Field(0, description="Total count of recruiter/admin-verified experiences")
    public_projects_count: int = Field(0, description="Total count of public active innovation projects")
    canonical_skills_count: int = Field(0, description="Count of distinct canonical skills backed by evidence")
    completed_milestones_count: int = Field(0, description="Total completed milestones across public projects")
    verified_evidence_count: int = Field(0, description="Total count of verified evidence artifacts across public projects")
    total_evaluations_count: int = Field(0, description="Total count of submitted recruiter evaluations across projects")
    average_project_score: Optional[float] = Field(None, description="Average overall score across all evaluated projects")


class PassportSkillItem(BaseModel):
    """Canonical skill with evidence provenance tags."""
    id: int
    name: str
    slug: str
    category: Optional[str] = None
    is_verified: bool = False
    sources: List[str] = Field(default_factory=list, description="Evidence provenance (experience, project, profile, evaluation)")

    model_config = ConfigDict(from_attributes=True)


class PassportEvidenceItem(BaseModel):
    """Verified project evidence artifact safe for public and recruiter presentation."""
    id: int
    innovation_project_id: int
    milestone_id: Optional[int] = None
    milestone_title: Optional[str] = None
    title: str
    description: Optional[str] = None
    evidence_type: str
    url: str
    verified_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PassportExperienceItem(BaseModel):
    """Verified experience record safe for public and recruiter presentation."""
    id: int
    title: str
    organization_name: Optional[str] = None
    experience_type: str
    start_date: date
    end_date: Optional[date] = None
    is_current: bool = False
    description: str
    status: str
    verification_source: str
    verified_at: Optional[datetime] = None
    innovation_project_id: Optional[int] = None
    innovation_project_title: Optional[str] = None
    skills: Optional[str] = None
    structured_skills: List[SkillResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class PassportMilestoneItem(BaseModel):
    """Project milestone execution entry."""
    id: int
    innovation_project_id: int
    project_title: str
    title: str
    description: Optional[str] = None
    status: str
    display_order: int = 0
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PassportProjectItem(BaseModel):
    """Public innovation project with milestones, skills, verified evidence, and recruiter evaluations."""
    id: int
    title: str
    slug: str
    short_description: Optional[str] = None
    description: str
    project_type: str
    status: str
    visibility: str
    repository_url: Optional[str] = None
    live_demo_url: Optional[str] = None
    skills: Optional[str] = None
    structured_skills: List[SkillResponse] = Field(default_factory=list)
    total_milestones: int = 0
    completed_milestones: int = 0
    progress_percentage: int = 0
    milestones: List[PassportMilestoneItem] = Field(default_factory=list)
    verified_evidence: List[PassportEvidenceItem] = Field(default_factory=list)
    verified_evidence_count: int = 0
    evaluations: List[PassportEvaluationItem] = Field(default_factory=list)
    average_evaluation_score: Optional[float] = None
    evaluations_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class PassportResumeInfo(BaseModel):
    """Safe metadata for an attached resume document."""
    id: int
    original_filename: str
    content_type: str
    file_size: int
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PassportResponse(BaseModel):
    """Comprehensive Experience Passport aggregated payload."""
    identity: PassportIdentity
    summary: PassportSummary
    verified_experiences: List[PassportExperienceItem] = Field(default_factory=list)
    projects: List[PassportProjectItem] = Field(default_factory=list)
    skills: List[PassportSkillItem] = Field(default_factory=list)
    milestones: List[PassportMilestoneItem] = Field(default_factory=list)
    verified_evidence: List[PassportEvidenceItem] = Field(default_factory=list)
    resume: Optional[PassportResumeInfo] = None
    is_owner: bool = False
    model_config = ConfigDict(from_attributes=True)


# ==============================================================================
# Phase 36: Passport Sharing & Public Sanitized Projections
# ==============================================================================

class PassportShareCreateRequest(BaseModel):
    """Payload for creating a new public Passport share link."""
    label: Optional[str] = Field(None, max_length=128, description="Optional memorable label for the link")
    expires_in_days: Optional[int] = Field(None, ge=1, le=365, description="Optional link lifetime in days")
    allow_contact_info: bool = Field(False, description="Whether direct contact info (email/phone) is visible")
    allow_unverified_projects: bool = Field(False, description="Whether unverified in-progress projects are visible")


class PassportShareUpdateRequest(BaseModel):
    """Payload for modifying an existing Passport share link."""
    label: Optional[str] = Field(None, max_length=128)
    allow_contact_info: Optional[bool] = None
    allow_unverified_projects: Optional[bool] = None
    is_active: Optional[bool] = None
    expires_in_days: Optional[int] = Field(None, ge=1, le=365, description="Set new expiration in N days from now")
    clear_expiration: Optional[bool] = Field(False, description="Explicitly remove expiration and make link indefinite")


class PassportShareCreateResponse(BaseModel):
    """Response returned upon creating a Passport share link. Contains the raw token exactly once."""
    id: int
    share_token: str
    share_url: str
    label: Optional[str] = None
    is_active: bool = True
    allow_contact_info: bool = False
    allow_unverified_projects: bool = False
    view_count: int = 0
    expires_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PassportShareSummaryResponse(BaseModel):
    """Summary of a Passport share link for student link management. Raw token is never returned."""
    id: int
    token_preview: str
    share_url: Optional[str] = None
    label: Optional[str] = None
    is_active: bool = True
    allow_contact_info: bool = False
    allow_unverified_projects: bool = False
    view_count: int = 0
    last_accessed_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_at: datetime
    revoked_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PublicVerificationSummary(BaseModel):
    """Authoritative platform verification summary without internal identifiers."""
    issuer: str = "CareerBridge"
    verification_status: str = "VERIFIED"
    verified_at: Optional[datetime] = None
    verified_placements_count: int = 0
    verified_projects_count: int = 0
    total_verified_skills: int = 0


class PublicSkillProvenance(BaseModel):
    """Sanitized skill competency backed by project and placement evidence."""
    skill_name: str
    category: Optional[str] = None
    projects_count: int = 0
    verified_placements_count: int = 0


class PublicExperienceItem(BaseModel):
    """Sanitized verified employer experience item. Internal IDs and notes strictly omitted."""
    company_name: str
    role_title: str
    employment_type: str
    start_date: str
    end_date: Optional[str] = None
    is_current: bool = False
    is_verified: bool = True
    verified_at: Optional[datetime] = None


class PublicProjectItem(BaseModel):
    """Sanitized public innovation project. Internal IDs and raw storage paths strictly omitted."""
    title: str
    tagline: Optional[str] = None
    description: str
    milestones_completed: int = 0
    total_milestones: int = 0
    repository_url: Optional[str] = None
    live_demo_url: Optional[str] = None
    is_verified: bool = False
    verified_evidence_count: int = 0


class PublicContactInfo(BaseModel):
    """Sanitized public contact info included ONLY when allow_contact_info is True."""
    email: str
    phone: Optional[str] = None
    portfolio_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None


class PublicPassportResponse(BaseModel):
    """
    Explicit, sanitized public projection of a student's Career Passport.
    Never exposes internal database IDs, candidate evaluations, recruiter notes,
    application history, or offer terms.
    """
    # Student Header
    full_name: Optional[str] = None
    institution: Optional[str] = None
    major: Optional[str] = None
    degree: Optional[str] = None
    graduation_year: Optional[int] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None

    # Optional Contact Info (Present ONLY when allow_contact_info == True)
    contact_info: Optional[PublicContactInfo] = None

    # Verification & Public Artifacts
    verification_summary: PublicVerificationSummary
    verified_skills: List[PublicSkillProvenance] = Field(default_factory=list)
    experience_timeline: List[PublicExperienceItem] = Field(default_factory=list)
    featured_projects: List[PublicProjectItem] = Field(default_factory=list)
