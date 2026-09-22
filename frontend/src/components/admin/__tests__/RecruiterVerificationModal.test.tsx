import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecruiterVerificationModal } from '../RecruiterVerificationModal';
import * as adminApi from '@/api/admin';
import { AdminRecruiter } from '@/types/admin';

vi.mock('@/api/admin');

const mockRecruiter: AdminRecruiter = {
  id: 10,
  user_id: 5,
  email: 'recruiter@company.com',
  company_name: 'Nexus Corp',
  company_description: 'AI & Cloud',
  contact_name: 'Alice Talent',
  phone: '+1234567890',
  company_website: 'https://nexus.io',
  company_location: 'Seattle, WA',
  industry: 'Technology',
  company_size: '50-100',
  is_verified: false,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
};

describe('RecruiterVerificationModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <RecruiterVerificationModal
        isOpen={false}
        recruiter={mockRecruiter}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('verifies recruiter successfully using user_id', async () => {
    const updateSpy = vi
      .spyOn(adminApi, 'updateAdminRecruiterVerification')
      .mockResolvedValue({
        ...mockRecruiter,
        is_verified: true,
      });
    const onClose = vi.fn();
    const onSuccess = vi.fn();

    render(
      <RecruiterVerificationModal
        isOpen={true}
        recruiter={mockRecruiter}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    expect(screen.getByText('Verify Recruiter Organization')).toBeInTheDocument();
    expect(screen.getByText('Nexus Corp')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('confirm-verification-btn'));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(5, { is_verified: true });
      expect(onSuccess).toHaveBeenCalledWith({ ...mockRecruiter, is_verified: true });
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('unverifies recruiter when currently verified', async () => {
    const verifiedRecruiter = { ...mockRecruiter, is_verified: true };
    const updateSpy = vi
      .spyOn(adminApi, 'updateAdminRecruiterVerification')
      .mockResolvedValue({
        ...mockRecruiter,
        is_verified: false,
      });

    render(
      <RecruiterVerificationModal
        isOpen={true}
        recruiter={verifiedRecruiter}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByText('Unverify Recruiter Organization')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('confirm-verification-btn'));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(5, { is_verified: false });
    });
  });
});
