import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectBlueprintDetailModal } from '../ProjectBlueprintDetailModal';
import * as projectBlueprintsApi from '@/api/projectBlueprints';
import { ProjectBlueprintDetail, BlueprintRecommendationItem } from '@/types/projectBlueprint';

vi.mock('@/api/projectBlueprints');

const mockDetail: ProjectBlueprintDetail = {
  id: 101,
  title: 'Distributed Key-Value Store with Raft Consensus',
  slug: 'distributed-kv-store-raft',
  version: 1,
  summary: 'Build a fault-tolerant, replicated in-memory key-value store.',
  description: 'Design and implement a distributed key-value store from scratch using Raft.',
  learning_objectives: '1. Master consensus protocols.\n2. Implement asynchronous gRPC networking.',
  project_type: 'software',
  difficulty_level: 'advanced',
  estimated_hours: 40,
  status: 'published',
  skills: [
    { id: 1, skill_id: 10, name: 'Go', slug: 'go', category: 'Backend', is_primary: true },
    { id: 2, skill_id: 11, name: 'Distributed Systems', slug: 'distributed-systems', category: 'Backend', is_primary: true },
    { id: 3, skill_id: 12, name: 'gRPC', slug: 'grpc', category: 'Backend', is_primary: false },
  ],
  milestones: [
    {
      id: 1,
      title: 'RPC Protocol & Storage Engine',
      description: 'Define protobuf service schemas.',
      expected_deliverable: 'In-memory LSM store with gRPC handler interfaces.',
      recommended_evidence_type: 'repository',
      evidence_guidance: 'Public repository link with unit tests.',
      display_order: 1,
      created_at: '2026-10-08T00:00:00Z',
    },
    {
      id: 2,
      title: 'Leader Election Loop',
      description: 'Implement election timers and RequestVote RPCs.',
      expected_deliverable: 'Election state machine handling split-votes.',
      recommended_evidence_type: 'demo',
      evidence_guidance: 'Test harness terminal recording.',
      display_order: 2,
      created_at: '2026-10-08T00:00:00Z',
    },
  ],
  created_at: '2026-10-08T00:00:00Z',
  updated_at: '2026-10-08T00:00:00Z',
};

const mockRecommendation: BlueprintRecommendationItem = {
  blueprint: {
    ...mockDetail,
    milestones_count: 2,
  },
  matched_missing_skills: [{ id: 10, name: 'Go', slug: 'go', is_primary: true }],
  missing_primary_count: 1,
  missing_supporting_count: 0,
  total_missing_covered: 1,
  relevance_score: 13,
  recommendation_reason: 'Matches missing skill: Go',
};

describe('ProjectBlueprintDetailModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    render(
      <ProjectBlueprintDetailModal
        blueprintId={101}
        isOpen={false}
        onClose={vi.fn()}
        onInstantiate={vi.fn()}
      />
    );

    expect(screen.queryByTestId('blueprint-detail-modal')).not.toBeInTheDocument();
  });

  it('fetches and displays blueprint details, learning objectives, and ordered milestones', async () => {
    vi.mocked(projectBlueprintsApi.getBlueprintDetail).mockResolvedValueOnce(mockDetail);

    render(
      <ProjectBlueprintDetailModal
        blueprintId={101}
        recommendation={mockRecommendation}
        isOpen={true}
        onClose={vi.fn()}
        onInstantiate={vi.fn()}
      />
    );

    expect(screen.getByTestId('blueprint-modal-loading')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Distributed Key-Value Store with Raft Consensus')).toBeInTheDocument();
    });

    // Overview & learning objectives
    expect(screen.getByText(/Design and implement a distributed key-value store/)).toBeInTheDocument();
    expect(screen.getByText(/Master consensus protocols/)).toBeInTheDocument();

    // Recommendation box
    expect(screen.getByTestId('modal-recommendation-box')).toHaveTextContent('Matches missing skill: Go');

    // Milestones ordered list
    const m1 = screen.getByTestId('modal-milestone-1');
    expect(m1).toHaveTextContent('1. RPC Protocol & Storage Engine');
    expect(m1).toHaveTextContent('Public repository link with unit tests.');

    const m2 = screen.getByTestId('modal-milestone-2');
    expect(m2).toHaveTextContent('2. Leader Election Loop');
    expect(m2).toHaveTextContent('Test harness terminal recording.');
  });

  it('renders conflict error notice when provided', async () => {
    vi.mocked(projectBlueprintsApi.getBlueprintDetail).mockResolvedValueOnce(mockDetail);

    render(
      <ProjectBlueprintDetailModal
        blueprintId={101}
        isOpen={true}
        onClose={vi.fn()}
        onInstantiate={vi.fn()}
        conflictError="You already have an active project created from this blueprint."
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('blueprint-conflict-error')).toHaveTextContent(
        'You already have an active project created from this blueprint.'
      );
    });
  });

  it('triggers onInstantiate callback when Start This Project button is clicked', async () => {
    vi.mocked(projectBlueprintsApi.getBlueprintDetail).mockResolvedValueOnce(mockDetail);
    const handleInstantiate = vi.fn();

    render(
      <ProjectBlueprintDetailModal
        blueprintId={101}
        isOpen={true}
        onClose={vi.fn()}
        onInstantiate={handleInstantiate}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('modal-instantiate-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('modal-instantiate-btn'));
    expect(handleInstantiate).toHaveBeenCalledWith(101);
  });

  it('handles error state gracefully with retry button', async () => {
    vi.mocked(projectBlueprintsApi.getBlueprintDetail).mockRejectedValueOnce({
      status: 500,
      message: 'Failed to fetch roadmap',
    });

    render(
      <ProjectBlueprintDetailModal
        blueprintId={101}
        isOpen={true}
        onClose={vi.fn()}
        onInstantiate={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('blueprint-modal-error')).toHaveTextContent('Failed to fetch roadmap');
    });

    // Click retry
    vi.mocked(projectBlueprintsApi.getBlueprintDetail).mockResolvedValueOnce(mockDetail);
    fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => {
      expect(screen.getByText('Distributed Key-Value Store with Raft Consensus')).toBeInTheDocument();
    });
  });
});
