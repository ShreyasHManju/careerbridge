import { Skill } from './skill';

/**
 * CareerBridge Experience Passport Types
 * Strictly aligned with backend schemas in app/schemas/passport.py
 */

export interface PassportIdentity {
  user_id: number;
  email: string;
  full_name: string | null;
  college: string | null;
  degree: string | null;
  branch: string | null;
  graduation_year: number | null;
  bio: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  profile_image_url: string | null;
  is_verified: boolean;
  created_at: string;
}

export interface PassportEvaluationItem {
  id: number;
  recruiter_id: number;
  recruiter_company: string | null;
  recruiter_name: string | null;
  overall_score: number | null;
  technical_score: number | null;
  problem_solving_score: number | null;
  execution_score: number | null;
  communication_score: number | null;
  evidence_score: number | null;
  recommendation: string | null;
  strengths: string | null;
  assessed_skills: Skill[];
  submitted_at: string | null;
}

export interface PassportSummary {
  verified_experiences_count: number;
  public_projects_count: number;
  canonical_skills_count: number;
  completed_milestones_count: number;
  verified_evidence_count: number;
  total_evaluations_count?: number;
  average_project_score?: number | null;
}

export interface PassportSkillItem {
  id: number;
  name: string;
  slug: string;
  category: string | null;
  is_verified: boolean;
  sources: string[];
}

export interface PassportEvidenceItem {
  id: number;
  innovation_project_id: number;
  milestone_id: number | null;
  milestone_title: string | null;
  title: string;
  description: string | null;
  evidence_type: string;
  url: string;
  verified_at: string | null;
}

export interface PassportExperienceItem {
  id: number;
  title: string;
  organization_name: string | null;
  experience_type: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  description: string;
  status: string;
  verification_source: string;
  verified_at: string | null;
  innovation_project_id: number | null;
  innovation_project_title: string | null;
  skills: string | null;
  structured_skills: Skill[];
}

export interface PassportMilestoneItem {
  id: number;
  innovation_project_id: number;
  project_title: string;
  title: string;
  description: string | null;
  status: string;
  display_order: number;
  due_date: string | null;
  completed_at: string | null;
}

export interface PassportProjectItem {
  id: number;
  title: string;
  slug: string;
  short_description: string | null;
  description: string;
  project_type: string;
  status: string;
  visibility: string;
  repository_url: string | null;
  live_demo_url: string | null;
  skills: string | null;
  structured_skills: Skill[];
  total_milestones: number;
  completed_milestones: number;
  progress_percentage: number;
  milestones: PassportMilestoneItem[];
  verified_evidence: PassportEvidenceItem[];
  verified_evidence_count: number;
  evaluations?: PassportEvaluationItem[];
  average_evaluation_score?: number | null;
  evaluations_count?: number;
}

export interface PassportResumeInfo {
  id: number;
  original_filename: string;
  content_type: string;
  file_size: number;
  updated_at: string;
}

export interface PassportResponse {
  identity: PassportIdentity;
  summary: PassportSummary;
  verified_experiences: PassportExperienceItem[];
  projects: PassportProjectItem[];
  skills: PassportSkillItem[];
  milestones: PassportMilestoneItem[];
  verified_evidence: PassportEvidenceItem[];
  resume: PassportResumeInfo | null;
  is_owner: boolean;
}

// ==============================================================================
// Phase 36: Passport Sharing & Public Sanitized Projections
// ==============================================================================

export interface PassportShareCreateRequest {
  label?: string | null;
  expires_in_days?: number | null;
  allow_contact_info?: boolean;
  allow_unverified_projects?: boolean;
}

export interface PassportShareUpdateRequest {
  label?: string | null;
  allow_contact_info?: boolean;
  allow_unverified_projects?: boolean;
  is_active?: boolean;
  expires_in_days?: number | null;
  clear_expiration?: boolean;
}

export interface PassportShareCreateResponse {
  id: number;
  share_token: string;
  share_url: string;
  label: string | null;
  is_active: boolean;
  allow_contact_info: boolean;
  allow_unverified_projects: boolean;
  view_count: number;
  expires_at: string | null;
  created_at: string;
}

export interface PassportShareSummaryResponse {
  id: number;
  token_preview: string;
  share_url?: string | null;
  label: string | null;
  is_active: boolean;
  allow_contact_info: boolean;
  allow_unverified_projects: boolean;
  view_count: number;
  last_accessed_at: string | null;
  expires_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface PublicVerificationSummary {
  issuer: string;
  verification_status: string;
  verified_at: string | null;
  verified_placements_count: number;
  verified_projects_count: number;
  total_verified_skills: number;
}

export interface PublicSkillProvenance {
  skill_name: string;
  category: string | null;
  projects_count: number;
  verified_placements_count: number;
}

export interface PublicExperienceItem {
  company_name: string;
  role_title: string;
  employment_type: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  is_verified: boolean;
  verified_at: string | null;
}

export interface PublicProjectItem {
  title: string;
  tagline: string | null;
  description: string;
  milestones_completed: number;
  total_milestones: number;
  repository_url: string | null;
  live_demo_url: string | null;
  is_verified: boolean;
  verified_evidence_count: number;
}

export interface PublicContactInfo {
  email: string;
  phone: string | null;
  portfolio_url: string | null;
  linkedin_url: string | null;
  github_url: string | null;
}

export interface PublicPassportResponse {
  full_name: string | null;
  institution: string | null;
  major: string | null;
  degree: string | null;
  graduation_year: number | null;
  bio: string | null;
  avatar_url: string | null;
  contact_info: PublicContactInfo | null;
  verification_summary: PublicVerificationSummary;
  verified_skills: PublicSkillProvenance[];
  experience_timeline: PublicExperienceItem[];
  featured_projects: PublicProjectItem[];
}
