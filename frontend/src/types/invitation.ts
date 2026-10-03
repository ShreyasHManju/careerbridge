export type InvitationStatus = 'pending' | 'accepted' | 'declined';

export interface JobInvitationJobSummary {
  id: number;
  title: string;
  company_name: string;
  location?: string | null;
  is_remote: boolean;
  opportunity_type: string;
  is_active: boolean;
}

export interface JobInvitationRecruiterSummary {
  id: number;
  full_name?: string | null;
  company_name?: string | null;
}

export interface JobInvitationStudentSummary {
  id: number;
  full_name?: string | null;
  college?: string | null;
  degree?: string | null;
}

export interface JobInvitation {
  id: number;
  job_id: number;
  recruiter_id: number;
  student_id: number;
  message?: string | null;
  status: InvitationStatus;
  created_at: string;
  updated_at: string;
  responded_at?: string | null;
  job_posting?: JobInvitationJobSummary | null;
  recruiter?: JobInvitationRecruiterSummary | null;
  student?: JobInvitationStudentSummary | null;
}

export interface CreateJobInvitationPayload {
  student_id: number;
  message?: string;
}

export interface RespondJobInvitationPayload {
  status: 'accepted' | 'declined';
}
