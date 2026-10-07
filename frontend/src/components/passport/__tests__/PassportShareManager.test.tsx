import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PassportShareManager } from '../PassportShareManager';
import * as passportApi from '@/api/passport';
import { PassportShareSummaryResponse } from '@/types/passport';

const mockSharesList: PassportShareSummaryResponse[] = [
  {
    id: 101,
    token_preview: 'cb_share_101abc...',
    share_url: null,
    label: 'Google Application',
    is_active: true,
    allow_contact_info: true,
    allow_unverified_projects: false,
    view_count: 14,
    last_accessed_at: '2026-10-07T14:30:00Z',
    expires_at: '2026-11-01T00:00:00Z',
    created_at: '2026-10-01T10:00:00Z',
    revoked_at: null,
  },
  {
    id: 102,
    token_preview: 'cb_share_102def...',
    share_url: null,
    label: 'Expired Share Link',
    is_active: true,
    allow_contact_info: false,
    allow_unverified_projects: true,
    view_count: 3,
    last_accessed_at: null,
    expires_at: '2026-09-01T00:00:00Z', // Past date -> Expired
    created_at: '2026-08-01T10:00:00Z',
    revoked_at: null,
  },
  {
    id: 103,
    token_preview: 'cb_share_103ghi...',
    share_url: null,
    label: 'Old Recruiter Link',
    is_active: false,
    allow_contact_info: false,
    allow_unverified_projects: false,
    view_count: 0,
    last_accessed_at: null,
    expires_at: null,
    created_at: '2026-07-01T10:00:00Z',
    revoked_at: '2026-07-15T12:00:00Z',
  },
];

describe('PassportShareManager Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state while fetching shares', () => {
    vi.spyOn(passportApi, 'listPassportShares').mockReturnValue(new Promise(() => {}));

    render(<PassportShareManager />);

    expect(screen.getByTestId('shares-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading your passport sharing links...')).toBeInTheDocument();
  });

  it('renders empty state when no share links exist', async () => {
    vi.spyOn(passportApi, 'listPassportShares').mockResolvedValueOnce([]);

    render(<PassportShareManager />);

    await waitFor(() => {
      expect(screen.queryByTestId('shares-loading')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('shares-empty')).toBeInTheDocument();
    expect(screen.getByText('No Active Sharing Links Yet')).toBeInTheDocument();
  });

  it('renders populated shares list with status badges, view counts, and token previews', async () => {
    vi.spyOn(passportApi, 'listPassportShares').mockResolvedValueOnce(mockSharesList);

    render(<PassportShareManager />);

    await waitFor(() => {
      expect(screen.queryByTestId('shares-loading')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('shares-list')).toBeInTheDocument();

    // Share 101 - Active
    expect(screen.getByTestId('share-label-101')).toHaveTextContent('Google Application');
    expect(screen.getByTestId('share-status-active-101')).toHaveTextContent('Active');
    expect(screen.getByTestId('share-preview-101')).toHaveTextContent('Token Preview: cb_share_101abc...');
    expect(screen.getByTestId('share-views-101')).toHaveTextContent('14');
    expect(screen.getByTestId('share-contact-visibility-101')).toHaveTextContent('✓ Visible');
    expect(screen.getByTestId('share-unverified-visibility-101')).toHaveTextContent('✗ Verified Only');

    // Share 102 - Expired
    expect(screen.getByTestId('share-status-expired-102')).toHaveTextContent('Expired');
    expect(screen.getByTestId('share-unverified-visibility-102')).toHaveTextContent('✓ Included');

    // Share 103 - Revoked
    expect(screen.getByTestId('share-status-revoked-103')).toHaveTextContent('Revoked');
  });

  it('opens edit modal, submits settings update, and refreshes list', async () => {
    vi.spyOn(passportApi, 'listPassportShares')
      .mockResolvedValueOnce(mockSharesList)
      .mockResolvedValueOnce([
        {
          ...mockSharesList[0],
          label: 'Updated Google Application',
          allow_contact_info: false,
        },
        mockSharesList[1],
        mockSharesList[2],
      ]);

    const updateSpy = vi.spyOn(passportApi, 'updatePassportShare').mockResolvedValueOnce({
      ...mockSharesList[0],
      label: 'Updated Google Application',
      allow_contact_info: false,
    });

    render(<PassportShareManager />);

    await waitFor(() => {
      expect(screen.getByTestId('edit-share-btn-101')).toBeInTheDocument();
    });

    // Click Edit
    fireEvent.click(screen.getByTestId('edit-share-btn-101'));

    expect(screen.getByTestId('edit-share-modal')).toBeInTheDocument();
    expect(screen.getByTestId('edit-share-label-input')).toHaveValue('Google Application');

    // Change label and contact info
    fireEvent.change(screen.getByTestId('edit-share-label-input'), {
      target: { value: 'Updated Google Application' },
    });
    fireEvent.click(screen.getByTestId('edit-contact-checkbox')); // Uncheck

    // Submit
    fireEvent.click(screen.getByTestId('edit-share-save-btn'));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(101, {
        label: 'Updated Google Application',
        allow_contact_info: false,
        allow_unverified_projects: false,
        is_active: true,
      });
    });

    await waitFor(() => {
      expect(screen.queryByTestId('edit-share-modal')).not.toBeInTheDocument();
    });
  });

  it('opens revocation confirmation dialog and performs revocation on confirm', async () => {
    vi.spyOn(passportApi, 'listPassportShares')
      .mockResolvedValueOnce(mockSharesList)
      .mockResolvedValueOnce([
        {
          ...mockSharesList[0],
          is_active: false,
          revoked_at: '2026-10-08T00:00:00Z',
        },
        mockSharesList[1],
        mockSharesList[2],
      ]);

    const revokeSpy = vi
      .spyOn(passportApi, 'revokePassportShare')
      .mockResolvedValueOnce(undefined);

    render(<PassportShareManager />);

    await waitFor(() => {
      expect(screen.getByTestId('revoke-share-trigger-101')).toBeInTheDocument();
    });

    // Click Revoke Trigger
    fireEvent.click(screen.getByTestId('revoke-share-trigger-101'));

    expect(screen.getByTestId('revoke-confirm-dialog')).toBeInTheDocument();

    // Confirm Revocation
    fireEvent.click(screen.getByTestId('confirm-revoke-btn'));

    await waitFor(() => {
      expect(revokeSpy).toHaveBeenCalledWith(101);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('revoke-confirm-dialog')).not.toBeInTheDocument();
    });
  });

  it('cancels revocation dialog when cancel button is clicked', async () => {
    vi.spyOn(passportApi, 'listPassportShares').mockResolvedValueOnce(mockSharesList);
    const revokeSpy = vi.spyOn(passportApi, 'revokePassportShare');

    render(<PassportShareManager />);

    await waitFor(() => {
      expect(screen.getByTestId('revoke-share-trigger-101')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('revoke-share-trigger-101'));
    expect(screen.getByTestId('revoke-confirm-dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('cancel-revoke-btn'));
    expect(screen.queryByTestId('revoke-confirm-dialog')).not.toBeInTheDocument();
    expect(revokeSpy).not.toHaveBeenCalled();
  });

  it('handles error state and provides retry functionality', async () => {
    const listSpy = vi
      .spyOn(passportApi, 'listPassportShares')
      .mockRejectedValueOnce({
        message: 'Database connection failure',
      })
      .mockResolvedValueOnce(mockSharesList);

    render(<PassportShareManager />);

    await waitFor(() => {
      expect(screen.getByTestId('shares-error')).toBeInTheDocument();
    });

    expect(screen.getByText('Database connection failure')).toBeInTheDocument();

    // Click Retry
    fireEvent.click(screen.getByText('Retry'));

    expect(listSpy).toHaveBeenCalledTimes(2);

    await waitFor(() => {
      expect(screen.getByTestId('shares-list')).toBeInTheDocument();
    });
  });
});
