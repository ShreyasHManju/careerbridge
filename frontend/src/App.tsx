import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { AppLayout } from '@/layouts/AppLayout';
import { PublicLayout } from '@/layouts/PublicLayout';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { AppHome } from '@/pages/AppHome';
import { StudentProfilePage } from '@/pages/StudentProfilePage';
import { SavedJobsPage } from '@/pages/SavedJobsPage';
import { RecruiterProfilePage } from '@/pages/RecruiterProfilePage';
import { RecruiterJobsPage } from '@/pages/RecruiterJobsPage';
import { JobDiscoveryPage } from '@/pages/JobDiscoveryPage';
import { JobDetailPage } from '@/pages/JobDetailPage';
import { StudentApplicationsPage } from '@/pages/StudentApplicationsPage';
import { RecruiterApplicationsPage } from '@/pages/RecruiterApplicationsPage';
import { StudentInterviewsPage } from '@/pages/StudentInterviewsPage';
import { RecruiterInterviewsPage } from '@/pages/RecruiterInterviewsPage';
import { MessagesPage } from '@/pages/MessagesPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export const App: React.FC = () => {
  return (
    <Routes>
      {/* Root redirect to protected /app */}
      <Route path="/" element={<Navigate to="/app" replace />} />

      {/* Public Unauthenticated Routes */}
      <Route element={<PublicLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* Protected Authenticated Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/app" element={<AppHome />} />
          {/* Opportunity Discovery Routes (all authenticated roles) */}
          <Route path="/app/jobs" element={<JobDiscoveryPage />} />
          <Route path="/app/jobs/:jobId" element={<JobDetailPage />} />
          {/* Direct & Real-Time Messaging Route (all authenticated roles) */}
          <Route path="/app/messages" element={<MessagesPage />} />
          {/* Student-only domain routes */}
          <Route element={<ProtectedRoute allowedRoles={['student']} />}>
            <Route path="/app/student/profile" element={<StudentProfilePage />} />
            <Route path="/app/saved-jobs" element={<SavedJobsPage />} />
            <Route path="/app/applications" element={<StudentApplicationsPage />} />
            <Route path="/app/interviews" element={<StudentInterviewsPage />} />
          </Route>
          {/* Recruiter-only domain routes */}
          <Route element={<ProtectedRoute allowedRoles={['recruiter']} />}>
            <Route path="/app/recruiter/profile" element={<RecruiterProfilePage />} />
            <Route path="/app/recruiter/jobs" element={<RecruiterJobsPage />} />
            <Route path="/app/recruiter/applications" element={<RecruiterApplicationsPage />} />
            <Route path="/app/recruiter/interviews" element={<RecruiterInterviewsPage />} />
          </Route>
        </Route>
      </Route>

      {/* 404 Catch-All */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
