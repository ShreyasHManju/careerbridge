/**
 * Canonical Interview Type Definitions (Phase F-08)
 * Strictly aligned with backend schemas in app/schemas/interview.py
 * and models in app/models/interview.py.
 */

export type InterviewType = 'online' | 'in_person' | 'phone';

export type InterviewStatus =
  | 'scheduled'
  | 'completed'
  | 'cancelled'
  | 'rescheduled';

export interface Interview {
  id: number;
  application_id: number;
  recruiter_id: number;
  student_id: number;
  job_id: number | null;
  job_title: string | null;
  company_name: string | null;
  candidate_email: string | null;
  recruiter_email: string | null;
  scheduled_at: string;
  duration_minutes: number;
  interview_type: InterviewType;
  location_or_link: string | null;
  notes: string | null;
  status: InterviewStatus;
  created_at: string;
  updated_at: string;
}

export interface InterviewCreate {
  scheduled_at: string;
  duration_minutes: number;
  interview_type?: InterviewType;
  location_or_link?: string | null;
  notes?: string | null;
}

export interface InterviewUpdate {
  scheduled_at?: string;
  duration_minutes?: number;
  interview_type?: InterviewType;
  location_or_link?: string | null;
  notes?: string | null;
  status?: InterviewStatus;
}

/**
 * Filter status options for client-side filtering
 */
export type InterviewFilterStatus = 'all' | InterviewStatus;
