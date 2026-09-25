import { apiClient } from './client';
import {
  ExperienceRecord,
  ExperienceRecordCreate,
  ExperienceRecordListResponse,
  ExperienceRecordUpdate,
  ExperienceVerificationDecision,
} from '@/types/experience';

/**
 * CareerBridge Verified Experience API Service Module
 * Implements endpoints from Phase 2 backend (app/routers/experience_records.py).
 */

export const getMyExperiences = async (): Promise<ExperienceRecordListResponse> => {
  const response = await apiClient.get<ExperienceRecordListResponse>('/students/me/experiences');
  return response.data;
};

export const getMyExperience = async (experienceId: number): Promise<ExperienceRecord> => {
  const response = await apiClient.get<ExperienceRecord>(`/students/me/experiences/${experienceId}`);
  return response.data;
};

export const createExperience = async (
  payload: ExperienceRecordCreate
): Promise<ExperienceRecord> => {
  const response = await apiClient.post<ExperienceRecord>('/students/me/experiences', payload);
  return response.data;
};

export const updateExperience = async (
  experienceId: number,
  payload: ExperienceRecordUpdate
): Promise<ExperienceRecord> => {
  const response = await apiClient.patch<ExperienceRecord>(
    `/students/me/experiences/${experienceId}`,
    payload
  );
  return response.data;
};

export const deleteExperience = async (experienceId: number): Promise<void> => {
  await apiClient.delete(`/students/me/experiences/${experienceId}`);
};

export const requestExperienceVerification = async (
  experienceId: number
): Promise<ExperienceRecord> => {
  const response = await apiClient.post<ExperienceRecord>(
    `/students/me/experiences/${experienceId}/request-verification`
  );
  return response.data;
};

export const getPendingVerifications = async (): Promise<ExperienceRecordListResponse> => {
  const response = await apiClient.get<ExperienceRecordListResponse>('/verifications/pending');
  return response.data;
};

export const decideExperienceVerification = async (
  verificationId: number,
  payload: ExperienceVerificationDecision
): Promise<ExperienceRecord> => {
  const response = await apiClient.post<ExperienceRecord>(
    `/verifications/${verificationId}/decision`,
    payload
  );
  return response.data;
};

export const getStudentExperiences = async (
  studentId: number
): Promise<ExperienceRecordListResponse> => {
  const response = await apiClient.get<ExperienceRecordListResponse>(
    `/students/${studentId}/experiences`
  );
  return response.data;
};
