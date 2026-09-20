import { apiClient } from './client';
import {
  StudentDashboard,
  RecruiterDashboard,
  AdminDashboard,
} from '@/types/dashboard';

/**
 * Retrieve database-aggregated metrics for the authenticated student.
 * Scoped strictly to current_user.id.
 */
export async function getStudentDashboard(): Promise<StudentDashboard> {
  const response = await apiClient.get<StudentDashboard>('/dashboard/student');
  return response.data;
}

/**
 * Retrieve database-aggregated metrics for the authenticated recruiter.
 * Scoped strictly to job postings owned by current_user.id.
 */
export async function getRecruiterDashboard(): Promise<RecruiterDashboard> {
  const response = await apiClient.get<RecruiterDashboard>('/dashboard/recruiter');
  return response.data;
}

/**
 * Retrieve platform-wide growth indicators and aggregated metrics for administrators.
 * Optionally filters monthly registrations by calendar year.
 */
export async function getAdminDashboard(periodYear?: number): Promise<AdminDashboard> {
  const params = periodYear ? { period_year: periodYear } : undefined;
  const response = await apiClient.get<AdminDashboard>('/dashboard/admin', { params });
  return response.data;
}
