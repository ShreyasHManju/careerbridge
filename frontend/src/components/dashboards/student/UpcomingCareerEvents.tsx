import React from 'react';
import { Link } from 'react-router-dom';
import { StudentDashboard } from '@/types/dashboard';
import { CalendarIcon, BookmarkIcon, SearchIcon, ClipboardIcon, UserIcon, ArrowRightIcon } from './StudentDashboardIcons';

interface UpcomingCareerEventsProps {
  dashboard: StudentDashboard;
}

export const UpcomingCareerEvents: React.FC<UpcomingCareerEventsProps> = ({ dashboard }) => {
  return (
    <section className="cb-events-and-resources-section" aria-labelledby="upcoming-events-heading">
      <div className="cb-events-resources-grid">
        {/* Left Column: Scheduled Events & Bookmarks */}
        <div className="cb-events-column">
          <div className="cb-section-header">
            <h2 id="upcoming-events-heading" className="cb-section-title">
              Upcoming Milestones
            </h2>
            <p className="cb-section-subtitle">
              Active schedules and bookmarked deadlines requiring your attention.
            </p>
          </div>

          <div className="cb-event-cards-stack">
            {/* Interviews Card */}
            <div className="cb-event-status-card">
              <div className="cb-event-status-icon cb-icon-primary">
                <CalendarIcon size={22} />
              </div>
              <div className="cb-event-status-info">
                <div className="cb-event-status-header">
                  <h3 className="cb-event-status-title">Upcoming Interviews</h3>
                  <span className="cb-event-count-badge">{dashboard.upcoming_interviews} Scheduled</span>
                </div>
                <p className="cb-event-status-desc">
                  {dashboard.upcoming_interviews > 0
                    ? `You have ${dashboard.upcoming_interviews} active interview round(s) arranged by recruiters.`
                    : 'No upcoming interviews scheduled at this time.'}
                </p>
                <Link to="/app/interviews" className="cb-event-link">
                  <span>Manage Interviews</span>
                  <ArrowRightIcon size={14} />
                </Link>
              </div>
            </div>

            {/* Saved Opportunities Card */}
            <div className="cb-event-status-card">
              <div className="cb-event-status-icon cb-icon-warning">
                <BookmarkIcon size={22} />
              </div>
              <div className="cb-event-status-info">
                <div className="cb-event-status-header">
                  <h3 className="cb-event-status-title">Saved Opportunities</h3>
                  <span className="cb-event-count-badge">{dashboard.saved_internships} Bookmarked</span>
                </div>
                <p className="cb-event-status-desc">
                  {dashboard.saved_internships > 0
                    ? `You have ${dashboard.saved_internships} saved role(s) ready for application submission.`
                    : 'No saved opportunities. Bookmark roles to apply later.'}
                </p>
                <Link to="/app/saved-jobs" className="cb-event-link">
                  <span>View Saved Postings</span>
                  <ArrowRightIcon size={14} />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Quick Resources & Navigation */}
        <div className="cb-resources-column">
          <div className="cb-section-header">
            <h2 id="student-quick-actions-heading" className="cb-section-title">
              Quick Actions & Resources
            </h2>
            <p className="cb-section-subtitle">
              Jump directly to primary student workflow destinations.
            </p>
          </div>

          <div className="cb-action-grid">
            <Link to="/app/jobs" className="cb-action-card" data-testid="quick-link-jobs">
              <div className="cb-action-card-body">
                <span className="cb-action-icon" aria-hidden="true">
                  <SearchIcon size={20} />
                </span>
                <div>
                  <h3 className="cb-action-title">Browse Opportunities</h3>
                  <p className="cb-action-desc">
                    Discover new active job and internship postings with custom search and filters.
                  </p>
                </div>
              </div>
            </Link>

            <Link to="/app/applications" className="cb-action-card" data-testid="quick-link-applications">
              <div className="cb-action-card-body">
                <span className="cb-action-icon" aria-hidden="true">
                  <ClipboardIcon size={20} />
                </span>
                <div>
                  <h3 className="cb-action-title">My Applications</h3>
                  <p className="cb-action-desc">
                    Track the real-time review status of all your submitted candidate applications.
                  </p>
                </div>
              </div>
            </Link>

            <Link to="/app/interviews" className="cb-action-card" data-testid="quick-link-interviews">
              <div className="cb-action-card-body">
                <span className="cb-action-icon" aria-hidden="true">
                  <CalendarIcon size={20} />
                </span>
                <div>
                  <h3 className="cb-action-title">My Interviews</h3>
                  <p className="cb-action-desc">
                    View scheduled dates, durations, meeting links, and recruiter notes.
                  </p>
                </div>
              </div>
            </Link>

            <Link to="/app/student/profile" className="cb-action-card" data-testid="quick-link-profile">
              <div className="cb-action-card-body">
                <span className="cb-action-icon" aria-hidden="true">
                  <UserIcon size={20} />
                </span>
                <div>
                  <h3 className="cb-action-title">My Profile & Resume</h3>
                  <p className="cb-action-desc">
                    Update your contact details, education, skills, and resume document.
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
