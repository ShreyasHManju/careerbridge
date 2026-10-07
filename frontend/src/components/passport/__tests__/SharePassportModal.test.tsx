import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SharePassportModal } from '../SharePassportModal';
import * as passportApi from '@/api/passport';
import { PassportShareCreateResponse } from '@/types/passport';

const mockCreatedShare: PassportShareCreateResponse = {
  id: 1,
  share_token: 'share_token_secret_123',
  share_url: '/p/share_token_secret_123',
  label: 'Google Application',
  is_active: true,
  allow_contact_info: true,
  allow_unverified_projects: false,
  view_count: 0,
  expires_at: '2026-11-08T00:00:00Z',
  created_at: '2026-10-08T00:00:00Z',
};

describe('SharePassportModal Component', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    mockOnClose.mockClear();
    mockOnSuccess.mockClear();
  });

  it('does not render when isOpen is false', () => {
    render(
      <SharePassportModal
        isOpen={false}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.queryByTestId('share-passport-modal')).not.toBeInTheDocument();
  });

  it('renders creation form when isOpen is true', () => {
    render(
      <SharePassportModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByTestId('share-passport-modal')).toBeInTheDocument();
    expect(screen.getByTestId('share-label-input')).toBeInTheDocument();
    expect(screen.getByTestId('share-expiration-select')).toBeInTheDocument();
    expect(screen.getByTestId('share-allow-contact-checkbox')).toBeInTheDocument();
    expect(screen.getByTestId('share-allow-unverified-checkbox')).toBeInTheDocument();
    expect(screen.getByTestId('share-modal-submit-btn')).toHaveTextContent('Create Share Link');
  });

  it('submits form with correct payload and renders success view with copy URL button', async () => {
    const createSpy = vi
      .spyOn(passportApi, 'createPassportShare')
      .mockResolvedValueOnce(mockCreatedShare);

    render(
      <SharePassportModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    // Fill form
    fireEvent.change(screen.getByTestId('share-label-input'), {
      target: { value: 'Google Application' },
    });
    fireEvent.change(screen.getByTestId('share-expiration-select'), {
      target: { value: '30' },
    });
    fireEvent.click(screen.getByTestId('share-allow-contact-checkbox'));

    // Submit form
    fireEvent.click(screen.getByTestId('share-modal-submit-btn'));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({
        label: 'Google Application',
        expires_in_days: 30,
        allow_contact_info: true,
        allow_unverified_projects: false,
      });
    });

    // Verify Success View
    await waitFor(() => {
      expect(screen.getByTestId('share-success-view')).toBeInTheDocument();
    });

    expect(screen.getByTestId('created-share-url-input')).toHaveValue(
      `${window.location.origin}/p/share_token_secret_123`
    );
    expect(screen.getByTestId('copy-share-url-btn')).toBeInTheDocument();
    expect(screen.getByTestId('share-token-notice')).toBeInTheDocument();
    expect(mockOnSuccess).toHaveBeenCalledWith(mockCreatedShare);

    // Test Done button closes modal
    fireEvent.click(screen.getByTestId('share-modal-done-btn'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('handles copy button click and displays copied feedback', async () => {
    vi.spyOn(passportApi, 'createPassportShare').mockResolvedValueOnce(mockCreatedShare);

    // Mock clipboard writeText
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <SharePassportModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    fireEvent.click(screen.getByTestId('share-modal-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('copy-share-url-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('copy-share-url-btn'));

    expect(writeTextMock).toHaveBeenCalledWith(
      `${window.location.origin}/p/share_token_secret_123`
    );
    expect(screen.getByText('✓ Copied!')).toBeInTheDocument();
  });

  it('displays API error message on creation failure', async () => {
    vi.spyOn(passportApi, 'createPassportShare').mockRejectedValueOnce({
      message: 'Active share limit reached for student.',
    });

    render(
      <SharePassportModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    fireEvent.click(screen.getByTestId('share-modal-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('share-modal-error')).toBeInTheDocument();
    });

    expect(screen.getByText('Active share limit reached for student.')).toBeInTheDocument();
    expect(screen.queryByTestId('share-success-view')).not.toBeInTheDocument();
  });

  it('closes modal on close button click and escape key', () => {
    const { unmount } = render(
      <SharePassportModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    fireEvent.click(screen.getByTestId('share-passport-modal-close-btn'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);

    // Test Escape key
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(2);

    unmount();
  });
});
