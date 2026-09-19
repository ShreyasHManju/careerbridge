import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { AppLayout } from '@/layouts/AppLayout';
import { PublicLayout } from '@/layouts/PublicLayout';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { AppHome } from '@/pages/AppHome';
import { StudentProfilePage } from '@/pages/StudentProfilePage';
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
          {/* Student-only domain routes */}
          <Route element={<ProtectedRoute allowedRoles={['student']} />}>
            <Route path="/app/student/profile" element={<StudentProfilePage />} />
          </Route>
        </Route>
      </Route>

      {/* 404 Catch-All */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
