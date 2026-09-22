import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserDetailModal } from '../UserDetailModal';
import * as adminApi from '@/api/admin';
import { AdminUser } from '@/types/admin';

vi.mock('@/api/admin');

const mockUser: AdminUser = {
  id: 10,
  email: 'admin.super@careerbridge.io',
  role: 'admin',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
};

describe('UserDetailModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <UserDetailModal isOpen={false} userId={10} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('fetches and displays user details when opened', async () => {
    vi.spyOn(adminApi, 'getAdminUserDetail').mockResolvedValue(mockUser);

    render(<UserDetailModal isOpen={true} userId={10} onClose={vi.fn()} />);

    expect(screen.getByText('User Account Details')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('#10')).toBeInTheDocument();
      expect(screen.getByText('admin.super@careerbridge.io')).toBeInTheDocument();
      expect(screen.getByText('admin')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('✓ Verified')).toBeInTheDocument();
    });
  });

  it('displays error when fetch fails', async () => {
    vi.spyOn(adminApi, 'getAdminUserDetail').mockRejectedValue({
      detail: 'User not found',
    });

    render(<UserDetailModal isOpen={true} userId={999} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('User not found')).toBeInTheDocument();
    });
  });
});
