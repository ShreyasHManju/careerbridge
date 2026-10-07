import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, UserIcon, CodeFolderIcon, ShieldCheckIcon, CalendarIcon, ClipboardIcon, BookmarkIcon, SearchIcon } from './StudentDashboardIcons';
import { StudentDashboard } from '@/types/dashboard';
import { PassportResponse } from '@/types/passport';
import { ActionItem } from '@/types/actionCenter';
import { ActionCenterBadge } from '@/components/action-center/ActionCenterBadge';

interface CareerActionListProps {
  dashboard: StudentDashboard;
  passport?: PassportResponse | null;
}

interface StudentActionItem extends ActionItem {
  icon: React.ReactNode;
}

export const CareerActionList: React.FC<CareerActionListProps> = ({
  dashboard,
  passport,
}) => {
  const actions: StudentActionItem[] = [];

  const hasCompleteProfile = Boolean(
    passport?.identity?.full_name &&
    passport?.identity?.college &&
    (passport?.identity?.degree || passport?.identity?.branch)
  );

  const projectsCount = passport?.summary?.public_projects_count ?? passport?.projects?.length ?? 0;
  const experiencesCount = passport?.summary?.verified_experiences_count ?? passport?.verified_experiences?.length ?? 0;

  // 1. Critical priority: pending job offers awaiting review / decision
  if ((dashboard.pending_offers ?? 0) > 0) {
    actions.push({
      id: 'review-pending-offer',
      title: 'Review your pending job offer',
      description: `You have ${dashboard.pending_offers} official job offer(s) waiting for your review and decision. Review compensation, terms, and accept before the deadline.`,
      destination: '/app/applications?status=offered',
      ctaLabel: 'Review Offer',
      badgeText: 'Decision Required',
      priority: 'high',
      category: 'application',
      sourceDomain: 'student',
      notificationType: 'offer_received',
      count: dashboard.pending_offers,
      icon: <ShieldCheckIcon size={20} className="cb-action-item-icon" />,
    });
  }

  // 2. Highest priority: accepted placement credentialing
  if (dashboard.accepted_applications > 0) {
    actions.push({
      id: 'credentialize-offer',
      title: 'Credentialize your accepted placement',
      description: `You have ${dashboard.accepted_applications} accepted placement offer(s). Add them to your Experience Passport to earn verified employer credentials.`,
      destination: '/app/applications?status=accepted',
      ctaLabel: 'Add to Passport',
      badgeText: 'Placement Credential',
      priority: 'high',
      category: 'experience_verification',
      sourceDomain: 'student',
      notificationType: 'application_status_changed',
      count: dashboard.accepted_applications,
      icon: <ShieldCheckIcon size={20} className="cb-action-item-icon" />,
    });
  }

  // 2. High priority: upcoming interview preparation
  if (dashboard.upcoming_interviews > 0) {
    actions.push({
      id: 'interview-prep',
      title: 'Prepare for your upcoming interview',
      description: `You have ${dashboard.upcoming_interviews} scheduled interview round(s). Review recruiter notes and project talking points.`,
      destination: '/app/interviews',
      ctaLabel: 'View Interviews',
      badgeText: 'High Priority',
      priority: 'high',
      category: 'interview',
      sourceDomain: 'student',
      notificationType: 'interview_scheduled',
      count: dashboard.upcoming_interviews,
      icon: <CalendarIcon size={20} className="cb-action-item-icon" />,
    });
  }

  // 2. Profile completion if incomplete
  if (!hasCompleteProfile) {
    actions.push({
      id: 'complete-profile',
      title: 'Complete your student profile',
      description: 'Add your academic background, institution, and core skills so employers can evaluate your eligibility.',
      destination: '/app/student/profile',
      ctaLabel: 'Update Profile',
      badgeText: 'Recommended',
      priority: 'high',
      category: 'profile',
      sourceDomain: 'student',
      icon: <UserIcon size={20} className="cb-action-item-icon" />,
    });
  }

  // 3. Add project if none exists
  if (projectsCount === 0) {
    actions.push({
      id: 'add-project',
      title: 'Add your first innovation project',
      description: 'Showcase real-world artifacts, code repositories, and milestone evidence to stand out to recruiters.',
      destination: '/app/projects',
      ctaLabel: 'Add Project',
      badgeText: 'Evidence Building',
      priority: 'medium',
      category: 'project_evaluation',
      sourceDomain: 'student',
      icon: <CodeFolderIcon size={20} className="cb-action-item-icon" />,
    });
  }

  // 4. Experience verification if none exists
  if (experiencesCount === 0) {
    actions.push({
      id: 'build-experience',
      title: 'Build your experience evidence',
      description: 'Document internships, student organizations, or capstone roles and submit them for employer verification.',
      destination: '/app/experiences',
      ctaLabel: 'Manage Experiences',
      badgeText: 'Verification',
      priority: 'medium',
      category: 'experience_verification',
      sourceDomain: 'student',
      notificationType: 'experience_verification_changed',
      icon: <ShieldCheckIcon size={20} className="cb-action-item-icon" />,
    });
  }

  // 5. Review active applications if any exist
  if (dashboard.total_applications > 0) {
    actions.push({
      id: 'review-applications',
      title: 'Review your application progress',
      description: `Track status across ${dashboard.total_applications} application(s) (${dashboard.applications_under_review} in review, ${dashboard.shortlisted_applications} shortlisted).`,
      destination: '/app/applications',
      ctaLabel: 'View Applications',
      badgeText: 'Active Funnel',
      priority: 'standard',
      category: 'application',
      sourceDomain: 'student',
      notificationType: 'application_status_changed',
      count: dashboard.total_applications,
      icon: <ClipboardIcon size={20} className="cb-action-item-icon" />,
    });
  }

  // 6. Review saved jobs if any exist
  if (dashboard.saved_internships > 0) {
    actions.push({
      id: 'review-saved-jobs',
      title: 'Review your saved opportunities',
      description: `You have ${dashboard.saved_internships} opportunity bookmarks. Submit your applications before upcoming deadlines.`,
      destination: '/app/saved-jobs',
      ctaLabel: 'View Saved',
      badgeText: 'Saved Opportunities',
      priority: 'standard',
      category: 'general',
      sourceDomain: 'student',
      count: dashboard.saved_internships,
      icon: <BookmarkIcon size={20} className="cb-action-item-icon" />,
    });
  }

  // 7. Browse opportunities (always available fallback / exploration)
  actions.push({
    id: 'explore-jobs',
    title: 'Explore active internships and jobs',
    description: 'Discover new vetted roles matching your skills, academic discipline, and career interests.',
    destination: '/app/jobs',
    ctaLabel: 'Browse Opportunities',
    badgeText: 'Discovery',
    priority: 'standard',
    category: 'talent_sourcing',
    sourceDomain: 'student',
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
                <ActionCenterBadge
                  priority={action.priority}
                  label={action.badgeText}
                />
              </div>
              <h3 className="cb-career-action-title">{action.title}</h3>
              <p className="cb-career-action-desc">{action.description}</p>
            </div>
            <div className="cb-career-action-cta">
              <Link to={action.destination} className="cb-btn cb-btn-secondary cb-btn-sm cb-action-link-btn">
                <span>{action.ctaLabel}</span>
                <ArrowRightIcon size={14} />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
