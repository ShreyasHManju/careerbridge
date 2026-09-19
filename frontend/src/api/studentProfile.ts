import { apiClient } from './client';
import {
  StudentProfile,
  StudentProfileCreateRequest,
  StudentProfileUpdateRequest,
} from '@/types/studentProfile';

/**
 * Student Profile API Service Layer
 * Interacts with /api/v1/student/profile endpoints.
 * Authentication (Bearer token injection) and error normalization are handled by apiClient.
 */

/**
 * Retrieve current authenticated student's profile.
 * Route: GET /api/v1/student/profile
 * Returns 404 if profile has not yet been created.
 */
export async function getStudentProfileApi(): Promise<StudentProfile> {
  const response = await apiClient.get<StudentProfile>('/student/profile');
  return response.data;
}

/**
 * Create initial profile for the authenticated student.
 * Route: POST /api/v1/student/profile
 * Returns 409 if profile already exists for the account.
 */
export async function createStudentProfileApi(
  data: StudentProfileCreateRequest
): Promise<StudentProfile> {
  const response = await apiClient.post<StudentProfile>('/student/profile', data);
  return response.data;
}

/**
 * Partially update existing profile fields for the authenticated student.
 * Route: PATCH /api/v1/student/profile
 * Returns 404 if profile does not exist.
 */
export async function updateStudentProfileApi(
  data: StudentProfileUpdateRequest
): Promise<StudentProfile> {
  const response = await apiClient.patch<StudentProfile>('/student/profile', data);
  return response.data;
}
