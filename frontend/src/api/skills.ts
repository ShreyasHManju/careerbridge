import { apiClient } from './client';
import { Skill, SkillSearchParams } from '@/types/skill';

/**
 * CareerBridge Structured Skills API Service
 * Handles canonical skill search and autocomplete.
 */

export async function getSkills(params: SkillSearchParams = {}): Promise<Skill[]> {
  const queryParams: Record<string, string | number> = {};

  if (params.q && params.q.trim()) {
    queryParams.q = params.q.trim();
  }
  if (params.category && params.category.trim()) {
    queryParams.category = params.category.trim();
  }
  if (typeof params.limit === 'number' && params.limit > 0) {
    queryParams.limit = params.limit;
  }

  const response = await apiClient.get<Skill[]>('/skills', { params: queryParams });
  return response.data;
}
