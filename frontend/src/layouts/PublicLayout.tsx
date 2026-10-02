import React from 'react';
import { Outlet } from 'react-router-dom';

/**
 * Public Layout Container
 * Used for authentication flows (Login and Register)
 */
export const PublicLayout: React.FC = () => {
  return (
    <div className="cb-public-layout">
      <Outlet />
    </div>
  );
};
