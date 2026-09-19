import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { UserRole } from '@/types/auth';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  children?: React.ReactNode;
}

/**
 * Route guard component:
 * - Displays loading indicator while session hydrates
 * - Redirects unauthenticated visitors to /login preserving the intended target URL
 * - Validates role authorization when allowedRoles is provided
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="cb-loading-screen" role="status" aria-live="polite">
        <div className="cb-spinner"></div>
        <p>Verifying authentication session...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="cb-forbidden-container">
        <h2>403 — Access Denied</h2>
        <p>Your account ({user.role}) does not have permission to view this resource.</p>
      </div>
    );
  }

  return children ? <>{children}</> : <Outlet />;
};
