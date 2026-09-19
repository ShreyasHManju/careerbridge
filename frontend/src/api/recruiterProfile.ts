import { apiClient } from './client';
import {
  RecruiterProfile,
  RecruiterProfileCreateRequest,
  RecruiterProfileUpdateRequest,
} from '@/types/recruiterProfile';

/**
 * Recruiter Profile API Service Module
 * Dispatches requests to /recruiter/profile using the shared apiClient.
 */

/**
 * Fetch the authenticated recruiter's profile.
 * Returns 404 if profile does not exist yet.
 */
export async function getRecruiterProfileApi(): Promise<RecruiterProfile> {
  const response = await apiClient.get<RecruiterProfile>('/recruiter/profile');
  return response.data;
}

/**
 * Create a new profile for the authenticated recruiter.
 * Returns 201 on success, 409 if profile already exists.
 */
export async function createRecruiterProfileApi(
  data: RecruiterProfileCreateRequest
): Promise<RecruiterProfile> {
  const response = await apiClient.post<RecruiterProfile>('/recruiter/profile', data);
  return response.data;
}

/**
 * Partially update existing recruiter profile.
 * Returns 200 on success, 404 if profile does not exist.
 */
export async function updateRecruiterProfileApi(
  data: RecruiterProfileUpdateRequest
): Promise<RecruiterProfile> {
  const response = await apiClient.patch<RecruiterProfile>('/recruiter/profile', data);
  return response.data;
}
