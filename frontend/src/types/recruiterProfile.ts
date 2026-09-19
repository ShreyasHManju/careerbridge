/**
 * Recruiter & Company Profile Type Definitions
 * Strictly aligned with backend Pydantic schemas in app/schemas/recruiter_profile.py
 */

export interface RecruiterProfile {
  id: number;
  user_id: number;
  company_name: string;
  company_description: string | null;
  contact_name: string | null;
  phone: string | null;
  company_website: string | null;
  company_location: string | null;
  industry: string | null;
  company_size: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecruiterProfileCreateRequest {
  company_name: string;
  company_description?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  company_website?: string | null;
  company_location?: string | null;
  industry?: string | null;
  company_size?: string | null;
}

export interface RecruiterProfileUpdateRequest {
  company_name?: string | null;
  company_description?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  company_website?: string | null;
  company_location?: string | null;
  industry?: string | null;
  company_size?: string | null;
}
