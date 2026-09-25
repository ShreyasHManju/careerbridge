import { Skill } from './skill';

/**
 * CareerBridge Verified Experience Domain Types
 * Aligned strictly with Phase 2 backend schemas (app/schemas/experience_record.py and app/models/experience_record.py)
 */

export type ExperienceType =
  | 'project'
  | 'internship'
  | 'work'
  | 'research'
  | 'leadership'
  | 'certification';

export type VerificationStatus =
  | 'draft'
  | 'claimed'
  | 'pending_verification'
  | 'verified'
  | 'rejected';

export type VerificationSource =
  | 'self_claimed'
  | 'platform_project'
  | 'recruiter_confirmed'
  | 'admin_confirmed';

export interface ExperienceSkill {
  id: number;
  experience_record_id: number;
  skill_id: number;
  created_at: string;
  skill?: Skill;
}

export interface ExperienceRecord {
  id: number;
  student_id: number;
  title: string;
  organization_name: string | null;
  experience_type: ExperienceType;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  description: string;
  status: VerificationStatus;
  verification_source: VerificationSource;
  innovation_project_id: number | null;
  verifier_id: number | null;
  verifier_name?: string | null;
  verified_at: string | null;
  verification_notes: string | null;
  skills: string | null;
  structured_skills?: Skill[] | null;
  created_at: string;
  updated_at: string;
}

export interface ExperienceRecordCreate {
  title: string;
  organization_name?: string | null;
  experience_type?: ExperienceType;
  start_date: string;
  end_date?: string | null;
  is_current?: boolean;
  description: string;
  skills?: string | null;
  innovation_project_id?: number | null;
  status?: VerificationStatus;
}

export interface ExperienceRecordUpdate {
  title?: string;
  organization_name?: string | null;
  experience_type?: ExperienceType;
  start_date?: string;
  end_date?: string | null;
  is_current?: boolean;
  description?: string;
  skills?: string | null;
  innovation_project_id?: number | null;
  status?: VerificationStatus;
}

export interface ExperienceVerificationDecision {
  action: 'approve' | 'reject';
  notes?: string | null;
}

export interface ExperienceRecordListResponse {
  items: ExperienceRecord[];
  total: number;
}
