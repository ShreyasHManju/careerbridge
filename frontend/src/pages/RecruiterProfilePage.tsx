import React, { useCallback, useEffect, useState } from 'react';
import {
  getRecruiterProfileApi,
  createRecruiterProfileApi,
  updateRecruiterProfileApi,
} from '@/api/recruiterProfile';
import {
  RecruiterProfile,
  RecruiterProfileCreateRequest,
  RecruiterProfileUpdateRequest,
} from '@/types/recruiterProfile';
import { ApiErrorResponse, ValidationErrorDetail } from '@/types/api';

interface RecruiterFormData {
  company_name: string;
  company_description: string;
  contact_name: string;
  phone: string;
  company_website: string;
  company_location: string;
  industry: string;
  company_size: string;
}

const initialFormState: RecruiterFormData = {
  company_name: '',
  company_description: '',
  contact_name: '',
  phone: '',
  company_website: '',
  company_location: '',
  industry: '',
  company_size: '',
};

export const RecruiterProfilePage: React.FC = () => {
  const [formData, setFormData] = useState<RecruiterFormData>(initialFormState);
  const [profile, setProfile] = useState<RecruiterProfile | null>(null);
  const [isExistingProfile, setIsExistingProfile] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [initialLoadError, setInitialLoadError] = useState<{ status?: number; message: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const populateForm = (data: RecruiterProfile) => {
    setProfile(data);
    setIsExistingProfile(true);
    setFormData({
      company_name: data.company_name || '',
      company_description: data.company_description || '',
      contact_name: data.contact_name || '',
      phone: data.phone || '',
      company_website: data.company_website || '',
      company_location: data.company_location || '',
      industry: data.industry || '',
      company_size: data.company_size || '',
    });
  };

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setInitialLoadError(null);
    setFormError(null);
    setSuccessMessage(null);
    setFieldErrors({});

    try {
      const data = await getRecruiterProfileApi();
      populateForm(data);
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      const status = apiError?.status;

      if (status === 404) {
        // Case B: Profile does not exist yet (Normal first-time onboarding state)
        setIsExistingProfile(false);
        setProfile(null);
        setFormData(initialFormState);
      } else if (status === 403) {
        setInitialLoadError({
          status: 403,
          message: 'You do not have permission to access the recruiter profile.',
        });
      } else if (status === 401) {
        setInitialLoadError({
          status: 401,
          message: 'Your session is not authenticated. Please log in again.',
        });
      } else if (status && status >= 500) {
        setInitialLoadError({
          status,
          message: 'Service is temporarily unavailable. Please try again.',
        });
      } else {
        setInitialLoadError({
          status,
          message: apiError?.message || 'Unable to connect to CareerBridge server. Please check your network.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Company Name: Required, 2-150 characters
    const trimmedCompanyName = formData.company_name.trim();
    if (!trimmedCompanyName) {
      errors.company_name = 'Company name is required.';
    } else if (trimmedCompanyName.length < 2) {
      errors.company_name = 'Company name must be at least 2 characters.';
    } else if (trimmedCompanyName.length > 150) {
      errors.company_name = 'Company name must not exceed 150 characters.';
    }

    // Company Description: Optional, max 2000 characters
    if (formData.company_description && formData.company_description.length > 2000) {
      errors.company_description = 'Company description must not exceed 2000 characters.';
    }

    // Contact Name: Optional, 2-100 characters when provided
    const trimmedContactName = formData.contact_name.trim();
    if (trimmedContactName) {
      if (trimmedContactName.length < 2) {
        errors.contact_name = 'Contact name must be at least 2 characters.';
      } else if (trimmedContactName.length > 100) {
        errors.contact_name = 'Contact name must not exceed 100 characters.';
      }
    }

    // Phone: Optional, max 20 characters
    if (formData.phone && formData.phone.length > 20) {
      errors.phone = 'Phone number must not exceed 20 characters.';
    }

    // Company Location: Optional, max 150 characters
    if (formData.company_location && formData.company_location.length > 150) {
      errors.company_location = 'Company location must not exceed 150 characters.';
    }

    // Industry: Optional, max 100 characters
    if (formData.industry && formData.industry.length > 100) {
      errors.industry = 'Industry must not exceed 100 characters.';
    }

    // Company Size: Optional, max 50 characters
    if (formData.company_size && formData.company_size.length > 50) {
      errors.company_size = 'Company size must not exceed 50 characters.';
    }

    // Company Website: Optional, max 255 characters, valid HTTP/HTTPS URL
    const trimmedWebsite = formData.company_website.trim();
    if (trimmedWebsite) {
      if (trimmedWebsite.length > 255) {
        errors.company_website = 'Company website must not exceed 255 characters.';
      } else {
        try {
          const parsed = new URL(trimmedWebsite);
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            errors.company_website = 'Please enter a valid URL starting with http:// or https://.';
          }
        } catch {
          errors.company_website = 'Please enter a valid URL starting with http:// or https://.';
        }
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!validateForm()) {
      setFormError('Please resolve the highlighted validation errors.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (!isExistingProfile) {
        // Case B: Create Profile (POST /recruiter/profile)
        const createPayload: RecruiterProfileCreateRequest = {
          company_name: formData.company_name.trim(),
          company_description: formData.company_description.trim() || null,
          contact_name: formData.contact_name.trim() || null,
          phone: formData.phone.trim() || null,
          company_website: formData.company_website.trim() || null,
          company_location: formData.company_location.trim() || null,
          industry: formData.industry.trim() || null,
          company_size: formData.company_size.trim() || null,
        };

        const created = await createRecruiterProfileApi(createPayload);
        populateForm(created);
        setSuccessMessage('Company profile created successfully!');
      } else {
        // Case A: Update Profile (PATCH /recruiter/profile)
        const updatePayload: RecruiterProfileUpdateRequest = {
          company_name: formData.company_name.trim(),
          company_description: formData.company_description.trim() || null,
          contact_name: formData.contact_name.trim() || null,
          phone: formData.phone.trim() || null,
          company_website: formData.company_website.trim() || null,
          company_location: formData.company_location.trim() || null,
          industry: formData.industry.trim() || null,
          company_size: formData.company_size.trim() || null,
        };

        const updated = await updateRecruiterProfileApi(updatePayload);
        populateForm(updated);
        setSuccessMessage('Company profile updated successfully!');
      }
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      const status = apiError?.status;

      if (status === 409) {
        setFormError('A company profile already exists for this account.');
      } else if (status === 404) {
        // PATCH 404: operation error — must NOT reset to create mode
        setFormError('Company profile not found. Please refresh or create a new profile.');
      } else if (status === 403) {
        setFormError('You do not have permission to access or modify this profile.');
      } else if (status === 422) {
        if (Array.isArray(apiError.detail)) {
          const backendErrors: Record<string, string> = {};
          apiError.detail.forEach((item: ValidationErrorDetail) => {
            const field = item.loc[item.loc.length - 1];
            if (typeof field === 'string') {
              backendErrors[field] = item.msg;
            }
          });
          setFieldErrors((prev) => ({ ...prev, ...backendErrors }));
        }
        setFormError(apiError.message || 'Validation failed. Please check the entered data.');
      } else if (status === 429) {
        setFormError(apiError.message || 'Too many requests. Please wait a moment before trying again.');
      } else if (status && status >= 500) {
        setFormError('Service is temporarily unavailable. Please try again.');
      } else {
        setFormError(apiError?.message || 'Failed to save profile. Please check your network connection.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="cb-loading-screen" role="status" aria-live="polite">
        <div className="cb-spinner"></div>
        <p>Loading company profile...</p>
      </div>
    );
  }

  if (initialLoadError) {
    return (
      <div className="cb-card" role="alert" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
        <h2 style={{ color: initialLoadError.status === 403 ? 'var(--cb-danger)' : 'inherit', marginBottom: '0.75rem' }}>
          {initialLoadError.status === 403 ? 'Access Denied' : 'Unable to Load Profile'}
        </h2>
        <p style={{ color: 'var(--cb-text-muted)', marginBottom: '1.5rem' }}>
          {initialLoadError.message}
        </p>
        {initialLoadError.status !== 403 && (
          <button
            onClick={loadProfile}
            className="cb-btn cb-btn-primary"
            type="button"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="cb-profile-page">
      <div className="cb-card">
        <div style={{ marginBottom: '1.5rem' }}>
          <h2>My Company Profile</h2>
          <p className="cb-subtitle" style={{ marginBottom: '0' }}>
            {isExistingProfile
              ? 'Edit Profile — keep your organization, contact, and website details up to date.'
              : 'Create Profile — complete your company details to post opportunities and discover talent.'}
          </p>
        </div>

        {profile && isExistingProfile && (
          <div
            style={{
              background: '#f8fafc',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--cb-radius)',
              border: '1px solid var(--cb-border)',
              marginBottom: '1.25rem',
              fontSize: '0.85rem',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ color: 'var(--cb-text-muted)' }}>Profile ID: #{profile.id}</span>
              <span style={{ color: 'var(--cb-text-muted)' }}>
                Last Updated: {new Date(profile.updated_at).toLocaleDateString()}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--cb-text-muted)' }}>Status:</span>
              {profile.is_verified ? (
                <span
                  className="cb-verified-badge"
                  title="Verified Company — Verified by platform administrators"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  ✓ Verified Company
                </span>
              ) : (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    background: '#fef3c7',
                    color: '#92400e',
                    border: '1px solid #fde68a',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                  title="Pending Verification — Platform administrator review pending"
                >
                  ⏳ Pending Verification
                </span>
              )}
            </div>

            <div style={{ width: '100%', fontSize: '0.8rem', color: 'var(--cb-text-muted)', marginTop: '0.25rem' }}>
              Verification status is managed by platform administrators. Unverified recruiters can still post jobs and connect with candidates.
            </div>
          </div>
        )}

        {successMessage && (
          <div className="cb-alert cb-alert-success" role="alert">
            {successMessage}
          </div>
        )}

        {formError && (
          <div className="cb-alert cb-alert-danger" role="alert">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="cb-form" noValidate>
          {/* Section 1: Company Information */}
          <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--cb-border)', paddingBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--cb-text)' }}>Company Information</h3>

            <div className="cb-form-group">
              <label htmlFor="company_name">
                Company Name <span style={{ color: 'var(--cb-danger)' }}>*</span>
              </label>
              <input
                id="company_name"
                name="company_name"
                type="text"
                value={formData.company_name}
                onChange={handleChange}
                placeholder="e.g. Acme Innovations Inc."
                disabled={isSubmitting}
                required
                className="cb-input"
              />
              {fieldErrors.company_name ? (
                <small className="cb-input-hint" style={{ color: 'var(--cb-danger)' }} role="alert">
                  {fieldErrors.company_name}
                </small>
              ) : (
                <small className="cb-input-hint">Required. Between 2 and 150 characters.</small>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="cb-form-group">
                <label htmlFor="industry">Industry</label>
                <input
                  id="industry"
                  name="industry"
                  type="text"
                  value={formData.industry}
                  onChange={handleChange}
                  placeholder="e.g. Technology, Healthcare, Finance"
                  disabled={isSubmitting}
                  className="cb-input"
                />
                {fieldErrors.industry && (
                  <small className="cb-input-hint" style={{ color: 'var(--cb-danger)' }} role="alert">
                    {fieldErrors.industry}
                  </small>
                )}
              </div>

              <div className="cb-form-group">
                <label htmlFor="company_size">Company Size</label>
                <input
                  id="company_size"
                  name="company_size"
                  type="text"
                  value={formData.company_size}
                  onChange={handleChange}
                  placeholder="e.g. 1-10, 11-50, 51-200, 500+"
                  disabled={isSubmitting}
                  className="cb-input"
                />
                {fieldErrors.company_size && (
                  <small className="cb-input-hint" style={{ color: 'var(--cb-danger)' }} role="alert">
                    {fieldErrors.company_size}
                  </small>
                )}
              </div>
            </div>

            <div className="cb-form-group">
              <label htmlFor="company_description">Company Description</label>
              <textarea
                id="company_description"
                name="company_description"
                rows={4}
                value={formData.company_description}
                onChange={handleChange}
                placeholder="Overview of your company, mission, work culture, or products..."
                disabled={isSubmitting}
                className="cb-input"
                style={{ resize: 'vertical' }}
              />
              {fieldErrors.company_description ? (
                <small className="cb-input-hint" style={{ color: 'var(--cb-danger)' }} role="alert">
                  {fieldErrors.company_description}
                </small>
              ) : (
                <small className="cb-input-hint">Maximum 2000 characters ({formData.company_description.length}/2000).</small>
              )}
            </div>
          </div>

          {/* Section 2: Contact Information */}
          <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--cb-border)', paddingBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--cb-text)' }}>Contact Information</h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="cb-form-group">
                <label htmlFor="contact_name">Contact Person Name</label>
                <input
                  id="contact_name"
                  name="contact_name"
                  type="text"
                  value={formData.contact_name}
                  onChange={handleChange}
                  placeholder="e.g. Jane Doe"
                  disabled={isSubmitting}
                  className="cb-input"
                />
                {fieldErrors.contact_name ? (
                  <small className="cb-input-hint" style={{ color: 'var(--cb-danger)' }} role="alert">
                    {fieldErrors.contact_name}
                  </small>
                ) : (
                  <small className="cb-input-hint">Optional. 2 to 100 characters when provided.</small>
                )}
              </div>

              <div className="cb-form-group">
                <label htmlFor="phone">Phone Number</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="e.g. +1-555-0200"
                  disabled={isSubmitting}
                  className="cb-input"
                />
                {fieldErrors.phone && (
                  <small className="cb-input-hint" style={{ color: 'var(--cb-danger)' }} role="alert">
                    {fieldErrors.phone}
                  </small>
                )}
              </div>
            </div>

            <div className="cb-form-group">
              <label htmlFor="company_location">Company Location</label>
              <input
                id="company_location"
                name="company_location"
                type="text"
                value={formData.company_location}
                onChange={handleChange}
                placeholder="e.g. San Francisco, CA or Bengaluru, India"
                disabled={isSubmitting}
                className="cb-input"
              />
              {fieldErrors.company_location && (
                <small className="cb-input-hint" style={{ color: 'var(--cb-danger)' }} role="alert">
                  {fieldErrors.company_location}
                </small>
              )}
            </div>
          </div>

          {/* Section 3: Company Website */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--cb-text)' }}>Company Website</h3>

            <div className="cb-form-group">
              <label htmlFor="company_website">Official Website URL</label>
              <input
                id="company_website"
                name="company_website"
                type="url"
                value={formData.company_website}
                onChange={handleChange}
                placeholder="https://acme-innovations.example.com"
                disabled={isSubmitting}
                className="cb-input"
              />
              {fieldErrors.company_website && (
                <small className="cb-input-hint" style={{ color: 'var(--cb-danger)' }} role="alert">
                  {fieldErrors.company_website}
                </small>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              type="submit"
              className="cb-btn cb-btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? 'Saving...'
                : isExistingProfile
                ? 'Save Changes'
                : 'Create Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
