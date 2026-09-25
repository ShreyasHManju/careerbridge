import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { VerificationRequestCard } from '../VerificationRequestCard';
import { ExperienceRecord } from '@/types/experience';

const mockPendingExperience: ExperienceRecord = {
  id: 77,
  student_id: 15,
  title: 'Data Science Intern',
  organization_name: 'Apex Analytics',
  experience_type: 'internship',
  start_date: '2025-05-01',
  end_date: '2025-08-15',
  is_current: false,
  description: 'Built ETL pipelines and performed statistical cohort analysis in Python and SQL.',
  status: 'pending_verification',
  verification_source: 'self_claimed',
  innovation_project_id: 12,
  verifier_id: null,
  verifier_name: null,
  verified_at: null,
  verification_notes: null,
  skills: 'Python, SQL, Pandas',
  structured_skills: [
    {
      id: 1,
      name: 'Python',
      slug: 'python',
      category: 'Backend',
      is_verified: true,
      created_at: '2026-09-24T00:00:00Z',
    },
    {
      id: 2,
      name: 'SQL',
      slug: 'sql',
      category: 'Database',
      is_verified: true,
      created_at: '2026-09-24T00:00:00Z',
    },
  ],
  created_at: '2026-09-25T00:00:00Z',
  updated_at: '2026-09-25T00:00:00Z',
};

describe('VerificationRequestCard Component', () => {
  it('renders student identity, experience metadata, skills, and linked project', () => {
    render(
      <MemoryRouter>
        <VerificationRequestCard
          experience={mockPendingExperience}
          studentName="Alex Johnson"
          onDecision={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Data Science Intern')).toBeInTheDocument();
    expect(screen.getByText(/Alex Johnson/i)).toBeInTheDocument();
    expect(screen.getByText(/Apex Analytics/i)).toBeInTheDocument();
    expect(screen.getByText(/Pending Verification/i)).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText('SQL')).toBeInTheDocument();

    const projectLink = screen.getByRole('link', {
      name: /View linked Innovation Project #12/i,
    });
    expect(projectLink).toBeInTheDocument();
  });

  it('triggers onDecision with approve action on approve button click', async () => {
    const handleDecision = vi.fn().mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <VerificationRequestCard
          experience={mockPendingExperience}
          onDecision={handleDecision}
        />
      </MemoryRouter>
    );

    const approveBtn = screen.getByTestId('approve-btn-77');
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(handleDecision).toHaveBeenCalledWith(77, {
        action: 'approve',
      });
    });
  });

  it('opens rejection box and allows rejection with optional notes', async () => {
    const handleDecision = vi.fn().mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <VerificationRequestCard
          experience={mockPendingExperience}
          onDecision={handleDecision}
        />
      </MemoryRouter>
    );

    const rejectBtn = screen.getByTestId('reject-btn-77');
    fireEvent.click(rejectBtn);

    expect(screen.getByTestId('rejection-box-77')).toBeInTheDocument();

    const notesInput = screen.getByLabelText(/Reason for Rejection/i);
    fireEvent.change(notesInput, {
      target: { value: 'Could not verify employment dates with HR department.' },
    });

    const confirmRejectBtn = screen.getByTestId('confirm-reject-btn-77');
    fireEvent.click(confirmRejectBtn);

    await waitFor(() => {
      expect(handleDecision).toHaveBeenCalledWith(77, {
        action: 'reject',
        notes: 'Could not verify employment dates with HR department.',
      });
    });
  });

  it('allows canceling rejection flow without submitting decision', () => {
    const handleDecision = vi.fn();

    render(
      <MemoryRouter>
        <VerificationRequestCard
          experience={mockPendingExperience}
          onDecision={handleDecision}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('reject-btn-77'));
    expect(screen.getByTestId('rejection-box-77')).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelBtn);

    expect(screen.queryByTestId('rejection-box-77')).not.toBeInTheDocument();
    expect(handleDecision).not.toHaveBeenCalled();
  });
});
