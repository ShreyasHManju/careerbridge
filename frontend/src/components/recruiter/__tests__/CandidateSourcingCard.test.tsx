import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CandidateSourcingCard } from '../CandidateSourcingCard';
import {
  CandidateSourcingResult,
  candidateFromPassport,
} from '@/types/candidate';
import { PassportResponse } from '@/types/passport';

const mockCandidate: CandidateSourcingResult = {
  id: 42,
  full_name: 'Alex Rivera',
  email: 'alex.rivera@university.edu',
  bio: 'Passionate full-stack developer with 2+ years building open-source React and Python applications.',
  profile_image_url: 'https://example.com/avatar.jpg',
  github_url: 'https://github.com/alexrivera',
  linkedin_url: 'https://linkedin.com/in/alexrivera',
  portfolio_url: 'https://alexrivera.dev',
  education: {
    college: 'Stanford University',
    degree: 'B.S.',
    branch: 'Computer Science',
    graduation_year: 2026,
  },
  skills: [
    { id: 1, name: 'React', slug: 'react', category: 'Frontend', is_verified: true },
    { id: 2, name: 'TypeScript', slug: 'typescript', category: 'Frontend', is_verified: true },
    { id: 3, name: 'FastAPI', slug: 'fastapi', category: 'Backend', is_verified: false },
    { id: 4, name: 'Docker', slug: 'docker', category: 'DevOps', is_verified: false },
  ],
  verified_skills: [
    { id: 1, name: 'React', slug: 'react', category: 'Frontend', is_verified: true },
    { id: 2, name: 'TypeScript', slug: 'typescript', category: 'Frontend', is_verified: true },
  ],
  top_projects: [
    {
      id: 101,
      title: 'DevCollab Open Source Platform',
      slug: 'devcollab',
      short_description: 'Real-time collaborative code editor with WebSockets.',
      project_type: 'capstone',
      visibility: 'public',
      progress_percentage: 100,
      verified_evidence_count: 3,
      average_evaluation_score: 4.8,
      evaluations_count: 2,
      repository_url: 'https://github.com/alexrivera/devcollab',
      live_demo_url: 'https://devcollab.demo',
    },
  ],
  passport_summary: {
    verified_experiences_count: 2,
    public_projects_count: 1,
    canonical_skills_count: 4,
    completed_milestones_count: 6,
    verified_evidence_count: 3,
    total_evaluations_count: 2,
    average_project_score: 4.8,
    is_verified: true,
  },
  created_at: '2026-09-01T10:00:00Z',
};

const mockMinimalCandidate: CandidateSourcingResult = {
  id: 99,
  full_name: null,
  bio: null,
  profile_image_url: null,
  github_url: null,
  linkedin_url: null,
  portfolio_url: null,
  education: {
    college: null,
    degree: null,
    branch: null,
    graduation_year: null,
  },
  skills: [],
  verified_skills: [],
  top_projects: [],
  passport_summary: {
    verified_experiences_count: 0,
    public_projects_count: 0,
    canonical_skills_count: 0,
    completed_milestones_count: 0,
    verified_evidence_count: 0,
    is_verified: false,
  },
};

const mockPassportResponse: PassportResponse = {
  identity: {
    user_id: 77,
    email: 'jordan@college.edu',
    full_name: 'Jordan Lee',
    college: 'MIT',
    degree: 'M.S.',
    branch: 'Robotics',
    graduation_year: 2027,
    bio: 'Autonomous robotics researcher and software engineer.',
    github_url: 'https://github.com/jordanlee',
    linkedin_url: null,
    portfolio_url: null,
    profile_image_url: null,
    is_verified: true,
    created_at: '2026-08-15T09:00:00Z',
  },
  summary: {
    verified_experiences_count: 3,
    public_projects_count: 2,
    canonical_skills_count: 5,
    completed_milestones_count: 8,
    verified_evidence_count: 4,
    total_evaluations_count: 1,
    average_project_score: 5.0,
  },
  verified_experiences: [],
  projects: [
    {
      id: 201,
      title: 'Autonomous Navigation Drone',
      slug: 'autonomous-drone',
      short_description: 'ROS2 and Computer Vision navigation system.',
      description: 'Full description of drone project.',
      project_type: 'research',
      status: 'active',
      visibility: 'public',
      repository_url: 'https://github.com/jordanlee/drone',
      live_demo_url: null,
      skills: 'ROS2, Python, C++',
      structured_skills: [],
      total_milestones: 4,
      completed_milestones: 4,
      progress_percentage: 100,
      milestones: [],
      verified_evidence: [],
      verified_evidence_count: 2,
      average_evaluation_score: 5.0,
      evaluations_count: 1,
    },
    {
      id: 202,
      title: 'Internal Secret Project',
      slug: 'internal-secret',
      short_description: 'Confidential project.',
      description: 'Private details.',
      project_type: 'personal',
      status: 'active',
      visibility: 'private', // Private project should be excluded by candidateFromPassport
      repository_url: null,
      live_demo_url: null,
      skills: null,
      structured_skills: [],
      total_milestones: 1,
      completed_milestones: 0,
      progress_percentage: 0,
      milestones: [],
      verified_evidence: [],
      verified_evidence_count: 0,
    },
  ],
  skills: [
    { id: 10, name: 'ROS2', slug: 'ros2', category: 'Robotics', is_verified: true, sources: ['experience'] },
    { id: 11, name: 'Python', slug: 'python', category: 'Backend', is_verified: true, sources: ['project'] },
    { id: 12, name: 'C++', slug: 'cpp', category: 'Languages', is_verified: false, sources: ['profile'] },
  ],
  milestones: [],
  verified_evidence: [],
  resume: null,
  is_owner: false,
};

describe('CandidateSourcingCard Component', () => {
  it('1. renders candidate identity, name, avatar, bio, and web links correctly', () => {
    render(
      <MemoryRouter>
        <CandidateSourcingCard candidate={mockCandidate} />
      </MemoryRouter>
    );

    expect(screen.getByText('Alex Rivera')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alex Rivera' })).toHaveAttribute('href', '/app/passport/42');
    expect(screen.getByTestId('candidate-bio-42')).toHaveTextContent(/Passionate full-stack developer/);
    expect(screen.getByRole('link', { name: /GitHub profile of Alex Rivera/i })).toHaveAttribute(
      'href',
      'https://github.com/alexrivera'
    );
    expect(screen.getByRole('link', { name: /LinkedIn profile of Alex Rivera/i })).toHaveAttribute(
      'href',
      'https://linkedin.com/in/alexrivera'
    );
  });

  it('2. renders education details with degree, branch, institution, and graduation year', () => {
    render(
      <MemoryRouter>
        <CandidateSourcingCard candidate={mockCandidate} />
      </MemoryRouter>
    );

    const educationElem = screen.getByTestId('candidate-education-42');
    expect(educationElem).toHaveTextContent(/B\.S\. in Computer Science/);
    expect(educationElem).toHaveTextContent(/Stanford University/);
    expect(educationElem).toHaveTextContent(/Class of 2026/);
  });

  it('3. renders verified skills distinctly with verified badge indicator', () => {
    render(
      <MemoryRouter>
        <CandidateSourcingCard candidate={mockCandidate} />
      </MemoryRouter>
    );

    const reactBadge = screen.getByTestId('verified-skill-react');
    expect(reactBadge).toBeInTheDocument();
    expect(reactBadge).toHaveTextContent(/React/);
    expect(reactBadge).toHaveTextContent(/✓/);

    const tsBadge = screen.getByTestId('verified-skill-typescript');
    expect(tsBadge).toBeInTheDocument();
    expect(tsBadge).toHaveTextContent(/TypeScript/);

    // Unverified skills should be present without verified test ID
    expect(screen.getByText('FastAPI')).toBeInTheDocument();
    expect(screen.getByText('Docker')).toBeInTheDocument();
  });

  it('4. renders verified credentials summary stats pills', () => {
    render(
      <MemoryRouter>
        <CandidateSourcingCard candidate={mockCandidate} />
      </MemoryRouter>
    );

    expect(screen.getByText(/Verified Claims/)).toBeInTheDocument();
    expect(screen.getByText('Public Projects')).toBeInTheDocument();
    expect(screen.getByText(/Reviews/)).toBeInTheDocument();
    expect(screen.getByText(/\(4\.8\/5\)/)).toBeInTheDocument();
    expect(screen.getByTestId('passport-verified-badge-42')).toHaveTextContent(/Verified Passport/);
  });

  it('5. strictly prevents rendering private sensitive data', () => {
    render(
      <MemoryRouter>
        <CandidateSourcingCard candidate={mockCandidate} />
      </MemoryRouter>
    );

    // Phone numbers, internal notes, private tokens must NOT be in document
    expect(screen.queryByText(/phone/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/internal/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/notes/i)).not.toBeInTheDocument();
  });

  it('6. renders public project items with artifact counts and evaluation metrics', () => {
    render(
      <MemoryRouter>
        <CandidateSourcingCard candidate={mockCandidate} />
      </MemoryRouter>
    );

    const projectCard = screen.getByTestId('candidate-project-101');
    expect(projectCard).toBeInTheDocument();
    expect(screen.getByText('DevCollab Open Source Platform')).toBeInTheDocument();
    expect(screen.getByText(/Real-time collaborative code editor/)).toBeInTheDocument();
    expect(screen.getByText(/3 Artifacts/)).toBeInTheDocument();
    expect(screen.getByText(/4\.8\/5 \(2 reviews\)/)).toBeInTheDocument();
    expect(screen.getByText(/100% completed/)).toBeInTheDocument();
  });

  it('7. gracefully handles minimal candidate data with fallback values', () => {
    render(
      <MemoryRouter>
        <CandidateSourcingCard candidate={mockCandidate} />
      </MemoryRouter>
    );

    // Initial render with full data works; now test minimal
    const { unmount } = render(
      <MemoryRouter>
        <CandidateSourcingCard candidate={mockMinimalCandidate} />
      </MemoryRouter>
    );

    expect(screen.getByText('Candidate #99')).toBeInTheDocument();
    expect(screen.getByText('ST')).toBeInTheDocument(); // Initials fallback
    expect(screen.getByText(/Academic details not specified/)).toBeInTheDocument();
    expect(screen.queryByTestId('passport-verified-badge-99')).not.toBeInTheDocument();
    unmount();
  });

  it('8. "View Experience Passport" link navigates to /app/passport/:studentId', () => {
    render(
      <MemoryRouter>
        <CandidateSourcingCard candidate={mockCandidate} />
      </MemoryRouter>
    );

    const passportLink = screen.getByTestId('view-passport-btn-42');
    expect(passportLink).toBeInTheDocument();
    expect(passportLink).toHaveAttribute('href', '/app/passport/42');
  });

  it('9. "Message Candidate" link uses the standard messaging deep-link convention', () => {
    render(
      <MemoryRouter>
        <CandidateSourcingCard candidate={mockCandidate} />
      </MemoryRouter>
    );

    const messageLink = screen.getByTestId('message-candidate-btn-42');
    expect(messageLink).toBeInTheDocument();
    expect(messageLink).toHaveAttribute('href', '/app/messages?recipientId=42');
  });

  it('10. triggers onInvite callback when invite button is clicked', () => {
    const handleInvite = vi.fn();
    render(
      <MemoryRouter>
        <CandidateSourcingCard candidate={mockCandidate} onInvite={handleInvite} />
      </MemoryRouter>
    );

    const inviteBtn = screen.getByTestId('invite-candidate-btn-42');
    expect(inviteBtn).toBeInTheDocument();
    fireEvent.click(inviteBtn);
    expect(handleInvite).toHaveBeenCalledTimes(1);
    expect(handleInvite).toHaveBeenCalledWith(mockCandidate);
  });

  it('11. converts PassportResponse into CandidateSourcingResult accurately via candidateFromPassport', () => {
    const converted = candidateFromPassport(mockPassportResponse);

    expect(converted.id).toBe(77);
    expect(converted.full_name).toBe('Jordan Lee');
    expect(converted.education.college).toBe('MIT');
    expect(converted.education.degree).toBe('M.S.');
    expect(converted.education.graduation_year).toBe(2027);
    expect(converted.verified_skills).toHaveLength(2); // ROS2 and Python are verified
    expect(converted.verified_skills.map((s) => s.name)).toEqual(['ROS2', 'Python']);
    expect(converted.top_projects).toHaveLength(1); // Private project must be excluded
    expect(converted.top_projects[0].title).toBe('Autonomous Navigation Drone');
    expect(converted.passport_summary.is_verified).toBe(true);
    expect(converted.passport_summary.verified_experiences_count).toBe(3);
  });
});
