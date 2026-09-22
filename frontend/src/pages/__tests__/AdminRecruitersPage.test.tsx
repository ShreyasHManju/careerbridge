import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminRecruitersPage } from '../AdminRecruitersPage';
import * as adminApi from '@/api/admin';
import { AdminRecruiter, AdminRecruiterPaginationResponse } from '@/types/admin';

vi.mock('@/api/admin');

const mockRecruiter1: AdminRecruiter = {
  id: 1,
  user_id: 10,
  email: 'recruiter1@nexus.io',
  company_name: 'Nexus Tech',
  company_description: 'AI Cloud Platform',
  contact_name: 'Alice Johnson',
  phone: '+1-555-1234',
  company_website: 'https://nexus.io',
  company_location: 'Seattle, WA',
  industry: 'Technology',
  company_size: '50-100',
  is_verified: false,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
};

const mockRecruiter2: AdminRecruiter = {
  id: 2,
  user_id: 11,
  email: 'recruiter2@acme.com',
  company_name: 'Acme Corp',
  company_description: 'Global Logistics',
  contact_name: 'Bob Smith',
  phone: '+1-555-5678',
  company_website: 'https://acme.com',
  company_location: 'Chicago, IL',
  industry: 'Logistics',
  company_size: '500+',
  is_verified: true,
  created_at: '2026-09-02T10:00:00Z',
  updated_at: '2026-09-02T10:00:00Z',
};

const mockPaginationResponse: AdminRecruiterPaginationResponse = {
  items: [mockRecruiter1, mockRecruiter2],
  page: 1,
  page_size: 10,
  total: 2,
  total_pages: 1,
};

describe('AdminRecruitersPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.spyOn(adminApi, 'getAdminRecruiters').mockReturnValue(new Promise(() => {}));

    render(<AdminRecruitersPage />);

    expect(screen.getByText(/Loading recruiter organizations/i)).toBeInTheDocument();
  });

  it('renders recruiter list table with verification badges', async () => {
    vi.spyOn(adminApi, 'getAdminRecruiters').mockResolvedValue(mockPaginationResponse);

    render(<AdminRecruitersPage />);

    await waitFor(() => {
      expect(screen.getByText('Nexus Tech')).toBeInTheDocument();
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      expect(screen.getByTestId('unverified-badge-1')).toBeInTheDocument();
      expect(screen.getByTestId('verified-badge-2')).toBeInTheDocument();
    });
  });

  it('filters recruiters by search and verification status', async () => {
    const fetchSpy = vi
      .spyOn(adminApi, 'getAdminRecruiters')
      .mockResolvedValue(mockPaginationResponse);

    render(<AdminRecruitersPage />);

    await waitFor(() => {
      expect(screen.getByText('Nexus Tech')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('recruiter-search-input');
    fireEvent.change(searchInput, { target: { value: 'Nexus' } });
    fireEvent.click(screen.getByTestId('search-recruiters-btn'));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'Nexus', page: 1 })
      );
    });

    fireEvent.change(screen.getByTestId('verification-filter-select'), {
      target: { value: 'true' },
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ is_verified: true, page: 1 })
      );
    });
  });

  it('opens verification modal and updates recruiter status on success', async () => {
    vi.spyOn(adminApi, 'getAdminRecruiters').mockResolvedValue(mockPaginationResponse);
    vi.spyOn(adminApi, 'updateAdminRecruiterVerification').mockResolvedValue({
      ...mockRecruiter1,
      is_verified: true,
    });

    render(<AdminRecruitersPage />);

    await waitFor(() => {
      expect(screen.getByText('Nexus Tech')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-verify-1-btn'));

    expect(screen.getByTestId('recruiter-verification-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('confirm-verification-btn'));

    await waitFor(() => {
      expect(
        screen.getByText(/Recruiter organization 'Nexus Tech' verification status was updated to Verified/i)
      ).toBeInTheDocument();
    });
  });

  it('renders error state on fetch failure and retries', async () => {
    vi.spyOn(adminApi, 'getAdminRecruiters')
      .mockRejectedValueOnce({ detail: 'Network error' })
      .mockResolvedValueOnce(mockPaginationResponse);

    render(<AdminRecruitersPage />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('retry-recruiters-btn'));

    await waitFor(() => {
      expect(screen.getByText('Nexus Tech')).toBeInTheDocument();
    });
  });
});
