import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PublicPassportPage } from '../PublicPassportPage';
import * as passportApi from '@/api/passport';
import { PublicPassportResponse } from '@/types/passport';

const mockPublicPassport: PublicPassportResponse = {
  full_name: 'Elena Rostova',
  institution: 'Stanford University',
  major: 'Computer Science',
  degree: 'B.S.',
  graduation_year: 2026,
  bio: 'Systems software enthusiast and open-source contributor.',
  avatar_url: 'https://example.com/avatar.jpg',
  contact_info: {
    email: 'elena@stanford.edu',
    phone: '+1-555-0199',
    github_url: 'https://github.com/elenarostova',
    linkedin_url: 'https://linkedin.com/in/elenarostova',
    portfolio_url: 'https://elenarostova.dev',
  },
  verification_summary: {
    issuer: 'CareerBridge',
    verification_status: 'VERIFIED',
    verified_at: '2026-09-15T12:00:00Z',
    verified_placements_count: 2,
    verified_projects_count: 1,
    total_verified_skills: 4,
  },
  verified_skills: [
    {
      skill_name: 'Rust',
      category: 'Systems',
      projects_count: 1,
      verified_placements_count: 1,
    },
    {
      skill_name: 'Distributed Systems',
      category: 'Architecture',
      projects_count: 1,
      verified_placements_count: 2,
    },
  ],
  experience_timeline: [
    {
      company_name: 'Cloudflare',
      role_title: 'Systems Engineering Intern',
      employment_type: 'Internship',
      start_date: '2025-06-01',
      end_date: '2025-08-31',
      is_current: false,
      is_verified: true,
      verified_at: '2025-09-01T00:00:00Z',
    },
  ],
  featured_projects: [
    {
      title: 'High-Throughput Key-Value Store',
      tagline: 'LSM-tree storage engine in Rust',
      description: 'Engineered a concurrent storage engine with WAL and compaction.',
      milestones_completed: 3,
      total_milestones: 3,
      repository_url: 'https://github.com/elenarostova/kv-store',
      live_demo_url: 'https://kv-demo.elenarostova.dev',
      is_verified: true,
      verified_evidence_count: 2,
    },
  ],
};

describe('PublicPassportPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state while resolving share token', () => {
    vi.spyOn(passportApi, 'getPublicPassport').mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter initialEntries={['/p/share_token_xyz']}>
        <Routes>
          <Route path="/p/:shareToken" element={<PublicPassportPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('public-passport-loading')).toBeInTheDocument();
    expect(
      screen.getByText('Verifying CareerBridge credentials & loading passport...')
    ).toBeInTheDocument();
  });

  it('renders populated public verified passport with all sections and verification proofs', async () => {
    vi.spyOn(passportApi, 'getPublicPassport').mockResolvedValueOnce(mockPublicPassport);

    render(
      <MemoryRouter initialEntries={['/p/share_token_xyz']}>
        <Routes>
          <Route path="/p/:shareToken" element={<PublicPassportPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('public-passport-loading')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('public-passport-page')).toBeInTheDocument();

    // Trust Banner & Header
    expect(screen.getByTestId('public-passport-banner')).toBeInTheDocument();
    expect(screen.getByTestId('public-passport-name')).toHaveTextContent('Elena Rostova');
    expect(screen.getByTestId('public-verified-badge')).toHaveTextContent('✓ CareerBridge Verified');
    expect(screen.getByTestId('public-passport-academic')).toHaveTextContent(
      'B.S. • Computer Science • Stanford University • Class of 2026'
    );
    expect(screen.getByTestId('public-passport-bio')).toHaveTextContent(
      'Systems software enthusiast and open-source contributor.'
    );
    expect(screen.getByTestId('public-passport-avatar')).toHaveAttribute(
      'src',
      'https://example.com/avatar.jpg'
    );

    // Contact section
    expect(screen.getByTestId('public-contact-section')).toBeInTheDocument();
    expect(screen.getByTestId('public-contact-email')).toHaveTextContent('elena@stanford.edu');
    expect(screen.getByTestId('public-contact-github')).toHaveAttribute(
      'href',
      'https://github.com/elenarostova'
    );

    // Verification Summary
    expect(screen.getByTestId('public-issuer')).toHaveTextContent('Issuer: CareerBridge');
    expect(screen.getByTestId('stat-count-public-placements')).toHaveTextContent('2');
    expect(screen.getByTestId('stat-count-public-projects')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-count-public-skills')).toHaveTextContent('4');

    // Skills Grid
    expect(screen.getByTestId('public-skill-card-Rust')).toHaveTextContent('Rust');
    expect(screen.getByTestId('public-skill-card-Rust')).toHaveTextContent('📁 1 Project');
    expect(screen.getByTestId('public-skill-card-Rust')).toHaveTextContent('💼 1 Placement');

    // Experience
    expect(screen.getByTestId('public-exp-item-0')).toHaveTextContent('Systems Engineering Intern');
    expect(screen.getByTestId('public-exp-item-0')).toHaveTextContent('Cloudflare');

    // Projects
    expect(screen.getByTestId('public-proj-item-0')).toHaveTextContent(
      'High-Throughput Key-Value Store'
    );
    expect(screen.getByTestId('public-proj-repo-0')).toHaveAttribute(
      'href',
      'https://github.com/elenarostova/kv-store'
    );
    expect(screen.getByTestId('public-proj-demo-0')).toHaveAttribute(
      'href',
      'https://kv-demo.elenarostova.dev'
    );

    // Footer
    expect(screen.getByTestId('public-passport-footer')).toBeInTheDocument();
  });

  it('renders correctly when contact info is hidden by the student', async () => {
    const passportWithoutContact: PublicPassportResponse = {
      ...mockPublicPassport,
      contact_info: null,
      avatar_url: null,
    };

    vi.spyOn(passportApi, 'getPublicPassport').mockResolvedValueOnce(passportWithoutContact);

    render(
      <MemoryRouter initialEntries={['/p/share_token_xyz']}>
        <Routes>
          <Route path="/p/:shareToken" element={<PublicPassportPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('public-passport-loading')).not.toBeInTheDocument();
    });

    expect(screen.queryByTestId('public-contact-section')).not.toBeInTheDocument();
    expect(screen.getByTestId('public-passport-avatar-placeholder')).toHaveTextContent('ER');
  });

  it('renders 404 state when link is not found', async () => {
    vi.spyOn(passportApi, 'getPublicPassport').mockRejectedValueOnce({
      status: 404,
      message: 'Passport share link not found.',
    });

    render(
      <MemoryRouter initialEntries={['/p/invalid_token']}>
        <Routes>
          <Route path="/p/:shareToken" element={<PublicPassportPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('public-passport-not-found')).toBeInTheDocument();
    });

    expect(screen.getByText('Passport Link Not Found')).toBeInTheDocument();
    expect(screen.getByTestId('public-passport-home-btn')).toBeInTheDocument();
  });

  it('renders 410 state when link is expired or revoked', async () => {
    vi.spyOn(passportApi, 'getPublicPassport').mockRejectedValueOnce({
      status: 410,
      message: 'This Passport sharing link has expired or has been revoked.',
    });

    render(
      <MemoryRouter initialEntries={['/p/expired_token']}>
        <Routes>
          <Route path="/p/:shareToken" element={<PublicPassportPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('public-passport-expired-revoked')).toBeInTheDocument();
    });

    expect(screen.getByText('Passport Link Expired or Revoked')).toBeInTheDocument();
  });

  it('renders 429 state when rate limited and handles retry', async () => {
    const getSpy = vi
      .spyOn(passportApi, 'getPublicPassport')
      .mockRejectedValueOnce({
        status: 429,
        retry_after: 30,
        message: 'Too many requests.',
      })
      .mockResolvedValueOnce(mockPublicPassport);

    render(
      <MemoryRouter initialEntries={['/p/rate_limited_token']}>
        <Routes>
          <Route path="/p/:shareToken" element={<PublicPassportPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('public-passport-rate-limited')).toBeInTheDocument();
    });

    expect(screen.getByText('Too Many Requests')).toBeInTheDocument();
    expect(screen.getByText(/Retry after 30 seconds/)).toBeInTheDocument();

    // Click Retry
    fireEvent.click(screen.getByTestId('public-passport-rate-retry-btn'));

    expect(getSpy).toHaveBeenCalledTimes(2);

    await waitFor(() => {
      expect(screen.getByTestId('public-passport-page')).toBeInTheDocument();
    });
  });

  it('renders generic error state on network failure and handles retry', async () => {
    const getSpy = vi
      .spyOn(passportApi, 'getPublicPassport')
      .mockRejectedValueOnce({
        status: 500,
        message: 'Internal server error.',
      })
      .mockResolvedValueOnce(mockPublicPassport);

    render(
      <MemoryRouter initialEntries={['/p/error_token']}>
        <Routes>
          <Route path="/p/:shareToken" element={<PublicPassportPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('public-passport-generic-error')).toBeInTheDocument();
    });

    expect(screen.getByText('Unable to Load Passport')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('public-passport-retry-button'));

    expect(getSpy).toHaveBeenCalledTimes(2);

    await waitFor(() => {
      expect(screen.getByTestId('public-passport-page')).toBeInTheDocument();
    });
  });
});
