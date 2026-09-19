import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { StudentProfilePage } from '../StudentProfilePage';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { AppLayout } from '@/layouts/AppLayout';
import * as studentProfileApi from '@/api/studentProfile';
import * as useAuthModule from '@/auth/useAuth';
import { StudentProfile } from '@/types/studentProfile';
import { ApiErrorResponse } from '@/types/api';
import { User } from '@/types/auth';

const mockProfile: StudentProfile = {
  id: 1,
  user_id: 10,
  full_name: 'Jane Doe',
  phone: '+91 9876543210',
  college: 'National Institute of Technology',
  degree: 'B.Tech',
  branch: 'Computer Science',
  graduation_year: 2026,
  bio: 'Software engineering student passionate about full-stack development.',
  skills: 'Python, React, TypeScript, PostgreSQL',
  github_url: 'https://github.com/janedoe',
  linkedin_url: 'https://linkedin.com/in/janedoe',
  portfolio_url: 'https://janedoe.dev',
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

const mockRecruiterUser: User = {
  id: 20,
  email: 'recruiter@example.com',
  role: 'recruiter',
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

describe('StudentProfilePage — Comprehensive F-03 Scenarios', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Initial loading
  it('Scenario 1: Initial loading — displays loading indicator while profile data is being fetched', async () => {
    vi.spyOn(studentProfileApi, 'getStudentProfileApi').mockReturnValue(
      new Promise(() => {}) // pending
    );

    render(
      <MemoryRouter>
        <StudentProfilePage />
      </MemoryRouter>
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/Loading student profile\.\.\./i)).toBeInTheDocument();
  });

  // 2. Initial GET 404 -> create state
  it('Scenario 2: Initial GET 404 -> create state — transitions to create/onboarding state with empty form', async () => {
    const notFoundError: ApiErrorResponse = {
      success: false,
      message: 'Student profile not found',
      error_code: 'NOT_FOUND',
      status: 404,
    };
    vi.spyOn(studentProfileApi, 'getStudentProfileApi').mockRejectedValueOnce(notFoundError);

    render(
      <MemoryRouter>
        <StudentProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { level: 2, name: /My Student Profile/i })).toBeInTheDocument();
    expect(screen.getByText(/Create Profile — complete your profile details/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Profile/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Full Name/i)).toHaveValue('');
    expect(screen.getByLabelText(/Phone Number/i)).toHaveValue('');
    expect(screen.queryByText(/Profile ID:/i)).not.toBeInTheDocument();
  });

  // 3. Valid creation submits POST
  it('Scenario 3: Valid creation submits POST — sends only editable create fields without system fields', async () => {
    const user = userEvent.setup();
    vi.spyOn(studentProfileApi, 'getStudentProfileApi').mockRejectedValueOnce({
      status: 404,
      message: 'Not found',
    });
    const createSpy = vi.spyOn(studentProfileApi, 'createStudentProfileApi').mockResolvedValueOnce(mockProfile);

    render(
      <MemoryRouter>
        <StudentProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/Full Name/i), 'Jane Doe');
    await user.type(screen.getByLabelText(/Phone Number/i), '+91 9876543210');
    await user.type(screen.getByLabelText(/College \/ University/i), 'NIT');
    await user.type(screen.getByLabelText(/Degree/i), 'B.Tech');
    await user.type(screen.getByLabelText(/Branch \/ Major/i), 'Computer Science');
    await user.type(screen.getByLabelText(/Graduation Year/i), '2026');
    await user.type(screen.getByLabelText(/Professional Bio/i), 'Software engineering student.');
    await user.type(screen.getByLabelText(/Skills/i), 'Python, React');
    await user.type(screen.getByLabelText(/GitHub Profile URL/i), 'https://github.com/janedoe');
    await user.type(screen.getByLabelText(/LinkedIn Profile URL/i), 'https://linkedin.com/in/janedoe');
    await user.type(screen.getByLabelText(/Portfolio \/ Personal Website/i), 'https://janedoe.dev');

    await user.click(screen.getByRole('button', { name: /Create Profile/i }));

    expect(createSpy).toHaveBeenCalledTimes(1);
    const sentPayload = createSpy.mock.calls[0][0];
    expect(sentPayload).toEqual({
      full_name: 'Jane Doe',
      phone: '+91 9876543210',
      college: 'NIT',
      degree: 'B.Tech',
      branch: 'Computer Science',
      graduation_year: 2026,
      bio: 'Software engineering student.',
      skills: 'Python, React',
      github_url: 'https://github.com/janedoe',
      linkedin_url: 'https://linkedin.com/in/janedoe',
      portfolio_url: 'https://janedoe.dev',
    });
    // System fields MUST NEVER be sent
    expect(sentPayload).not.toHaveProperty('id');
    expect(sentPayload).not.toHaveProperty('user_id');
    expect(sentPayload).not.toHaveProperty('created_at');
    expect(sentPayload).not.toHaveProperty('updated_at');
  });

  // 4. Successful POST -> edit/profile state
  it('Scenario 4: Successful POST -> edit/profile state — transitions into edit mode with Profile ID and Save Changes button', async () => {
    const user = userEvent.setup();
    vi.spyOn(studentProfileApi, 'getStudentProfileApi').mockRejectedValueOnce({ status: 404 });
    vi.spyOn(studentProfileApi, 'createStudentProfileApi').mockResolvedValueOnce(mockProfile);

    render(
      <MemoryRouter>
        <StudentProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/Full Name/i), 'Jane Doe');
    await user.click(screen.getByRole('button', { name: /Create Profile/i }));

    await waitFor(() => {
      expect(screen.getByText(/Profile ID: #1/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Edit Profile — keep your academic/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument();
  });

  // 5. Successful creation success feedback
  it('Scenario 5: Successful creation success feedback — displays success alert upon creation', async () => {
    const user = userEvent.setup();
    vi.spyOn(studentProfileApi, 'getStudentProfileApi').mockRejectedValueOnce({ status: 404 });
    vi.spyOn(studentProfileApi, 'createStudentProfileApi').mockResolvedValueOnce(mockProfile);

    render(
      <MemoryRouter>
        <StudentProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/Full Name/i), 'Jane Doe');
    await user.click(screen.getByRole('button', { name: /Create Profile/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Student profile created successfully!/i);
    });
  });

  // 6. GET 200 pre-populates all returned fields
  it('Scenario 6: GET 200 pre-populates all returned fields — sets form inputs and renders edit state', async () => {
    vi.spyOn(studentProfileApi, 'getStudentProfileApi').mockResolvedValueOnce(mockProfile);

    render(
      <MemoryRouter>
        <StudentProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    expect(screen.getByLabelText(/Full Name/i)).toHaveValue('Jane Doe');
    expect(screen.getByLabelText(/Phone Number/i)).toHaveValue('+91 9876543210');
    expect(screen.getByLabelText(/College \/ University/i)).toHaveValue('National Institute of Technology');
    expect(screen.getByLabelText(/Degree/i)).toHaveValue('B.Tech');
    expect(screen.getByLabelText(/Branch \/ Major/i)).toHaveValue('Computer Science');
    expect(screen.getByLabelText(/Graduation Year/i)).toHaveValue(2026);
    expect(screen.getByLabelText(/Professional Bio/i)).toHaveValue('Software engineering student passionate about full-stack development.');
    expect(screen.getByLabelText(/Skills/i)).toHaveValue('Python, React, TypeScript, PostgreSQL');
    expect(screen.getByLabelText(/GitHub Profile URL/i)).toHaveValue('https://github.com/janedoe');
    expect(screen.getByLabelText(/LinkedIn Profile URL/i)).toHaveValue('https://linkedin.com/in/janedoe');
    expect(screen.getByLabelText(/Portfolio \/ Personal Website/i)).toHaveValue('https://janedoe.dev');
    expect(screen.getByText(/Profile ID: #1/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument();
  });

  // 7. Editing submits PATCH
  it('Scenario 7: Editing submits PATCH — dispatches PATCH with updated fields and no system fields (never PUT)', async () => {
    const user = userEvent.setup();
    vi.spyOn(studentProfileApi, 'getStudentProfileApi').mockResolvedValueOnce(mockProfile);
    const patchSpy = vi.spyOn(studentProfileApi, 'updateStudentProfileApi').mockResolvedValueOnce({
      ...mockProfile,
      degree: 'M.S.',
    });

    render(
      <MemoryRouter>
        <StudentProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    const degreeInput = screen.getByLabelText(/Degree/i);
    await user.clear(degreeInput);
    await user.type(degreeInput, 'M.S.');

    await user.click(screen.getByRole('button', { name: /Save Changes/i }));

    expect(patchSpy).toHaveBeenCalledTimes(1);
    const patchPayload = patchSpy.mock.calls[0][0];
    expect(patchPayload.degree).toBe('M.S.');
    expect(patchPayload).not.toHaveProperty('id');
    expect(patchPayload).not.toHaveProperty('user_id');
    expect(patchPayload).not.toHaveProperty('created_at');
    expect(patchPayload).not.toHaveProperty('updated_at');
  });

  // 8. Successful PATCH updates displayed profile
  it('Scenario 8: Successful PATCH updates displayed profile — displays success alert upon update', async () => {
    const user = userEvent.setup();
    vi.spyOn(studentProfileApi, 'getStudentProfileApi').mockResolvedValueOnce(mockProfile);
    vi.spyOn(studentProfileApi, 'updateStudentProfileApi').mockResolvedValueOnce({
      ...mockProfile,
      bio: 'New bio statement.',
    });

    render(
      <MemoryRouter>
        <StudentProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    const bioInput = screen.getByLabelText(/Professional Bio/i);
    await user.clear(bioInput);
    await user.type(bioInput, 'New bio statement.');

    await user.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Student profile updated successfully!/i);
    });
  });

  // 9. Empty full name rejected
  it('Scenario 9: Empty full name rejected — client validation rejects empty full name with "Full name is required."', async () => {
    const user = userEvent.setup();
    vi.spyOn(studentProfileApi, 'getStudentProfileApi').mockRejectedValueOnce({ status: 404 });
    const createSpy = vi.spyOn(studentProfileApi, 'createStudentProfileApi');

    render(
      <MemoryRouter>
        <StudentProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Create Profile/i }));

    expect(screen.getByText(/Full name is required\./i)).toBeInTheDocument();
    expect(screen.getByText(/Please resolve the highlighted validation errors\./i)).toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
  });

  // 10. Full name <2 characters rejected
  it('Scenario 10: Full name <2 characters rejected — client validation rejects 1-character name', async () => {
    const user = userEvent.setup();
    vi.spyOn(studentProfileApi, 'getStudentProfileApi').mockRejectedValueOnce({ status: 404 });
    const createSpy = vi.spyOn(studentProfileApi, 'createStudentProfileApi');

    render(
      <MemoryRouter>
        <StudentProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/Full Name/i), 'A');
    await user.click(screen.getByRole('button', { name: /Create Profile/i }));

    expect(screen.getByText(/Full name must be at least 2 characters\./i)).toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
  });

  // 11. Full name >100 characters rejected
  it('Scenario 11: Full name >100 characters rejected — client validation rejects name exceeding 100 characters', async () => {
    const user = userEvent.setup();
    vi.spyOn(studentProfileApi, 'getStudentProfileApi').mockRejectedValueOnce({ status: 404 });
    const createSpy = vi.spyOn(studentProfileApi, 'createStudentProfileApi');

    render(
      <MemoryRouter>
        <StudentProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/Full Name/i);
    fireEvent.change(nameInput, { target: { value: 'A'.repeat(101) } });
    await user.click(screen.getByRole('button', { name: /Create Profile/i }));

    expect(screen.getByText(/Full name must not exceed 100 characters\./i)).toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
  });

  // 12. Graduation year <1900 rejected
  it('Scenario 12: Graduation year <1900 rejected — client validation rejects year before 1900', async () => {
    const user = userEvent.setup();
    vi.spyOn(studentProfileApi, 'getStudentProfileApi').mockRejectedValueOnce({ status: 404 });

    render(
      <MemoryRouter>
        <StudentProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/Full Name/i), 'Jane Doe');
    await user.type(screen.getByLabelText(/Graduation Year/i), '1899');
    await user.click(screen.getByRole('button', { name: /Create Profile/i }));

    expect(screen.getByText(/Graduation year must be between 1900 and 2100\./i)).toBeInTheDocument();
  });

  // 13. Graduation year >2100 rejected
  it('Scenario 13: Graduation year >2100 rejected — client validation rejects year after 2100', async () => {
    const user = userEvent.setup();
    vi.spyOn(studentProfileApi, 'getStudentProfileApi').mockRejectedValueOnce({ status: 404 });

    render(
      <MemoryRouter>
        <StudentProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/Full Name/i), 'Jane Doe');
    await user.type(screen.getByLabelText(/Graduation Year/i), '2101');
    await user.click(screen.getByRole('button', { name: /Create Profile/i }));

    expect(screen.getByText(/Graduation year must be between 1900 and 2100\./i)).toBeInTheDocument();
  });

  // 14. Bio >1000 rejected
  it('Scenario 14: Bio >1000 rejected — client validation rejects bio exceeding 1000 characters', async () => {
    const user = userEvent.setup();
    vi.spyOn(studentProfileApi, 'getStudentProfileApi').mockRejectedValueOnce({ status: 404 });

    render(
      <MemoryRouter>
        <StudentProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/Full Name/i), 'Jane Doe');
    const bioInput = screen.getByLabelText(/Professional Bio/i);
    fireEvent.change(bioInput, { target: { value: 'x'.repeat(1001) } });
    await user.click(screen.getByRole('button', { name: /Create Profile/i }));

    expect(screen.getByText(/Bio must not exceed 1000 characters\./i)).toBeInTheDocument();
  });

  // 15. Skills >1000 rejected
  it('Scenario 15: Skills >1000 rejected — client validation rejects skills exceeding 1000 characters', async () => {
    const user = userEvent.setup();
    vi.spyOn(studentProfileApi, 'getStudentProfileApi').mockRejectedValueOnce({ status: 404 });

    render(
      <MemoryRouter>
        <StudentProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/Full Name/i), 'Jane Doe');
    const skillsInput = screen.getByLabelText(/Skills/i);
    fireEvent.change(skillsInput, { target: { value: 's'.repeat(1001) } });
    await user.click(screen.getByRole('button', { name: /Create Profile/i }));

    expect(screen.getByText(/Skills must not exceed 1000 characters\./i)).toBeInTheDocument();
  });

  // 16. Invalid non-empty URL rejected
  it('Scenario 16: Invalid non-empty URL rejected — allows empty or valid http(s) URLs while rejecting malformed or non-http(s) schemes', async () => {
    const user = userEvent.setup();
    vi.spyOn(studentProfileApi, 'getStudentProfileApi').mockRejectedValueOnce({ status: 404 });
    const createSpy = vi.spyOn(studentProfileApi, 'createStudentProfileApi').mockResolvedValueOnce(mockProfile);

    render(
      <MemoryRouter>
        <StudentProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/Full Name/i), 'Jane Doe');
    await user.type(screen.getByLabelText(/GitHub Profile URL/i), 'invalid-scheme');
    await user.type(screen.getByLabelText(/LinkedIn Profile URL/i), 'ftp://bad-url.com');
    await user.type(screen.getByLabelText(/Portfolio \/ Personal Website/i), 'javascript:void(0)');

    await user.click(screen.getByRole('button', { name: /Create Profile/i }));

    const urlErrors = screen.getAllByText('Please enter a valid URL starting with http:// or https://.');
    expect(urlErrors).toHaveLength(3);
    expect(createSpy).not.toHaveBeenCalled();

    // Now correct to valid http/https and empty optional URL
    const githubInput = screen.getByLabelText(/GitHub Profile URL/i);
    await user.clear(githubInput);
    await user.type(githubInput, 'http://github.com/janedoe');

    const linkedinInput = screen.getByLabelText(/LinkedIn Profile URL/i);
    await user.clear(linkedinInput);
    await user.type(linkedinInput, 'https://linkedin.com/in/janedoe');

    const portfolioInput = screen.getByLabelText(/Portfolio \/ Personal Website/i);
    await user.clear(portfolioInput); // Leave empty

    await user.click(screen.getByRole('button', { name: /Create Profile/i }));

    // Empty URL allowed, valid http/https allowed, create succeeded
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        github_url: 'http://github.com/janedoe',
        linkedin_url: 'https://linkedin.com/in/janedoe',
        portfolio_url: null,
      })
    );
  });

  // 17. Initial 403 permission error
  it('Scenario 17: Initial 403 permission error — handles initial GET 403 with Access Denied and no retry button', async () => {
    vi.spyOn(studentProfileApi, 'getStudentProfileApi').mockRejectedValueOnce({
      status: 403,
      message: 'Forbidden',
    });

    render(
      <MemoryRouter>
        <StudentProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { level: 2, name: /Access Denied/i })).toBeInTheDocument();
    expect(screen.getByText(/You do not have permission to access the student profile\./i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Retry/i })).not.toBeInTheDocument();
  });

  // 18. Initial 500/503 server error + retry
  it('Scenario 18: Initial 500/503 server error + retry — handles server error and successfully recovers on Retry click', async () => {
    const user = userEvent.setup();
    const getSpy = vi.spyOn(studentProfileApi, 'getStudentProfileApi')
      .mockRejectedValueOnce({
        status: 503,
        message: 'Service Unavailable',
      })
      .mockResolvedValueOnce(mockProfile);

    render(
      <MemoryRouter>
        <StudentProfilePage />
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
      expect(screen.getByText(/Edit Profile — keep your academic/i)).toBeInTheDocument();
    });
    expect(getSpy).toHaveBeenCalledTimes(2);
  });

  // 19. Initial network failure + retry
  it('Scenario 19: Initial network failure + retry — handles network outage with retry button that recovers', async () => {
    const user = userEvent.setup();
    const getSpy = vi.spyOn(studentProfileApi, 'getStudentProfileApi')
      .mockRejectedValueOnce({
        status: undefined,
        message: 'Network Error',
      })
      .mockResolvedValueOnce(mockProfile);

    render(
      <MemoryRouter>
        <StudentProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /Unable to Load Profile/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/Network Error/i)).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    expect(retryBtn).toBeInTheDocument();

    await user.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText(/Edit Profile — keep your academic/i)).toBeInTheDocument();
    });
    expect(getSpy).toHaveBeenCalledTimes(2);
  });

  // 20. POST 409 duplicate-profile message
  it('Scenario 20: POST 409 duplicate-profile message — handles 409 conflict and displays duplicate profile error', async () => {
    const user = userEvent.setup();
    vi.spyOn(studentProfileApi, 'getStudentProfileApi').mockRejectedValueOnce({ status: 404 });
    vi.spyOn(studentProfileApi, 'createStudentProfileApi').mockRejectedValueOnce({
      status: 409,
      message: 'Student profile already exists for this account.',
    });

    render(
      <MemoryRouter>
        <StudentProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/Full Name/i), 'Jane Doe');
    await user.click(screen.getByRole('button', { name: /Create Profile/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/A student profile already exists for this account\./i);
    });
  });

  // 21. POST 422 validation feedback
  it('Scenario 21: POST 422 validation feedback — parses backend validation errors and maps them to input hints', async () => {
    const user = userEvent.setup();
    vi.spyOn(studentProfileApi, 'getStudentProfileApi').mockRejectedValueOnce({ status: 404 });
    vi.spyOn(studentProfileApi, 'createStudentProfileApi').mockRejectedValueOnce({
      status: 422,
      message: 'Validation failed.',
      detail: [
        {
          loc: ['body', 'graduation_year'],
          msg: 'Graduation year must not be in the distant future.',
          type: 'value_error',
        },
      ],
    });

    render(
      <MemoryRouter>
        <StudentProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/Full Name/i), 'Jane Doe');
    await user.click(screen.getByRole('button', { name: /Create Profile/i }));

    await waitFor(() => {
      expect(screen.getByText(/Graduation year must not be in the distant future\./i)).toBeInTheDocument();
    });
  });

  // 22. PATCH 404 is treated as an operation error, NOT onboarding
  it('Scenario 22: PATCH 404 is treated as an operation error, NOT onboarding — displays error alert and never resets to create mode', async () => {
    const user = userEvent.setup();
    vi.spyOn(studentProfileApi, 'getStudentProfileApi').mockResolvedValueOnce(mockProfile);
    vi.spyOn(studentProfileApi, 'updateStudentProfileApi').mockRejectedValueOnce({
      status: 404,
      message: 'Student profile not found. Please refresh or create a new profile.',
    });

    render(
      <MemoryRouter>
        <StudentProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    // Verify initial edit state
    expect(screen.getByText(/Edit Profile — keep your academic/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument();

    // Trigger PATCH
    await user.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Student profile not found\. Please refresh or create a new profile\./i);
    });

    // CRITICAL: Page MUST REMAIN in edit state — never reset to create/onboarding mode!
    expect(screen.getByText(/Edit Profile — keep your academic/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument();
    expect(screen.queryByText(/Create Profile — complete your profile details/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create Profile/i })).not.toBeInTheDocument();
  });

  // 23. 429 rate-limit message
  it('Scenario 23: 429 rate-limit message — handles 429 rate limit during submit with rate limit alert', async () => {
    const user = userEvent.setup();
    vi.spyOn(studentProfileApi, 'getStudentProfileApi').mockRejectedValueOnce({ status: 404 });
    vi.spyOn(studentProfileApi, 'createStudentProfileApi').mockRejectedValueOnce({
      status: 429,
      message: 'Too many requests. Please wait a moment before trying again.',
    });

    render(
      <MemoryRouter>
        <StudentProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/Full Name/i), 'Jane Doe');
    await user.click(screen.getByRole('button', { name: /Create Profile/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Too many requests\. Please wait a moment before trying again\./i);
    });
  });

  // 24. Recruiter cannot access student profile route
  it('Scenario 24: Recruiter cannot access student profile route — role protection renders 403 Access Denied and blocks component', () => {
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
      <MemoryRouter initialEntries={['/app/student/profile']}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={['student']} />}>
            <Route path="/app/student/profile" element={<StudentProfilePage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 2, name: /403 — Access Denied/i })).toBeInTheDocument();
    expect(screen.getByText(/Your account \(recruiter\) does not have permission to view this resource\./i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: /My Student Profile/i })).not.toBeInTheDocument();
  });

  // 25. Admin cannot access student profile route
  it('Scenario 25: Admin cannot access student profile route — role protection renders 403 Access Denied and blocks component', () => {
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
      <MemoryRouter initialEntries={['/app/student/profile']}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={['student']} />}>
            <Route path="/app/student/profile" element={<StudentProfilePage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 2, name: /403 — Access Denied/i })).toBeInTheDocument();
    expect(screen.getByText(/Your account \(admin\) does not have permission to view this resource\./i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: /My Student Profile/i })).not.toBeInTheDocument();
  });

  // Additional scenario: empty optional fields send nulls
  it('Scenario 26 (Additional): Submits null for empty optional fields during creation', async () => {
    const user = userEvent.setup();
    vi.spyOn(studentProfileApi, 'getStudentProfileApi').mockRejectedValueOnce({ status: 404 });
    const createSpy = vi.spyOn(studentProfileApi, 'createStudentProfileApi').mockResolvedValueOnce({
      ...mockProfile,
      phone: null,
      college: null,
      degree: null,
      branch: null,
      graduation_year: null,
      bio: null,
      skills: null,
      github_url: null,
      linkedin_url: null,
      portfolio_url: null,
    });

    render(
      <MemoryRouter>
        <StudentProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/Full Name/i), 'Minimal Student');
    await user.click(screen.getByRole('button', { name: /Create Profile/i }));

    expect(createSpy).toHaveBeenCalledWith({
      full_name: 'Minimal Student',
      phone: null,
      college: null,
      degree: null,
      branch: null,
      graduation_year: null,
      bio: null,
      skills: null,
      github_url: null,
      linkedin_url: null,
      portfolio_url: null,
    });
  });

  // Additional scenario: clears field errors on change
  it('Scenario 27 (Additional): Clears field error when the user edits the input', async () => {
    const user = userEvent.setup();
    vi.spyOn(studentProfileApi, 'getStudentProfileApi').mockRejectedValueOnce({ status: 404 });

    render(
      <MemoryRouter>
        <StudentProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Create Profile/i }));
    expect(screen.getByText(/Full name is required\./i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Full Name/i), 'Jane Doe');
    expect(screen.queryByText(/Full name is required\./i)).not.toBeInTheDocument();
  });

  // Additional scenario: Navigation link in AppLayout
  it('Scenario 28 (Additional): AppLayout renders "My Profile" for student, hides for recruiter and admin', () => {
    // 1. Student
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

    const { unmount } = render(
      <MemoryRouter initialEntries={['/app']}>
        <AppLayout />
      </MemoryRouter>
    );

    const profileLink = screen.getByRole('link', { name: /My Profile/i });
    expect(profileLink).toBeInTheDocument();
    expect(profileLink).toHaveAttribute('href', '/app/student/profile');
    unmount();

    // 2. Recruiter
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

    const { unmount: unmountRecruiter } = render(
      <MemoryRouter initialEntries={['/app']}>
        <AppLayout />
      </MemoryRouter>
    );
    expect(screen.queryByRole('link', { name: /My Profile/i })).not.toBeInTheDocument();
    unmountRecruiter();

    // 3. Admin
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
    expect(screen.queryByRole('link', { name: /My Profile/i })).not.toBeInTheDocument();
  });
});
