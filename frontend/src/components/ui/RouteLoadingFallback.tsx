import React from 'react';

interface RouteLoadingFallbackProps {
  message?: string;
}

export const RouteLoadingFallback: React.FC<RouteLoadingFallbackProps> = ({
  message = 'Loading...',
}) => {
  return (
    <div
      className="cb-loading-screen"
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="cb-spinner" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
};
