import React from 'react';
import { useAuth } from '@/auth/useAuth';

/**
 * Minimal Authenticated Landing Placeholder
 * Proves that protected routing, JWT token injection, and session hydration work.
 * (Feature dashboards will be developed in later roadmap phases).
 */
export const AppHome: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="cb-home-container">
      <div className="cb-card cb-welcome-card">
        <h2>Frontend Foundation Active</h2>
        <p className="cb-subtitle">
          Protected routing, centralized API client, and authentication session verified.
        </p>

        {user && (
          <div className="cb-profile-summary">
            <h3>Authenticated User Identity</h3>
            <dl className="cb-dl">
              <div className="cb-dl-row">
                <dt>User ID:</dt>
                <dd>{user.id}</dd>
              </div>
              <div className="cb-dl-row">
                <dt>Email:</dt>
                <dd>{user.email}</dd>
              </div>
              <div className="cb-dl-row">
                <dt>Assigned Role:</dt>
                <dd>
                  <span className={`cb-role-tag cb-role-${user.role}`}>
                    {user.role}
                  </span>
                </dd>
              </div>
              <div className="cb-dl-row">
                <dt>Account Active:</dt>
                <dd>{user.is_active ? 'Active' : 'Inactive'}</dd>
              </div>
              <div className="cb-dl-row">
                <dt>Platform Verified:</dt>
                <dd>{user.is_verified ? 'Yes (Verified)' : 'No (Standard)'}</dd>
              </div>
              <div className="cb-dl-row">
                <dt>Account Created:</dt>
                <dd>{new Date(user.created_at).toLocaleString()}</dd>
              </div>
            </dl>
          </div>
        )}

        <div className="cb-roadmap-info">
          <h4>Next Milestones on Roadmap:</h4>
          <ul>
            <li>Phase F-03: Student Profile & Resume Management</li>
            <li>Phase F-04: Candidate Opportunity Discovery</li>
            <li>Phase F-05: Application Submission & Saved Jobs</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
