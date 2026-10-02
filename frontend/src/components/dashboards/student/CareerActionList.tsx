import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, UserIcon, CodeFolderIcon, ShieldCheckIcon, CalendarIcon, ClipboardIcon, BookmarkIcon, SearchIcon } from './StudentDashboardIcons';
import { StudentDashboard } from '@/types/dashboard';
import { PassportResponse } from '@/types/passport';

interface CareerActionListProps {
  dashboard: StudentDashboard;
  passport?: PassportResponse | null;
}

interface ActionItem {
  id: string;
  title: string;
  description: string;
  link: string;
  linkText: string;
  badgeText: string;
  priority: 'high' | 'medium' | 'standard';
  icon: React.ReactNode;
}

export const CareerActionList: React.FC<CareerActionListProps> = ({
  dashboard,
  passport,
}) => {
  const actions: ActionItem[] = [];

  const hasCompleteProfile = Boolean(
    passport?.identity?.full_name &&
    passport?.identity?.college &&
    (passport?.identity?.degree || passport?.identity?.branch)
  );

  const projectsCount = passport?.summary?.public_projects_count ?? passport?.projects?.length ?? 0;
  const experiencesCount = passport?.summary?.verified_experiences_count ?? passport?.verified_experiences?.length ?? 0;

  // 1. High priority: upcoming interview preparation
  if (dashboard.upcoming_interviews > 0) {
    actions.push({
      id: 'interview-prep',
      title: 'Prepare for your upcoming interview',
      description: `You have ${dashboard.upcoming_interviews} scheduled interview round(s). Review recruiter notes and project talking points.`,
      link: '/app/interviews',
      linkText: 'View Interviews',
      badgeText: 'High Priority',
      priority: 'high',
      icon: <CalendarIcon size={20} className="cb-action-item-icon" />,
    });
  }

  // 2. Profile completion if incomplete
  if (!hasCompleteProfile) {
    actions.push({
      id: 'complete-profile',
      title: 'Complete your student profile',
      description: 'Add your academic background, institution, and core skills so employers can evaluate your eligibility.',
      link: '/app/student/profile',
      linkText: 'Update Profile',
      badgeText: 'Recommended',
      priority: 'high',
      icon: <UserIcon size={20} className="cb-action-item-icon" />,
    });
  }

  // 3. Add project if none exists
  if (projectsCount === 0) {
    actions.push({
      id: 'add-project',
      title: 'Add your first innovation project',
      description: 'Showcase real-world artifacts, code repositories, and milestone evidence to stand out to recruiters.',
      link: '/app/projects',
      linkText: 'Add Project',
      badgeText: 'Evidence Building',
      priority: 'medium',
      icon: <CodeFolderIcon size={20} className="cb-action-item-icon" />,
    });
  }

  // 4. Experience verification if none exists
  if (experiencesCount === 0) {
    actions.push({
      id: 'build-experience',
      title: 'Build your experience evidence',
      description: 'Document internships, student organizations, or capstone roles and submit them for employer verification.',
      link: '/app/experiences',
      linkText: 'Manage Experiences',
      badgeText: 'Verification',
      priority: 'medium',
      icon: <ShieldCheckIcon size={20} className="cb-action-item-icon" />,
    });
  }

  // 5. Review active applications if any exist
  if (dashboard.total_applications > 0) {
    actions.push({
      id: 'review-applications',
      title: 'Review your application progress',
      description: `Track status across ${dashboard.total_applications} application(s) (${dashboard.applications_under_review} in review, ${dashboard.shortlisted_applications} shortlisted).`,
      link: '/app/applications',
      linkText: 'View Applications',
      badgeText: 'Active Funnel',
      priority: 'standard',
      icon: <ClipboardIcon size={20} className="cb-action-item-icon" />,
    });
  }

  // 6. Review saved jobs if any exist
  if (dashboard.saved_internships > 0) {
    actions.push({
      id: 'review-saved-jobs',
      title: 'Review your saved opportunities',
      description: `You have ${dashboard.saved_internships} opportunity bookmarks. Submit your applications before upcoming deadlines.`,
      link: '/app/saved-jobs',
      linkText: 'View Saved',
      badgeText: 'Saved Opportunities',
      priority: 'standard',
      icon: <BookmarkIcon size={20} className="cb-action-item-icon" />,
    });
  }

  // 7. Browse opportunities (always available fallback / exploration)
  actions.push({
    id: 'explore-jobs',
    title: 'Explore active internships and jobs',
    description: 'Discover new vetted roles matching your skills, academic discipline, and career interests.',
    link: '/app/jobs',
    linkText: 'Browse Opportunities',
    badgeText: 'Discovery',
    priority: 'standard',
    icon: <SearchIcon size={20} className="cb-action-item-icon" />,
  });

  // Limit to top 3-4 actionable items
  const displayActions = actions.slice(0, 4);

  return (
    <section className="cb-career-actions-section" aria-labelledby="today-actions-heading">
      <div className="cb-section-header">
        <h2 id="today-actions-heading" className="cb-section-title">
          What should I do next?
        </h2>
        <p className="cb-section-subtitle">
          Recommended focus areas based on your current career evidence and application pipeline.
        </p>
      </div>

      <div className="cb-action-card-list">
        {displayActions.map((action) => (
          <div key={action.id} className={`cb-career-action-card cb-action-priority-${action.priority}`}>
            <div className="cb-career-action-icon-wrapper">
              {action.icon}
            </div>
            <div className="cb-career-action-content">
              <div className="cb-career-action-badge-row">
                <span className={`cb-action-priority-badge cb-badge-${action.priority}`}>
                  {action.badgeText}
                </span>
              </div>
              <h3 className="cb-career-action-title">{action.title}</h3>
              <p className="cb-career-action-desc">{action.description}</p>
            </div>
            <div className="cb-career-action-cta">
              <Link to={action.link} className="cb-btn cb-btn-secondary cb-btn-sm cb-action-link-btn">
                <span>{action.linkText}</span>
                <ArrowRightIcon size={14} />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
