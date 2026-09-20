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

describe('AppLayout Navigation (Phase F-06)', () => {
  it('renders student navigation links including My Applications (/app/applications)', () => {
    setupAuth(mockStudentUser);

    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /Home/i })).toHaveAttribute('href', '/app');
    expect(screen.getByRole('link', { name: /My Profile/i })).toHaveAttribute('href', '/app/student/profile');
    expect(screen.getByRole('link', { name: /Opportunities/i })).toHaveAttribute('href', '/app/jobs');
    expect(screen.getByRole('link', { name: /My Applications/i })).toHaveAttribute('href', '/app/applications');
    expect(screen.queryByRole('link', { name: /^Applications$/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Applications \(Phase 5\)/i)).not.toBeInTheDocument();
  });

  it('renders recruiter navigation links including Applications (/app/recruiter/applications)', () => {
    setupAuth(mockRecruiterUser);

    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /Home/i })).toHaveAttribute('href', '/app');
    expect(screen.getByRole('link', { name: /Company Profile/i })).toHaveAttribute('href', '/app/recruiter/profile');
    expect(screen.getByRole('link', { name: /Opportunities/i })).toHaveAttribute('href', '/app/jobs');
    expect(screen.getByRole('link', { name: /^Applications$/i })).toHaveAttribute('href', '/app/recruiter/applications');
    expect(screen.queryByRole('link', { name: /My Applications/i })).not.toBeInTheDocument();
  });

  it('renders admin navigation without application self-service management link', () => {
    setupAuth(mockAdminUser);

    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /Home/i })).toHaveAttribute('href', '/app');
    expect(screen.getByRole('link', { name: /Opportunities/i })).toHaveAttribute('href', '/app/jobs');
    expect(screen.queryByRole('link', { name: /My Applications/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Applications$/i })).not.toBeInTheDocument();
  });
});
