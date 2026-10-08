import { apiClient } from './client';
import {
  ProjectBlueprintDetail,
  ProjectBlueprintPaginationResponse,
  JobProjectRecommendationsResponse,
  SkillProjectRecommendationsResponse,
} from '@/types/projectBlueprint';
import { InnovationProject } from '@/types/innovationProject';

export interface ListBlueprintsParams {
  search?: string;
  difficulty?: string;
  project_type?: string;
  page?: number;
  page_size?: number;
}

/**
 * List published project blueprints (or all statuses for admins) with optional filtering.
 */
export const listBlueprints = async (
  params?: ListBlueprintsParams
): Promise<ProjectBlueprintPaginationResponse> => {
  const response = await apiClient.get<ProjectBlueprintPaginationResponse>('/projects/blueprints', {
    params,
  });
  return response.data;
};

/**
 * Retrieve detailed project blueprint information including milestones and evidence guidance.
 */
export const getBlueprintDetail = async (blueprintId: number): Promise<ProjectBlueprintDetail> => {
  const response = await apiClient.get<ProjectBlueprintDetail>(`/projects/blueprints/${blueprintId}`);
  return response.data;
};

/**
 * Get personalized project blueprint recommendations for skill gaps identified against a job posting.
 */
export const getJobProjectRecommendations = async (
  jobId: number
): Promise<JobProjectRecommendationsResponse> => {
  const response = await apiClient.get<JobProjectRecommendationsResponse>(
    `/projects/recommendations/jobs/${jobId}`
  );
  return response.data;
};

/**
 * Get recommended project blueprints covering an explicit set of target skill IDs.
 */
export const getSkillsProjectRecommendations = async (
  skillIds: number[]
): Promise<SkillProjectRecommendationsResponse> => {
  const params = new URLSearchParams();
  skillIds.forEach((id) => params.append('skill_ids', id.toString()));

  const response = await apiClient.get<SkillProjectRecommendationsResponse>(
    `/projects/recommendations/skills?${params.toString()}`
  );
  return response.data;
};

/**
 * Instantiate a published blueprint into a new private InnovationProject owned by the authenticated student.
 */
export const instantiateBlueprint = async (blueprintId: number): Promise<InnovationProject> => {
  const response = await apiClient.post<InnovationProject>(
    `/projects/blueprints/${blueprintId}/instantiate`
  );
  return response.data;
};
