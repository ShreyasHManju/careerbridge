import React, { useState, useEffect } from 'react';
import { JobOffer } from '@/types/jobOffer';
import { JobPosting } from '@/types/job';
import { acceptJobOffer, rejectJobOffer, getJobOfferById } from '@/api/jobOffers';
import { OfferStatusBadge } from './OfferStatusBadge';
import { ApiErrorResponse } from '@/types/api';

export interface StudentOfferDecisionModalProps {
  isOpen: boolean;
  offer: JobOffer;
  job?: JobPosting | null;
  onClose: () => void;
  onDecisionComplete: (updatedOffer: JobOffer, decision: 'accepted' | 'rejected') => void;
}

const formatDate = (isoString?: string | null): string => {
  if (!isoString) return 'Not specified';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
};

const formatCurrency = (amount?: number | null, currency: string = 'USD'): string => {
  if (amount === undefined || amount === null) return 'Compensation not specified';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
};

export const StudentOfferDecisionModal: React.FC<StudentOfferDecisionModalProps> = ({
  isOpen,
  offer: initialOffer,
  job,
  onClose,
  onDecisionComplete,
}) => {
  const [offer, setOffer] = useState<JobOffer>(initialOffer);
  const [decisionStep, setDecisionStep] = useState<'view' | 'confirm_accept' | 'confirm_reject'>('view');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isRefetching, setIsRefetching] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setOffer(initialOffer);
      setDecisionStep('view');
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen, initialOffer]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        if (decisionStep !== 'view') {
          setDecisionStep('view');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, decisionStep, onClose]);

  if (!isOpen) return null;

  const jobTitle = offer.title || job?.title || 'Job Opportunity';
  const companyName = job?.company_name || 'Hiring Organization';
  const isOffered = offer.status === 'offered';

  const refetchOffer = async () => {
    setIsRefetching(true);
    try {
      const fresh = await getJobOfferById(offer.id);
      setOffer(fresh);
    } catch {
      // Quiet fallback
    } finally {
      setIsRefetching(false);
    }
  };

  const handleAccept = async () => {
    if (isSubmitting || !isOffered) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const updated = await acceptJobOffer(offer.id);
      setOffer(updated);
      setDecisionStep('view');
      setSuccessMessage('Congratulations! You have accepted the job offer. Your Experience Passport will now reflect this verified experience.');
      onDecisionComplete(updated, 'accepted');
    } catch (err: unknown) {
      const apiErr = err as ApiErrorResponse;
      const msg = typeof apiErr?.detail === 'string'
        ? apiErr.detail
        : apiErr?.message || 'Failed to accept job offer. Please try again.';
      setErrorMessage(msg);
      setDecisionStep('view');
      // Refetch current state in case offer was withdrawn or expired
      await refetchOffer();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (isSubmitting || !isOffered) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const updated = await rejectJobOffer(offer.id);
      setOffer(updated);
      setDecisionStep('view');
      setSuccessMessage('You have declined the job offer. The recruiter has been notified.');
      onDecisionComplete(updated, 'rejected');
    } catch (err: unknown) {
      const apiErr = err as ApiErrorResponse;
      const msg = typeof apiErr?.detail === 'string'
        ? apiErr.detail
        : apiErr?.message || 'Failed to decline job offer. Please try again.';
      setErrorMessage(msg);
      setDecisionStep('view');
      // Refetch current state
      await refetchOffer();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="cb-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-offer-modal-title"
      data-testid="student-offer-decision-modal"
    >
      <div className="cb-modal-dialog cb-offer-decision-modal">
        {/* Header */}
        <div className="cb-modal-header">
          <div className="cb-offer-modal-title-group">
            <span className="cb-offer-tag">Official Job Offer</span>
            <h2 id="student-offer-modal-title" className="cb-modal-title">
              {jobTitle}
            </h2>
            <p className="cb-modal-subtitle">{companyName}</p>
          </div>
          <div className="cb-offer-modal-header-actions">
            <OfferStatusBadge status={offer.status} />
            <button
              type="button"
              className="cb-modal-close-btn"
              onClick={onClose}
              disabled={isSubmitting}
              aria-label="Close Offer Details Modal"
              data-testid="close-student-offer-modal-btn"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="cb-modal-body">
          {errorMessage && (
            <div className="cb-alert cb-alert-danger" role="alert" data-testid="student-offer-error-alert">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="cb-alert cb-alert-success" role="alert" data-testid="student-offer-success-alert">
              {successMessage}
            </div>
          )}

          {decisionStep === 'confirm_accept' && (
            <div className="cb-alert cb-alert-success cb-decision-confirm-box" role="alert" data-testid="accept-confirm-box">
              <h3><strong>Accept this Job Offer?</strong></h3>
              <p>
                By accepting, your application status will become <strong>Accepted</strong> and a verified
                Experience Record will be added to your <strong>Career Passport</strong>.
              </p>
              <div className="cb-decision-confirm-actions">
                <button
                  type="button"
                  className="cb-btn cb-btn-success"
                  onClick={handleAccept}
                  disabled={isSubmitting}
                  data-testid="confirm-accept-btn"
                >
                  {isSubmitting ? 'Accepting Offer...' : 'Yes, Accept Offer 🎉'}
                </button>
                <button
                  type="button"
                  className="cb-btn cb-btn-secondary"
                  onClick={() => setDecisionStep('view')}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {decisionStep === 'confirm_reject' && (
            <div className="cb-alert cb-alert-warning cb-decision-confirm-box" role="alert" data-testid="reject-confirm-box">
              <h3><strong>Decline this Job Offer?</strong></h3>
              <p>
                Are you sure you want to decline? Your application will be marked as <strong>Declined</strong> and
                the employer will be notified. This action is final.
              </p>
              <div className="cb-decision-confirm-actions">
                <button
                  type="button"
                  className="cb-btn cb-btn-danger"
                  onClick={handleReject}
                  disabled={isSubmitting}
                  data-testid="confirm-reject-btn"
                >
                  {isSubmitting ? 'Declining Offer...' : 'Yes, Decline Offer'}
                </button>
                <button
                  type="button"
                  className="cb-btn cb-btn-secondary"
                  onClick={() => setDecisionStep('view')}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Offer Details Grid */}
          <div className="cb-offer-details-grid">
            <div className="cb-offer-detail-card">
              <span className="cb-offer-detail-label">Position</span>
              <strong className="cb-offer-detail-value">{offer.title}</strong>
            </div>

            <div className="cb-offer-detail-card">
              <span className="cb-offer-detail-label">Compensation</span>
              <strong className="cb-offer-detail-value cb-offer-compensation">
                {formatCurrency(offer.compensation, offer.currency)}
              </strong>
            </div>

            <div className="cb-offer-detail-card">
              <span className="cb-offer-detail-label">Expected Start Date</span>
              <span className="cb-offer-detail-value">{formatDate(offer.start_date)}</span>
            </div>

            <div className="cb-offer-detail-card">
              <span className="cb-offer-detail-label">Offer Expiration</span>
              <span className="cb-offer-detail-value cb-offer-expiration">
                {formatDate(offer.expiration_date)}
              </span>
            </div>
          </div>

          {/* Terms and Conditions */}
          {offer.terms && (
            <div className="cb-offer-terms-section">
              <h4 className="cb-offer-terms-heading">Offer Terms & Details</h4>
              <div className="cb-offer-terms-content">
                <p>{offer.terms}</p>
              </div>
            </div>
          )}

          {/* Status Context Banners for Non-Offered States */}
          {offer.status === 'accepted' && (
            <div className="cb-alert cb-alert-info" role="status">
              ✨ <strong>Offer Accepted:</strong> This offer was accepted. Your verified credentials and experience are available in your Career Passport.
            </div>
          )}

          {offer.status === 'rejected' && (
            <div className="cb-alert cb-alert-secondary" role="status">
              This job offer was declined.
            </div>
          )}

          {offer.status === 'withdrawn' && (
            <div className="cb-alert cb-alert-warning" role="status">
              This job offer was withdrawn by the employer.
            </div>
          )}

          {offer.status === 'expired' && (
            <div className="cb-alert cb-alert-warning" role="status">
              The response window for this job offer has expired.
            </div>
          )}
        </div>

        {/* Footer with Action Controls */}
        <div className="cb-modal-footer">
          {isOffered && decisionStep === 'view' && !successMessage && (
            <>
              <button
                type="button"
                className="cb-btn cb-btn-success"
                onClick={() => setDecisionStep('confirm_accept')}
                disabled={isSubmitting || isRefetching}
                data-testid="accept-offer-trigger-btn"
              >
                ✅ Accept Offer
              </button>
              <button
                type="button"
                className="cb-btn cb-btn-outline-danger"
                onClick={() => setDecisionStep('confirm_reject')}
                disabled={isSubmitting || isRefetching}
                data-testid="reject-offer-trigger-btn"
              >
                ❌ Decline Offer
              </button>
            </>
          )}

          <button
            type="button"
            className="cb-btn cb-btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
            data-testid="close-student-offer-footer-btn"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
