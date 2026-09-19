import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RecruiterProfilePage } from '../RecruiterProfilePage';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { AppLayout } from '@/layouts/AppLayout';
import * as recruiterProfileApi from '@/api/recruiterProfile';
import * as useAuthModule from '@/auth/useAuth';
import { RecruiterProfile } from '@/types/recruiterProfile';
import { User } from '@/types/auth';

const mockRecruiterProfile: RecruiterProfile = {
  id: 1,
  user_id: 20,
  company_name: 'Acme Innovations Inc.',
  company_description: 'Pioneering next-generation cloud infrastructure.',
  contact_name: 'Jane Doe',
  phone: '+1-555-0200',
  company_website: 'https://acme-innovations.example.com',
  company_location: 'San Francisco, CA',
  industry: 'Technology',
  company_size: '51-200',
  is_verified: true,
  created_at: '2026-09-19T10:00:00Z',
  updated_at: '2026-09-19T10:00:00Z',
};

const mockRecruiterUser: User = {
  id: 20,
  email: 'recruiter@example.com',
  role: 'recruiter',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-19T10:00:00Z',
  updated_at: '2026-09-19T10:00:00Z',
};

const mockStudentUser: User = {
  id: 10,
  email: 'student@example.com',
  role: 'student',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-19T10:00:00Z',
  updated_at: '2026-09-19T10:00:00Z',
};

const mockAdminUser: User = {
  id: 30,
  email: 'admin@example.com',
  role: 'admin',
  is_active: true,
  is_verified: true,
  created_at: '2026-09-19T10:00:00Z',
  updated_at: '2026-09-19T10:00:00Z',
};

describe('RecruiterProfilePage — Comprehensive F-04 Scenarios', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial Loading & States', () => {
    it('displays loading screen while profile data is being fetched', () => {
      vi.spyOn(recruiterProfileApi, 'getRecruiterProfileApi').mockReturnValue(
        new Promise(() => {}) // pending
      );

      render(
        <MemoryRouter>
          <RecruiterProfilePage />
        </MemoryRouter>
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText(/Loading company profile\.\.\./i)).toBeInTheDocument();
    });

    it('handles initial GET 404 by transitioning to Create Profile onboarding mode', async () => {
      vi.spyOn(recruiterProfileApi, 'getRecruiterProfileApi').mockRejectedValueOnce({
        status: 404,
        message: 'Recruiter profile not found',
      });

      render(
        <MemoryRouter>
          <RecruiterProfilePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      expect(screen.getByRole('heading', { level: 2, name: /My Company Profile/i })).toBeInTheDocument();
      expect(screen.getByText(/Create Profile — complete your company details/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Create Profile/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/Company Name/i)).toHaveValue('');
      expect(screen.queryByText(/Profile ID:/i)).not.toBeInTheDocument();
    });

    it('handles initial GET 200 by pre-populating existing company profile in edit mode', async () => {
      vi.spyOn(recruiterProfileApi, 'getRecruiterProfileApi').mockResolvedValueOnce(mockRecruiterProfile);

      render(
        <MemoryRouter>
          <RecruiterProfilePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      expect(screen.getByText(/Edit Profile — keep your organization/i)).toBeInTheDocument();
      expect(screen.getByText(/Profile ID: #1/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument();

      expect(screen.getByLabelText(/Company Name/i)).toHaveValue('Acme Innovations Inc.');
      expect(screen.getByLabelText(/Industry/i)).toHaveValue('Technology');
      expect(screen.getByLabelText(/Company Size/i)).toHaveValue('51-200');
      expect(screen.getByLabelText(/Company Description/i)).toHaveValue(
        'Pioneering next-generation cloud infrastructure.'
      );
      expect(screen.getByLabelText(/Contact Person Name/i)).toHaveValue('Jane Doe');
      expect(screen.getByLabelText(/Phone Number/i)).toHaveValue('+1-555-0200');
      expect(screen.getByLabelText(/Company Location/i)).toHaveValue('San Francisco, CA');
      expect(screen.getByLabelText(/Official Website URL/i)).toHaveValue(
        'https://acme-innovations.example.com'
      );
    });

    it('handles initial load 500/503 server error with a functional Retry button', async () => {
      const user = userEvent.setup();
      const getSpy = vi.spyOn(recruiterProfileApi, 'getRecruiterProfileApi')
        .mockRejectedValueOnce({
          status: 503,
          message: 'Service Unavailable',
        })
        .mockResolvedValueOnce(mockRecruiterProfile);

      render(
        <MemoryRouter>
          <RecruiterProfilePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 2, name: /Unable to Load Profile/i })).toBeInTheDocument();
      });

      expect(screen.getByText(/Service is temporarily unavailable\. Please try again\./i)).toBeInTheDocument();
      const retryBtn = screen.getByRole('button', { name: /Retry/i });
      expect(retryBtn).toBeInTheDocument();

      await user.click(retryBtn);

      await waitFor(() => {
        expect(screen.getByText(/Edit Profile — keep your organization/i)).toBeInTheDocument();
      });
      expect(getSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Creation Workflow & Security', () => {
    it('submits valid POST payload with only editable fields and displays success alert', async () => {
      const user = userEvent.setup();
      vi.spyOn(recruiterProfileApi, 'getRecruiterProfileApi').mockRejectedValueOnce({ status: 404 });
      const createSpy = vi.spyOn(recruiterProfileApi, 'createRecruiterProfileApi').mockResolvedValueOnce(mockRecruiterProfile);

      render(
        <MemoryRouter>
          <RecruiterProfilePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/Company Name/i), 'Acme Innovations Inc.');
      await user.type(screen.getByLabelText(/Industry/i), 'Technology');
      await user.type(screen.getByLabelText(/Company Size/i), '51-200');
      await user.type(screen.getByLabelText(/Company Description/i), 'Pioneering next-generation cloud infrastructure.');
      await user.type(screen.getByLabelText(/Contact Person Name/i), 'Jane Doe');
      await user.type(screen.getByLabelText(/Phone Number/i), '+1-555-0200');
      await user.type(screen.getByLabelText(/Company Location/i), 'San Francisco, CA');
      await user.type(screen.getByLabelText(/Official Website URL/i), 'https://acme-innovations.example.com');

      await user.click(screen.getByRole('button', { name: /Create Profile/i }));

      expect(createSpy).toHaveBeenCalledTimes(1);
      const sentPayload = createSpy.mock.calls[0][0];
      expect(sentPayload).toEqual({
        company_name: 'Acme Innovations Inc.',
        industry: 'Technology',
        company_size: '51-200',
        company_description: 'Pioneering next-generation cloud infrastructure.',
        contact_name: 'Jane Doe',
        phone: '+1-555-0200',
        company_location: 'San Francisco, CA',
        company_website: 'https://acme-innovations.example.com',
      });

      // Security assertions: Never send protected or server-controlled fields
      expect(sentPayload).not.toHaveProperty('id');
      expect(sentPayload).not.toHaveProperty('user_id');
      expect(sentPayload).not.toHaveProperty('is_verified');
      expect(sentPayload).not.toHaveProperty('created_at');
      expect(sentPayload).not.toHaveProperty('updated_at');

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/Company profile created successfully!/i);
      });
      expect(screen.getByText(/Profile ID: #1/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument();
    });

    it('converts empty optional string fields to null on POST creation', async () => {
      const user = userEvent.setup();
      vi.spyOn(recruiterProfileApi, 'getRecruiterProfileApi').mockRejectedValueOnce({ status: 404 });
      const createSpy = vi.spyOn(recruiterProfileApi, 'createRecruiterProfileApi').mockResolvedValueOnce({
        ...mockRecruiterProfile,
        company_description: null,
        contact_name: null,
        phone: null,
        company_website: null,
        company_location: null,
        industry: null,
        company_size: null,
      });

      render(
        <MemoryRouter>
          <RecruiterProfilePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/Company Name/i), 'Minimal Corp');
      await user.click(screen.getByRole('button', { name: /Create Profile/i }));

      expect(createSpy).toHaveBeenCalledWith({
        company_name: 'Minimal Corp',
        company_description: null,
        contact_name: null,
        phone: null,
        company_website: null,
        company_location: null,
        industry: null,
        company_size: null,
      });
    });

    it('handles 409 conflict during creation with duplicate profile error message', async () => {
      const user = userEvent.setup();
      vi.spyOn(recruiterProfileApi, 'getRecruiterProfileApi').mockRejectedValueOnce({ status: 404 });
      vi.spyOn(recruiterProfileApi, 'createRecruiterProfileApi').mockRejectedValueOnce({
        status: 409,
        message: 'A company profile already exists for this account.',
      });

      render(
        <MemoryRouter>
          <RecruiterProfilePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/Company Name/i), 'Duplicate Inc.');
      await user.click(screen.getByRole('button', { name: /Create Profile/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/A company profile already exists for this account\./i);
      });
    });
  });

  describe('Editing & Update Lifecycle', () => {
    it('submits valid PATCH payload, displays success alert, and remains in edit mode', async () => {
      const user = userEvent.setup();
      vi.spyOn(recruiterProfileApi, 'getRecruiterProfileApi').mockResolvedValueOnce(mockRecruiterProfile);
      const patchSpy = vi.spyOn(recruiterProfileApi, 'updateRecruiterProfileApi').mockResolvedValueOnce({
        ...mockRecruiterProfile,
        company_location: 'Austin, TX',
      });

      render(
        <MemoryRouter>
          <RecruiterProfilePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      const locationInput = screen.getByLabelText(/Company Location/i);
      await user.clear(locationInput);
      await user.type(locationInput, 'Austin, TX');

      await user.click(screen.getByRole('button', { name: /Save Changes/i }));

      expect(patchSpy).toHaveBeenCalledTimes(1);
      const patchPayload = patchSpy.mock.calls[0][0];
      expect(patchPayload.company_location).toBe('Austin, TX');
      // Never send protected fields
      expect(patchPayload).not.toHaveProperty('id');
      expect(patchPayload).not.toHaveProperty('user_id');
      expect(patchPayload).not.toHaveProperty('is_verified');
      expect(patchPayload).not.toHaveProperty('created_at');
      expect(patchPayload).not.toHaveProperty('updated_at');

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/Company profile updated successfully!/i);
      });
      expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument();
    });

    it('treats PATCH 404 as an operation error and NEVER resets to onboarding create mode', async () => {
      const user = userEvent.setup();
      vi.spyOn(recruiterProfileApi, 'getRecruiterProfileApi').mockResolvedValueOnce(mockRecruiterProfile);
      vi.spyOn(recruiterProfileApi, 'updateRecruiterProfileApi').mockRejectedValueOnce({
        status: 404,
        message: 'Company profile not found. Please refresh or create a new profile.',
      });

      render(
        <MemoryRouter>
          <RecruiterProfilePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Save Changes/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/Company profile not found\. Please refresh or create a new profile\./i);
      });

      // Crucial: Must remain in edit mode!
      expect(screen.getByText(/Edit Profile — keep your organization/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument();
      expect(screen.queryByText(/Create Profile — complete your company details/i)).not.toBeInTheDocument();
    });
  });

  describe('Client-Side Form Validation', () => {
    beforeEach(() => {
      vi.spyOn(recruiterProfileApi, 'getRecruiterProfileApi').mockRejectedValueOnce({ status: 404 });
    });

    it('validates required company_name and min length (>= 2)', async () => {
      const user = userEvent.setup();
      const createSpy = vi.spyOn(recruiterProfileApi, 'createRecruiterProfileApi');

      render(
        <MemoryRouter>
          <RecruiterProfilePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      // Empty submit
      await user.click(screen.getByRole('button', { name: /Create Profile/i }));
      expect(screen.getByText(/Company name is required\./i)).toBeInTheDocument();
      expect(createSpy).not.toHaveBeenCalled();

      // 1-character submit
      await user.type(screen.getByLabelText(/Company Name/i), 'A');
      await user.click(screen.getByRole('button', { name: /Create Profile/i }));
      expect(screen.getByText(/Company name must be at least 2 characters\./i)).toBeInTheDocument();
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('validates company_name max length (<= 150)', async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <RecruiterProfilePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText(/Company Name/i);
      fireEvent.change(nameInput, { target: { value: 'A'.repeat(151) } });
      await user.click(screen.getByRole('button', { name: /Create Profile/i }));

      expect(screen.getByText(/Company name must not exceed 150 characters\./i)).toBeInTheDocument();
    });

    it('validates company_description max length (<= 2000)', async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <RecruiterProfilePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/Company Name/i), 'Acme Inc.');
      const descInput = screen.getByLabelText(/Company Description/i);
      fireEvent.change(descInput, { target: { value: 'D'.repeat(2001) } });
      await user.click(screen.getByRole('button', { name: /Create Profile/i }));

      expect(screen.getByText(/Company description must not exceed 2000 characters\./i)).toBeInTheDocument();
    });

    it('validates contact_name min length (>= 2) and max length (<= 100) when provided', async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <RecruiterProfilePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/Company Name/i), 'Acme Inc.');

      // 1 char contact name
      await user.type(screen.getByLabelText(/Contact Person Name/i), 'J');
      await user.click(screen.getByRole('button', { name: /Create Profile/i }));
      expect(screen.getByText(/Contact name must be at least 2 characters\./i)).toBeInTheDocument();

      // > 100 chars contact name
      const contactInput = screen.getByLabelText(/Contact Person Name/i);
      fireEvent.change(contactInput, { target: { value: 'C'.repeat(101) } });
      await user.click(screen.getByRole('button', { name: /Create Profile/i }));
      expect(screen.getByText(/Contact name must not exceed 100 characters\./i)).toBeInTheDocument();
    });

    it('validates phone max length (<= 20)', async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <RecruiterProfilePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/Company Name/i), 'Acme Inc.');
      const phoneInput = screen.getByLabelText(/Phone Number/i);
      fireEvent.change(phoneInput, { target: { value: '1'.repeat(21) } });
      await user.click(screen.getByRole('button', { name: /Create Profile/i }));

      expect(screen.getByText(/Phone number must not exceed 20 characters\./i)).toBeInTheDocument();
    });

    it('validates company_location max length (<= 150)', async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <RecruiterProfilePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/Company Name/i), 'Acme Inc.');
      const locInput = screen.getByLabelText(/Company Location/i);
      fireEvent.change(locInput, { target: { value: 'L'.repeat(151) } });
      await user.click(screen.getByRole('button', { name: /Create Profile/i }));

      expect(screen.getByText(/Company location must not exceed 150 characters\./i)).toBeInTheDocument();
    });

    it('validates industry max length (<= 100)', async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <RecruiterProfilePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/Company Name/i), 'Acme Inc.');
      const indInput = screen.getByLabelText(/Industry/i);
      fireEvent.change(indInput, { target: { value: 'I'.repeat(101) } });
      await user.click(screen.getByRole('button', { name: /Create Profile/i }));

      expect(screen.getByText(/Industry must not exceed 100 characters\./i)).toBeInTheDocument();
    });

    it('validates company_size max length (<= 50)', async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <RecruiterProfilePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/Company Name/i), 'Acme Inc.');
      const sizeInput = screen.getByLabelText(/Company Size/i);
      fireEvent.change(sizeInput, { target: { value: 'S'.repeat(51) } });
      await user.click(screen.getByRole('button', { name: /Create Profile/i }));

      expect(screen.getByText(/Company size must not exceed 50 characters\./i)).toBeInTheDocument();
    });

    it('validates company_website: allows valid http/https URLs and empty URLs, rejects malformed schemes', async () => {
      const user = userEvent.setup();
      const createSpy = vi.spyOn(recruiterProfileApi, 'createRecruiterProfileApi');

      render(
        <MemoryRouter>
          <RecruiterProfilePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/Company Name/i), 'Acme Inc.');
      const websiteInput = screen.getByLabelText(/Official Website URL/i);

      // Non-HTTP scheme
      await user.type(websiteInput, 'ftp://acme.org');
      await user.click(screen.getByRole('button', { name: /Create Profile/i }));
      expect(screen.getByText('Please enter a valid URL starting with http:// or https://.')).toBeInTheDocument();
      expect(createSpy).not.toHaveBeenCalled();

      // Malformed URL
      await user.clear(websiteInput);
      await user.type(websiteInput, 'not-a-valid-url');
      await user.click(screen.getByRole('button', { name: /Create Profile/i }));
      expect(screen.getByText('Please enter a valid URL starting with http:// or https://.')).toBeInTheDocument();

      // Clear field (empty optional URL should remove error)
      await user.clear(websiteInput);
      expect(screen.queryByText('Please enter a valid URL starting with http:// or https://.')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling & API Resilience', () => {
    it('handles initial load 403 Forbidden with Access Denied and no retry button', async () => {
      vi.spyOn(recruiterProfileApi, 'getRecruiterProfileApi').mockRejectedValueOnce({
        status: 403,
        message: 'Forbidden',
      });

      render(
        <MemoryRouter>
          <RecruiterProfilePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      expect(screen.getByRole('heading', { level: 2, name: /Access Denied/i })).toBeInTheDocument();
      expect(screen.getByText(/You do not have permission to access the recruiter profile\./i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Retry/i })).not.toBeInTheDocument();
    });

    it('handles 422 validation errors from backend detail array by mapping to field hints', async () => {
      const user = userEvent.setup();
      vi.spyOn(recruiterProfileApi, 'getRecruiterProfileApi').mockRejectedValueOnce({ status: 404 });
      vi.spyOn(recruiterProfileApi, 'createRecruiterProfileApi').mockRejectedValueOnce({
        status: 422,
        message: 'Validation failed.',
        detail: [
          {
            loc: ['body', 'company_size'],
            msg: 'String should have at most 50 characters',
            type: 'string_too_long',
          },
        ],
      });

      render(
        <MemoryRouter>
          <RecruiterProfilePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/Company Name/i), 'Acme Inc.');
      await user.click(screen.getByRole('button', { name: /Create Profile/i }));

      await waitFor(() => {
        expect(screen.getByText(/String should have at most 50 characters/i)).toBeInTheDocument();
      });
    });

    it('handles 429 rate limit during save with rate limit alert', async () => {
      const user = userEvent.setup();
      vi.spyOn(recruiterProfileApi, 'getRecruiterProfileApi').mockRejectedValueOnce({ status: 404 });
      vi.spyOn(recruiterProfileApi, 'createRecruiterProfileApi').mockRejectedValueOnce({
        status: 429,
        message: 'Too many requests. Please wait a moment before trying again.',
      });

      render(
        <MemoryRouter>
          <RecruiterProfilePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/Company Name/i), 'Acme Inc.');
      await user.click(screen.getByRole('button', { name: /Create Profile/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/Too many requests\. Please wait a moment before trying again\./i);
      });
    });
  });

  describe('Verification Display Behavior', () => {
    it('displays "✓ Verified Company" badge when is_verified is true and remains strictly read-only', async () => {
      vi.spyOn(recruiterProfileApi, 'getRecruiterProfileApi').mockResolvedValueOnce({
        ...mockRecruiterProfile,
        is_verified: true,
      });

      render(
        <MemoryRouter>
          <RecruiterProfilePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      expect(screen.getByText(/✓ Verified Company/i)).toBeInTheDocument();
      expect(screen.getByText(/Verification status is managed by platform administrators/i)).toBeInTheDocument();
      // Confirm there are no verification checkboxes or edit controls
      expect(screen.queryByLabelText(/Verified/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Verify/i })).not.toBeInTheDocument();
    });

    it('displays "⏳ Pending Verification" badge when is_verified is false', async () => {
      vi.spyOn(recruiterProfileApi, 'getRecruiterProfileApi').mockResolvedValueOnce({
        ...mockRecruiterProfile,
        is_verified: false,
      });

      render(
        <MemoryRouter>
          <RecruiterProfilePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      expect(screen.getByText(/⏳ Pending Verification/i)).toBeInTheDocument();
    });
  });

  describe('Navigation & Route Role Protection', () => {
    it('AppLayout renders "Company Profile" nav link for recruiter and hides "My Profile"', () => {
      vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
        user: mockRecruiterUser,
        token: 'valid-token',
        isAuthenticated: true,
        isLoading: false,
        error: null,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        clearAuthentication: vi.fn(),
        initializeSession: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <MemoryRouter initialEntries={['/app']}>
          <AppLayout />
        </MemoryRouter>
      );

      const recruiterLink = screen.getByRole('link', { name: /Company Profile/i });
      expect(recruiterLink).toBeInTheDocument();
      expect(recruiterLink).toHaveAttribute('href', '/app/recruiter/profile');
      expect(screen.queryByRole('link', { name: /My Profile/i })).not.toBeInTheDocument();
    });

    it('AppLayout does NOT render "Company Profile" for student (shows "My Profile")', () => {
      vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
        user: mockStudentUser,
        token: 'valid-token',
        isAuthenticated: true,
        isLoading: false,
        error: null,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        clearAuthentication: vi.fn(),
        initializeSession: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <MemoryRouter initialEntries={['/app']}>
          <AppLayout />
        </MemoryRouter>
      );

      expect(screen.queryByRole('link', { name: /Company Profile/i })).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: /My Profile/i })).toBeInTheDocument();
    });

    it('AppLayout does NOT render "Company Profile" for admin', () => {
      vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
        user: mockAdminUser,
        token: 'valid-token',
        isAuthenticated: true,
        isLoading: false,
        error: null,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        clearAuthentication: vi.fn(),
        initializeSession: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <MemoryRouter initialEntries={['/app']}>
          <AppLayout />
        </MemoryRouter>
      );

      expect(screen.queryByRole('link', { name: /Company Profile/i })).not.toBeInTheDocument();
    });

    it('Route protection: blocks student from /app/recruiter/profile with 403 Access Denied', () => {
      vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
        user: mockStudentUser,
        token: 'valid-token',
        isAuthenticated: true,
        isLoading: false,
        error: null,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        clearAuthentication: vi.fn(),
        initializeSession: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <MemoryRouter initialEntries={['/app/recruiter/profile']}>
          <Routes>
            <Route element={<ProtectedRoute allowedRoles={['recruiter']} />}>
              <Route path="/app/recruiter/profile" element={<RecruiterProfilePage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByRole('heading', { level: 2, name: /403 — Access Denied/i })).toBeInTheDocument();
      expect(screen.getByText(/Your account \(student\) does not have permission to view this resource\./i)).toBeInTheDocument();
      expect(screen.queryByRole('heading', { level: 2, name: /My Company Profile/i })).not.toBeInTheDocument();
    });

    it('Route protection: blocks admin from /app/recruiter/profile with 403 Access Denied', () => {
      vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
        user: mockAdminUser,
        token: 'valid-token',
        isAuthenticated: true,
        isLoading: false,
        error: null,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        clearAuthentication: vi.fn(),
        initializeSession: vi.fn(),
        clearError: vi.fn(),
      });

      render(
        <MemoryRouter initialEntries={['/app/recruiter/profile']}>
          <Routes>
            <Route element={<ProtectedRoute allowedRoles={['recruiter']} />}>
              <Route path="/app/recruiter/profile" element={<RecruiterProfilePage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByRole('heading', { level: 2, name: /403 — Access Denied/i })).toBeInTheDocument();
      expect(screen.getByText(/Your account \(admin\) does not have permission to view this resource\./i)).toBeInTheDocument();
      expect(screen.queryByRole('heading', { level: 2, name: /My Company Profile/i })).not.toBeInTheDocument();
    });
  });
});
