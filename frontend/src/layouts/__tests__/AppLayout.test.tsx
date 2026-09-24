import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppLayout } from '../AppLayout';
import * as useAuthModule from '@/auth/useAuth';
import { User } from '@/types/auth';

const mockStudentUser: User = {
  id: 1,
  email: 'student@example.com',
  role: 'student',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-19T10:00:00Z',
  updated_at: '2026-09-19T10:00:00Z',
};

const mockRecruiterUser: User = {
  id: 2,
  email: 'recruiter@example.com',
  role: 'recruiter',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-19T10:00:00Z',
  updated_at: '2026-09-19T10:00:00Z',
};

const mockAdminUser: User = {
  id: 3,
  email: 'admin@example.com',
  role: 'admin',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-19T10:00:00Z',
  updated_at: '2026-09-19T10:00:00Z',
};

function setupAuth(user: User | null) {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    user,
    token: user ? 'valid-token' : null,
    isAuthenticated: !!user,
    isLoading: false,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    clearAuthentication: vi.fn(),
    initializeSession: vi.fn(),
    clearError: vi.fn(),
  });
}

describe('AppLayout Navigation (Phase F-08 & 30B.2)', () => {
  it('renders student navigation links including Projects (/app/projects), Saved Jobs (/app/saved-jobs), My Applications (/app/applications) and Interviews (/app/interviews)', () => {
    setupAuth(mockStudentUser);

    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /Home/i })).toHaveAttribute('href', '/app');
    expect(screen.getByRole('link', { name: /My Profile/i })).toHaveAttribute('href', '/app/student/profile');
    expect(screen.getByRole('link', { name: /^Projects$/i })).toHaveAttribute('href', '/app/projects');
    expect(screen.getByRole('link', { name: /Opportunities/i })).toHaveAttribute('href', '/app/jobs');
    expect(screen.getByRole('link', { name: /Saved Jobs/i })).toHaveAttribute('href', '/app/saved-jobs');
    expect(screen.getByRole('link', { name: /My Applications/i })).toHaveAttribute('href', '/app/applications');
    expect(screen.getByRole('link', { name: /Interviews/i })).toHaveAttribute('href', '/app/interviews');
    expect(screen.queryByRole('link', { name: /^Job Postings$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Applications$/i })).not.toBeInTheDocument();
  });

  it('renders recruiter navigation links including Job Postings (/app/recruiter/jobs), Applications (/app/recruiter/applications) and Interviews (/app/recruiter/interviews)', () => {
    setupAuth(mockRecruiterUser);

    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /Home/i })).toHaveAttribute('href', '/app');
    expect(screen.getByRole('link', { name: /Company Profile/i })).toHaveAttribute('href', '/app/recruiter/profile');
    expect(screen.getByRole('link', { name: /Opportunities/i })).toHaveAttribute('href', '/app/jobs');
    expect(screen.getByRole('link', { name: /^Job Postings$/i })).toHaveAttribute('href', '/app/recruiter/jobs');
    expect(screen.getByRole('link', { name: /^Applications$/i })).toHaveAttribute('href', '/app/recruiter/applications');
    expect(screen.getByRole('link', { name: /Interviews/i })).toHaveAttribute('href', '/app/recruiter/interviews');
    expect(screen.queryByRole('link', { name: /^Projects$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Saved Jobs/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /My Applications/i })).not.toBeInTheDocument();
  });

  it('renders admin navigation without project, application, interview, job postings, or saved-job self-service links', () => {
    setupAuth(mockAdminUser);

    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /Home/i })).toHaveAttribute('href', '/app');
    expect(screen.getByRole('link', { name: /Opportunities/i })).toHaveAttribute('href', '/app/jobs');
    expect(screen.queryByRole('link', { name: /^Projects$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Saved Jobs/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /My Applications/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Job Postings$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Applications$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Interviews/i })).not.toBeInTheDocument();
  });

  it('renders notification center control for authenticated users across all roles', () => {
    // Student
    setupAuth(mockStudentUser);
    const { unmount: unmountStudent } = render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: /Notifications/i })).toBeInTheDocument();
    unmountStudent();

    // Recruiter
    setupAuth(mockRecruiterUser);
    const { unmount: unmountRecruiter } = render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: /Notifications/i })).toBeInTheDocument();
    unmountRecruiter();

    // Admin
    setupAuth(mockAdminUser);
    const { unmount: unmountAdmin } = render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: /Notifications/i })).toBeInTheDocument();
    unmountAdmin();
  });

  it('does not render notification control or user pill when unauthenticated', () => {
    setupAuth(null);

    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    );

    expect(screen.queryByRole('button', { name: /Notifications/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/student@example.com/i)).not.toBeInTheDocument();
  });
});
