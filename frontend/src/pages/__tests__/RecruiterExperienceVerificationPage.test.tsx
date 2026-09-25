import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecruiterExperienceVerificationPage } from '../RecruiterExperienceVerificationPage';
import * as experiencesApi from '@/api/experiences';
import { ExperienceRecord, ExperienceRecordListResponse } from '@/types/experience';

const mockPendingExperiences: ExperienceRecord[] = [
  {
    id: 101,
    student_id: 15,
    title: 'Cloud Infrastructure Intern',
    organization_name: 'Apex Cloud Systems',
    experience_type: 'internship',
    start_date: '2025-05-01',
    end_date: '2025-08-31',
    is_current: false,
    description: 'Designed Terraform modules and automated CI/CD deployment pipelines.',
    status: 'pending_verification',
    verification_source: 'self_claimed',
    innovation_project_id: null,
    verifier_id: null,
    verifier_name: null,
    verified_at: null,
    verification_notes: null,
    skills: 'Terraform, Docker, AWS',
    structured_skills: [],
    created_at: '2026-09-25T00:00:00Z',
    updated_at: '2026-09-25T00:00:00Z',
  },
  {
    id: 102,
    student_id: 16,
    title: 'ML Engineering Intern',
    organization_name: 'Apex Cloud Systems',
    experience_type: 'internship',
    start_date: '2025-06-01',
    end_date: '2025-09-01',
    is_current: false,
    description: 'Deployed LLM quantization pipelines and evaluated latency.',
    status: 'pending_verification',
    verification_source: 'self_claimed',
    innovation_project_id: null,
    verifier_id: null,
    verifier_name: null,
    verified_at: null,
    verification_notes: null,
    skills: 'PyTorch, Python',
    structured_skills: [],
    created_at: '2026-09-25T00:00:00Z',
    updated_at: '2026-09-25T00:00:00Z',
  },
];

describe('RecruiterExperienceVerificationPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state initially and then shows pending requests', async () => {
    const listResponse: ExperienceRecordListResponse = {
      items: mockPendingExperiences,
      total: 2,
    };
    vi.spyOn(experiencesApi, 'getPendingVerifications').mockResolvedValueOnce(listResponse);

    render(
      <MemoryRouter>
        <RecruiterExperienceVerificationPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Loading pending verification requests...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Cloud Infrastructure Intern')).toBeInTheDocument();
      expect(screen.getByText('ML Engineering Intern')).toBeInTheDocument();
    });
  });

  it('renders clear empty state when queue is empty', async () => {
    vi.spyOn(experiencesApi, 'getPendingVerifications').mockResolvedValueOnce({
      items: [],
      total: 0,
    });

    render(
      <MemoryRouter>
        <RecruiterExperienceVerificationPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Queue is Clear')).toBeInTheDocument();
      expect(
        screen.getByText(
          'There are no pending experience verification claims awaiting review at this time.'
        )
      ).toBeInTheDocument();
    });
  });

  it('handles API loading error and allows retry', async () => {
    const getSpy = vi
      .spyOn(experiencesApi, 'getPendingVerifications')
      .mockRejectedValueOnce(new Error('Internal server error fetching queue'))
      .mockResolvedValueOnce({ items: mockPendingExperiences, total: 2 });

    render(
      <MemoryRouter>
        <RecruiterExperienceVerificationPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to load verification queue')).toBeInTheDocument();
      expect(
        screen.getByText('Internal server error fetching queue')
      ).toBeInTheDocument();
    });

    const retryBtn = screen.getByTestId('retry-verification-btn');
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Cloud Infrastructure Intern')).toBeInTheDocument();
    });
    expect(getSpy).toHaveBeenCalledTimes(2);
  });

  it('approves a verification request and updates local queue state', async () => {
    vi.spyOn(experiencesApi, 'getPendingVerifications').mockResolvedValueOnce({
      items: mockPendingExperiences,
      total: 2,
    });

    const verifiedRecord: ExperienceRecord = {
      ...mockPendingExperiences[0],
      status: 'verified',
      verification_source: 'recruiter_confirmed',
    };

    const decideSpy = vi
      .spyOn(experiencesApi, 'decideExperienceVerification')
      .mockResolvedValueOnce(verifiedRecord);

    render(
      <MemoryRouter>
        <RecruiterExperienceVerificationPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Cloud Infrastructure Intern')).toBeInTheDocument();
    });

    const approveBtn = screen.getByTestId('approve-btn-101');
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(decideSpy).toHaveBeenCalledWith(101, { action: 'approve' });
      expect(screen.queryByText('Cloud Infrastructure Intern')).not.toBeInTheDocument();
      expect(
        screen.getByText('Experience "Cloud Infrastructure Intern" was verified successfully.')
      ).toBeInTheDocument();
    });
  });

  it('rejects a verification request with notes and updates local queue state', async () => {
    vi.spyOn(experiencesApi, 'getPendingVerifications').mockResolvedValueOnce({
      items: mockPendingExperiences,
      total: 2,
    });

    const rejectedRecord: ExperienceRecord = {
      ...mockPendingExperiences[0],
      status: 'rejected',
    };

    const decideSpy = vi
      .spyOn(experiencesApi, 'decideExperienceVerification')
      .mockResolvedValueOnce(rejectedRecord);

    render(
      <MemoryRouter>
        <RecruiterExperienceVerificationPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Cloud Infrastructure Intern')).toBeInTheDocument();
    });

    const rejectBtn = screen.getByTestId('reject-btn-101');
    fireEvent.click(rejectBtn);

    expect(screen.getByTestId('rejection-box-101')).toBeInTheDocument();

    const notesInput = screen.getByLabelText(/Reason for Rejection/i);
    fireEvent.change(notesInput, {
      target: { value: 'Candidate dates do not align with company records.' },
    });

    const confirmRejectBtn = screen.getByTestId('confirm-reject-btn-101');
    fireEvent.click(confirmRejectBtn);

    await waitFor(() => {
      expect(decideSpy).toHaveBeenCalledWith(101, {
        action: 'reject',
        notes: 'Candidate dates do not align with company records.',
      });
      expect(screen.queryByText('Cloud Infrastructure Intern')).not.toBeInTheDocument();
      expect(
        screen.getByText('Experience "Cloud Infrastructure Intern" was rejected successfully.')
      ).toBeInTheDocument();
    });
  });

  it('preserves list state on decision failure and displays structured error', async () => {
    vi.spyOn(experiencesApi, 'getPendingVerifications').mockResolvedValueOnce({
      items: mockPendingExperiences,
      total: 2,
    });

    vi.spyOn(experiencesApi, 'decideExperienceVerification').mockRejectedValueOnce({
      message: 'Unauthorized: verifier cannot decide this record',
    });

    render(
      <MemoryRouter>
        <RecruiterExperienceVerificationPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Cloud Infrastructure Intern')).toBeInTheDocument();
    });

    const approveBtn = screen.getByTestId('approve-btn-101');
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(
        screen.getByText('Unauthorized: verifier cannot decide this record')
      ).toBeInTheDocument();
      // Items remain in the UI
      expect(screen.getByText('Cloud Infrastructure Intern')).toBeInTheDocument();
      expect(screen.getByText('ML Engineering Intern')).toBeInTheDocument();
    });
  });
});
