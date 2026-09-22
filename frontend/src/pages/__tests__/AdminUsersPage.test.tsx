import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminUsersPage } from '../AdminUsersPage';
import * as adminApi from '@/api/admin';
import * as exportApi from '@/api/export';
import * as authHook from '@/auth/useAuth';
import { AdminUser, AdminUserPaginationResponse } from '@/types/admin';

vi.mock('@/api/admin');
vi.mock('@/api/export');

const mockAdminUser: AdminUser = {
  id: 1,
  email: 'admin@careerbridge.io',
  role: 'admin',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
};

const mockStudentUser: AdminUser = {
  id: 2,
  email: 'student@example.com',
  role: 'student',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-02T10:00:00Z',
  updated_at: '2026-09-02T10:00:00Z',
};

const mockInactiveUser: AdminUser = {
  id: 3,
  email: 'banned@example.com',
  role: 'student',
  is_active: false,
  is_verified: false,
  created_at: '2026-09-03T10:00:00Z',
  updated_at: '2026-09-03T10:00:00Z',
};

const mockPaginationResponse: AdminUserPaginationResponse = {
  items: [mockAdminUser, mockStudentUser, mockInactiveUser],
  page: 1,
  page_size: 10,
  total: 3,
  total_pages: 1,
};

describe('AdminUsersPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authHook, 'useAuth').mockReturnValue({
      user: {
        id: 1,
        email: 'admin@careerbridge.io',
        role: 'admin',
        is_active: true,
        is_verified: true,
        created_at: '2026-09-01T10:00:00Z',
        updated_at: '2026-09-01T10:00:00Z',
      },
      isAuthenticated: true,
      isLoading: false,
      token: 'admin-token',
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      clearAuthentication: vi.fn(),
      initializeSession: vi.fn(),
      clearError: vi.fn(),
    });
  });

  it('renders loading state initially', () => {
    vi.spyOn(adminApi, 'getAdminUsers').mockReturnValue(new Promise(() => {}));

    render(<AdminUsersPage />);

    expect(screen.getByText(/Loading user directory/i)).toBeInTheDocument();
  });

  it('renders user directory table with data and self-deactivation guard', async () => {
    vi.spyOn(adminApi, 'getAdminUsers').mockResolvedValue(mockPaginationResponse);

    render(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('admin@careerbridge.io')).toBeInTheDocument();
      expect(screen.getByText('student@example.com')).toBeInTheDocument();
      expect(screen.getByText('banned@example.com')).toBeInTheDocument();
      expect(screen.getByText('You')).toBeInTheDocument();
    });

    // Self deactivation button is disabled
    const selfToggleBtn = screen.getByTestId('toggle-status-1-btn');
    expect(selfToggleBtn).toBeDisabled();

    // Other user deactivation button is enabled
    const studentToggleBtn = screen.getByTestId('toggle-status-2-btn');
    expect(studentToggleBtn).not.toBeDisabled();
  });

  it('filters by email search', async () => {
    const fetchSpy = vi.spyOn(adminApi, 'getAdminUsers').mockResolvedValue(mockPaginationResponse);

    render(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('student@example.com')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('user-search-input');
    fireEvent.change(searchInput, { target: { value: 'student@example.com' } });
    fireEvent.click(screen.getByTestId('search-users-btn'));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'student@example.com', page: 1 })
      );
    });
  });

  it('filters by role and status', async () => {
    const fetchSpy = vi.spyOn(adminApi, 'getAdminUsers').mockResolvedValue(mockPaginationResponse);

    render(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('student@example.com')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('role-filter-select'), {
      target: { value: 'student' },
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'student', page: 1 })
      );
    });

    fireEvent.change(screen.getByTestId('status-filter-select'), {
      target: { value: 'true' },
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: true, page: 1 })
      );
    });
  });

  it('opens UserStatusModal and updates row on success', async () => {
    vi.spyOn(adminApi, 'getAdminUsers').mockResolvedValue(mockPaginationResponse);
    vi.spyOn(adminApi, 'updateAdminUserStatus').mockResolvedValue({
      ...mockStudentUser,
      is_active: false,
    });

    render(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('student@example.com')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-status-2-btn'));

    expect(screen.getByTestId('user-status-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('confirm-status-btn'));

    await waitFor(() => {
      expect(
        screen.getByText(/User account student@example.com was successfully deactivated/i)
      ).toBeInTheDocument();
    });
  });

  it('triggers CSV export', async () => {
    vi.spyOn(adminApi, 'getAdminUsers').mockResolvedValue(mockPaginationResponse);
    const exportSpy = vi.spyOn(exportApi, 'exportAdminUsers').mockResolvedValue(undefined);

    render(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('admin@careerbridge.io')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('export-users-btn'));

    await waitFor(() => {
      expect(exportSpy).toHaveBeenCalled();
      expect(screen.getByText('User directory CSV exported successfully.')).toBeInTheDocument();
    });
  });

  it('renders error state and retry button on fetch failure', async () => {
    vi.spyOn(adminApi, 'getAdminUsers').mockRejectedValue({
      detail: 'Failed to fetch users',
    });

    render(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch users')).toBeInTheDocument();
      expect(screen.getByTestId('retry-users-btn')).toBeInTheDocument();
    });
  });

  it('renders empty state when total is 0', async () => {
    vi.spyOn(adminApi, 'getAdminUsers').mockResolvedValue({
      items: [],
      page: 1,
      page_size: 10,
      total: 0,
      total_pages: 0,
    });

    render(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByTestId('users-empty-state')).toBeInTheDocument();
    });
  });
});
