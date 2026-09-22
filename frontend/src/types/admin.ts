/**
 * Platform Administration & Moderation TypeScript Definitions
 * Strictly aligned with CareerBridge backend Pydantic schemas.
 */

export interface AdminUser {
  id: number;
  email: string;
  role: 'student' | 'recruiter' | 'admin';
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminUserPaginationResponse {
  items: AdminUser[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface AdminUserStatusUpdate {
  is_active: boolean;
}

export interface AdminUserQueryParams {
  search?: string;
  role?: 'student' | 'recruiter' | 'admin';
  is_active?: boolean;
  page?: number;
  page_size?: number;
}

export interface AdminRecruiter {
  id: number;
  user_id: number;
  email: string | null;
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

export interface AdminRecruiterPaginationResponse {
  items: AdminRecruiter[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface AdminRecruiterVerificationUpdate {
  is_verified: boolean;
}

export interface AdminRecruiterQueryParams {
  search?: string;
  is_verified?: boolean;
  page?: number;
  page_size?: number;
}

export interface AdminJobQueryParams {
  search?: string;
  opportunity_type?: 'internship' | 'job';
  employment_type?: 'full_time' | 'part_time' | 'contract' | 'internship';
  is_active?: boolean;
  page?: number;
  page_size?: number;
}

export interface AdminJobStatusUpdate {
  is_active: boolean;
}
