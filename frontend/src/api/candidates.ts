import { apiClient } from './client';
import {
  CandidateSearchFilters,
  CandidateSourcingResult,
} from '@/types/candidate';

/**
 * Recruiter Candidate Sourcing & Talent Discovery API Service (Phase 5 Step 2)
 */

export interface CandidateSearchResponse {
  items: CandidateSourcingResult[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * Search and filter discoverable student candidates.
 * GET /api/v1/recruiter/candidates
 */
export async function searchCandidates(
  filters: CandidateSearchFilters = {},
  page = 1,
  pageSize = 10
): Promise<CandidateSearchResponse> {
  const queryParams: Record<string, string | number | boolean> = {
    page,
    page_size: pageSize,
  };

  if (filters.query && filters.query.trim()) {
    queryParams.q = filters.query.trim();
  }
  if (filters.college && filters.college.trim()) {
    queryParams.college = filters.college.trim();
  }
  if (filters.degree && filters.degree.trim()) {
    queryParams.degree = filters.degree.trim();
  }
  if (filters.graduation_year) {
    queryParams.graduation_year = filters.graduation_year;
  }
  if (filters.has_verified_passport) {
    queryParams.has_verified_passport = true;
  }
  if (typeof filters.min_verified_skills === 'number' && filters.min_verified_skills > 0) {
    queryParams.min_verified_skills = filters.min_verified_skills;
  }
  if (filters.skills && filters.skills.length > 0) {
    queryParams.skills = filters.skills.join(',');
  }
  if (filters.sort_by) {
    queryParams.sort_by = filters.sort_by;
  }

  const response = await apiClient.get<CandidateSearchResponse>('/recruiter/candidates', {
    params: queryParams,
  });
  return response.data;
}
