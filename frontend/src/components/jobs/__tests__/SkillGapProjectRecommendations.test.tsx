import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SkillGapProjectRecommendations } from '../SkillGapProjectRecommendations';
import * as projectBlueprintsApi from '@/api/projectBlueprints';
import { JobProjectRecommendationsResponse } from '@/types/projectBlueprint';
import { InnovationProject } from '@/types/innovationProject';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/api/projectBlueprints');

const mockRecommendationsResponse: JobProjectRecommendationsResponse = {
  job_id: 10,
  job_title: 'Senior Systems Architect',
  total_missing_skills: 2,
  missing_skills: [
    { id: 10, name: 'Go', slug: 'go', category: 'Backend', is_verified: true, created_at: '' },
    { id: 11, name: 'Distributed Systems', slug: 'distributed-systems', category: 'Backend', is_verified: true, created_at: '' },
  ],
  recommendations: [
    {
      blueprint: {
        id: 101,
        title: 'Distributed Key-Value Store with Raft Consensus',
        slug: 'distributed-kv-store-raft',
        version: 1,
        summary: 'Build a fault-tolerant, replicated key-value store using Raft.',
        project_type: 'software',
        difficulty_level: 'advanced',
        estimated_hours: 40,
        status: 'published',
        skills: [
          { id: 1, skill_id: 10, name: 'Go', slug: 'go', category: 'Backend', is_primary: true },
          { id: 2, skill_id: 11, name: 'Distributed Systems', slug: 'distributed-systems', category: 'Backend', is_primary: true },
        ],
        milestones_count: 4,
        created_at: '2026-10-08T00:00:00Z',
        updated_at: '2026-10-08T00:00:00Z',
      },
      matched_missing_skills: [
        { id: 10, name: 'Go', slug: 'go', is_primary: true },
        { id: 11, name: 'Distributed Systems', slug: 'distributed-systems', is_primary: true },
      ],
      missing_primary_count: 2,
      missing_supporting_count: 0,
      total_missing_covered: 2,
      relevance_score: 30,
      recommendation_reason: 'Helps you build and demonstrate Go and Distributed Systems.',
    },
  ],
};

const mockInstantiatedProject: InnovationProject = {
  id: 55,
  student_id: 1,
  title: 'Distributed Key-Value Store with Raft Consensus',
  slug: 'distributed-kv-store-raft-abc',
  description: 'Design and implement a distributed key-value store.',
  project_type: 'software',
  status: 'active',
  visibility: 'private',
  created_at: '2026-10-08T00:00:00Z',
  updated_at: '2026-10-08T00:00:00Z',
};

describe('SkillGapProjectRecommendations Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state while fetching blueprint recommendations', () => {
    vi.mocked(projectBlueprintsApi.getJobProjectRecommendations).mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <SkillGapProjectRecommendations jobId={10} jobTitle="Senior Systems Architect" />
      </MemoryRouter>
    );

    expect(screen.getByTestId('blueprint-recommendations-loading')).toBeInTheDocument();
    expect(
      screen.getByText('Finding Curated Project Blueprints to Bridge Your Skill Gap...')
    ).toBeInTheDocument();
  });

  it('renders error state and allows retry', async () => {
    vi.mocked(projectBlueprintsApi.getJobProjectRecommendations).mockRejectedValueOnce({
      status: 500,
      message: 'Network error connecting to recommendations service',
    });

    render(
      <MemoryRouter>
        <SkillGapProjectRecommendations jobId={10} jobTitle="Senior Systems Architect" />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('blueprint-recommendations-error')).toBeInTheDocument();
    });

    expect(screen.getByText('Network error connecting to recommendations service')).toBeInTheDocument();

    // Click retry
    vi.mocked(projectBlueprintsApi.getJobProjectRecommendations).mockResolvedValueOnce(mockRecommendationsResponse);
    fireEvent.click(screen.getByText('Retry Blueprint Recommendations'));

    await waitFor(() => {
      expect(screen.getByTestId('skill-gap-project-recommendations')).toBeInTheDocument();
    });
  });

  it('renders empty state when no recommendations exist with navigation links', async () => {
    vi.mocked(projectBlueprintsApi.getJobProjectRecommendations).mockResolvedValueOnce({
      job_id: 10,
      job_title: 'Rare Role',
      total_missing_skills: 1,
      missing_skills: [],
      recommendations: [],
    });

    render(
      <MemoryRouter>
        <SkillGapProjectRecommendations jobId={10} jobTitle="Rare Role" />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('blueprint-recommendations-empty')).toBeInTheDocument();
    });

    expect(screen.getByText('Custom Innovation Project Option')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /\+ Create Custom Project/i })).toHaveAttribute(
      'href',
      '/app/projects'
    );
  });

  it('renders recommendation cards and handles instantiation flow', async () => {
    vi.mocked(projectBlueprintsApi.getJobProjectRecommendations).mockResolvedValueOnce(mockRecommendationsResponse);
    vi.mocked(projectBlueprintsApi.instantiateBlueprint).mockResolvedValueOnce(mockInstantiatedProject);

    const onProjectCreated = vi.fn();

    render(
      <MemoryRouter>
        <SkillGapProjectRecommendations
          jobId={10}
          jobTitle="Senior Systems Architect"
          onProjectCreated={onProjectCreated}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('blueprint-card-101')).toBeInTheDocument();
    });

    expect(screen.getByText('Distributed Key-Value Store with Raft Consensus')).toBeInTheDocument();
    expect(screen.getByText('⚡ 30 Match Points')).toBeInTheDocument();

    // Click Start Project
    const startBtn = screen.getByTestId('instantiate-blueprint-btn-101');
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(projectBlueprintsApi.instantiateBlueprint).toHaveBeenCalledWith(101);
    });

    await waitFor(() => {
      expect(onProjectCreated).toHaveBeenCalledWith(mockInstantiatedProject);
    });
  });

  it('displays 409 conflict error when student already has an active project from the blueprint', async () => {
    vi.mocked(projectBlueprintsApi.getJobProjectRecommendations).mockResolvedValueOnce(mockRecommendationsResponse);
    vi.mocked(projectBlueprintsApi.instantiateBlueprint).mockRejectedValueOnce({
      status: 409,
      detail: 'You already have an active project created from this blueprint.',
    });

    render(
      <MemoryRouter>
        <SkillGapProjectRecommendations jobId={10} jobTitle="Senior Systems Architect" />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('blueprint-card-101')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('instantiate-blueprint-btn-101'));

    await waitFor(() => {
      expect(
        screen.getByText('You already have an active project created from this blueprint.')
      ).toBeInTheDocument();
    });
  });
});
