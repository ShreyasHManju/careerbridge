import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { ExperienceList } from '../ExperienceList';
import { ExperienceRecord } from '@/types/experience';

const mockExperiences: ExperienceRecord[] = [
  {
    id: 1,
    student_id: 10,
    title: 'Frontend Engineer',
    organization_name: 'Acme Corp',
    experience_type: 'work',
    start_date: '2024-01-01',
    end_date: '2024-12-31',
    is_current: false,
    description: 'Developed modern accessible web components using React and TypeScript.',
    status: 'verified',
    verification_source: 'recruiter_confirmed',
    innovation_project_id: null,
    verifier_id: 99,
    verifier_name: null,
    verified_at: '2025-01-01',
    verification_notes: null,
    skills: 'React, TypeScript',
    structured_skills: [],
    created_at: '2026-09-25T00:00:00Z',
    updated_at: '2026-09-25T00:00:00Z',
  },
  {
    id: 2,
    student_id: 10,
    title: 'Research Assistant',
    organization_name: 'AI Institute',
    experience_type: 'research',
    start_date: '2025-01-01',
    end_date: null,
    is_current: true,
    description: 'Conducted experiments on large language models and attention mechanisms.',
    status: 'claimed',
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

describe('ExperienceList Component', () => {
  it('renders loading indicator when isLoading is true', () => {
    render(<ExperienceList experiences={[]} isLoading={true} />);

    expect(screen.getByTestId('experience-list-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading verified experiences...')).toBeInTheDocument();
  });

  it('renders error state and handles retry button', () => {
    const handleRetry = vi.fn();
    render(
      <ExperienceList
        experiences={[]}
        error="Network timeout"
        onRetry={handleRetry}
      />
    );

    expect(screen.getByTestId('experience-list-error')).toBeInTheDocument();
    expect(screen.getByText('Failed to load experiences')).toBeInTheDocument();
    expect(screen.getByText('Network timeout')).toBeInTheDocument();

    const retryBtn = screen.getByTestId('retry-btn');
    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it('renders empty state when experiences array is empty', () => {
    render(<ExperienceList experiences={[]} />);

    expect(screen.getByTestId('experience-list-empty')).toBeInTheDocument();
    expect(screen.getByText('No Experience Records Found')).toBeInTheDocument();
  });

  it('renders custom empty message when provided', () => {
    render(
      <ExperienceList
        experiences={[]}
        emptyTitle="No Verified Work"
        emptyMessage="This student has not verified any work records yet."
      />
    );

    expect(screen.getByText('No Verified Work')).toBeInTheDocument();
    expect(
      screen.getByText('This student has not verified any work records yet.')
    ).toBeInTheDocument();
  });

  it('renders all experience cards in populated state', () => {
    render(
      <MemoryRouter>
        <ExperienceList experiences={mockExperiences} isOwner={false} />
      </MemoryRouter>
    );

    expect(screen.getByTestId('experience-list')).toBeInTheDocument();
    expect(screen.getByText('Frontend Engineer')).toBeInTheDocument();
    expect(screen.getByText('Research Assistant')).toBeInTheDocument();
    expect(screen.getByTestId('experience-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('experience-card-2')).toBeInTheDocument();
  });

  it('passes owner action callbacks through to cards', () => {
    const handleEdit = vi.fn();
    const handleDelete = vi.fn();
    const handleRequestVerification = vi.fn();

    render(
      <MemoryRouter>
        <ExperienceList
          experiences={mockExperiences}
          isOwner={true}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onRequestVerification={handleRequestVerification}
        />
      </MemoryRouter>
    );

    const editBtn = screen.getByTestId('edit-experience-btn-2');
    fireEvent.click(editBtn);
    expect(handleEdit).toHaveBeenCalledWith(mockExperiences[1]);
  });
});
