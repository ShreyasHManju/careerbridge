import React, { useCallback, useEffect, useState } from 'react';
import { AdminUser, AdminUserQueryParams } from '@/types/admin';
import * as adminApi from '@/api/admin';
import { exportAdminUsers } from '@/api/export';
import { useAuth } from '@/auth/useAuth';
import { UserStatusModal } from '@/components/admin/UserStatusModal';
import { UserDetailModal } from '@/components/admin/UserDetailModal';
import { ApiErrorResponse } from '@/types/api';

export const AdminUsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;

  const [search, setSearch] = useState<string>('');
  const [role, setRole] = useState<'student' | 'recruiter' | 'admin' | ''>('');
  const [isActive, setIsActive] = useState<string>(''); // '' | 'true' | 'false'

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Modal states
  const [selectedUserForStatus, setSelectedUserForStatus] = useState<AdminUser | null>(null);
  const [selectedUserIdForDetail, setSelectedUserIdForDetail] = useState<number | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: AdminUserQueryParams = {
        page,
        page_size: pageSize,
      };
      if (search.trim()) params.search = search.trim();
      if (role) params.role = role;
      if (isActive === 'true') params.is_active = true;
      if (isActive === 'false') params.is_active = false;

      const resp = await adminApi.getAdminUsers(params);
      setUsers(resp.items);
      setTotal(resp.total);
      setTotalPages(resp.total_pages || 1);
    } catch (err: unknown) {
      const apiErr = err as ApiErrorResponse;
      setError(
        (typeof apiErr?.detail === 'string' ? apiErr.detail : null) ||
        apiErr?.message ||
        'Failed to load user accounts.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [page, search, role, isActive]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRole(e.target.value as 'student' | 'recruiter' | 'admin' | '');
    setPage(1);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setIsActive(e.target.value);
    setPage(1);
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      await exportAdminUsers();
      setActionSuccessMessage('User directory CSV exported successfully.');
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch {
      setError('Failed to export user directory CSV.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleStatusUpdateSuccess = (updatedUser: AdminUser) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === updatedUser.id ? updatedUser : u))
    );
    setActionSuccessMessage(
      `User account ${updatedUser.email} was successfully ${
        updatedUser.is_active ? 'activated' : 'deactivated'
      }.`
    );
    setTimeout(() => setActionSuccessMessage(null), 4000);
  };

  return (
    <div className="cb-admin-page-container" data-testid="admin-users-page">
      <div className="cb-page-header">
        <div className="cb-page-header-title-group">
          <h1 className="cb-page-title">User Account Administration</h1>
          <p className="cb-page-subtitle">
            Manage user accounts, roles, verification badges, and account activity.
          </p>
        </div>
        <div className="cb-page-header-actions">
          <button
            type="button"
            className="cb-btn cb-btn-secondary cb-btn-sm"
            onClick={handleExportCsv}
            disabled={isExporting}
            data-testid="export-users-btn"
          >
            {isExporting ? 'Exporting...' : '📥 Export CSV'}
          </button>
        </div>
      </div>

      {actionSuccessMessage && (
        <div className="cb-alert cb-alert-success" role="alert" style={{ marginBottom: '1.5rem' }}>
          {actionSuccessMessage}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="cb-admin-filter-bar">
        <form onSubmit={handleSearchSubmit} className="cb-admin-search-form">
          <input
            type="text"
            className="cb-input cb-input-sm"
            placeholder="Search by email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search users by email"
            data-testid="user-search-input"
          />
          <button type="submit" className="cb-btn cb-btn-primary cb-btn-sm" data-testid="search-users-btn">
            Search
          </button>
        </form>

        <div className="cb-admin-filter-group">
          <label htmlFor="role-filter" className="cb-filter-label">Role:</label>
          <select
            id="role-filter"
            className="cb-input cb-input-sm cb-select"
            value={role}
            onChange={handleRoleChange}
            data-testid="role-filter-select"
          >
            <option value="">All Roles</option>
            <option value="student">Student</option>
            <option value="recruiter">Recruiter</option>
            <option value="admin">Administrator</option>
          </select>

          <label htmlFor="status-filter" className="cb-filter-label">Status:</label>
          <select
            id="status-filter"
            className="cb-input cb-input-sm cb-select"
            value={isActive}
            onChange={handleStatusChange}
            data-testid="status-filter-select"
          >
            <option value="">All Statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      {/* Main Content State Rendering */}
      {isLoading ? (
        <div className="cb-dashboard-loading" role="status" aria-live="polite">
          <div className="cb-spinner" aria-hidden="true" />
          <p>Loading user directory...</p>
        </div>
      ) : error ? (
        <div className="cb-dashboard-error-container" role="alert">
          <div className="cb-alert cb-alert-danger">
            <p className="cb-alert-message">{error}</p>
          </div>
          <button
            type="button"
            onClick={fetchUsers}
            className="cb-btn cb-btn-primary cb-retry-btn"
            data-testid="retry-users-btn"
          >
            Retry
          </button>
        </div>
      ) : users.length === 0 ? (
        <div className="cb-empty-state" data-testid="users-empty-state">
          <h3>No User Accounts Found</h3>
          <p>No user records matched your filter and search criteria.</p>
        </div>
      ) : (
        <>
          <div className="cb-table-responsive">
            <table className="cb-table cb-table-hover" aria-label="Platform Users Table">
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Verified</th>
                  <th scope="col">Created</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = currentUser?.id === u.id;
                  return (
                    <tr key={u.id} data-testid={`user-row-${u.id}`}>
                      <td>#{u.id}</td>
                      <td>
                        <strong>{u.email}</strong>
                        {isSelf && (
                          <span className="cb-badge cb-badge-secondary" style={{ marginLeft: '0.5rem' }}>
                            You
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`cb-role-tag cb-role-${u.role}`}>{u.role}</span>
                      </td>
                      <td>
                        <span
                          className={`cb-badge ${u.is_active ? 'cb-badge-success' : 'cb-badge-danger'}`}
                        >
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        {u.is_verified ? (
                          <span className="cb-verified-badge">✓ Verified</span>
                        ) : (
                          <span className="cb-badge cb-badge-secondary">Unverified</span>
                        )}
                      </td>
                      <td>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="cb-btn-group" style={{ justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="cb-btn cb-btn-secondary cb-btn-xs"
                            onClick={() => setSelectedUserIdForDetail(u.id)}
                            data-testid={`view-user-${u.id}-btn`}
                          >
                            Details
                          </button>
                          <button
                            type="button"
                            className={`cb-btn cb-btn-xs ${
                              u.is_active ? 'cb-btn-danger' : 'cb-btn-success'
                            }`}
                            onClick={() => setSelectedUserForStatus(u)}
                            disabled={isSelf && u.is_active}
                            title={
                              isSelf && u.is_active
                                ? 'You cannot deactivate your own currently authenticated account'
                                : u.is_active
                                ? 'Deactivate this user account'
                                : 'Activate this user account'
                            }
                            data-testid={`toggle-status-${u.id}-btn`}
                          >
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Accessible Pagination Bar */}
          <div className="cb-pagination-container">
            <span className="cb-pagination-info">
              Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({total} total users)
            </span>
            <div className="cb-pagination" role="navigation" aria-label="Users pagination">
              <button
                type="button"
                className="cb-page-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                aria-label="Previous page"
                data-testid="prev-page-btn"
              >
                ← Previous
              </button>
              <button
                type="button"
                className="cb-page-btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                aria-label="Next page"
                data-testid="next-page-btn"
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}

      {/* User Status Modal */}
      <UserStatusModal
        isOpen={Boolean(selectedUserForStatus)}
        user={selectedUserForStatus}
        onClose={() => setSelectedUserForStatus(null)}
        onSuccess={handleStatusUpdateSuccess}
      />

      {/* User Detail Modal */}
      <UserDetailModal
        isOpen={Boolean(selectedUserIdForDetail)}
        userId={selectedUserIdForDetail}
        onClose={() => setSelectedUserIdForDetail(null)}
      />
    </div>
  );
};
