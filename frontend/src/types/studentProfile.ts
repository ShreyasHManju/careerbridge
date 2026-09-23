import { Skill } from './skill';

export interface StudentProfile {
  id: number;
  user_id: number;
  full_name: string;
  phone: string | null;
  college: string | null;
  degree: string | null;
  branch: string | null;
  graduation_year: number | null;
  bio: string | null;
  skills: string | null;
  structured_skills?: Skill[] | null;
  github_url: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentProfileCreateRequest {
  full_name: string;
  phone?: string | null;
  college?: string | null;
  degree?: string | null;
  branch?: string | null;
  graduation_year?: number | null;
  bio?: string | null;
  skills?: string | null;
  github_url?: string | null;
  linkedin_url?: string | null;
  portfolio_url?: string | null;
}

export interface StudentProfileUpdateRequest {
  full_name?: string | null;
  phone?: string | null;
  college?: string | null;
  degree?: string | null;
  branch?: string | null;
  graduation_year?: number | null;
  bio?: string | null;
  skills?: string | null;
  github_url?: string | null;
  linkedin_url?: string | null;
  portfolio_url?: string | null;
}
