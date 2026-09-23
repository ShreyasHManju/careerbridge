/**
 * CareerBridge Structured Skill Types
 * Strictly aligned with backend schemas in app/schemas/skill.py
 */

export interface Skill {
  id: number;
  name: string;
  slug: string;
  category: string | null;
  is_verified: boolean;
  created_at: string;
}

export interface StudentSkill {
  id: number;
  student_profile_id: number;
  skill_id: number;
  proficiency: string | null;
  created_at: string;
  skill?: Skill;
}

export interface JobSkill {
  id: number;
  job_posting_id: number;
  skill_id: number;
  is_required: boolean;
  created_at: string;
  skill?: Skill;
}

export interface SkillSearchParams {
  q?: string;
  category?: string;
  limit?: number;
}
