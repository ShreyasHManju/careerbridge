/**
 * Canonical Job Offer TypeScript Definitions (Phase 35B.4)
 * Strictly aligned with backend schemas in app/schemas/job_offer.py
 * and models in app/models/job_offer.py.
 */

export type OfferStatus =
  | 'draft'
  | 'offered'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'expired';

export interface JobOffer {
  id: number;
  application_id: number;
  recruiter_id: number;
  status: OfferStatus;
  title: string;
  compensation: number | null;
  currency: string;
  start_date: string | null;
  expiration_date: string | null;
  terms: string | null;
  created_at: string;
  updated_at: string;

  // Metadata fields for display
  job_id?: number | null;
  job_title?: string | null;
  company_name?: string | null;
  student_id?: number | null;
  student_name?: string | null;
  student_email?: string | null;
  recruiter_name?: string | null;
}

export interface JobOfferCreate {
  title: string;
  compensation?: number | null;
  currency?: string;
  start_date?: string | null;
  expiration_date?: string | null;
  terms?: string | null;
}

export interface JobOfferUpdate {
  title?: string;
  compensation?: number | null;
  currency?: string;
  start_date?: string | null;
  expiration_date?: string | null;
  terms?: string | null;
  status?: OfferStatus;
}

export interface JobOfferListResponse {
  total: number;
  items: JobOffer[];
}
