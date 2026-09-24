import { apiClient } from './client';
import {
  InnovationProject,
  InnovationProjectCreate,
  InnovationProjectPaginationResponse,
  InnovationProjectUpdate,
  ProjectMilestone,
  ProjectMilestoneCreate,
  ProjectMilestoneListResponse,
  ProjectMilestoneUpdate,
  ProjectStatus,
  ProjectType,
} from '@/types/innovationProject';

export interface GetProjectsParams {
  q?: string;
  project_type?: ProjectType;
  skill?: string;
  page?: number;
  page_size?: number;
}

export const getMyProjects = async (status?: ProjectStatus): Promise<InnovationProject[]> => {
  const response = await apiClient.get<InnovationProject[]>('/innovation-projects/my', {
    params: status ? { status } : undefined,
  });
  return response.data;
};

export const getProjects = async (params?: GetProjectsParams): Promise<InnovationProjectPaginationResponse> => {
  const response = await apiClient.get<InnovationProjectPaginationResponse>('/innovation-projects', {
    params,
  });
  return response.data;
};

export const getProjectById = async (id: number): Promise<InnovationProject> => {
  const response = await apiClient.get<InnovationProject>(`/innovation-projects/${id}`);
  return response.data;
};

export const createProject = async (payload: InnovationProjectCreate): Promise<InnovationProject> => {
  const response = await apiClient.post<InnovationProject>('/innovation-projects', payload);
  return response.data;
};

export const updateProject = async (
  id: number,
  payload: InnovationProjectUpdate
): Promise<InnovationProject> => {
  const response = await apiClient.patch<InnovationProject>(`/innovation-projects/${id}`, payload);
  return response.data;
};

export const deleteProject = async (id: number): Promise<void> => {
  await apiClient.delete(`/innovation-projects/${id}`);
};

// =========================================================================
// Project Milestones API (Milestone 2.0-C)
// =========================================================================

export const createProjectMilestone = async (
  projectId: number,
  payload: ProjectMilestoneCreate
): Promise<ProjectMilestone> => {
  const response = await apiClient.post<ProjectMilestone>(
    `/innovation-projects/${projectId}/milestones`,
    payload
  );
  return response.data;
};

export const getProjectMilestones = async (
  projectId: number
): Promise<ProjectMilestoneListResponse> => {
  const response = await apiClient.get<ProjectMilestoneListResponse>(
    `/innovation-projects/${projectId}/milestones`
  );
  return response.data;
};

export const updateProjectMilestone = async (
  projectId: number,
  milestoneId: number,
  payload: ProjectMilestoneUpdate
): Promise<ProjectMilestone> => {
  const response = await apiClient.patch<ProjectMilestone>(
    `/innovation-projects/${projectId}/milestones/${milestoneId}`,
    payload
  );
  return response.data;
};

export const deleteProjectMilestone = async (
  projectId: number,
  milestoneId: number
): Promise<void> => {
  await apiClient.delete(`/innovation-projects/${projectId}/milestones/${milestoneId}`);
};
