import { apiClient } from './client';
import {
  InnovationProject,
  InnovationProjectCreate,
  InnovationProjectPaginationResponse,
  InnovationProjectUpdate,
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
