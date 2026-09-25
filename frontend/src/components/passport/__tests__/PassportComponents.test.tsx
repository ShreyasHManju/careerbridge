import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  PassportHeader,
  PassportSummary,
  PassportSkills,
  PassportExperiences,
  PassportProjects,
  PassportResume,
} from '../index';
import {
  PassportIdentity,
  PassportSummary as PassportSummaryType,
  PassportSkillItem,
  PassportExperienceItem,
  PassportProjectItem,
  PassportResumeInfo,
} from '@/types/passport';

describe('Passport Component Prototypes', () => {
  describe('PassportHeader', () => {
    const mockIdentity: PassportIdentity = {
      user_id: 1,
      email: 'alex@example.com',
      full_name: 'Alex Morgan',
      college: 'MIT',
      degree: 'B.S.',
      branch: 'Computer Science',
      graduation_year: 2026,
      bio: 'Passionate software developer.',
      github_url: 'https://github.com/alexmorgan',
      linkedin_url: 'https://linkedin.com/in/alexmorgan',
      portfolio_url: 'https://alexmorgan.dev',
      profile_image_url: '/api/v1/profile-image/1',
      is_verified: true,
      created_at: '2026-09-20T00:00:00Z',
    };

    it('renders full identity details, academic line, and external links', () => {
      render(<PassportHeader identity={mockIdentity} isOwner={true} />);

      expect(screen.getByTestId('passport-student-name')).toHaveTextContent('Alex Morgan');
      expect(screen.getByTestId('passport-verified-badge')).toHaveTextContent('✓ Verified Student');
      expect(screen.getByTestId('passport-owner-badge')).toHaveTextContent('Your Passport');
      expect(screen.getByTestId('passport-academic-info')).toHaveTextContent('B.S. • Computer Science • MIT • Class of 2026');
      expect(screen.getByTestId('passport-bio')).toHaveTextContent('Passionate software developer.');
      expect(screen.getByTestId('passport-avatar-img')).toBeInTheDocument();
      expect(screen.getByTestId('passport-github-link')).toHaveAttribute('href', 'https://github.com/alexmorgan');
      expect(screen.getByTestId('passport-linkedin-link')).toHaveAttribute('href', 'https://linkedin.com/in/alexmorgan');
      expect(screen.getByTestId('passport-portfolio-link')).toHaveAttribute('href', 'https://alexmorgan.dev');
    });

    it('renders fallback initials avatar and email when name/image are missing', () => {
      const minimalIdentity: PassportIdentity = {
        user_id: 2,
        email: 'student@example.com',
        full_name: null,
        college: null,
        degree: null,
        branch: null,
        graduation_year: null,
        bio: null,
        github_url: null,
        linkedin_url: null,
        portfolio_url: null,
        profile_image_url: null,
        is_verified: false,
        created_at: '2026-09-20T00:00:00Z',
      };

      render(<PassportHeader identity={minimalIdentity} isOwner={false} />);

      expect(screen.getByTestId('passport-student-name')).toHaveTextContent('student@example.com');
      expect(screen.getByTestId('passport-avatar-placeholder')).toHaveTextContent('ST');
      expect(screen.queryByTestId('passport-verified-badge')).not.toBeInTheDocument();
      expect(screen.queryByTestId('passport-owner-badge')).not.toBeInTheDocument();
    });
  });

  describe('PassportSummary', () => {
    it('renders metric counts for experiences, projects, skills, and milestones', () => {
      const summary: PassportSummaryType = {
        verified_experiences_count: 3,
        public_projects_count: 2,
        canonical_skills_count: 5,
        completed_milestones_count: 4,
      };

      render(<PassportSummary summary={summary} />);

      expect(screen.getByTestId('stat-count-experiences')).toHaveTextContent('3');
      expect(screen.getByTestId('stat-count-projects')).toHaveTextContent('2');
      expect(screen.getByTestId('stat-count-skills')).toHaveTextContent('5');
      expect(screen.getByTestId('stat-count-milestones')).toHaveTextContent('4');
    });

    it('renders cleanly with zero values', () => {
      const zeroSummary: PassportSummaryType = {
        verified_experiences_count: 0,
        public_projects_count: 0,
        canonical_skills_count: 0,
        completed_milestones_count: 0,
      };

      render(<PassportSummary summary={zeroSummary} />);

      expect(screen.getByTestId('stat-count-experiences')).toHaveTextContent('0');
      expect(screen.getByTestId('stat-count-projects')).toHaveTextContent('0');
      expect(screen.getByTestId('stat-count-skills')).toHaveTextContent('0');
      expect(screen.getByTestId('stat-count-milestones')).toHaveTextContent('0');
    });
  });

  describe('PassportSkills', () => {
    const mockSkills: PassportSkillItem[] = [
      {
        id: 1,
        name: 'TypeScript',
        slug: 'typescript',
        category: 'Frontend',
        is_verified: true,
        sources: ['profile', 'experience'],
      },
      {
        id: 2,
        name: 'PostgreSQL',
        slug: 'postgresql',
        category: 'Database',
        is_verified: true,
        sources: ['experience'],
      },
    ];

    it('renders populated skills with category and provenance tags', () => {
      render(<PassportSkills skills={mockSkills} />);

      expect(screen.getByTestId('passport-skill-typescript')).toHaveTextContent('TypeScript');
      expect(screen.getByTestId('passport-skill-typescript')).toHaveTextContent('Frontend');
      expect(screen.getByTestId('skill-source-typescript-profile')).toHaveTextContent('Profile');
      expect(screen.getByTestId('skill-source-typescript-experience')).toHaveTextContent('Experience');

      expect(screen.getByTestId('passport-skill-postgresql')).toHaveTextContent('PostgreSQL');
      expect(screen.getByTestId('skill-source-postgresql-experience')).toHaveTextContent('Experience');
    });

    it('renders clean empty state when skills list is empty', () => {
      render(<PassportSkills skills={[]} />);
      expect(screen.getByTestId('passport-skills-empty')).toHaveTextContent('No skills added yet to this passport.');
    });
  });

  describe('PassportExperiences', () => {
    const mockExperiences: PassportExperienceItem[] = [
      {
        id: 101,
        title: 'Backend Intern',
        organization_name: 'Apex Cloud Systems',
        experience_type: 'internship',
        start_date: '2025-06-01',
        end_date: '2025-08-31',
        is_current: false,
        description: 'Engineered high-throughput event processing.',
        status: 'verified',
        verification_source: 'recruiter_confirmed',
        verified_at: '2025-09-01T00:00:00Z',
        innovation_project_id: 1,
        innovation_project_title: 'Distributed Queue',
        skills: 'Python, Redis',
        structured_skills: [
          {
            id: 1,
            name: 'Python',
            slug: 'python',
            category: 'Backend',
            is_verified: true,
            created_at: '2026-09-20T00:00:00Z',
          },
        ],
      },
    ];

    it('renders verified experience timeline with associated project and skills', () => {
      render(<PassportExperiences experiences={mockExperiences} />);

      expect(screen.getByTestId('exp-title-101')).toHaveTextContent('Backend Intern');
      expect(screen.getByTestId('exp-org-101')).toHaveTextContent('Apex Cloud Systems');
      expect(screen.getByTestId('exp-badge-101')).toHaveTextContent('✓ Recruiter Verified');
      expect(screen.getByTestId('exp-desc-101')).toHaveTextContent('Engineered high-throughput event processing.');
      expect(screen.getByTestId('exp-project-101')).toHaveTextContent('🚀 Distributed Queue');
      expect(screen.getByTestId('exp-skills-101')).toHaveTextContent('Python');
    });

    it('renders clean empty state when no experiences exist', () => {
      render(<PassportExperiences experiences={[]} />);
      expect(screen.getByTestId('passport-experiences-empty')).toHaveTextContent('No verified experience records available.');
    });
  });

  describe('PassportProjects', () => {
    const mockProjects: PassportProjectItem[] = [
      {
        id: 201,
        title: 'Task Orchestrator',
        slug: 'task-orchestrator',
        short_description: 'Scalable async workflow engine',
        description: 'Built with React and FastAPI.',
        project_type: 'software',
        status: 'active',
        visibility: 'public',
        repository_url: 'https://github.com/alexmorgan/orchestrator',
        live_demo_url: 'https://orchestrator.dev',
        skills: 'React, FastAPI',
        structured_skills: [
          {
            id: 2,
            name: 'React',
            slug: 'react',
            category: 'Frontend',
            is_verified: true,
            created_at: '2026-09-20T00:00:00Z',
          },
        ],
        total_milestones: 2,
        completed_milestones: 1,
        progress_percentage: 50,
        milestones: [
          {
            id: 1,
            innovation_project_id: 201,
            project_title: 'Task Orchestrator',
            title: 'Architecture Blueprint',
            description: null,
            status: 'completed',
            display_order: 1,
            due_date: null,
            completed_at: '2026-09-22T00:00:00Z',
          },
          {
            id: 2,
            innovation_project_id: 201,
            project_title: 'Task Orchestrator',
            title: 'Worker Implementation',
            description: null,
            status: 'in_progress',
            display_order: 2,
            due_date: null,
            completed_at: null,
          },
        ],
      },
    ];

    it('renders project card, repository link, live demo, and milestones progress', () => {
      render(<PassportProjects projects={mockProjects} />);

      expect(screen.getByTestId('proj-title-201')).toHaveTextContent('Task Orchestrator');
      expect(screen.getByTestId('proj-short-desc-201')).toHaveTextContent('Scalable async workflow engine');
      expect(screen.getByTestId('proj-repo-201')).toHaveAttribute('href', 'https://github.com/alexmorgan/orchestrator');
      expect(screen.getByTestId('proj-demo-201')).toHaveAttribute('href', 'https://orchestrator.dev');
      expect(screen.getByTestId('proj-milestones-201')).toHaveTextContent('50%');
      expect(screen.getByTestId('milestone-item-1')).toHaveTextContent('Architecture Blueprint');
      expect(screen.getByTestId('milestone-item-2')).toHaveTextContent('Worker Implementation');
    });

    it('renders clean empty state when no public projects exist', () => {
      render(<PassportProjects projects={[]} />);
      expect(screen.getByTestId('passport-projects-empty')).toHaveTextContent('No active public innovation projects on record.');
    });
  });

  describe('PassportResume', () => {
    const mockResume: PassportResumeInfo = {
      id: 301,
      original_filename: 'Alex_Morgan_CV_2026.pdf',
      content_type: 'application/pdf',
      file_size: 2097152, // 2MB
      updated_at: '2026-09-21T00:00:00Z',
    };

    it('renders safe resume metadata without exposing internal file paths', () => {
      const { container } = render(<PassportResume resume={mockResume} />);

      expect(screen.getByTestId('passport-resume-filename')).toHaveTextContent('Alex_Morgan_CV_2026.pdf');
      expect(screen.getByTestId('passport-resume-meta')).toHaveTextContent('2.0 MB • PDF');
      // Assert that no internal paths are leaked
      expect(container.textContent).not.toContain('C:\\');
      expect(container.textContent).not.toContain('/storage/');
    });

    it('renders clean empty state when resume is null', () => {
      render(<PassportResume resume={null} />);
      expect(screen.getByTestId('passport-resume-empty')).toHaveTextContent('No resume document uploaded.');
    });
  });
});
