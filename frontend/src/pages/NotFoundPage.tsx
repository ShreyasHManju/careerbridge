import React from 'react';
import { Link } from 'react-router-dom';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="cb-not-found">
      <h1>404</h1>
      <h2>Page Not Found</h2>
      <p>The requested route does not exist.</p>
      <Link to="/app" className="cb-btn cb-btn-primary">
        Return to Home
      </Link>
    </div>
  );
};
