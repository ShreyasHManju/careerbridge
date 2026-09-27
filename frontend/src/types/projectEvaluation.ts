export type EvaluationStatus = 'draft' | 'submitted' | 'withdrawn';

export type EvaluationRecommendation =
  | 'not_recommended'
  | 'developing'
  | 'recommended'
  | 'strongly_recommended';

export type SkillAssessmentProficiency =
  | 'not_observed'
  | 'basic'
  | 'intermediate'
  | 'advanced';

export interface EvaluationSkillAssessment {
  id: number;
  evaluation_id: number;
  skill_id: number;
  skill_name?: string;
  skill_slug?: string;
  skill_category?: string;
  proficiency: SkillAssessmentProficiency;
  comments?: string;
  notes?: string;
  created_at: string;
}

export interface ProjectEvaluation {
  id: number;
  project_id: number;
  project_title?: string;
  student_id: number;
  student_name?: string;
  recruiter_id: number;
  recruiter_name?: string;
  company_name?: string;
  recruiter_company?: string;
  status: EvaluationStatus;
  technical_quality_score?: number;
  problem_solving_score?: number;
  execution_score?: number;
  communication_documentation_score?: number;
  evidence_quality_score?: number;
  overall_score?: number;
  recommendation?: EvaluationRecommendation;
  strengths?: string;
  improvement_areas?: string;
  feedback?: string;
  skill_assessments: EvaluationSkillAssessment[];
  submitted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EvaluationSkillAssessmentCreate {
  skill_id: number;
  proficiency: SkillAssessmentProficiency;
  comments?: string;
}

export interface ProjectEvaluationCreate {
  technical_quality_score?: number;
  problem_solving_score?: number;
  execution_score?: number;
  communication_documentation_score?: number;
  evidence_quality_score?: number;
  recommendation?: EvaluationRecommendation;
  strengths?: string;
  improvement_areas?: string;
  feedback?: string;
  skill_assessments?: EvaluationSkillAssessmentCreate[];
}

export interface ProjectEvaluationUpdate {
  technical_quality_score?: number;
  problem_solving_score?: number;
  execution_score?: number;
  communication_documentation_score?: number;
  evidence_quality_score?: number;
  recommendation?: EvaluationRecommendation;
  strengths?: string;
  improvement_areas?: string;
  feedback?: string;
  skill_assessments?: EvaluationSkillAssessmentCreate[];
}
