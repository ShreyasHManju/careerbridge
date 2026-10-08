import React from 'react';
import { ChangePasswordCard } from '@/components/auth/ChangePasswordCard';
import { useAuth } from '@/auth/useAuth';

export const SecuritySettingsPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="cb-container" style={{ maxWidth: '640px', margin: '2rem auto', padding: '0 1rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.5rem', color: 'var(--cb-text)' }}>
          Security & Account Settings
        </h1>
        <p style={{ margin: 0, color: 'var(--cb-text-muted)', fontSize: '0.95rem' }}>
          Manage your account credentials and security preferences.
        </p>
      </div>

      <div className="cb-security-user-info cb-glass-card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--cb-text-muted)' }}>
              Signed in as
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--cb-text)' }}>
              {user?.email}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className={`cb-role-tag cb-role-${user?.role || 'student'}`}>
              {user?.role}
            </span>
            {user?.is_verified && (
              <span className="cb-verified-badge" title="Verified Account">✓ Verified</span>
            )}
          </div>
        </div>
      </div>

      <ChangePasswordCard />
    </div>
  );
};
