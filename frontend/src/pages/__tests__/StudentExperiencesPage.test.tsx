import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StudentExperiencesPage } from '../StudentExperiencesPage';
import * as experiencesApi from '@/api/experiences';
import { ExperienceRecord, ExperienceRecordListResponse } from '@/types/experience';

const mockExperiences: ExperienceRecord[] = [
  {
    id: 1,
    student_id: 10,
    title: 'Software Development Intern',
    organization_name: 'Tech Giant Inc',
    experience_type: 'internship',
    start_date: '2025-06-01',
    end_date: '2025-08-31',
    is_current: false,
    description: 'Developed full stack features using React, TypeScript, and FastAPI.',
    status: 'claimed',
    verification_source: 'self_claimed',
    innovation_project_id: null,
    verifier_id: null,
    verifier_name: null,
    verified_at: null,
    verification_notes: null,
    skills: 'React, TypeScript, FastAPI',
    structured_skills: [],
    created_at: '2026-09-25T00:00:00Z',
    updated_at: '2026-09-25T00:00:00Z',
  },
  {
    id: 2,
    student_id: 10,
    title: 'Research Fellow',
    organization_name: 'AI Robotics Lab',
    experience_type: 'research',
    start_date: '2025-01-10',
    end_date: null,
    is_current: true,
    description: 'Published research on transformer architectures for robotics.',
    status: 'verified',
    verification_source: 'recruiter_confirmed',
    innovation_project_id: null,
    verifier_id: 99,
    verifier_name: null,
    verified_at: '2025-05-01T00:00:00Z',
    verification_notes: null,
    skills: 'PyTorch, Python',
    structured_skills: [],
    created_at: '2026-09-25T00:00:00Z',
    updated_at: '2026-09-25T00:00:00Z',
  },
];

describe('StudentExperiencesPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state initially and then displays populated experiences', async () => {
    const listResponse: ExperienceRecordListResponse = {
      items: mockExperiences,
      total: 2,
    };
    vi.spyOn(experiencesApi, 'getMyExperiences').mockResolvedValueOnce(listResponse);

    render(
      <MemoryRouter>
        <StudentExperiencesPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Loading verified experiences...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Software Development Intern')).toBeInTheDocument();
      expect(screen.getByText('Research Fellow')).toBeInTheDocument();
    });

    expect(screen.getByText('Total Records')).toBeInTheDocument();
  });

  it('renders empty state when no experiences exist', async () => {
    vi.spyOn(experiencesApi, 'getMyExperiences').mockResolvedValueOnce({
      items: [],
      total: 0,
    });

    render(
      <MemoryRouter>
        <StudentExperiencesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No Experience Records Found')).toBeInTheDocument();
    });
  });

  it('handles API failure and allows retry', async () => {
    const getSpy = vi
      .spyOn(experiencesApi, 'getMyExperiences')
      .mockRejectedValueOnce(new Error('Network error loading experiences'))
      .mockResolvedValueOnce({ items: mockExperiences, total: 2 });

    render(
      <MemoryRouter>
        <StudentExperiencesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to load experiences')).toBeInTheDocument();
      expect(screen.getByText('Network error loading experiences')).toBeInTheDocument();
    });

    const retryBtn = screen.getByTestId('retry-btn');
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Software Development Intern')).toBeInTheDocument();
    });
    expect(getSpy).toHaveBeenCalledTimes(2);
  });

  it('opens create modal, submits new experience, and adds it to list', async () => {
    vi.spyOn(experiencesApi, 'getMyExperiences').mockResolvedValueOnce({
      items: mockExperiences,
      total: 2,
    });

    const createdRecord: ExperienceRecord = {
      id: 3,
      student_id: 10,
      title: 'Open Source Contributor',
      organization_name: 'Linux Foundation',
      experience_type: 'project',
      start_date: '2025-02-01',
      end_date: '2025-05-01',
      is_current: false,
      description: 'Contributed kernel patches and documentation.',
      status: 'claimed',
      verification_source: 'self_claimed',
      innovation_project_id: null,
      verifier_id: null,
      verifier_name: null,
      verified_at: null,
      verification_notes: null,
      skills: 'C, Git',
      structured_skills: [],
      created_at: '2026-09-25T00:00:00Z',
      updated_at: '2026-09-25T00:00:00Z',
    };

    const createSpy = vi
      .spyOn(experiencesApi, 'createExperience')
      .mockResolvedValueOnce(createdRecord);

    render(
      <MemoryRouter>
        <StudentExperiencesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Software Development Intern')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('add-experience-btn'));
    expect(screen.getByText('Add Experience Record')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Title \/ Role/i), {
      target: { value: 'Open Source Contributor' },
    });
    fireEvent.change(screen.getByLabelText(/Organization \/ Company \/ Lab/i), {
      target: { value: 'Linux Foundation' },
    });
    fireEvent.change(screen.getByLabelText(/Experience Type/i), {
      target: { value: 'project' },
    });
    fireEvent.change(screen.getByLabelText(/Start Date/i), {
      target: { value: '2025-02-01' },
    });
    fireEvent.change(screen.getByLabelText(/End Date/i), {
      target: { value: '2025-05-01' },
    });
    fireEvent.change(screen.getByLabelText(/Description & Responsibilities/i), {
      target: { value: 'Contributed kernel patches and documentation.' },
    });

    fireEvent.click(screen.getByTestId('submit-experience-btn'));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalled();
      expect(screen.getByText('Open Source Contributor')).toBeInTheDocument();
      expect(
        screen.getByText('Experience "Open Source Contributor" added to your profile.')
      ).toBeInTheDocument();
    });
  });

  it('triggers verification request and updates item status', async () => {
    vi.spyOn(experiencesApi, 'getMyExperiences').mockResolvedValueOnce({
      items: [mockExperiences[0]],
      total: 1,
    });

    const pendingRecord: ExperienceRecord = {
      ...mockExperiences[0],
      status: 'pending_verification',
    };

    const requestSpy = vi
      .spyOn(experiencesApi, 'requestExperienceVerification')
      .mockResolvedValueOnce(pendingRecord);

    render(
      <MemoryRouter>
        <StudentExperiencesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Software Development Intern')).toBeInTheDocument();
    });

    const requestBtn = screen.getByTestId('request-verify-btn-1');
    fireEvent.click(requestBtn);

    await waitFor(() => {
      expect(requestSpy).toHaveBeenCalledWith(1);
      expect(
        screen.getByText('Verification request submitted for "Software Development Intern".')
      ).toBeInTheDocument();
    });
  });

  it('handles experience deletion with confirmation modal', async () => {
    vi.spyOn(experiencesApi, 'getMyExperiences').mockResolvedValueOnce({
      items: [mockExperiences[0]],
      total: 1,
    });

    const deleteSpy = vi
      .spyOn(experiencesApi, 'deleteExperience')
      .mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter>
        <StudentExperiencesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Software Development Intern')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByTestId('delete-experience-btn-1');
    fireEvent.click(deleteBtn);

    expect(screen.getByText('Confirm Experience Deletion')).toBeInTheDocument();

    const confirmDeleteBtn = screen.getByTestId('confirm-delete-experience-btn');
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith(1);
      expect(screen.queryByText('Software Development Intern')).not.toBeInTheDocument();
    });
  });
});
