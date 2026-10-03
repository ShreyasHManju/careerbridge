import { Skill } from './skill';
import { PassportResponse } from './passport';

/**
 * Canonical Candidate Sourcing Types (Phase 5 Step 1)
 * Strictly aligned with existing student profile, passport, and evaluation models.
 */

export interface CandidateEducationSummary {
  college: string | null;
  degree: string | null;
  branch: string | null;
  graduation_year: number | null;
}

export interface CandidateSkillSummary {
  id: number;
  name: string;
  slug: string;
  category: string | null;
  is_verified: boolean;
  sources?: string[];
}

export interface CandidateProjectSummary {
  id: number;
  title: string;
  slug?: string;
  short_description: string | null;
  project_type: string;
  visibility: string;
  progress_percentage: number;
  verified_evidence_count: number;
  structured_skills?: Skill[];
  average_evaluation_score?: number | null;
  evaluations_count?: number;
  repository_url?: string | null;
  live_demo_url?: string | null;
}

export interface CandidatePassportSummary {
  verified_experiences_count: number;
  public_projects_count: number;
  canonical_skills_count: number;
  completed_milestones_count: number;
  verified_evidence_count: number;
  total_evaluations_count?: number;
  average_project_score?: number | null;
  is_verified?: boolean;
}

export interface CandidateSourcingResult {
  id: number; // student user_id
  full_name: string | null;
  email?: string;
  bio: string | null;
  profile_image_url: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  education: CandidateEducationSummary;
  skills: CandidateSkillSummary[];
  verified_skills: CandidateSkillSummary[];
  top_projects: CandidateProjectSummary[];
  passport_summary: CandidatePassportSummary;
  created_at?: string;
}

export interface CandidateSearchFilters {
  query?: string;
  skills?: string[];
  college?: string;
  degree?: string;
  graduation_year?: number;
  has_verified_passport?: boolean;
  min_verified_skills?: number;
  min_projects?: number;
  min_evaluation_score?: number;
  sort_by?: 'relevance' | 'verified_skills' | 'top_rated_projects' | 'recent';
}

/**
 * Convert a full student PassportResponse into a safe, public CandidateSourcingResult.
 */
export function candidateFromPassport(passport: PassportResponse): CandidateSourcingResult {
  const verifiedSkills = (passport.skills || []).filter((s) => s.is_verified);
  const publicProjects = (passport.projects || []).filter((p) => p.visibility === 'public');

  return {
    id: passport.identity.user_id,
    full_name: passport.identity.full_name,
    email: passport.identity.email,
    bio: passport.identity.bio,
    profile_image_url: passport.identity.profile_image_url,
    github_url: passport.identity.github_url,
    linkedin_url: passport.identity.linkedin_url,
    portfolio_url: passport.identity.portfolio_url,
    education: {
      college: passport.identity.college,
      degree: passport.identity.degree,
      branch: passport.identity.branch,
      graduation_year: passport.identity.graduation_year,
    },
    skills: (passport.skills || []).map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      category: s.category,
      is_verified: s.is_verified,
      sources: s.sources,
    })),
    verified_skills: verifiedSkills.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      category: s.category,
      is_verified: true,
      sources: s.sources,
    })),
    top_projects: publicProjects.slice(0, 3).map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      short_description: p.short_description,
      project_type: p.project_type,
      visibility: p.visibility,
      progress_percentage: p.progress_percentage,
      verified_evidence_count: p.verified_evidence_count,
      structured_skills: p.structured_skills,
      average_evaluation_score: p.average_evaluation_score,
      evaluations_count: p.evaluations_count,
      repository_url: p.repository_url,
      live_demo_url: p.live_demo_url,
    })),
    passport_summary: {
      verified_experiences_count: passport.summary?.verified_experiences_count || 0,
      public_projects_count: passport.summary?.public_projects_count || 0,
      canonical_skills_count: passport.summary?.canonical_skills_count || 0,
      completed_milestones_count: passport.summary?.completed_milestones_count || 0,
      verified_evidence_count: passport.summary?.verified_evidence_count || 0,
      total_evaluations_count: passport.summary?.total_evaluations_count,
      average_project_score: passport.summary?.average_project_score,
      is_verified: passport.identity.is_verified,
    },
    created_at: passport.identity.created_at,
  };
}
