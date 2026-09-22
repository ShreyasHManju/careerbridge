/**
 * Canonical Application Type Definitions (Phase F-06)
 * Strictly aligned with backend schemas in app/schemas/application.py
 * and models in app/models/application.py.
 */

export type ApplicationStatus =
  | 'applied'
  | 'reviewing'
  | 'shortlisted'
  | 'rejected'
  | 'accepted';

export interface Application {
  id: number;
  job_posting_id: number;
  student_id: number;
  cover_message: string | null;
  status: ApplicationStatus;
  created_at: string;
  updated_at: string;
}

export interface ApplicationCreate {
  cover_message?: string;
}

export interface ApplicationUpdate {
  status: ApplicationStatus;
}

export interface ApplicationBulkStatusUpdate {
  application_ids: number[];
  status: ApplicationStatus;
}

export interface ApplicationBulkStatusResponse {
  updated_count: number;
  status: ApplicationStatus;
  items: Application[];
}

/**
 * Filter status options for client-side filtering
 */
export type ApplicationFilterStatus = 'all' | ApplicationStatus;
