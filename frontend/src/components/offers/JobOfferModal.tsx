import React, { useState, useEffect } from 'react';
import { JobOffer, JobOfferCreate, JobOfferUpdate } from '@/types/jobOffer';
import { createJobOffer, updateJobOffer, sendJobOffer, withdrawJobOffer, getApplicationJobOffer } from '@/api/jobOffers';
import { OfferStatusBadge } from './OfferStatusBadge';
import { ApiErrorResponse } from '@/types/api';

export interface JobOfferModalProps {
  isOpen: boolean;
  applicationId: number;
  candidateName?: string;
  jobTitle?: string;
  companyName?: string;
  existingOffer?: JobOffer | null;
  onClose: () => void;
  onSuccess: (offer: JobOffer) => void;
}

export const JobOfferModal: React.FC<JobOfferModalProps> = ({
  isOpen,
  applicationId,
  candidateName = 'Candidate',
  jobTitle = 'Position',
  companyName = 'Company',
  existingOffer = null,
  onClose,
  onSuccess,
}) => {
  const [offer, setOffer] = useState<JobOffer | null>(existingOffer);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState<boolean>(false);

  // Form Fields
  const [title, setTitle] = useState<string>('');
  const [compensation, setCompensation] = useState<string>('');
  const [currency, setCurrency] = useState<string>('USD');
  const [startDate, setStartDate] = useState<string>('');
  const [expirationDate, setExpirationDate] = useState<string>('');
  const [terms, setTerms] = useState<string>('');

  // Sync state on open or when existingOffer changes
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setSuccessMessage(null);
      setShowWithdrawConfirm(false);

      if (existingOffer) {
        setOffer(existingOffer);
        setTitle(existingOffer.title);
        setCompensation(existingOffer.compensation ? String(existingOffer.compensation) : '');
        setCurrency(existingOffer.currency || 'USD');
        setStartDate(existingOffer.start_date ? existingOffer.start_date.split('T')[0] : '');
        setExpirationDate(existingOffer.expiration_date ? existingOffer.expiration_date.split('T')[0] : '');
        setTerms(existingOffer.terms || '');
      } else {
        // Fetch existing offer for application if not passed
        setIsLoading(true);
        getApplicationJobOffer(applicationId)
          .then((fetched) => {
            setOffer(fetched);
            if (fetched) {
              setTitle(fetched.title);
              setCompensation(fetched.compensation ? String(fetched.compensation) : '');
              setCurrency(fetched.currency || 'USD');
              setStartDate(fetched.start_date ? fetched.start_date.split('T')[0] : '');
              setExpirationDate(fetched.expiration_date ? fetched.expiration_date.split('T')[0] : '');
              setTerms(fetched.terms || '');
            } else {
              // Pre-fill defaults
              setTitle(jobTitle || '');
              setCompensation('');
              setCurrency('USD');
              setStartDate('');
              setExpirationDate('');
              setTerms('');
            }
          })
          .catch(() => {
            setOffer(null);
            setTitle(jobTitle || '');
            setCompensation('');
            setCurrency('USD');
            setStartDate('');
            setExpirationDate('');
            setTerms('');
          })
          .finally(() => {
            setIsLoading(false);
          });
      }
    } else {
      setOffer(null);
    }
  }, [isOpen, applicationId, existingOffer, jobTitle]);

  // Keyboard accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        if (showWithdrawConfirm) {
          setShowWithdrawConfirm(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, showWithdrawConfirm, onClose]);

  if (!isOpen) return null;

  const isDraft = offer?.status === 'draft';
  const isOffered = offer?.status === 'offered';
  const isTerminal =
    offer?.status === 'accepted' ||
    offer?.status === 'rejected' ||
    offer?.status === 'withdrawn' ||
    offer?.status === 'expired';
  const isReadOnly = isOffered || isTerminal;

  const validateForm = (): boolean => {
    if (!title.trim()) {
      setErrorMessage('Offer title / position is required.');
      return false;
    }
    if (compensation && isNaN(Number(compensation))) {
      setErrorMessage('Compensation must be a valid number.');
      return false;
    }
    return true;
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const compVal = compensation.trim() ? Number(compensation.trim()) : undefined;

    try {
      if (offer && offer.id) {
        // Update existing draft
        const payload: JobOfferUpdate = {
          title: title.trim(),
          compensation: compVal,
          currency: currency.trim() || 'USD',
          start_date: startDate ? `${startDate}T00:00:00Z` : undefined,
          expiration_date: expirationDate ? `${expirationDate}T23:59:59Z` : undefined,
          terms: terms.trim() || undefined,
        };
        const updated = await updateJobOffer(offer.id, payload);
        setOffer(updated);
        setSuccessMessage('Job offer draft updated successfully.');
        onSuccess(updated);
      } else {
        // Create new draft
        const payload: JobOfferCreate = {
          title: title.trim(),
          compensation: compVal,
          currency: currency.trim() || 'USD',
          start_date: startDate ? `${startDate}T00:00:00Z` : undefined,
          expiration_date: expirationDate ? `${expirationDate}T23:59:59Z` : undefined,
          terms: terms.trim() || undefined,
        };
        const created = await createJobOffer(applicationId, payload);
        setOffer(created);
        setSuccessMessage('Job offer draft created successfully.');
        onSuccess(created);
      }
    } catch (err: unknown) {
      const apiErr = err as ApiErrorResponse;
      setErrorMessage(
        typeof apiErr?.detail === 'string'
          ? apiErr.detail
          : apiErr?.message || 'Failed to save job offer draft.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendOffer = async () => {
    if (!validateForm() || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const compVal = compensation.trim() ? Number(compensation.trim()) : undefined;

    try {
      if (offer && offer.id) {
        // Update draft first if changed, then send
        const payload: JobOfferUpdate = {
          title: title.trim(),
          compensation: compVal,
          currency: currency.trim() || 'USD',
          start_date: startDate ? `${startDate}T00:00:00Z` : undefined,
          expiration_date: expirationDate ? `${expirationDate}T23:59:59Z` : undefined,
          terms: terms.trim() || undefined,
        };
        await updateJobOffer(offer.id, payload);
        const sent = await sendJobOffer(offer.id);
        setOffer(sent);
        setSuccessMessage('Job offer extended and sent to candidate successfully!');
        onSuccess(sent);
      } else {
        // Create draft first, then send via POST /offers/{offerId}/send
        const payload: JobOfferCreate = {
          title: title.trim(),
          compensation: compVal,
          currency: currency.trim() || 'USD',
          start_date: startDate ? `${startDate}T00:00:00Z` : undefined,
          expiration_date: expirationDate ? `${expirationDate}T23:59:59Z` : undefined,
          terms: terms.trim() || undefined,
        };
        const created = await createJobOffer(applicationId, payload);
        const sent = await sendJobOffer(created.id);
        setOffer(sent);
        setSuccessMessage('Job offer created and sent to candidate successfully!');
        onSuccess(sent);
      }
    } catch (err: unknown) {
      const apiErr = err as ApiErrorResponse;
      setErrorMessage(
        typeof apiErr?.detail === 'string'
          ? apiErr.detail
          : apiErr?.message || 'Failed to send job offer.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdrawOffer = async () => {
    if (!offer || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const withdrawn = await withdrawJobOffer(offer.id);
      setOffer(withdrawn);
      setShowWithdrawConfirm(false);
      setSuccessMessage('Job offer has been withdrawn.');
      onSuccess(withdrawn);
    } catch (err: unknown) {
      const apiErr = err as ApiErrorResponse;
      setErrorMessage(
        typeof apiErr?.detail === 'string'
          ? apiErr.detail
          : apiErr?.message || 'Failed to withdraw job offer.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="cb-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="job-offer-modal-title"
      data-testid="job-offer-modal"
    >
      <div className="cb-modal-dialog cb-offer-modal">
        {/* Header */}
        <div className="cb-modal-header">
          <div className="cb-offer-modal-title-group">
            <h2 id="job-offer-modal-title" className="cb-modal-title">
              {offer ? 'Job Offer Management' : 'Extend Official Job Offer'}
            </h2>
            <p className="cb-modal-subtitle">
              For <strong>{candidateName}</strong> &bull; {jobTitle} at {companyName}
            </p>
          </div>
          <div className="cb-offer-modal-header-actions">
            {offer && <OfferStatusBadge status={offer.status} />}
            <button
              type="button"
              className="cb-modal-close-btn"
              onClick={onClose}
              disabled={isSubmitting}
              aria-label="Close Job Offer Modal"
              data-testid="close-offer-modal-btn"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="cb-modal-body">
          {isLoading ? (
            <div className="cb-offer-loading-state" role="status">
              <span className="cb-spinner" /> Loading offer details...
            </div>
          ) : (
            <>
              {errorMessage && (
                <div className="cb-alert cb-alert-danger" role="alert" data-testid="offer-error-alert">
                  {errorMessage}
                </div>
              )}

              {successMessage && (
                <div className="cb-alert cb-alert-success" role="alert" data-testid="offer-success-alert">
                  {successMessage}
                </div>
              )}

              {showWithdrawConfirm && (
                <div className="cb-alert cb-alert-warning cb-offer-withdraw-confirm" role="alert">
                  <p><strong>Are you sure you want to withdraw this active job offer?</strong></p>
                  <p className="cb-text-muted">The candidate will no longer be able to accept it.</p>
                  <div className="cb-offer-withdraw-actions">
                    <button
                      type="button"
                      className="cb-btn cb-btn-danger cb-btn-sm"
                      onClick={handleWithdrawOffer}
                      disabled={isSubmitting}
                      data-testid="confirm-withdraw-offer-btn"
                    >
                      {isSubmitting ? 'Withdrawing...' : 'Yes, Withdraw Offer'}
                    </button>
                    <button
                      type="button"
                      className="cb-btn cb-btn-secondary cb-btn-sm"
                      onClick={() => setShowWithdrawConfirm(false)}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleSaveDraft} className="cb-offer-form">
                <div className="cb-form-group">
                  <label htmlFor="offer-title" className="cb-form-label">
                    Position Title <span className="cb-required">*</span>
                  </label>
                  <input
                    id="offer-title"
                    type="text"
                    className="cb-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Full-Stack Software Engineer"
                    disabled={isReadOnly || isSubmitting}
                    required
                    data-testid="offer-title-input"
                  />
                </div>

                <div className="cb-form-row">
                  <div className="cb-form-group cb-form-col">
                    <label htmlFor="offer-compensation" className="cb-form-label">
                      Compensation / Salary
                    </label>
                    <input
                      id="offer-compensation"
                      type="number"
                      step="any"
                      className="cb-input"
                      value={compensation}
                      onChange={(e) => setCompensation(e.target.value)}
                      placeholder="e.g. 85000"
                      disabled={isReadOnly || isSubmitting}
                      data-testid="offer-compensation-input"
                    />
                  </div>

                  <div className="cb-form-group cb-form-col-sm">
                    <label htmlFor="offer-currency" className="cb-form-label">
                      Currency
                    </label>
                    <input
                      id="offer-currency"
                      type="text"
                      className="cb-input"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      placeholder="USD"
                      maxLength={10}
                      disabled={isReadOnly || isSubmitting}
                      data-testid="offer-currency-input"
                    />
                  </div>
                </div>

                <div className="cb-form-row">
                  <div className="cb-form-group cb-form-col">
                    <label htmlFor="offer-start-date" className="cb-form-label">
                      Expected Start Date
                    </label>
                    <input
                      id="offer-start-date"
                      type="date"
                      className="cb-input"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      disabled={isReadOnly || isSubmitting}
                      data-testid="offer-start-date-input"
                    />
                  </div>

                  <div className="cb-form-group cb-form-col">
                    <label htmlFor="offer-expiration-date" className="cb-form-label">
                      Offer Expiration Date
                    </label>
                    <input
                      id="offer-expiration-date"
                      type="date"
                      className="cb-input"
                      value={expirationDate}
                      onChange={(e) => setExpirationDate(e.target.value)}
                      disabled={isReadOnly || isSubmitting}
                      data-testid="offer-expiration-date-input"
                    />
                  </div>
                </div>

                <div className="cb-form-group">
                  <label htmlFor="offer-terms" className="cb-form-label">
                    Terms & Conditions / Offer Letter Notes
                  </label>
                  <textarea
                    id="offer-terms"
                    className="cb-textarea"
                    rows={4}
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    placeholder="Provide details about benefits, reporting structure, equipment, background check contingencies, or additional instructions..."
                    disabled={isReadOnly || isSubmitting}
                    data-testid="offer-terms-input"
                  />
                </div>
              </form>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="cb-modal-footer">
          {(!offer || isDraft) && (
            <>
              <button
                type="button"
                className="cb-btn cb-btn-secondary"
                onClick={handleSaveDraft}
                disabled={isSubmitting || isLoading}
                data-testid="save-draft-offer-btn"
              >
                {isSubmitting ? 'Saving...' : 'Save Draft'}
              </button>
              <button
                type="button"
                className="cb-btn cb-btn-primary"
                onClick={handleSendOffer}
                disabled={isSubmitting || isLoading}
                data-testid="send-offer-btn"
              >
                {isSubmitting ? 'Sending...' : '🚀 Send Offer to Candidate'}
              </button>
            </>
          )}

          {isOffered && !showWithdrawConfirm && (
            <button
              type="button"
              className="cb-btn cb-btn-outline-danger"
              onClick={() => setShowWithdrawConfirm(true)}
              disabled={isSubmitting || isLoading}
              data-testid="withdraw-offer-trigger-btn"
            >
              Withdraw Offer
            </button>
          )}

          <button
            type="button"
            className="cb-btn cb-btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
            data-testid="close-offer-footer-btn"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
