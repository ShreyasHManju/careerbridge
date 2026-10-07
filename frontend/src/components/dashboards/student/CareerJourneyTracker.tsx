import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircleIcon } from './StudentDashboardIcons';
import { StudentDashboard } from '@/types/dashboard';
import { PassportResponse } from '@/types/passport';

interface CareerJourneyTrackerProps {
  dashboard: StudentDashboard;
  passport?: PassportResponse | null;
}

type StageStatus = 'completed' | 'active' | 'upcoming';

interface Stage {
  id: string;
  name: string;
  link: string;
  status: StageStatus;
  detail: string;
}

export const CareerJourneyTracker: React.FC<CareerJourneyTrackerProps> = ({
  dashboard,
  passport,
}) => {
  // Real indicators
  const hasProfile = Boolean(passport?.identity?.full_name);
  const skillsCount = passport?.summary?.canonical_skills_count ?? passport?.skills?.length ?? 0;
  const projectsCount = passport?.summary?.public_projects_count ?? passport?.projects?.length ?? 0;
  const experiencesCount = passport?.summary?.verified_experiences_count ?? passport?.verified_experiences?.length ?? 0;
  const applicationsCount = dashboard.total_applications;
  const interviewsCount = dashboard.upcoming_interviews;
  const offersCount = dashboard.accepted_applications;

  const pendingOffersCount = dashboard.pending_offers ?? 0;

  // Determine stage statuses deterministically
  const stages: Stage[] = [
    {
      id: 'profile',
      name: 'Profile',
      link: '/app/student/profile',
      status: hasProfile ? 'completed' : 'active',
      detail: hasProfile ? 'Identity registered' : 'Set up profile details',
    },
    {
      id: 'skills',
      name: 'Skills',
      link: '/app/student/profile',
      status: skillsCount > 0 ? 'completed' : hasProfile ? 'active' : 'upcoming',
      detail: skillsCount > 0 ? `${skillsCount} skills documented` : 'Document core competencies',
    },
    {
      id: 'projects',
      name: 'Projects',
      link: '/app/projects',
      status: projectsCount > 0 ? 'completed' : skillsCount > 0 ? 'active' : 'upcoming',
      detail: projectsCount > 0 ? `${projectsCount} project(s) added` : 'Showcase project evidence',
    },
    {
      id: 'experiences',
      name: 'Experiences',
      link: '/app/experiences',
      status: experiencesCount > 0 ? 'completed' : projectsCount > 0 ? 'active' : 'upcoming',
      detail: experiencesCount > 0 ? `${experiencesCount} verified experience(s)` : 'Verify work or roles',
    },
    {
      id: 'applications',
      name: 'Applications',
      link: '/app/applications',
      status: applicationsCount > 0 ? 'completed' : 'active',
      detail: applicationsCount > 0 ? `${applicationsCount} application(s) submitted` : 'Apply to opportunities',
    },
    {
      id: 'interviews',
      name: 'Interviews',
      link: '/app/interviews',
      status: interviewsCount > 0 ? 'completed' : applicationsCount > 0 ? 'active' : 'upcoming',
      detail: interviewsCount > 0 ? `${interviewsCount} scheduled interview(s)` : 'Interview rounds',
    },
    {
      id: 'offers',
      name: 'Offers',
      link: offersCount > 0 ? '/app/applications?status=accepted' : '/app/applications?status=offered',
      status: offersCount > 0 ? 'completed' : pendingOffersCount > 0 ? 'active' : 'upcoming',
      detail:
        offersCount > 0
          ? `${offersCount} accepted offer(s) • Credentialize to Passport`
          : pendingOffersCount > 0
          ? `${pendingOffersCount} pending offer(s) • Decision required`
          : 'Placement milestones',
    },
  ];

  return (
    <section className="cb-career-journey-section" aria-labelledby="career-journey-heading">
      <div className="cb-section-header">
        <h2 id="career-journey-heading" className="cb-section-title">
          Career Journey
        </h2>
        <p className="cb-section-subtitle">
          Your progressive roadmap from core competencies to verified placement.
        </p>
      </div>

      <div className="cb-journey-timeline" role="list">
        {stages.map((stage, index) => {
          return (
            <Link
              key={stage.id}
              to={stage.link}
              className={`cb-journey-step cb-journey-step-${stage.status}`}
              role="listitem"
              aria-label={`${stage.name} stage: ${stage.status}. ${stage.detail}`}
            >
              <div className="cb-journey-step-indicator">
                <span className="cb-journey-step-num">
                  {stage.status === 'completed' ? (
                    <CheckCircleIcon size={14} className="cb-journey-check-icon" />
                  ) : (
                    index + 1
                  )}
                </span>
                {index < stages.length - 1 && <span className="cb-journey-connector" aria-hidden="true" />}
              </div>
              <div className="cb-journey-step-content">
                <div className="cb-journey-step-header">
                  <span className="cb-journey-step-name">{stage.name}</span>
                  <span className={`cb-journey-badge cb-journey-badge-${stage.status}`}>
                    {stage.status === 'completed' ? 'Completed' : stage.status === 'active' ? 'Active' : 'Next Up'}
                  </span>
                </div>
                <p className="cb-journey-step-detail">{stage.detail}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};
