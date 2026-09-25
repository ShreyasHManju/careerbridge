import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminExperienceVerificationPage } from '../AdminExperienceVerificationPage';
import * as experiencesApi from '@/api/experiences';
import { ExperienceRecord, ExperienceRecordListResponse } from '@/types/experience';

const mockAdminPendingExperiences: ExperienceRecord[] = [
  {
    id: 201,
    student_id: 30,
    title: 'Lead Open Source Maintainer',
    organization_name: 'Community Org',
    experience_type: 'leadership',
    start_date: '2024-01-01',
    end_date: '2024-12-31',
    is_current: false,
    description: 'Led a team of 15 developers maintaining core open source libraries.',
    status: 'pending_verification',
    verification_source: 'self_claimed',
    innovation_project_id: null,
    verifier_id: null,
    verifier_name: null,
    verified_at: null,
    verification_notes: null,
    skills: 'Leadership, Python, Git',
    structured_skills: [],
    created_at: '2026-09-25T00:00:00Z',
    updated_at: '2026-09-25T00:00:00Z',
  },
];

describe('AdminExperienceVerificationPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders administrator queue and displays claims', async () => {
    const listResponse: ExperienceRecordListResponse = {
      items: mockAdminPendingExperiences,
      total: 1,
    };
    vi.spyOn(experiencesApi, 'getPendingVerifications').mockResolvedValueOnce(listResponse);

    render(
      <MemoryRouter>
        <AdminExperienceVerificationPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Loading platform verification requests...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Lead Open Source Maintainer')).toBeInTheDocument();
      expect(screen.getByText('Platform Claims Pending')).toBeInTheDocument();
    });
  });

  it('renders clear empty state when no administrator reviews are pending', async () => {
    vi.spyOn(experiencesApi, 'getPendingVerifications').mockResolvedValueOnce({
      items: [],
      total: 0,
    });

    render(
      <MemoryRouter>
        <AdminExperienceVerificationPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('All Verification Claims Processed')).toBeInTheDocument();
    });
  });

  it('allows administrator to approve a claim', async () => {
    vi.spyOn(experiencesApi, 'getPendingVerifications').mockResolvedValueOnce({
      items: mockAdminPendingExperiences,
      total: 1,
    });

    const verifiedRecord: ExperienceRecord = {
      ...mockAdminPendingExperiences[0],
      status: 'verified',
      verification_source: 'admin_confirmed',
    };

    const decideSpy = vi
      .spyOn(experiencesApi, 'decideExperienceVerification')
      .mockResolvedValueOnce(verifiedRecord);

    render(
      <MemoryRouter>
        <AdminExperienceVerificationPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Lead Open Source Maintainer')).toBeInTheDocument();
    });

    const approveBtn = screen.getByTestId('approve-btn-201');
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(decideSpy).toHaveBeenCalledWith(201, { action: 'approve' });
      expect(screen.queryByText('Lead Open Source Maintainer')).not.toBeInTheDocument();
      expect(
        screen.getByText(
          'Admin decision recorded: Experience "Lead Open Source Maintainer" was verified.'
        )
      ).toBeInTheDocument();
    });
  });
});
