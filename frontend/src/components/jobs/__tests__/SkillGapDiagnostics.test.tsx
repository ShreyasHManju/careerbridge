import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SkillGapDiagnostics } from '../SkillGapDiagnostics';
import { JobMatchSummary } from '@/types/job';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('SkillGapDiagnostics Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders partial match with score, progress bar, matched and missing skills', () => {
    const mockSummary: JobMatchSummary = {
      match_percentage: 67,
      total_required: 3,
      total_matched: 2,
      total_verified_matched: 1,
      total_missing: 1,
      matched_skills: [
        { id: 1, name: 'React', is_verified: true, source: 'project' },
        { id: 2, name: 'TypeScript', is_verified: false, source: 'profile' },
      ],
      missing_skills: [
        { id: 3, name: 'Python' },
      ],
    };

    render(
      <MemoryRouter>
        <SkillGapDiagnostics matchSummary={mockSummary} jobTitle="Full Stack Engineer" />
      </MemoryRouter>
    );

    // Score badge
    const badge = screen.getByTestId('match-percentage-badge');
    expect(badge).toHaveTextContent('🎯 67% Match');
    expect(badge).toHaveClass('cb-badge-match-medium');

    // Stats
    expect(screen.getByTestId('match-ratio-text')).toHaveTextContent('2 of 3 skills matched');
    expect(screen.getByTestId('verified-matched-count')).toHaveTextContent('1 verified by evidence or evaluations');

    // Matched skills
    expect(screen.getByTestId('matched-skill-1')).toHaveTextContent('React');
    expect(screen.getByTestId('matched-skill-1')).toHaveTextContent('Verified');
    expect(screen.getByTestId('matched-skill-1')).toHaveTextContent('Project Evidence');

    expect(screen.getByTestId('matched-skill-2')).toHaveTextContent('TypeScript');
    expect(screen.getByTestId('matched-skill-2')).toHaveTextContent('Profile Claim');

    // Missing skills
    expect(screen.getByTestId('missing-skill-3')).toHaveTextContent('Python');

    // Exploration callout & Bridge This Gap button
    expect(screen.getByText(/Boost your candidacy by building or documenting a project/)).toBeInTheDocument();
    expect(screen.getByTestId('bridge-gap-button')).toHaveTextContent('Bridge This Gap');
    expect(screen.getByRole('link', { name: /Explore public projects to close skill gaps/i })).toHaveAttribute(
      'href',
      '/app/explore-projects'
    );
  });

  it('renders 100% full match with success banner and no missing skills or Bridge This Gap button', () => {
    const mockSummary: JobMatchSummary = {
      match_percentage: 100,
      total_required: 2,
      total_matched: 2,
      total_verified_matched: 2,
      total_missing: 0,
      matched_skills: [
        { id: 1, name: 'FastAPI', is_verified: true, source: 'experience' },
        { id: 2, name: 'PostgreSQL', is_verified: true, source: 'evaluation' },
      ],
      missing_skills: [],
    };

    render(
      <MemoryRouter>
        <SkillGapDiagnostics matchSummary={mockSummary} jobTitle="Backend Developer" />
      </MemoryRouter>
    );

    const badge = screen.getByTestId('match-percentage-badge');
    expect(badge).toHaveTextContent('🎯 100% Match');
    expect(badge).toHaveClass('cb-badge-match-high');

    expect(screen.getByTestId('all-skills-matched')).toHaveTextContent(
      'You meet 100% of the documented skill requirements for this opportunity!'
    );
    expect(screen.queryByTestId('missing-skills-list')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bridge-gap-button')).not.toBeInTheDocument();

    // Verify provenance labels
    expect(screen.getByText('Work Experience')).toBeInTheDocument();
    expect(screen.getByText('Recruiter Evaluated')).toBeInTheDocument();
  });

  it('renders 0% match when student has none of the required skills and shows Bridge This Gap button', () => {
    const mockSummary: JobMatchSummary = {
      match_percentage: 0,
      total_required: 2,
      total_matched: 0,
      total_verified_matched: 0,
      total_missing: 2,
      matched_skills: [],
      missing_skills: [
        { id: 10, name: 'Kubernetes' },
        { id: 11, name: 'Go' },
      ],
    };

    render(
      <MemoryRouter>
        <SkillGapDiagnostics matchSummary={mockSummary} jobTitle="DevOps Engineer" />
      </MemoryRouter>
    );

    const badge = screen.getByTestId('match-percentage-badge');
    expect(badge).toHaveTextContent('🎯 0% Match');
    expect(badge).toHaveClass('cb-badge-match-low');

    expect(
      screen.getByText('None of the required skills currently match your documented competencies.')
    ).toBeInTheDocument();
    expect(screen.getByTestId('missing-skill-10')).toHaveTextContent('Kubernetes');
    expect(screen.getByTestId('missing-skill-11')).toHaveTextContent('Go');

    const bridgeBtn = screen.getByTestId('bridge-gap-button');
    expect(bridgeBtn).toBeInTheDocument();
    expect(bridgeBtn).toHaveTextContent('Bridge This Gap');
  });

  it('navigates to /app/student/projects with correct state when Bridge This Gap is clicked', () => {
    const mockSummary: JobMatchSummary = {
      match_percentage: 50,
      total_required: 2,
      total_matched: 1,
      total_verified_matched: 0,
      total_missing: 1,
      matched_skills: [
        { id: 1, name: 'React', is_verified: false, source: 'profile' },
      ],
      missing_skills: [
        { id: 2, name: 'GraphQL' },
        { id: 3, name: 'TypeScript' },
      ],
    };

    render(
      <MemoryRouter>
        <SkillGapDiagnostics matchSummary={mockSummary} jobTitle="Frontend Lead" />
      </MemoryRouter>
    );

    const bridgeBtn = screen.getByTestId('bridge-gap-button');
    expect(bridgeBtn).toBeInTheDocument();

    fireEvent.click(bridgeBtn);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/app/student/projects', {
      state: {
        openCreateModal: true,
        prefilledSkills: 'GraphQL, TypeScript',
        jobTitle: 'Frontend Lead',
      },
    });
  });

  it('renders correctly when job has zero required skills', () => {
    const mockSummary: JobMatchSummary = {
      match_percentage: 100,
      total_required: 0,
      total_matched: 0,
      total_verified_matched: 0,
      total_missing: 0,
      matched_skills: [],
      missing_skills: [],
    };

    render(
      <MemoryRouter>
        <SkillGapDiagnostics matchSummary={mockSummary} />
      </MemoryRouter>
    );

    const badge = screen.getByTestId('match-percentage-badge');
    expect(badge).toHaveTextContent('🎯 100% Match');
    expect(screen.getByTestId('match-ratio-text')).toHaveTextContent('0 of 0 skills matched');
    expect(screen.getByTestId('all-skills-matched')).toBeInTheDocument();
    expect(screen.queryByTestId('bridge-gap-button')).not.toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    const mockSummary: JobMatchSummary = {
      match_percentage: 75,
      total_required: 4,
      total_matched: 3,
      total_verified_matched: 1,
      total_missing: 1,
      matched_skills: [
        { id: 1, name: 'Python', is_verified: true, source: 'project' },
      ],
      missing_skills: [
        { id: 2, name: 'Docker' },
      ],
    };

    render(
      <MemoryRouter>
        <SkillGapDiagnostics matchSummary={mockSummary} />
      </MemoryRouter>
    );

    const section = screen.getByTestId('skill-gap-diagnostics');
    expect(section).toHaveAttribute('aria-labelledby', 'skill-diagnostics-heading');

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '75');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
  });
});
