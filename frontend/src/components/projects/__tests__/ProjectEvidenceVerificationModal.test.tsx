import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProjectEvidenceVerificationModal } from '../ProjectEvidenceVerificationModal';
import { ProjectEvidence } from '@/types/innovationProject';

const mockEvidence: ProjectEvidence = {
  id: 42,
  innovation_project_id: 10,
  milestone_id: null,
  title: 'Deep Learning Training Pipeline',
  description: 'PyTorch models and evaluation notebooks',
  evidence_type: 'repository',
  url: 'https://github.com/example/dl-pipeline',
  created_at: '2026-09-26T00:00:00Z',
  updated_at: '2026-09-26T00:00:00Z',
};

describe('ProjectEvidenceVerificationModal Component', () => {
  it('does not render when isOpen is false', () => {
    render(
      <ProjectEvidenceVerificationModal
        isOpen={false}
        evidence={mockEvidence}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByTestId('verification-modal')).not.toBeInTheDocument();
  });

  it('renders modal form with evidence details and default verified status', () => {
    render(
      <ProjectEvidenceVerificationModal
        isOpen={true}
        evidence={mockEvidence}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId('verification-modal')).toBeInTheDocument();
    expect(screen.getByText('Review & Verify Evidence Artifact')).toBeInTheDocument();
    expect(screen.getByText('Deep Learning Training Pipeline')).toBeInTheDocument();
    expect(screen.getByText(/https:\/\/github\.com\/example\/dl-pipeline/i)).toBeInTheDocument();

    const statusSelect = screen.getByTestId('verification-status-select') as HTMLSelectElement;
    expect(statusSelect.value).toBe('verified');
  });

  it('pre-populates existing verification decision if present on evidence', () => {
    const evidenceWithVerification: ProjectEvidence = {
      ...mockEvidence,
      verification: {
        id: 7,
        evidence_id: 42,
        verifier_id: 1,
        status: 'rejected',
        notes: 'Missing training convergence logs.',
        verified_at: '2026-09-26T12:00:00Z',
        created_at: '2026-09-26T12:00:00Z',
        updated_at: '2026-09-26T12:00:00Z',
      },
    };

    render(
      <ProjectEvidenceVerificationModal
        isOpen={true}
        evidence={evidenceWithVerification}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const statusSelect = screen.getByTestId('verification-status-select') as HTMLSelectElement;
    expect(statusSelect.value).toBe('rejected');

    const notesInput = screen.getByTestId('verification-notes-input') as HTMLTextAreaElement;
    expect(notesInput.value).toBe('Missing training convergence logs.');
  });

  it('submits verification decision and closes modal', async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(
      <ProjectEvidenceVerificationModal
        isOpen={true}
        evidence={mockEvidence}
        onSubmit={handleSubmit}
        onClose={handleClose}
      />
    );

    const statusSelect = screen.getByTestId('verification-status-select');
    fireEvent.change(statusSelect, { target: { value: 'verified' } });

    const notesInput = screen.getByTestId('verification-notes-input');
    fireEvent.change(notesInput, {
      target: { value: 'Code architecture validated against platform rubric.' },
    });

    const submitBtn = screen.getByTestId('verification-submit-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        status: 'verified',
        notes: 'Code architecture validated against platform rubric.',
      });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  it('displays validation error if notes exceed 2000 characters', async () => {
    const handleSubmit = vi.fn();
    const handleClose = vi.fn();

    render(
      <ProjectEvidenceVerificationModal
        isOpen={true}
        evidence={mockEvidence}
        onSubmit={handleSubmit}
        onClose={handleClose}
      />
    );

    const notesInput = screen.getByTestId('verification-notes-input');
    // Fill with > 2000 chars
    fireEvent.change(notesInput, { target: { value: 'A'.repeat(2005) } });

    const submitBtn = screen.getByTestId('verification-submit-btn');
    fireEvent.click(submitBtn);

    expect(screen.getByText(/Verification notes cannot exceed 2000 characters/i)).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('handles server rejection error gracefully', async () => {
    const handleSubmit = vi.fn().mockRejectedValue({
      response: { data: { detail: 'Only platform administrators have permission to verify project evidence' } },
    });
    const handleClose = vi.fn();

    render(
      <ProjectEvidenceVerificationModal
        isOpen={true}
        evidence={mockEvidence}
        onSubmit={handleSubmit}
        onClose={handleClose}
      />
    );

    const submitBtn = screen.getByTestId('verification-submit-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Only platform administrators have permission/i)).toBeInTheDocument();
    });
    expect(handleClose).not.toHaveBeenCalled();
  });
});
