import React, { useCallback, useEffect, useState } from 'react';
import { AdminRecruiter, AdminRecruiterQueryParams } from '@/types/admin';
import * as adminApi from '@/api/admin';
import { RecruiterVerificationModal } from '@/components/admin/RecruiterVerificationModal';
import { ApiErrorResponse } from '@/types/api';

export const AdminRecruitersPage: React.FC = () => {
  const [recruiters, setRecruiters] = useState<AdminRecruiter[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;

  const [search, setSearch] = useState<string>('');
  const [isVerified, setIsVerified] = useState<string>(''); // '' | 'true' | 'false'

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  const [selectedRecruiterForVerify, setSelectedRecruiterForVerify] = useState<AdminRecruiter | null>(null);

  const fetchRecruiters = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: AdminRecruiterQueryParams = {
        page,
        page_size: pageSize,
      };
      if (search.trim()) params.search = search.trim();
      if (isVerified === 'true') params.is_verified = true;
      if (isVerified === 'false') params.is_verified = false;

      const resp = await adminApi.getAdminRecruiters(params);
      setRecruiters(resp.items);
      setTotal(resp.total);
      setTotalPages(resp.total_pages || 1);
    } catch (err: unknown) {
      const apiErr = err as ApiErrorResponse;
      setError(
        (typeof apiErr?.detail === 'string' ? apiErr.detail : null) ||
        apiErr?.message ||
        'Failed to load recruiter organizations.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [page, search, isVerified]);

  useEffect(() => {
    fetchRecruiters();
  }, [fetchRecruiters]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchRecruiters();
  };

  const handleVerificationFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setIsVerified(e.target.value);
    setPage(1);
  };

  const handleVerificationSuccess = (updatedRecruiter: AdminRecruiter) => {
    setRecruiters((prev) =>
      prev.map((r) => (r.id === updatedRecruiter.id ? updatedRecruiter : r))
    );
    setActionSuccessMessage(
      `Recruiter organization '${updatedRecruiter.company_name}' verification status was updated to ${
        updatedRecruiter.is_verified ? 'Verified' : 'Unverified'
      }.`
    );
    setTimeout(() => setActionSuccessMessage(null), 4000);
  };

  return (
    <div className="cb-admin-page-container" data-testid="admin-recruiters-page">
      <div className="cb-page-header">
        <div className="cb-page-header-title-group">
          <h1 className="cb-page-title">Recruiter Organization Verification</h1>
          <p className="cb-page-subtitle">
            Review company credentials, moderate hiring organizations, and grant institutional verification badges.
          </p>
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
            placeholder="Search company, contact, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search recruiters"
            data-testid="recruiter-search-input"
          />
          <button type="submit" className="cb-btn cb-btn-primary cb-btn-sm" data-testid="search-recruiters-btn">
            Search
          </button>
        </form>

        <div className="cb-admin-filter-group">
          <label htmlFor="verification-filter" className="cb-filter-label">Verification:</label>
          <select
            id="verification-filter"
            className="cb-input cb-input-sm cb-select"
            value={isVerified}
            onChange={handleVerificationFilterChange}
            data-testid="verification-filter-select"
          >
            <option value="">All Organizations</option>
            <option value="true">Verified</option>
            <option value="false">Unverified</option>
          </select>
        </div>
      </div>

      {/* Main Content States */}
      {isLoading ? (
        <div className="cb-dashboard-loading" role="status" aria-live="polite">
          <div className="cb-spinner" aria-hidden="true" />
          <p>Loading recruiter organizations...</p>
        </div>
      ) : error ? (
        <div className="cb-dashboard-error-container" role="alert">
          <div className="cb-alert cb-alert-danger">
            <p className="cb-alert-message">{error}</p>
          </div>
          <button
            type="button"
            onClick={fetchRecruiters}
            className="cb-btn cb-btn-primary cb-retry-btn"
            data-testid="retry-recruiters-btn"
          >
            Retry
          </button>
        </div>
      ) : recruiters.length === 0 ? (
        <div className="cb-empty-state" data-testid="recruiters-empty-state">
          <h3>No Recruiter Profiles Found</h3>
          <p>No organization profiles matched your filter and search criteria.</p>
        </div>
      ) : (
        <>
          <div className="cb-table-responsive">
            <table className="cb-table cb-table-hover" aria-label="Recruiter Organizations Table">
              <thead>
                <tr>
                  <th scope="col">Company</th>
                  <th scope="col">Contact</th>
                  <th scope="col">Email</th>
                  <th scope="col">Location</th>
                  <th scope="col">Industry / Size</th>
                  <th scope="col">Status</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recruiters.map((r) => (
                  <tr key={r.id} data-testid={`recruiter-row-${r.id}`}>
                    <td>
                      <div>
                        <strong>{r.company_name}</strong>
                        {r.company_website && (
                          <div style={{ fontSize: '0.8rem' }}>
                            <a
                              href={r.company_website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="cb-link"
                            >
                              {r.company_website.replace(/^https?:\/\//, '')} ↗
                            </a>
                          </div>
                        )}
                      </div>
                    </td>
                    <td>{r.contact_name || '—'}</td>
                    <td>{r.email || '—'}</td>
                    <td>{r.company_location || '—'}</td>
                    <td>
                      <div>{r.industry || '—'}</div>
                      {r.company_size && (
                        <small className="cb-text-muted">{r.company_size} employees</small>
                      )}
                    </td>
                    <td>
                      {r.is_verified ? (
                        <span className="cb-verified-badge" data-testid={`verified-badge-${r.id}`}>
                          ✓ Verified
                        </span>
                      ) : (
                        <span className="cb-badge cb-badge-secondary" data-testid={`unverified-badge-${r.id}`}>
                          Unverified
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className={`cb-btn cb-btn-xs ${
                          r.is_verified ? 'cb-btn-warning' : 'cb-btn-primary'
                        }`}
                        onClick={() => setSelectedRecruiterForVerify(r)}
                        data-testid={`toggle-verify-${r.id}-btn`}
                      >
                        {r.is_verified ? 'Unverify' : 'Verify Organization'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="cb-pagination-container">
            <span className="cb-pagination-info">
              Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({total} total organizations)
            </span>
            <div className="cb-pagination" role="navigation" aria-label="Recruiters pagination">
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

      {/* Recruiter Verification Modal */}
      <RecruiterVerificationModal
        isOpen={Boolean(selectedRecruiterForVerify)}
        recruiter={selectedRecruiterForVerify}
        onClose={() => setSelectedRecruiterForVerify(null)}
        onSuccess={handleVerificationSuccess}
      />
    </div>
  );
};
