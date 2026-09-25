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

export interface PassportSummary {
  verified_experiences_count: number;
  public_projects_count: number;
  canonical_skills_count: number;
  completed_milestones_count: number;
}

export interface PassportSkillItem {
  id: number;
  name: string;
  slug: string;
  category: string | null;
  is_verified: boolean;
  sources: string[];
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
  resume: PassportResumeInfo | null;
  is_owner: boolean;
}
