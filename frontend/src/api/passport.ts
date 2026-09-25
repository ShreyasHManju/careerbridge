import { apiClient } from './client';
import { PassportResponse } from '@/types/passport';

/**
 * CareerBridge Experience Passport API Service Module
 * Implements endpoints from Phase 2 backend (app/routers/passport.py).
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
