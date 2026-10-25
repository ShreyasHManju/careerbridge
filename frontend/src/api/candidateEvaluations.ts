import { apiClient } from './client';
import {
  CandidateEvaluation,
  CandidateEvaluationPayload,
} from '@/types/candidateEvaluation';

/**
 * List private recruiter scorecards for an application.
 * GET /api/v1/applications/{applicationId}/evaluations
 */
export async function getCandidateEvaluations(
  applicationId: number
): Promise<CandidateEvaluation[]> {
  const response = await apiClient.get<CandidateEvaluation[]>(
    `/applications/${applicationId}/evaluations`
  );
  return response.data;
}

/**
 * Create an application-level draft or submit a complete scorecard.
 * POST /api/v1/applications/{applicationId}/evaluations
 */
export async function createCandidateEvaluation(
  applicationId: number,
  payload: CandidateEvaluationPayload
): Promise<CandidateEvaluation> {
  const response = await apiClient.post<CandidateEvaluation>(
    `/applications/${applicationId}/evaluations`,
    payload
  );
  return response.data;
}

/**
 * Update an unsubmitted draft. The backend finalizes it when is_submitted=true.
 * PATCH /api/v1/evaluations/{evaluationId}
 */
export async function updateCandidateEvaluation(
  evaluationId: number,
  payload: CandidateEvaluationPayload
): Promise<CandidateEvaluation> {
  const response = await apiClient.patch<CandidateEvaluation>(
    `/evaluations/${evaluationId}`,
    payload
  );
  return response.data;
}

/**
 * Explicitly submit an existing draft if the caller needs the dedicated route.
 * POST /api/v1/evaluations/{evaluationId}/submit
 */
export async function submitCandidateEvaluation(
  evaluationId: number
): Promise<CandidateEvaluation> {
  const response = await apiClient.post<CandidateEvaluation>(
    `/evaluations/${evaluationId}/submit`
  );
  return response.data;
}
