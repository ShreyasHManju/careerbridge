import React, { useCallback, useEffect, useState } from 'react';
import {
  getStudentProfileApi,
  createStudentProfileApi,
  updateStudentProfileApi,
} from '@/api/studentProfile';
import {
  StudentProfile,
  StudentProfileCreateRequest,
  StudentProfileUpdateRequest,
} from '@/types/studentProfile';
import { ApiErrorResponse, ValidationErrorDetail } from '@/types/api';

interface ProfileFormData {
  full_name: string;
  phone: string;
  college: string;
  degree: string;
  branch: string;
  graduation_year: string;
  bio: string;
  skills: string;
  github_url: string;
  linkedin_url: string;
  portfolio_url: string;
}

const initialFormState: ProfileFormData = {
  full_name: '',
  phone: '',
  college: '',
  degree: '',
  branch: '',
  graduation_year: '',
  bio: '',
  skills: '',
  github_url: '',
  linkedin_url: '',
  portfolio_url: '',
};

export const StudentProfilePage: React.FC = () => {
  const [formData, setFormData] = useState<ProfileFormData>(initialFormState);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [isExistingProfile, setIsExistingProfile] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [initialLoadError, setInitialLoadError] = useState<{ status?: number; message: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const populateForm = (data: StudentProfile) => {
    setProfile(data);
    setIsExistingProfile(true);
    setFormData({
      full_name: data.full_name || '',
      phone: data.phone || '',
      college: data.college || '',
      degree: data.degree || '',
      branch: data.branch || '',
      graduation_year: data.graduation_year !== null && data.graduation_year !== undefined ? String(data.graduation_year) : '',
      bio: data.bio || '',
      skills: data.skills || '',
      github_url: data.github_url || '',
      linkedin_url: data.linkedin_url || '',
      portfolio_url: data.portfolio_url || '',
    });
  };

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setInitialLoadError(null);
    setFormError(null);
    setSuccessMessage(null);
    setFieldErrors({});

    try {
      const data = await getStudentProfileApi();
      populateForm(data);
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      const status = apiError?.status;

      if (status === 404) {
        // State A: Profile does not exist yet (Normal first-time onboarding state)
        setIsExistingProfile(false);
        setProfile(null);
        setFormData(initialFormState);
      } else if (status === 403) {
        setInitialLoadError({
          status: 403,
          message: 'You do not have permission to access the student profile.',
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
        // Network failure, connection drop, 429
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

    // Full name: Required, 2-100 characters
    const trimmedName = formData.full_name.trim();
    if (!trimmedName) {
      errors.full_name = 'Full name is required.';
    } else if (trimmedName.length < 2) {
      errors.full_name = 'Full name must be at least 2 characters.';
    } else if (trimmedName.length > 100) {
      errors.full_name = 'Full name must not exceed 100 characters.';
    }

    // Phone: Optional, max 20 characters
    if (formData.phone && formData.phone.length > 20) {
      errors.phone = 'Phone number must not exceed 20 characters.';
    }

    // College: Optional, max 150 characters
    if (formData.college && formData.college.length > 150) {
      errors.college = 'College name must not exceed 150 characters.';
    }

    // Degree: Optional, max 100 characters
    if (formData.degree && formData.degree.length > 100) {
      errors.degree = 'Degree must not exceed 100 characters.';
    }

    // Branch: Optional, max 100 characters
    if (formData.branch && formData.branch.length > 100) {
      errors.branch = 'Branch must not exceed 100 characters.';
    }

    // Graduation Year: Optional, integer 1900-2100
    if (formData.graduation_year.trim()) {
      const yearNum = Number(formData.graduation_year.trim());
      if (!Number.isInteger(yearNum)) {
        errors.graduation_year = 'Graduation year must be a whole number.';
      } else if (yearNum < 1900 || yearNum > 2100) {
        errors.graduation_year = 'Graduation year must be between 1900 and 2100.';
      }
    }

    // Bio: Optional, max 1000 characters
    if (formData.bio && formData.bio.length > 1000) {
      errors.bio = 'Bio must not exceed 1000 characters.';
    }

    // Skills: Optional, max 1000 characters
    if (formData.skills && formData.skills.length > 1000) {
      errors.skills = 'Skills must not exceed 1000 characters.';
    }

    // URL validation helper
    const isValidUrl = (urlStr: string) => {
      try {
        const parsed = new URL(urlStr);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    };

    if (formData.github_url.trim()) {
      if (formData.github_url.length > 255) {
        errors.github_url = 'GitHub URL must not exceed 255 characters.';
      } else if (!isValidUrl(formData.github_url.trim())) {
        errors.github_url = 'Please enter a valid URL starting with http:// or https://.';
      }
    }

    if (formData.linkedin_url.trim()) {
      if (formData.linkedin_url.length > 255) {
        errors.linkedin_url = 'LinkedIn URL must not exceed 255 characters.';
      } else if (!isValidUrl(formData.linkedin_url.trim())) {
        errors.linkedin_url = 'Please enter a valid URL starting with http:// or https://.';
      }
    }

    if (formData.portfolio_url.trim()) {
      if (formData.portfolio_url.length > 255) {
        errors.portfolio_url = 'Portfolio URL must not exceed 255 characters.';
      } else if (!isValidUrl(formData.portfolio_url.trim())) {
        errors.portfolio_url = 'Please enter a valid URL starting with http:// or https://.';
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
      const gradYear = formData.graduation_year.trim()
        ? parseInt(formData.graduation_year.trim(), 10)
        : null;

      if (!isExistingProfile) {
        // State A: Initial Profile Creation (POST /student/profile)
        const createPayload: StudentProfileCreateRequest = {
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim() || null,
          college: formData.college.trim() || null,
          degree: formData.degree.trim() || null,
          branch: formData.branch.trim() || null,
          graduation_year: gradYear,
          bio: formData.bio.trim() || null,
          skills: formData.skills.trim() || null,
          github_url: formData.github_url.trim() || null,
          linkedin_url: formData.linkedin_url.trim() || null,
          portfolio_url: formData.portfolio_url.trim() || null,
        };

        const created = await createStudentProfileApi(createPayload);
        populateForm(created);
        setSuccessMessage('Student profile created successfully!');
      } else {
        // State B: Existing Profile Update (PATCH /student/profile)
        const updatePayload: StudentProfileUpdateRequest = {
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim() || null,
          college: formData.college.trim() || null,
          degree: formData.degree.trim() || null,
          branch: formData.branch.trim() || null,
          graduation_year: gradYear,
          bio: formData.bio.trim() || null,
          skills: formData.skills.trim() || null,
          github_url: formData.github_url.trim() || null,
          linkedin_url: formData.linkedin_url.trim() || null,
          portfolio_url: formData.portfolio_url.trim() || null,
        };

        const updated = await updateStudentProfileApi(updatePayload);
        populateForm(updated);
        setSuccessMessage('Student profile updated successfully!');
      }
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      const status = apiError?.status;

      if (status === 409) {
        setFormError('A student profile already exists for this account.');
      } else if (status === 404) {
        setFormError('Student profile not found. Please refresh or create a new profile.');
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
        <p>Loading student profile...</p>
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
          <h2>My Student Profile</h2>
          <p className="cb-subtitle" style={{ marginBottom: '0' }}>
            {isExistingProfile
              ? 'Edit Profile — keep your academic, skills, and portfolio information up to date.'
              : 'Create Profile — complete your profile details to discover and apply for internship opportunities.'}
          </p>
        </div>

        {profile && isExistingProfile && (
          <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: 'var(--cb-radius)', border: '1px solid var(--cb-border)', marginBottom: '1.25rem', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', color: 'var(--cb-text-muted)' }}>
            <span>Profile ID: #{profile.id}</span>
            <span>Last Updated: {new Date(profile.updated_at).toLocaleDateString()}</span>
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
          {/* Section 1: Personal Information */}
          <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--cb-border)', paddingBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--cb-text)' }}>Personal Information</h3>
            
            <div className="cb-form-group">
              <label htmlFor="full_name">
                Full Name <span style={{ color: 'var(--cb-danger)' }}>*</span>
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                value={formData.full_name}
                onChange={handleChange}
                placeholder="e.g. Jane Doe"
                disabled={isSubmitting}
                required
                className="cb-input"
              />
              {fieldErrors.full_name ? (
                <small className="cb-input-hint" style={{ color: 'var(--cb-danger)' }} role="alert">
                  {fieldErrors.full_name}
                </small>
              ) : (
                <small className="cb-input-hint">Required. Between 2 and 100 characters.</small>
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
                placeholder="e.g. +91 9876543210"
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

          {/* Section 2: Education */}
          <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--cb-border)', paddingBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--cb-text)' }}>Education</h3>

            <div className="cb-form-group">
              <label htmlFor="college">College / University</label>
              <input
                id="college"
                name="college"
                type="text"
                value={formData.college}
                onChange={handleChange}
                placeholder="e.g. National Institute of Technology"
                disabled={isSubmitting}
                className="cb-input"
              />
              {fieldErrors.college && (
                <small className="cb-input-hint" style={{ color: 'var(--cb-danger)' }} role="alert">
                  {fieldErrors.college}
                </small>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="cb-form-group">
                <label htmlFor="degree">Degree</label>
                <input
                  id="degree"
                  name="degree"
                  type="text"
                  value={formData.degree}
                  onChange={handleChange}
                  placeholder="e.g. B.Tech, B.S., M.S."
                  disabled={isSubmitting}
                  className="cb-input"
                />
                {fieldErrors.degree && (
                  <small className="cb-input-hint" style={{ color: 'var(--cb-danger)' }} role="alert">
                    {fieldErrors.degree}
                  </small>
                )}
              </div>

              <div className="cb-form-group">
                <label htmlFor="branch">Branch / Major</label>
                <input
                  id="branch"
                  name="branch"
                  type="text"
                  value={formData.branch}
                  onChange={handleChange}
                  placeholder="e.g. Computer Science"
                  disabled={isSubmitting}
                  className="cb-input"
                />
                {fieldErrors.branch && (
                  <small className="cb-input-hint" style={{ color: 'var(--cb-danger)' }} role="alert">
                    {fieldErrors.branch}
                  </small>
                )}
              </div>

              <div className="cb-form-group">
                <label htmlFor="graduation_year">Graduation Year</label>
                <input
                  id="graduation_year"
                  name="graduation_year"
                  type="number"
                  min="1900"
                  max="2100"
                  value={formData.graduation_year}
                  onChange={handleChange}
                  placeholder="e.g. 2026"
                  disabled={isSubmitting}
                  className="cb-input"
                />
                {fieldErrors.graduation_year ? (
                  <small className="cb-input-hint" style={{ color: 'var(--cb-danger)' }} role="alert">
                    {fieldErrors.graduation_year}
                  </small>
                ) : (
                  <small className="cb-input-hint">Year between 1900 and 2100.</small>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Professional & Skills */}
          <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--cb-border)', paddingBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--cb-text)' }}>Professional Background</h3>

            <div className="cb-form-group">
              <label htmlFor="bio">Professional Bio</label>
              <textarea
                id="bio"
                name="bio"
                rows={4}
                value={formData.bio}
                onChange={handleChange}
                placeholder="Brief summary of your academic interests, career goals, or project highlights..."
                disabled={isSubmitting}
                className="cb-input"
                style={{ resize: 'vertical' }}
              />
              {fieldErrors.bio ? (
                <small className="cb-input-hint" style={{ color: 'var(--cb-danger)' }} role="alert">
                  {fieldErrors.bio}
                </small>
              ) : (
                <small className="cb-input-hint">Maximum 1000 characters ({formData.bio.length}/1000).</small>
              )}
            </div>

            <div className="cb-form-group">
              <label htmlFor="skills">Skills</label>
              <textarea
                id="skills"
                name="skills"
                rows={2}
                value={formData.skills}
                onChange={handleChange}
                placeholder="e.g. Python, React, TypeScript, FastAPI, PostgreSQL, Git"
                disabled={isSubmitting}
                className="cb-input"
                style={{ resize: 'vertical' }}
              />
              {fieldErrors.skills ? (
                <small className="cb-input-hint" style={{ color: 'var(--cb-danger)' }} role="alert">
                  {fieldErrors.skills}
                </small>
              ) : (
                <small className="cb-input-hint">Comma-separated list of technical and soft skills (max 1000 characters).</small>
              )}
            </div>
          </div>

          {/* Section 4: External Links */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--cb-text)' }}>Portfolio & Social Links</h3>

            <div className="cb-form-group">
              <label htmlFor="github_url">GitHub Profile URL</label>
              <input
                id="github_url"
                name="github_url"
                type="url"
                value={formData.github_url}
                onChange={handleChange}
                placeholder="https://github.com/username"
                disabled={isSubmitting}
                className="cb-input"
              />
              {fieldErrors.github_url && (
                <small className="cb-input-hint" style={{ color: 'var(--cb-danger)' }} role="alert">
                  {fieldErrors.github_url}
                </small>
              )}
            </div>

            <div className="cb-form-group">
              <label htmlFor="linkedin_url">LinkedIn Profile URL</label>
              <input
                id="linkedin_url"
                name="linkedin_url"
                type="url"
                value={formData.linkedin_url}
                onChange={handleChange}
                placeholder="https://linkedin.com/in/username"
                disabled={isSubmitting}
                className="cb-input"
              />
              {fieldErrors.linkedin_url && (
                <small className="cb-input-hint" style={{ color: 'var(--cb-danger)' }} role="alert">
                  {fieldErrors.linkedin_url}
                </small>
              )}
            </div>

            <div className="cb-form-group">
              <label htmlFor="portfolio_url">Portfolio / Personal Website</label>
              <input
                id="portfolio_url"
                name="portfolio_url"
                type="url"
                value={formData.portfolio_url}
                onChange={handleChange}
                placeholder="https://yourportfolio.dev"
                disabled={isSubmitting}
                className="cb-input"
              />
              {fieldErrors.portfolio_url && (
                <small className="cb-input-hint" style={{ color: 'var(--cb-danger)' }} role="alert">
                  {fieldErrors.portfolio_url}
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
