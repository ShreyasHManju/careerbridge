import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JobModerationModal } from '../JobModerationModal';
import * as adminApi from '@/api/admin';
import { JobPosting } from '@/types/job';

vi.mock('@/api/admin');

const mockJob: JobPosting = {
  id: 101,
  recruiter_id: 2,
  title: 'AI Robotics Engineer',
  description: 'Developing autonomous robots',
  opportunity_type: 'job',
  employment_type: 'full_time',
  location: 'Boston, MA',
  is_remote: true,
  skills: null,
  minimum_qualification: null,
  experience_required: null,
  salary_min: null,
  salary_max: null,
  application_deadline: null,
  is_active: true,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
  company_name: 'RoboCorp',
};

describe('JobModerationModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <JobModerationModal isOpen={false} job={mockJob} onClose={vi.fn()} onSuccess={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('deactivates active job on confirm', async () => {
    const updateSpy = vi.spyOn(adminApi, 'updateAdminJobStatus').mockResolvedValue({
      ...mockJob,
      is_active: false,
    });
    const onClose = vi.fn();
    const onSuccess = vi.fn();

    render(
      <JobModerationModal isOpen={true} job={mockJob} onClose={onClose} onSuccess={onSuccess} />
    );

    expect(screen.getByText('Deactivate Job Posting')).toBeInTheDocument();
    expect(screen.getByText(/AI Robotics Engineer/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('confirm-job-moderation-btn'));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(101, { is_active: false });
      expect(onSuccess).toHaveBeenCalledWith({ ...mockJob, is_active: false });
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('activates inactive job on confirm', async () => {
    const inactiveJob = { ...mockJob, is_active: false };
    const updateSpy = vi.spyOn(adminApi, 'updateAdminJobStatus').mockResolvedValue({
      ...mockJob,
      is_active: true,
    });

    render(
      <JobModerationModal isOpen={true} job={inactiveJob} onClose={vi.fn()} onSuccess={vi.fn()} />
    );

    expect(screen.getByText('Activate Job Posting')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('confirm-job-moderation-btn'));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(101, { is_active: true });
    });
  });
});
