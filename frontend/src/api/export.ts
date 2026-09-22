import { apiClient } from './client';

/**
 * Trigger browser file download from a Blob
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Export recruiter candidate applications as CSV.
 * GET /api/v1/recruiter/applications/export
 */
export async function exportRecruiterApplications(): Promise<void> {
  const response = await apiClient.get<Blob>('/recruiter/applications/export', {
    responseType: 'blob',
  });
  triggerBlobDownload(response.data, 'candidate_applications.csv');
}

/**
 * Export recruiter scheduled interviews as CSV.
 * GET /api/v1/recruiter/interviews/export
 */
export async function exportRecruiterInterviews(): Promise<void> {
  const response = await apiClient.get<Blob>('/recruiter/interviews/export', {
    responseType: 'blob',
  });
  triggerBlobDownload(response.data, 'recruiter_interviews.csv');
}

/**
 * Export platform user directory as CSV (Admin only).
 * GET /api/v1/admin/users/export
 */
export async function exportAdminUsers(): Promise<void> {
  const response = await apiClient.get<Blob>('/admin/users/export', {
    responseType: 'blob',
  });
  triggerBlobDownload(response.data, 'admin_users.csv');
}
