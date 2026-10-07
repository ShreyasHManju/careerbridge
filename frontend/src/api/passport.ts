import { apiClient } from './client';
import {
  PassportResponse,
  PassportShareCreateRequest,
  PassportShareCreateResponse,
  PassportShareSummaryResponse,
  PassportShareUpdateRequest,
  PublicPassportResponse,
} from '@/types/passport';

/**
 * CareerBridge Experience Passport API Service Module
 * Implements endpoints from Phase 2 & Phase 36 backend (app/routers/passport.py).
 */

export const getMyPassport = async (): Promise<PassportResponse> => {
  const response = await apiClient.get<PassportResponse>('/passport/me');
  return response.data;
};

export const getStudentPassport = async (
  studentId: number
): Promise<PassportResponse> => {
  const response = await apiClient.get<PassportResponse>(`/passport/${studentId}`);
  return response.data;
};

// ==============================================================================
// Phase 36: Passport Sharing & Public Career Passport Portal API
// ==============================================================================

/**
 * Generates a new granular public share link for the authenticated student.
 * The raw token and full share URL are returned only in this creation response.
 */
export const createPassportShare = async (
  payload: PassportShareCreateRequest
): Promise<PassportShareCreateResponse> => {
  const response = await apiClient.post<PassportShareCreateResponse>(
    '/passport/shares',
    payload
  );
  return response.data;
};

/**
 * Retrieves all active and historical share links owned by the authenticated student.
 */
export const listPassportShares = async (): Promise<PassportShareSummaryResponse[]> => {
  const response = await apiClient.get<PassportShareSummaryResponse[]>('/passport/shares');
  return response.data;
};

/**
 * Updates settings (label, visibility, active state, expiration) on an existing share link.
 */
export const updatePassportShare = async (
  shareId: number,
  payload: PassportShareUpdateRequest
): Promise<PassportShareSummaryResponse> => {
  const response = await apiClient.patch<PassportShareSummaryResponse>(
    `/passport/shares/${shareId}`,
    payload
  );
  return response.data;
};

/**
 * Revokes and deactivates a share link owned by the authenticated student.
 */
export const revokePassportShare = async (shareId: number): Promise<void> => {
  await apiClient.delete(`/passport/shares/${shareId}`);
};

/**
 * Resolves a public Career Passport share token into an explicit sanitized verification projection.
 * Does not require authentication.
 */
export const getPublicPassport = async (
  shareToken: string
): Promise<PublicPassportResponse> => {
  const response = await apiClient.get<PublicPassportResponse>(
    `/public/passport/${encodeURIComponent(shareToken)}`
  );
  return response.data;
};
