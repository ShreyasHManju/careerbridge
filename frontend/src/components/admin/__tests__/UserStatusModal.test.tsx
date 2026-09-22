import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserStatusModal } from '../UserStatusModal';
import * as adminApi from '@/api/admin';
import { AdminUser } from '@/types/admin';

vi.mock('@/api/admin');

const mockUser: AdminUser = {
  id: 42,
  email: 'candidate@test.com',
  role: 'student',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
};

describe('UserStatusModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false or user is null', () => {
    const { container } = render(
      <UserStatusModal isOpen={false} user={mockUser} onClose={vi.fn()} onSuccess={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('displays deactivation confirmation and updates status on confirm', async () => {
    const updateSpy = vi.spyOn(adminApi, 'updateAdminUserStatus').mockResolvedValue({
      ...mockUser,
      is_active: false,
    });
    const onClose = vi.fn();
    const onSuccess = vi.fn();

    render(
      <UserStatusModal isOpen={true} user={mockUser} onClose={onClose} onSuccess={onSuccess} />
    );

    expect(screen.getByText('Deactivate User Account')).toBeInTheDocument();
    expect(screen.getByText('candidate@test.com')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('confirm-status-btn'));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(42, { is_active: false });
      expect(onSuccess).toHaveBeenCalledWith({ ...mockUser, is_active: false });
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('displays activation confirmation when user is inactive', async () => {
    const inactiveUser = { ...mockUser, is_active: false };
    const updateSpy = vi.spyOn(adminApi, 'updateAdminUserStatus').mockResolvedValue({
      ...mockUser,
      is_active: true,
    });
    const onClose = vi.fn();
    const onSuccess = vi.fn();

    render(
      <UserStatusModal isOpen={true} user={inactiveUser} onClose={onClose} onSuccess={onSuccess} />
    );

    expect(screen.getByText('Activate User Account')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('confirm-status-btn'));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(42, { is_active: true });
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('displays error message when status update fails', async () => {
    vi.spyOn(adminApi, 'updateAdminUserStatus').mockRejectedValue({
      detail: 'Administrators cannot deactivate their own account',
    });

    render(
      <UserStatusModal isOpen={true} user={mockUser} onClose={vi.fn()} onSuccess={vi.fn()} />
    );

    fireEvent.click(screen.getByTestId('confirm-status-btn'));

    await waitFor(() => {
      expect(
        screen.getByText('Administrators cannot deactivate their own account')
      ).toBeInTheDocument();
    });
  });
});
