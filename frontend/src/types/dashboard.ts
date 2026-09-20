/**
 * CareerBridge Phase 22 Canonical Dashboard Types
 *
 * Grounded directly in backend Pydantic models (backend/app/schemas/dashboard.py).
 * All types represent real-time database-aggregated metrics.
 */

export interface StudentDashboard {
  total_applications: number;
  applications_under_review: number;
  shortlisted_applications: number;
  accepted_applications: number;
  saved_internships: number;
  upcoming_interviews: number;
}

export interface RecruiterDashboard {
  active_internships: number;
  total_applications: number;
  applications_awaiting_review: number;
  shortlisted_candidates: number;
  scheduled_interviews: number;
}

export interface MonthlyRegistrationMetric {
  month: string; // 'YYYY-MM'
  count: number;
}

export interface AdminDashboard {
  total_students: number;
  total_companies: number;
  verified_companies: number;
  published_internships: number;
  total_applications: number;
  application_success_rate: number; // 0.0 to 100.0
  monthly_registrations: MonthlyRegistrationMetric[];
}
