import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient } from '../client';
import { getSkills } from '../skills';
import { Skill } from '@/types/skill';

const mockSkills: Skill[] = [
  {
    id: 1,
    name: 'Python',
    slug: 'python',
    category: 'Backend',
    is_verified: true,
    created_at: '2026-09-23T00:00:00Z',
  },
  {
    id: 2,
    name: 'React',
    slug: 'react',
    category: 'Frontend',
    is_verified: true,
    created_at: '2026-09-23T00:00:00Z',
  },
];

describe('Skills API Service Module', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSkills', () => {
    it('dispatches GET to /skills with empty params when no search options given', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockSkills,
      });

      const result = await getSkills();

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith('/skills', { params: {} });
      expect(result).toEqual(mockSkills);
    });

    it('dispatches GET to /skills with q, category, and limit query parameters', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: [mockSkills[0]],
      });

      const result = await getSkills({ q: 'py', category: 'Backend', limit: 5 });

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith('/skills', {
        params: {
          q: 'py',
          category: 'Backend',
          limit: 5,
        },
      });
      expect(result).toEqual([mockSkills[0]]);
    });

    it('propagates network or API errors from the client', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValueOnce({
        success: false,
        message: 'Internal server error',
        error_code: 'INTERNAL_SERVER_ERROR',
        status: 500,
      });

      await expect(getSkills({ q: 'error' })).rejects.toEqual(
        expect.objectContaining({
          success: false,
          error_code: 'INTERNAL_SERVER_ERROR',
        })
      );
    });
  });
});
