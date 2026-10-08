import { Skill } from './skill';

export type BlueprintDifficulty = 'beginner' | 'intermediate' | 'advanced';

export type BlueprintStatus = 'draft' | 'published' | 'archived';

export interface BlueprintSkill {
  id: number;
  skill_id: number;
  name: string;
  slug: string;
  category?: string | null;
  is_primary: boolean;
}

export interface BlueprintMilestone {
  id: number;
  title: string;
  description: string;
  expected_deliverable: string;
  recommended_evidence_type: string;
  evidence_guidance?: string | null;
  display_order: number;
  created_at: string;
}

export interface ProjectBlueprintSummary {
  id: number;
  title: string;
  slug: string;
  version: number;
  summary: string;
  project_type: string;
  difficulty_level: BlueprintDifficulty | string;
  estimated_hours: number;
  status: BlueprintStatus | string;
  skills: BlueprintSkill[];
  milestones_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectBlueprintDetail {
  id: number;
  title: string;
  slug: string;
  version: number;
  summary: string;
  description: string;
  learning_objectives: string;
  project_type: string;
  difficulty_level: BlueprintDifficulty | string;
  estimated_hours: number;
  status: BlueprintStatus | string;
  skills: BlueprintSkill[];
  milestones: BlueprintMilestone[];
  created_at: string;
  updated_at: string;
}

export interface ProjectBlueprintPaginationResponse {
  items: ProjectBlueprintSummary[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface MatchedMissingSkillItem {
  id: number;
  name: string;
  slug: string;
  is_primary: boolean;
}

export interface BlueprintRecommendationItem {
  blueprint: ProjectBlueprintSummary;
  matched_missing_skills: MatchedMissingSkillItem[];
  missing_primary_count: number;
  missing_supporting_count: number;
  total_missing_covered: number;
  relevance_score: number;
  recommendation_reason: string;
}

export interface JobProjectRecommendationsResponse {
  job_id: number;
  job_title: string;
  total_missing_skills: number;
  missing_skills: Skill[];
  recommendations: BlueprintRecommendationItem[];
}

export interface SkillProjectRecommendationsResponse {
  target_skill_ids: number[];
  total_blueprints_found: number;
  recommendations: BlueprintRecommendationItem[];
}
