import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient } from '../client';
import {
  createProject,
  deleteProject,
  getMyProjects,
  getProjectById,
  getProjects,
  updateProject,
} from '../innovationProjects';
import { InnovationProject, InnovationProjectPaginationResponse } from '@/types/innovationProject';

const mockProject: InnovationProject = {
  id: 1,
  student_id: 10,
  title: 'Autonomous Drone Swarm',
  slug: 'autonomous-drone-swarm',
  short_description: 'Cooperative drone swarm mapping',
  description: 'ROS2 and PyTorch edge-based decentralized swarm controller.',
  project_type: 'software',
  status: 'active',
  visibility: 'public',
  skills: 'Python, ROS2, PyTorch',
  structured_skills: [
    { id: 1, name: 'Python', slug: 'python', category: 'Backend', is_verified: true, created_at: '2026-09-24T00:00:00Z' },
  ],
  repository_url: 'https://github.com/student/drone-swarm',
  live_demo_url: 'https://drones.demo.io',
  created_at: '2026-09-24T00:00:00Z',
  updated_at: '2026-09-24T00:00:00Z',
  owner_name: 'Test Student',
};

describe('Innovation Projects API Service Module', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getMyProjects', () => {
    it('calls GET /innovation-projects/my without params', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: [mockProject] });
      const res = await getMyProjects();
      expect(getSpy).toHaveBeenCalledWith('/innovation-projects/my', { params: undefined });
      expect(res).toEqual([mockProject]);
    });

    it('calls GET /innovation-projects/my with status filter', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: [mockProject] });
      const res = await getMyProjects('draft');
      expect(getSpy).toHaveBeenCalledWith('/innovation-projects/my', { params: { status: 'draft' } });
      expect(res).toEqual([mockProject]);
    });
  });

  describe('getProjects', () => {
    it('calls GET /innovation-projects with query params', async () => {
      const paginationData: InnovationProjectPaginationResponse = {
        items: [mockProject],
        page: 1,
        page_size: 10,
        total: 1,
        total_pages: 1,
      };
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: paginationData });
      const res = await getProjects({ q: 'Drone', project_type: 'software', page: 1, page_size: 10 });
      expect(getSpy).toHaveBeenCalledWith('/innovation-projects', {
        params: { q: 'Drone', project_type: 'software', page: 1, page_size: 10 },
      });
      expect(res).toEqual(paginationData);
    });
  });

  describe('getProjectById', () => {
    it('calls GET /innovation-projects/:id', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: mockProject });
      const res = await getProjectById(1);
      expect(getSpy).toHaveBeenCalledWith('/innovation-projects/1');
      expect(res).toEqual(mockProject);
    });
  });

  describe('createProject', () => {
    it('calls POST /innovation-projects with payload', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: mockProject });
      const payload = {
        title: 'Autonomous Drone Swarm',
        description: 'ROS2 and PyTorch edge-based decentralized swarm controller.',
        project_type: 'software' as const,
      };
      const res = await createProject(payload);
      expect(postSpy).toHaveBeenCalledWith('/innovation-projects', payload);
      expect(res).toEqual(mockProject);
    });
  });

  describe('updateProject', () => {
    it('calls PATCH /innovation-projects/:id with partial payload', async () => {
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({ data: mockProject });
      const payload = { title: 'Updated Title' };
      const res = await updateProject(1, payload);
      expect(patchSpy).toHaveBeenCalledWith('/innovation-projects/1', payload);
      expect(res).toEqual(mockProject);
    });
  });

  describe('deleteProject', () => {
    it('calls DELETE /innovation-projects/:id', async () => {
      const deleteSpy = vi.spyOn(apiClient, 'delete').mockResolvedValueOnce({ data: null });
      await deleteProject(1);
      expect(deleteSpy).toHaveBeenCalledWith('/innovation-projects/1');
    });
  });
});
