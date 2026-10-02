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
 *
 * 1. Waits for authentication/session hydration.
 * 2. Redirects unauthenticated users to /login.
 * 3. Preserves the originally requested location when redirecting.
 * 4. Enforces allowedRoles when supplied.
 * 5. Redirects authenticated users with an unauthorized role to
 *    /unauthorized instead of rendering the protected page.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles,
  children,
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  /*
   * Authentication/session hydration.
   */
  if (isLoading) {
    return (
      <div
        className="cb-loading-screen"
        role="status"
        aria-live="polite"
      >
        <div className="cb-spinner" aria-hidden="true" />
        <p>Verifying authentication session...</p>
      </div>
    );
  }

  /*
   * Authentication protection.
   *
   * Preserve the original location so the login flow can optionally
   * return the user to the page they originally requested.
   */
  if (!isAuthenticated || !user) {
    return (
      <Navigate
        to="/login"
        state={{ from: location }}
        replace
      />
    );
  }

  /*
   * Role-based authorization.
   *
   * IMPORTANT:
   * Do not render the protected route when the user's role is not
   * allowed. Redirect to the dedicated unauthorized page instead.
   *
   * This prevents a student/recruiter from remaining on URLs such as:
   *
   *   /app/admin/users
   *   /app/admin/jobs
   *   /app/admin/recruiters
   *   /app/admin/experience-verification
   */
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <Navigate
        to="/unauthorized"
        state={{
          from: location,
          role: user.role,
        }}
        replace
      />
    );
  }

  /*
   * Authorized user.
   *
   * Support both usage patterns:
   *
   * <ProtectedRoute>...</ProtectedRoute>
   *
   * and
   *
   * <ProtectedRoute>
   *   <Outlet />
   * </ProtectedRoute>
   */
  return children ? <>{children}</> : <Outlet />;
};