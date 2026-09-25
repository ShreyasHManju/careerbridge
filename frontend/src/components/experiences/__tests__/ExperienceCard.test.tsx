import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { ExperienceCard } from '../ExperienceCard';
import { ExperienceRecord } from '@/types/experience';

const baseMockExperience: ExperienceRecord = {
  id: 42,
  student_id: 10,
  title: 'Full Stack Engineering Intern',
  organization_name: 'Stark Enterprises',
  experience_type: 'internship',
  start_date: '2025-06-01',
  end_date: '2025-08-31',
  is_current: false,
  description: 'Engineered microservices in FastAPI and React frontends.',
  status: 'claimed',
  verification_source: 'self_claimed',
  innovation_project_id: null,
  verifier_id: null,
  verifier_name: null,
  verified_at: null,
  verification_notes: null,
  skills: 'FastAPI, React, TypeScript',
  structured_skills: [
    {
      id: 1,
      name: 'FastAPI',
      slug: 'fastapi',
      category: 'Backend',
      is_verified: true,
      created_at: '2026-09-24T00:00:00Z',
    },
    {
      id: 2,
      name: 'React',
      slug: 'react',
      category: 'Frontend',
      is_verified: true,
      created_at: '2026-09-24T00:00:00Z',
    },
  ],
  created_at: '2026-09-25T00:00:00Z',
  updated_at: '2026-09-25T00:00:00Z',
};

describe('ExperienceCard Component', () => {
  it('renders core experience details, badges, dates, and organization', () => {
    render(
      <MemoryRouter>
        <ExperienceCard experience={baseMockExperience} isOwner={false} />
      </MemoryRouter>
    );

    expect(screen.getByText('Full Stack Engineering Intern')).toBeInTheDocument();
    expect(screen.getByText('Stark Enterprises')).toBeInTheDocument();
    expect(screen.getByText('Internship')).toBeInTheDocument();
    expect(
      screen.getByText('Engineered microservices in FastAPI and React frontends.')
    ).toBeInTheDocument();
    expect(screen.getByText('Claimed')).toBeInTheDocument();
  });

  it('renders structured skills tags properly', () => {
    render(
      <MemoryRouter>
        <ExperienceCard experience={baseMockExperience} isOwner={false} />
      </MemoryRouter>
    );

    expect(screen.getByText('FastAPI')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
  });

  it('renders comma-separated skills fallback if structured_skills is missing', () => {
    const rawSkillsExp: ExperienceRecord = {
      ...baseMockExperience,
      structured_skills: undefined,
      skills: 'Docker, Kubernetes, AWS',
    };

    render(
      <MemoryRouter>
        <ExperienceCard experience={rawSkillsExp} isOwner={false} />
      </MemoryRouter>
    );

    expect(screen.getByText('Docker')).toBeInTheDocument();
    expect(screen.getByText('Kubernetes')).toBeInTheDocument();
    expect(screen.getByText('AWS')).toBeInTheDocument();
  });

  it('renders verified banner with verification source for verified records', () => {
    const verifiedExp: ExperienceRecord = {
      ...baseMockExperience,
      status: 'verified',
      verification_source: 'recruiter_confirmed',
      verifier_id: 99,
      verified_at: '2026-09-20',
    };

    render(
      <MemoryRouter>
        <ExperienceCard experience={verifiedExp} isOwner={false} />
      </MemoryRouter>
    );

    expect(screen.getByTestId('verified-banner-42')).toBeInTheDocument();
    expect(screen.getByText('Verified Achievement')).toBeInTheDocument();
    expect(
      screen.getByText(/Verified by Partner Organization/i)
    ).toBeInTheDocument();
  });

  it('renders current experience badge and "Present" when is_current is true', () => {
    const currentExp: ExperienceRecord = {
      ...baseMockExperience,
      is_current: true,
      end_date: null,
    };

    render(
      <MemoryRouter>
        <ExperienceCard experience={currentExp} isOwner={false} />
      </MemoryRouter>
    );

    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByText('Present')).toBeInTheDocument();
  });

  it('renders linked innovation project link when innovation_project_id is provided', () => {
    const linkedProjectExp: ExperienceRecord = {
      ...baseMockExperience,
      innovation_project_id: 88,
    };

    render(
      <MemoryRouter>
        <ExperienceCard experience={linkedProjectExp} isOwner={false} />
      </MemoryRouter>
    );

    const projectLink = screen.getByRole('link', {
      name: /View linked Innovation Project #88/i,
    });
    expect(projectLink).toBeInTheDocument();
    expect(projectLink).toHaveAttribute('href', '/app/projects/88');
  });

  it('handles optional missing fields like organization_name gracefully', () => {
    const noOrgExp: ExperienceRecord = {
      ...baseMockExperience,
      organization_name: null,
    };

    render(
      <MemoryRouter>
        <ExperienceCard experience={noOrgExp} isOwner={false} />
      </MemoryRouter>
    );

    expect(screen.queryByText('Stark Enterprises')).toBeNull();
  });

  it('renders owner actions and triggers callbacks', () => {
    const handleEdit = vi.fn();
    const handleDelete = vi.fn();
    const handleRequestVerification = vi.fn();

    render(
      <MemoryRouter>
        <ExperienceCard
          experience={baseMockExperience}
          isOwner={true}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onRequestVerification={handleRequestVerification}
        />
      </MemoryRouter>
    );

    const editBtn = screen.getByTestId('edit-experience-btn-42');
    fireEvent.click(editBtn);
    expect(handleEdit).toHaveBeenCalledWith(baseMockExperience);

    const reqVerifyBtn = screen.getByTestId('request-verify-btn-42');
    fireEvent.click(reqVerifyBtn);
    expect(handleRequestVerification).toHaveBeenCalledWith(baseMockExperience);

    const deleteBtn = screen.getByTestId('delete-experience-btn-42');
    fireEvent.click(deleteBtn);
    expect(handleDelete).toHaveBeenCalledWith(baseMockExperience);
  });

  it('renders resubmit verification button for rejected records', () => {
    const rejectedExp: ExperienceRecord = {
      ...baseMockExperience,
      status: 'rejected',
    };
    const handleRequestVerification = vi.fn();

    render(
      <MemoryRouter>
        <ExperienceCard
          experience={rejectedExp}
          isOwner={true}
          onRequestVerification={handleRequestVerification}
        />
      </MemoryRouter>
    );

    expect(
      screen.getByText('✕ Verification not approved. You may edit and resubmit.')
    ).toBeInTheDocument();
    const resubmitBtn = screen.getByRole('button', {
      name: /Request verification for Full Stack Engineering Intern/i,
    });
    expect(resubmitBtn).toHaveTextContent('Resubmit Verification');
    fireEvent.click(resubmitBtn);
    expect(handleRequestVerification).toHaveBeenCalledWith(rejectedExp);
  });

  it('hides edit button for verified records to enforce immutability', () => {
    const verifiedExp: ExperienceRecord = {
      ...baseMockExperience,
      status: 'verified',
    };

    render(
      <MemoryRouter>
        <ExperienceCard
          experience={verifiedExp}
          isOwner={true}
          onEdit={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('edit-experience-btn-42')).not.toBeInTheDocument();
    expect(screen.queryByTestId('request-verify-btn-42')).not.toBeInTheDocument();
  });

  it('hides all owner action buttons when isOwner is false', () => {
    render(
      <MemoryRouter>
        <ExperienceCard
          experience={baseMockExperience}
          isOwner={false}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onRequestVerification={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('edit-experience-btn-42')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-experience-btn-42')).not.toBeInTheDocument();
    expect(screen.queryByTestId('request-verify-btn-42')).not.toBeInTheDocument();
  });
});
