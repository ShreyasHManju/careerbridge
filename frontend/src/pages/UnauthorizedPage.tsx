import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';

export const UnauthorizedPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const stateRole = (location.state as { role?: string })?.role;
  const role = user?.role || stateRole || 'user';

  return (
    <div className="cb-forbidden-container" role="alert">
      <h2>403 — Access Denied</h2>
      <p>Your account ({role}) does not have permission to view this resource.</p>
      <Link to="/app" className="cb-btn cb-btn-primary" style={{ marginTop: '1.5rem' }}>
        Return to Dashboard
      </Link>
    </div>
  );
};
