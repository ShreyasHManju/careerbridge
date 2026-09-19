/**
 * Opportunity Discovery (Job & Internship) Type Definitions
 * Strictly aligned with backend schemas in app/schemas/job_posting.py,
 * app/schemas/saved_job.py, and app/schemas/application.py
 */

export type OpportunityType = 'internship' | 'job';
export type EmploymentType = 'full_time' | 'part_time' | 'contract';
export type JobSortBy = 'created_at' | 'application_deadline' | 'salary_min';
export type SortOrder = 'asc' | 'desc';

export interface JobPosting {
  id: number;
  recruiter_id: number;
  title: string;
  description: string;
  opportunity_type: OpportunityType;
  company_name: string;
  location: string | null;
  is_remote: boolean;
  employment_type: EmploymentType;
  skills: string | null;
  minimum_qualification: string | null;
  experience_required: string | null;
  salary_min: number | null;
  salary_max: number | null;
  application_deadline: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface JobPostingPagination {
  items: JobPosting[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface JobFilters {
  q?: string;
  opportunity_type?: OpportunityType;
  employment_type?: EmploymentType;
  is_remote?: boolean;
  location?: string;
  skills?: string;
  salary_min?: number;
  salary_max?: number;
  page?: number;
  page_size?: number;
  sort_by?: JobSortBy;
  sort_order?: SortOrder;
}

export interface SavedJobStatus {
  job_id: number;
  is_saved: boolean;
  saved_at: string | null;
}

export interface SavedJob {
  id: number;
  student_id: number;
  job_posting_id: number;
  created_at: string;
  job_posting: JobPosting;
}

export interface Application {
  id: number;
  job_posting_id: number;
  student_id: number;
  status: string;
  cover_message: string | null;
  resume_id: number;
  created_at: string;
  updated_at: string;
  job_posting?: JobPosting;
}

export interface ApplicationCreate {
  cover_message?: string;
}
