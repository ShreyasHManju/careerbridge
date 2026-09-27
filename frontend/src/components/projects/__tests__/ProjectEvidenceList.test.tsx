import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProjectEvidenceList } from '../ProjectEvidenceList';
import { ProjectEvidence, ProjectMilestone } from '@/types/innovationProject';

const mockMilestones: ProjectMilestone[] = [
  {
    id: 101,
    innovation_project_id: 1,
    title: 'Phase 1: Architecture Specification',
    status: 'completed',
    display_order: 1,
    created_at: '2026-09-24T00:00:00Z',
    updated_at: '2026-09-24T00:00:00Z',
  },
];

const mockEvidenceList: ProjectEvidence[] = [
  {
    id: 1,
    innovation_project_id: 1,
    milestone_id: null,
    title: 'GitHub Monorepo',
    description: 'Production React and FastAPI codebase with CI tests.',
    evidence_type: 'repository',
    url: 'https://github.com/example/careerbridge',
    created_at: '2026-09-25T00:00:00Z',
    updated_at: '2026-09-25T00:00:00Z',
    verification: {
      id: 10,
      evidence_id: 1,
      verifier_id: 99,
      status: 'verified',
      notes: 'Code passes all quality benchmarks.',
      verified_at: '2026-09-25T12:00:00Z',
      created_at: '2026-09-25T12:00:00Z',
      updated_at: '2026-09-25T12:00:00Z',
    },
  },
  {
    id: 2,
    innovation_project_id: 1,
    milestone_id: 101,
    title: 'System Architecture Document',
    description: 'Detailed UML sequence diagrams and database schemas.',
    evidence_type: 'document',
    url: 'https://example.com/architecture.pdf',
    created_at: '2026-09-25T00:00:00Z',
    updated_at: '2026-09-25T00:00:00Z',
    verification: null,
  },
  {
    id: 3,
    innovation_project_id: 1,
    milestone_id: null,
    title: 'Rejected Draft Diagram',
    description: 'Outdated architectural draft.',
    evidence_type: 'image',
    url: 'https://example.com/draft.png',
    created_at: '2026-09-25T00:00:00Z',
    updated_at: '2026-09-25T00:00:00Z',
    verification: {
      id: 11,
      evidence_id: 3,
      verifier_id: 99,
      status: 'rejected',
      notes: 'Resolution is too low and diagram is incomplete.',
      verified_at: '2026-09-25T12:00:00Z',
      created_at: '2026-09-25T12:00:00Z',
      updated_at: '2026-09-25T12:00:00Z',
    },
  },
];

describe('ProjectEvidenceList Component', () => {
  it('renders empty state for owner with add button', () => {
    const handleAdd = vi.fn();
    render(
      <ProjectEvidenceList
        evidenceList={[]}
        isOwner={true}
        onAddEvidence={handleAdd}
      />
    );

    expect(screen.getByTestId('evidence-empty')).toBeInTheDocument();
    expect(screen.getByText(/Attach code repositories, live demos/i)).toBeInTheDocument();
    const addBtn = screen.getByRole('button', { name: /Attach first evidence artifact/i });
    expect(addBtn).toBeInTheDocument();
    fireEvent.click(addBtn);
    expect(handleAdd).toHaveBeenCalledTimes(1);
  });

  it('renders empty state for viewer without add button', () => {
    render(<ProjectEvidenceList evidenceList={[]} isOwner={false} />);
    expect(screen.getByTestId('evidence-empty')).toBeInTheDocument();
    expect(screen.getByText(/No tangible evidence artifacts have been published/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Attach first evidence artifact/i })).not.toBeInTheDocument();
  });

  it('renders evidence artifacts list with correct details, badges, and external links', () => {
    render(
      <ProjectEvidenceList
        evidenceList={mockEvidenceList}
        milestones={mockMilestones}
        isOwner={false}
      />
    );

    expect(screen.getByText('GitHub Monorepo')).toBeInTheDocument();
    expect(screen.getByText('Production React and FastAPI codebase with CI tests.')).toBeInTheDocument();
    expect(screen.getByText('System Architecture Document')).toBeInTheDocument();

    // Check attached milestone tag
    expect(screen.getByText(/🚩 Phase 1: Architecture Specification/i)).toBeInTheDocument();

    // Check external links
    const links = screen.getAllByRole('link', { name: /Open artifact link/i });
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute('href', 'https://github.com/example/careerbridge');
    expect(links[0]).toHaveAttribute('target', '_blank');
    expect(links[1]).toHaveAttribute('href', 'https://example.com/architecture.pdf');
  });

  it('renders verification status badges and reviewer notes for verified, rejected, and pending evidence', () => {
    render(
      <ProjectEvidenceList
        evidenceList={mockEvidenceList}
        milestones={mockMilestones}
        isOwner={false}
      />
    );

    // Verified badge on evidence 1
    expect(screen.getByTestId('verification-badge-1')).toHaveTextContent('Verified Evidence');
    expect(screen.getByTestId('verification-notes-1')).toHaveTextContent('Code passes all quality benchmarks.');

    // Pending badge on evidence 2 (no verification record)
    expect(screen.getByTestId('verification-badge-2')).toHaveTextContent('Pending Review');
    expect(screen.queryByTestId('verification-notes-2')).not.toBeInTheDocument();

    // Rejected badge on evidence 3
    expect(screen.getByTestId('verification-badge-3')).toHaveTextContent('Review Rejected');
    expect(screen.getByTestId('verification-notes-3')).toHaveTextContent('Resolution is too low and diagram is incomplete.');
  });

  it('renders owner actions and triggers edit and delete callbacks', () => {
    const handleEdit = vi.fn();
    const handleDelete = vi.fn();

    render(
      <ProjectEvidenceList
        evidenceList={mockEvidenceList}
        milestones={mockMilestones}
        isOwner={true}
        onEditEvidence={handleEdit}
        onDeleteEvidence={handleDelete}
      />
    );

    const editBtns = screen.getAllByRole('button', { name: /Edit /i });
    expect(editBtns).toHaveLength(3);
    fireEvent.click(editBtns[0]);
    expect(handleEdit).toHaveBeenCalledWith(mockEvidenceList[0]);

    const deleteBtns = screen.getAllByRole('button', { name: /Delete /i });
    expect(deleteBtns).toHaveLength(3);
    fireEvent.click(deleteBtns[1]);
    expect(handleDelete).toHaveBeenCalledWith(mockEvidenceList[1]);
  });

  it('hides edit and delete action buttons for non-owner viewers', () => {
    render(
      <ProjectEvidenceList
        evidenceList={mockEvidenceList}
        milestones={mockMilestones}
        isOwner={false}
      />
    );

    expect(screen.queryByRole('button', { name: /Edit /i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete /i })).not.toBeInTheDocument();
  });

  it('renders Review / Verify buttons for admins and triggers onVerifyEvidence', () => {
    const handleVerify = vi.fn();

    render(
      <ProjectEvidenceList
        evidenceList={mockEvidenceList}
        milestones={mockMilestones}
        isOwner={false}
        isAdmin={true}
        onVerifyEvidence={handleVerify}
      />
    );

    const verifyBtns = screen.getAllByRole('button', { name: /Review and verify/i });
    expect(verifyBtns).toHaveLength(3);

    fireEvent.click(verifyBtns[0]);
    expect(handleVerify).toHaveBeenCalledWith(mockEvidenceList[0]);
  });

  it('does NOT render Review / Verify buttons for regular student owners or non-admin viewers', () => {
    render(
      <ProjectEvidenceList
        evidenceList={mockEvidenceList}
        milestones={mockMilestones}
        isOwner={true}
        isAdmin={false}
      />
    );

    expect(screen.queryByRole('button', { name: /Review and verify/i })).not.toBeInTheDocument();
  });
});
