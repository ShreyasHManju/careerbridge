/**
 * Recruiter candidate evaluation scorecard types.
 * Aligned with backend/app/schemas/candidate_evaluation.py.
 */
export type CandidateEvaluationStatus = 'draft' | 'submitted';

export type CandidateRecommendation =
  | 'strong_hire'
  | 'hire'
  | 'no_hire'
  | 'strong_no_hire';

export interface CandidateEvaluation {
  id: number;
  application_id: number;
  interview_id: number | null;
  recruiter_id: number;
  status: CandidateEvaluationStatus;
  technical_score: number | null;
  problem_solving_score: number | null;
  communication_score: number | null;
  role_fit_score: number | null;
  overall_score: number | null;
  recommendation: CandidateRecommendation | null;
  strengths: string | null;
  areas_for_growth: string | null;
  summary_notes: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  job_id?: number | null;
  job_title?: string | null;
  student_id?: number | null;
  student_name?: string | null;
  student_email?: string | null;
  recruiter_name?: string | null;
  company_name?: string | null;
}

export interface CandidateEvaluationPayload {
  interview_id?: number | null;
  technical_score?: number | null;
  problem_solving_score?: number | null;
  communication_score?: number | null;
  role_fit_score?: number | null;
  recommendation?: CandidateRecommendation | null;
  strengths?: string | null;
  areas_for_growth?: string | null;
  summary_notes?: string | null;
  is_submitted?: boolean;
}
