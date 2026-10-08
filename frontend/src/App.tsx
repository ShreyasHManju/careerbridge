import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { AppLayout } from '@/layouts/AppLayout';
import { PublicLayout } from '@/layouts/PublicLayout';
import { RouteLoadingFallback } from '@/components/ui/RouteLoadingFallback';

// Eager Authentication & Core Pages
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { SecuritySettingsPage } from '@/pages/SecuritySettingsPage';
import { AppHome } from '@/pages/AppHome';
import { UnauthorizedPage } from '@/pages/UnauthorizedPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

// Eager Core Discovery & Student Feature Pages
import { StudentProfilePage } from '@/pages/StudentProfilePage';
import { StudentProjectsPage } from '@/pages/StudentProjectsPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { SavedJobsPage } from '@/pages/SavedJobsPage';
import { JobDiscoveryPage } from '@/pages/JobDiscoveryPage';
import { JobDetailPage } from '@/pages/JobDetailPage';
import { StudentApplicationsPage } from '@/pages/StudentApplicationsPage';
import { StudentInvitationsPage } from '@/pages/StudentInvitationsPage';
import { StudentInterviewsPage } from '@/pages/StudentInterviewsPage';
import { StudentExperiencesPage } from '@/pages/StudentExperiencesPage';
import { PassportPage } from '@/pages/PassportPage';

// Lazy-Loaded Heavy Shared Feature Pages
const ProjectDetailPage = React.lazy(() =>
  import('@/pages/ProjectDetailPage').then((m) => ({ default: m.ProjectDetailPage }))
);
const MessagesPage = React.lazy(() =>
  import('@/pages/MessagesPage').then((m) => ({ default: m.MessagesPage }))
);
const NotificationsPage = React.lazy(() =>
  import('@/pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage }))
);

// Lazy-Loaded Public Career Passport
const PublicPassportPage = React.lazy(() =>
  import('@/pages/PublicPassportPage').then((m) => ({ default: m.PublicPassportPage }))
);

// Lazy-Loaded Recruiter Domain Pages
const RecruiterProfilePage = React.lazy(() =>
  import('@/pages/RecruiterProfilePage').then((m) => ({ default: m.RecruiterProfilePage }))
);
const RecruiterJobsPage = React.lazy(() =>
  import('@/pages/RecruiterJobsPage').then((m) => ({ default: m.RecruiterJobsPage }))
);
const RecruiterCandidatesPage = React.lazy(() =>
  import('@/pages/RecruiterCandidatesPage').then((m) => ({ default: m.RecruiterCandidatesPage }))
);
const RecruiterApplicationsPage = React.lazy(() =>
  import('@/pages/RecruiterApplicationsPage').then((m) => ({ default: m.RecruiterApplicationsPage }))
);
const RecruiterInterviewsPage = React.lazy(() =>
  import('@/pages/RecruiterInterviewsPage').then((m) => ({ default: m.RecruiterInterviewsPage }))
);
const RecruiterExperienceVerificationPage = React.lazy(() =>
  import('@/pages/RecruiterExperienceVerificationPage').then((m) => ({
    default: m.RecruiterExperienceVerificationPage,
  }))
);

// Lazy-Loaded Admin Domain Pages
const AdminUsersPage = React.lazy(() =>
  import('@/pages/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage }))
);
const AdminRecruitersPage = React.lazy(() =>
  import('@/pages/AdminRecruitersPage').then((m) => ({ default: m.AdminRecruitersPage }))
);
const AdminJobsPage = React.lazy(() =>
  import('@/pages/AdminJobsPage').then((m) => ({ default: m.AdminJobsPage }))
);
const AdminExperienceVerificationPage = React.lazy(() =>
  import('@/pages/AdminExperienceVerificationPage').then((m) => ({
    default: m.AdminExperienceVerificationPage,
  }))
);

export const App: React.FC = () => {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        {/* Root redirect to protected /app */}
        <Route path="/" element={<Navigate to="/app" replace />} />

        {/* Public Unauthenticated Routes */}
        <Route element={<PublicLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>

        {/* Public Career Passport Sharing Route (Unauthenticated) */}
        <Route path="/p/:shareToken" element={<PublicPassportPage />} />

        {/* Protected Authenticated Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/app" element={<AppHome />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            <Route path="/app/security" element={<SecuritySettingsPage />} />
            {/* Opportunity Discovery Routes (all authenticated roles) */}
            <Route path="/app/jobs" element={<JobDiscoveryPage />} />
            <Route path="/app/jobs/:jobId" element={<JobDetailPage />} />
            {/* Innovation Projects Discovery & Detail Routes (all authenticated roles) */}
            <Route path="/app/explore-projects" element={<ProjectsPage />} />
            <Route path="/app/projects/:projectId" element={<ProjectDetailPage />} />
            {/* Experience Passport Read-Only Detail Route (all authenticated roles) */}
            <Route path="/app/passport/:studentId" element={<PassportPage />} />
            {/* Direct & Real-Time Messaging Route (all authenticated roles) */}
            <Route path="/app/messages" element={<MessagesPage />} />
            {/* Notifications Center Route (all authenticated roles) */}
            <Route path="/app/notifications" element={<NotificationsPage />} />
            {/* Student-only domain routes */}
            <Route element={<ProtectedRoute allowedRoles={['student']} />}>
              <Route path="/app/student/profile" element={<StudentProfilePage />} />
              <Route path="/app/passport" element={<PassportPage />} />
              <Route path="/app/projects" element={<StudentProjectsPage />} />
              <Route path="/app/experiences" element={<StudentExperiencesPage />} />
              <Route path="/app/saved-jobs" element={<SavedJobsPage />} />
              <Route path="/app/applications" element={<StudentApplicationsPage />} />
              <Route path="/app/invitations" element={<StudentInvitationsPage />} />
              <Route path="/app/student/invitations" element={<StudentInvitationsPage />} />
              <Route path="/app/interviews" element={<StudentInterviewsPage />} />
            </Route>
            {/* Recruiter-only domain routes */}
            <Route element={<ProtectedRoute allowedRoles={['recruiter']} />}>
              <Route path="/app/recruiter/candidates" element={<RecruiterCandidatesPage />} />
              <Route path="/app/recruiter/profile" element={<RecruiterProfilePage />} />
              <Route path="/app/recruiter/jobs" element={<RecruiterJobsPage />} />
              <Route path="/app/recruiter/applications" element={<RecruiterApplicationsPage />} />
              <Route path="/app/recruiter/interviews" element={<RecruiterInterviewsPage />} />
              <Route
                path="/app/recruiter/experiences/verification"
                element={<RecruiterExperienceVerificationPage />}
              />
              <Route
                path="/app/recruiter/experience-verification"
                element={<RecruiterExperienceVerificationPage />}
              />
              <Route path="/app/recruiter/passport/:studentId" element={<PassportPage />} />
            </Route>
            {/* Admin-only domain routes */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/app/admin/users" element={<AdminUsersPage />} />
              <Route path="/app/admin/recruiters" element={<AdminRecruitersPage />} />
              <Route path="/app/admin/jobs" element={<AdminJobsPage />} />
              <Route
                path="/app/admin/experiences/verification"
                element={<AdminExperienceVerificationPage />}
              />
              <Route
                path="/app/admin/experience-verification"
                element={<AdminExperienceVerificationPage />}
              />
            </Route>
          </Route>
        </Route>

        {/* 404 Catch-All */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
};
