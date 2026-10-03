import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecruiterCandidatesPage } from '../RecruiterCandidatesPage';
import * as candidatesApi from '@/api/candidates';
import { CandidateSourcingResult } from '@/types/candidate';

const mockCandidate1: CandidateSourcingResult = {
  id: 10,
  full_name: 'Elena Rostova',
  bio: 'Systems engineer with 3 years of C++ and distributed systems experience.',
  profile_image_url: null,
  github_url: 'https://github.com/erostova',
  linkedin_url: null,
  portfolio_url: null,
  education: {
    college: 'Georgia Tech',
    degree: 'B.S.',
    branch: 'Computer Science',
    graduation_year: 2026,
  },
  skills: [
    { id: 1, name: 'C++', slug: 'cpp', category: 'Systems', is_verified: true },
    { id: 2, name: 'Distributed Systems', slug: 'dist-sys', category: 'Systems', is_verified: true },
    { id: 3, name: 'Go', slug: 'go', category: 'Backend', is_verified: false },
  ],
  verified_skills: [
    { id: 1, name: 'C++', slug: 'cpp', category: 'Systems', is_verified: true },
    { id: 2, name: 'Distributed Systems', slug: 'dist-sys', category: 'Systems', is_verified: true },
  ],
  top_projects: [
    {
      id: 501,
      title: 'High-Throughput Key-Value Store',
      slug: 'kv-store',
      short_description: 'Raft consensus based distributed storage engine.',
      project_type: 'capstone',
      visibility: 'public',
      progress_percentage: 100,
      verified_evidence_count: 4,
      average_evaluation_score: 4.9,
      evaluations_count: 2,
    },
  ],
  passport_summary: {
    verified_experiences_count: 2,
    public_projects_count: 1,
    canonical_skills_count: 3,
    completed_milestones_count: 5,
    verified_evidence_count: 4,
    total_evaluations_count: 2,
    average_project_score: 4.9,
    is_verified: true,
  },
  created_at: '2026-08-01T10:00:00Z',
};

const mockCandidate2: CandidateSourcingResult = {
  id: 20,
  full_name: 'Marcus Vance',
  bio: 'Frontend specialist building accessible React and TypeScript design systems.',
  profile_image_url: null,
  github_url: 'https://github.com/mvance',
  linkedin_url: 'https://linkedin.com/in/mvance',
  portfolio_url: 'https://mvance.dev',
  education: {
    college: 'UC Berkeley',
    degree: 'M.S.',
    branch: 'Software Engineering',
    graduation_year: 2027,
  },
  skills: [
    { id: 4, name: 'React', slug: 'react', category: 'Frontend', is_verified: true },
    { id: 5, name: 'TypeScript', slug: 'typescript', category: 'Frontend', is_verified: true },
    { id: 6, name: 'Accessibility', slug: 'a11y', category: 'Frontend', is_verified: true },
  ],
  verified_skills: [
    { id: 4, name: 'React', slug: 'react', category: 'Frontend', is_verified: true },
    { id: 5, name: 'TypeScript', slug: 'typescript', category: 'Frontend', is_verified: true },
    { id: 6, name: 'Accessibility', slug: 'a11y', category: 'Frontend', is_verified: true },
  ],
  top_projects: [],
  passport_summary: {
    verified_experiences_count: 1,
    public_projects_count: 0,
    canonical_skills_count: 3,
    completed_milestones_count: 2,
    verified_evidence_count: 2,
    is_verified: true,
  },
  created_at: '2026-08-10T10:00:00Z',
};

describe('RecruiterCandidatesPage Component (Talent Discovery)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. renders page header, subtitle, search bar, and filter controls', async () => {
    vi.spyOn(candidatesApi, 'searchCandidates').mockResolvedValue({
      items: [mockCandidate1, mockCandidate2],
      total: 2,
      page: 1,
      page_size: 10,
      total_pages: 1,
    });

    render(
      <MemoryRouter>
        <RecruiterCandidatesPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Talent Discovery' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search by candidate name, bio, skills/i)).toBeInTheDocument();
    expect(screen.getByTestId('candidate-degree-filter')).toBeInTheDocument();
    expect(screen.getByTestId('candidate-gradyear-filter')).toBeInTheDocument();
    expect(screen.getByTestId('verified-passport-filter')).toBeInTheDocument();
    expect(screen.getByTestId('candidate-sort-select')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Elena Rostova')).toBeInTheDocument();
      expect(screen.getByText('Marcus Vance')).toBeInTheDocument();
    });
  });

  it('2. displays candidate cards with education, verified skills, and stats pills', async () => {
    vi.spyOn(candidatesApi, 'searchCandidates').mockResolvedValue({
      items: [mockCandidate1],
      total: 1,
      page: 1,
      page_size: 10,
      total_pages: 1,
    });

    render(
      <MemoryRouter>
        <RecruiterCandidatesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Elena Rostova')).toBeInTheDocument();
      expect(screen.getByTestId('candidate-education-10')).toHaveTextContent(/Georgia Tech/);
      expect(screen.getByTestId('candidate-education-10')).toHaveTextContent(/Class of 2026/);
      expect(screen.getByTestId('verified-skill-cpp')).toBeInTheDocument();
      expect(screen.getByTestId('candidates-result-count')).toHaveTextContent(/Showing 1 of 1 discoverable candidate/);
    });
  });

  it('3. triggers search when keyword input changes and passes q filter to API', async () => {
    const searchSpy = vi.spyOn(candidatesApi, 'searchCandidates').mockResolvedValue({
      items: [mockCandidate2],
      total: 1,
      page: 1,
      page_size: 10,
      total_pages: 1,
    });

    render(
      <MemoryRouter>
        <RecruiterCandidatesPage />
      </MemoryRouter>
    );

    const searchInput = screen.getByPlaceholderText(/Search by candidate name/i);
    fireEvent.change(searchInput, { target: { value: 'React' } });

    await waitFor(() => {
      expect(searchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'React' }),
        1,
        10
      );
    });
  });

  it('4. filters by verified skill when skill input changes', async () => {
    const searchSpy = vi.spyOn(candidatesApi, 'searchCandidates').mockResolvedValue({
      items: [mockCandidate1],
      total: 1,
      page: 1,
      page_size: 10,
      total_pages: 1,
    });

    render(
      <MemoryRouter>
        <RecruiterCandidatesPage />
      </MemoryRouter>
    );

    const skillInput = screen.getByTestId('candidate-skill-filter');
    fireEvent.change(skillInput, { target: { value: 'C++' } });

    await waitFor(() => {
      expect(searchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ skills: ['C++'] }),
        1,
        10
      );
    });
  });

  it('5. filters by degree and graduation year dropdowns', async () => {
    const searchSpy = vi.spyOn(candidatesApi, 'searchCandidates').mockResolvedValue({
      items: [mockCandidate2],
      total: 1,
      page: 1,
      page_size: 10,
      total_pages: 1,
    });

    render(
      <MemoryRouter>
        <RecruiterCandidatesPage />
      </MemoryRouter>
    );

    const degreeSelect = screen.getByTestId('candidate-degree-filter');
    fireEvent.change(degreeSelect, { target: { value: 'M.S.' } });

    const yearSelect = screen.getByTestId('candidate-gradyear-filter');
    fireEvent.change(yearSelect, { target: { value: '2027' } });

    await waitFor(() => {
      expect(searchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ degree: 'M.S.', graduation_year: 2027 }),
        1,
        10
      );
    });
  });

  it('6. toggles verified passport only checkbox', async () => {
    const searchSpy = vi.spyOn(candidatesApi, 'searchCandidates').mockResolvedValue({
      items: [mockCandidate1],
      total: 1,
      page: 1,
      page_size: 10,
      total_pages: 1,
    });

    render(
      <MemoryRouter>
        <RecruiterCandidatesPage />
      </MemoryRouter>
    );

    const passportCheckbox = screen.getByTestId('verified-passport-filter');
    fireEvent.click(passportCheckbox);

    await waitFor(() => {
      expect(searchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ has_verified_passport: true }),
        1,
        10
      );
    });
  });

  it('7. updates sorting order when sort select changes', async () => {
    const searchSpy = vi.spyOn(candidatesApi, 'searchCandidates').mockResolvedValue({
      items: [mockCandidate1],
      total: 1,
      page: 1,
      page_size: 10,
      total_pages: 1,
    });

    render(
      <MemoryRouter>
        <RecruiterCandidatesPage />
      </MemoryRouter>
    );

    const sortSelect = screen.getByTestId('candidate-sort-select');
    fireEvent.change(sortSelect, { target: { value: 'top_rated_projects' } });

    await waitFor(() => {
      expect(searchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ sort_by: 'top_rated_projects' }),
        1,
        10
      );
    });
  });

  it('8. renders empty state when no candidates match search/filters', async () => {
    vi.spyOn(candidatesApi, 'searchCandidates').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 10,
      total_pages: 0,
    });

    render(
      <MemoryRouter>
        <RecruiterCandidatesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('candidates-empty-state')).toBeInTheDocument();
      expect(screen.getByText('No Candidates Found')).toBeInTheDocument();
    });
  });

  it('9. displays loading spinner while fetching candidates', () => {
    vi.spyOn(candidatesApi, 'searchCandidates').mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <RecruiterCandidatesPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('status', { name: /Loading candidates/i })).toBeInTheDocument();
  });

  it('10. renders error alert with retry button upon API failure', async () => {
    const searchSpy = vi.spyOn(candidatesApi, 'searchCandidates')
      .mockRejectedValueOnce(new Error('Network error loading talent directory'))
      .mockResolvedValueOnce({
        items: [mockCandidate1],
        total: 1,
        page: 1,
        page_size: 10,
        total_pages: 1,
      });

    render(
      <MemoryRouter>
        <RecruiterCandidatesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('candidates-error-alert')).toBeInTheDocument();
      expect(screen.getByText(/Network error loading talent directory/i)).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /Try Again/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Elena Rostova')).toBeInTheDocument();
    });
    expect(searchSpy).toHaveBeenCalledTimes(2);
  });

  it('11. provides functional pagination controls when multiple pages exist', async () => {
    const searchSpy = vi.spyOn(candidatesApi, 'searchCandidates').mockResolvedValue({
      items: [mockCandidate1],
      total: 25,
      page: 1,
      page_size: 10,
      total_pages: 3,
    });

    render(
      <MemoryRouter>
        <RecruiterCandidatesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('pagination-info')).toHaveTextContent(/Page 1 of 3/);
    });

    const nextBtn = screen.getByTestId('next-page-btn');
    expect(nextBtn).not.toBeDisabled();
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(searchSpy).toHaveBeenCalledWith(expect.anything(), 2, 10);
    });
  });

  it('12. preserves action links for Passport and Direct Messaging on candidate cards', async () => {
    vi.spyOn(candidatesApi, 'searchCandidates').mockResolvedValue({
      items: [mockCandidate1],
      total: 1,
      page: 1,
      page_size: 10,
      total_pages: 1,
    });

    render(
      <MemoryRouter>
        <RecruiterCandidatesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('view-passport-btn-10')).toHaveAttribute('href', '/app/passport/10');
      expect(screen.getByTestId('message-candidate-btn-10')).toHaveAttribute('href', '/app/messages?recipientId=10');
    });
  });

  it('13. resets all filters and page when Reset Filters button is clicked', async () => {
    vi.spyOn(candidatesApi, 'searchCandidates').mockResolvedValue({
      items: [mockCandidate1, mockCandidate2],
      total: 2,
      page: 1,
      page_size: 10,
      total_pages: 1,
    });

    render(
      <MemoryRouter>
        <RecruiterCandidatesPage />
      </MemoryRouter>
    );

    const searchInput = screen.getByPlaceholderText(/Search by candidate name/i);
    fireEvent.change(searchInput, { target: { value: 'Elena' } });

    const resetBtn = screen.getByTestId('reset-candidate-filters-btn');
    fireEvent.click(resetBtn);

    await waitFor(() => {
      expect(searchInput).toHaveValue('');
    });
  });
});
