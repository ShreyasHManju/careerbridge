import { apiClient } from './client';
import {
  ProjectEvaluation,
  ProjectEvaluationCreate,
  ProjectEvaluationUpdate,
} from '@/types/projectEvaluation';

/**
 * CareerBridge Recruiter Project Evaluation API Service Module (Phase 30C)
 */

export const createProjectEvaluation = async (
  projectId: number,
  payload: ProjectEvaluationCreate
): Promise<ProjectEvaluation> => {
  const response = await apiClient.post<ProjectEvaluation>(
    `/innovation-projects/${projectId}/evaluations`,
    payload
  );
  return response.data;
};

export const getProjectEvaluations = async (
  projectId: number
): Promise<ProjectEvaluation[]> => {
  const response = await apiClient.get<ProjectEvaluation[]>(
    `/innovation-projects/${projectId}/evaluations`
  );
  return response.data;
};

export const getProjectEvaluationById = async (
  evaluationId: number
): Promise<ProjectEvaluation> => {
  const response = await apiClient.get<ProjectEvaluation>(
    `/project-evaluations/${evaluationId}`
  );
  return response.data;
};

export const updateProjectEvaluation = async (
  evaluationId: number,
  payload: ProjectEvaluationUpdate
): Promise<ProjectEvaluation> => {
  const response = await apiClient.patch<ProjectEvaluation>(
    `/project-evaluations/${evaluationId}`,
    payload
  );
  return response.data;
};

export const submitProjectEvaluation = async (
  evaluationId: number
): Promise<ProjectEvaluation> => {
  const response = await apiClient.post<ProjectEvaluation>(
    `/project-evaluations/${evaluationId}/submit`
  );
  return response.data;
};

export const withdrawProjectEvaluation = async (
  evaluationId: number
): Promise<ProjectEvaluation> => {
  const response = await apiClient.post<ProjectEvaluation>(
    `/project-evaluations/${evaluationId}/withdraw`
  );
  return response.data;
};
