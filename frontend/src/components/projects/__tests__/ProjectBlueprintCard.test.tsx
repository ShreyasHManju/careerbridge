import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectBlueprintCard } from '../ProjectBlueprintCard';
import { ProjectBlueprintSummary, BlueprintRecommendationItem } from '@/types/projectBlueprint';

const mockBlueprint: ProjectBlueprintSummary = {
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
    { id: 3, skill_id: 12, name: 'gRPC', slug: 'grpc', category: 'Backend', is_primary: false },
  ],
  milestones_count: 4,
  created_at: '2026-10-08T00:00:00Z',
  updated_at: '2026-10-08T00:00:00Z',
};

const mockRecommendation: BlueprintRecommendationItem = {
  blueprint: mockBlueprint,
  matched_missing_skills: [
    { id: 10, name: 'Go', slug: 'go', is_primary: true },
    { id: 11, name: 'Distributed Systems', slug: 'distributed-systems', is_primary: true },
  ],
  missing_primary_count: 2,
  missing_supporting_count: 0,
  total_missing_covered: 2,
  relevance_score: 27,
  recommendation_reason: 'Helps you build and demonstrate Go and Distributed Systems through structured milestone deliverables.',
};

describe('ProjectBlueprintCard Component', () => {
  it('renders core blueprint information (title, summary, difficulty, hours, skills)', () => {
    const handleViewDetail = vi.fn();

    render(
      <ProjectBlueprintCard
        blueprint={mockBlueprint}
        onViewDetail={handleViewDetail}
      />
    );

    expect(screen.getByTestId('blueprint-title')).toHaveTextContent('Distributed Key-Value Store with Raft Consensus');
    expect(screen.getByTestId('blueprint-summary')).toHaveTextContent('Build a fault-tolerant, replicated key-value store');
    expect(screen.getByTestId('blueprint-difficulty')).toHaveTextContent('Advanced');
    expect(screen.getByTestId('blueprint-hours')).toHaveTextContent('⏱ 40 hrs');

    const primarySkills = screen.getByTestId('blueprint-primary-skills');
    expect(primarySkills).toHaveTextContent('★ Go');
    expect(primarySkills).toHaveTextContent('★ Distributed Systems');

    const supportingSkills = screen.getByTestId('blueprint-supporting-skills');
    expect(supportingSkills).toHaveTextContent('gRPC');
  });

  it('renders recommendation metrics and reason when recommendation prop is passed', () => {
    render(
      <ProjectBlueprintCard
        blueprint={mockBlueprint}
        recommendation={mockRecommendation}
        onViewDetail={vi.fn()}
      />
    );

    expect(screen.getByTestId('blueprint-score')).toHaveTextContent('⚡ 27 Match Points');
    expect(screen.getByTestId('blueprint-recommendation-reason')).toHaveTextContent(
      'Helps you build and demonstrate Go and Distributed Systems'
    );
  });

  it('triggers onViewDetail callback when View Roadmap button is clicked', () => {
    const handleViewDetail = vi.fn();

    render(
      <ProjectBlueprintCard
        blueprint={mockBlueprint}
        onViewDetail={handleViewDetail}
      />
    );

    const viewBtn = screen.getByTestId('view-blueprint-btn-101');
    expect(viewBtn).toHaveTextContent('View Roadmap (4 Milestones)');
    fireEvent.click(viewBtn);

    expect(handleViewDetail).toHaveBeenCalledTimes(1);
    expect(handleViewDetail).toHaveBeenCalledWith(101);
  });

  it('triggers onInstantiate callback when Start Project button is clicked', () => {
    const handleInstantiate = vi.fn();

    render(
      <ProjectBlueprintCard
        blueprint={mockBlueprint}
        onViewDetail={vi.fn()}
        onInstantiate={handleInstantiate}
      />
    );

    const instantiateBtn = screen.getByTestId('instantiate-blueprint-btn-101');
    expect(instantiateBtn).toHaveTextContent('🚀 Start Project');
    fireEvent.click(instantiateBtn);

    expect(handleInstantiate).toHaveBeenCalledTimes(1);
    expect(handleInstantiate).toHaveBeenCalledWith(101);
  });

  it('renders loading/disabled state during instantiation', () => {
    render(
      <ProjectBlueprintCard
        blueprint={mockBlueprint}
        onViewDetail={vi.fn()}
        onInstantiate={vi.fn()}
        isInstantiating={true}
      />
    );

    const instantiateBtn = screen.getByTestId('instantiate-blueprint-btn-101');
    expect(instantiateBtn).toHaveTextContent('Creating Project...');
    expect(instantiateBtn).toBeDisabled();
  });
});
