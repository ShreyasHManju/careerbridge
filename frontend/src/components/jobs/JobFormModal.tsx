import React, { useState, useEffect } from 'react';
import { JobPosting, JobPostingCreate, JobPostingUpdate, OpportunityType, EmploymentType } from '@/types/job';
import { createJob, updateJob } from '@/api/jobs';
import { ApiErrorResponse, ValidationErrorDetail } from '@/types/api';
import { SkillTagInput } from '@/components/ui/SkillTagInput';

interface JobFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (job: JobPosting) => void;
  initialJob?: JobPosting | null;
  defaultCompanyName?: string;
}

interface FormState {
  title: string;
  description: string;
  opportunity_type: OpportunityType;
  company_name: string;
  location: string;
  is_remote: boolean;
  employment_type: EmploymentType;
  skills: string;
  minimum_qualification: string;
  experience_required: string;
  salary_min: string;
  salary_max: string;
  application_deadline: string;
  is_active: boolean;
}

function formatToDateTimeLocal(isoString?: string | null): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return '';
  }
}

function parseDateTimeLocalToISO(localString: string): string | null {
  if (!localString.trim()) return null;
  const d = new Date(localString);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

export const JobFormModal: React.FC<JobFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialJob,
  defaultCompanyName = '',
}) => {
  const isEditMode = Boolean(initialJob);

  const getInitialFormState = (): FormState => ({
    title: initialJob?.title || '',
    description: initialJob?.description || '',
    opportunity_type: initialJob?.opportunity_type || 'job',
    company_name: initialJob?.company_name || defaultCompanyName,
    location: initialJob?.location || '',
    is_remote: initialJob?.is_remote ?? false,
    employment_type: initialJob?.employment_type || 'full_time',
    skills: initialJob?.skills || '',
    minimum_qualification: initialJob?.minimum_qualification || '',
    experience_required: initialJob?.experience_required || '',
    salary_min: initialJob?.salary_min != null ? String(initialJob.salary_min) : '',
    salary_max: initialJob?.salary_max != null ? String(initialJob.salary_max) : '',
    application_deadline: formatToDateTimeLocal(initialJob?.application_deadline),
    is_active: initialJob?.is_active ?? true,
  });

  const [formData, setFormData] = useState<FormState>(getInitialFormState);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sync state when modal opens or initialJob changes
  useEffect(() => {
    if (isOpen) {
      setFormData(getInitialFormState());
      setFieldErrors({});
      setGeneralError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, initialJob, defaultCompanyName]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) {
    return null;
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Title: 2..150
    const titleTrimmed = formData.title.trim();
    if (!titleTrimmed) {
      errors.title = 'Title is required.';
    } else if (titleTrimmed.length < 2) {
      errors.title = 'Title must be at least 2 characters.';
    } else if (titleTrimmed.length > 150) {
      errors.title = 'Title cannot exceed 150 characters.';
    }

    // Description: minimum 10
    const descTrimmed = formData.description.trim();
    if (!descTrimmed) {
      errors.description = 'Description is required.';
    } else if (descTrimmed.length < 10) {
      errors.description = 'Description must be at least 10 characters.';
    }

    // Company name: 2..150
    const compTrimmed = formData.company_name.trim();
    if (!compTrimmed) {
      errors.company_name = 'Company name is required.';
    } else if (compTrimmed.length < 2) {
      errors.company_name = 'Company name must be at least 2 characters.';
    } else if (compTrimmed.length > 150) {
      errors.company_name = 'Company name cannot exceed 150 characters.';
    }

    // Location: max 150
    if (formData.location.trim().length > 150) {
      errors.location = 'Location cannot exceed 150 characters.';
    }

    // Skills: max 1000
    if (formData.skills.trim().length > 1000) {
      errors.skills = 'Skills cannot exceed 1000 characters.';
    }

    // Minimum qualification: max 100
    if (formData.minimum_qualification.trim().length > 100) {
      errors.minimum_qualification = 'Minimum qualification cannot exceed 100 characters.';
    }

    // Experience required: max 50
    if (formData.experience_required.trim().length > 50) {
      errors.experience_required = 'Experience required cannot exceed 50 characters.';
    }

    // Salary min & max
    let minSal: number | null = null;
    let maxSal: number | null = null;

    if (formData.salary_min !== '') {
      const parsedMin = parseInt(formData.salary_min, 10);
      if (isNaN(parsedMin) || parsedMin < 0) {
        errors.salary_min = 'Minimum salary must be a positive integer.';
      } else {
        minSal = parsedMin;
      }
    }

    if (formData.salary_max !== '') {
      const parsedMax = parseInt(formData.salary_max, 10);
      if (isNaN(parsedMax) || parsedMax < 0) {
        errors.salary_max = 'Maximum salary must be a positive integer.';
      } else {
        maxSal = parsedMax;
      }
    }

    if (minSal !== null && maxSal !== null && maxSal < minSal) {
      errors.salary_max = 'Maximum salary cannot be less than minimum salary.';
    }

    // Application deadline validation if set
    if (formData.application_deadline) {
      const deadlineDate = new Date(formData.application_deadline);
      if (isNaN(deadlineDate.getTime())) {
        errors.application_deadline = 'Please provide a valid application deadline datetime.';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    if (generalError) {
      setGeneralError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setGeneralError(null);

    const deadlineISO = parseDateTimeLocalToISO(formData.application_deadline);
    const parsedSalaryMin = formData.salary_min !== '' ? parseInt(formData.salary_min, 10) : null;
    const parsedSalaryMax = formData.salary_max !== '' ? parseInt(formData.salary_max, 10) : null;

    try {
      if (isEditMode && initialJob) {
        const payload: JobPostingUpdate = {
          title: formData.title.trim(),
          description: formData.description.trim(),
          opportunity_type: formData.opportunity_type,
          company_name: formData.company_name.trim(),
          location: formData.location.trim() || null,
          is_remote: formData.is_remote,
          employment_type: formData.employment_type,
          skills: formData.skills.trim() || null,
          minimum_qualification: formData.minimum_qualification.trim() || null,
          experience_required: formData.experience_required.trim() || null,
          salary_min: parsedSalaryMin,
          salary_max: parsedSalaryMax,
          application_deadline: deadlineISO,
          is_active: formData.is_active,
        };

        const updated = await updateJob(initialJob.id, payload);
        onSuccess(updated);
        onClose();
      } else {
        const payload: JobPostingCreate = {
          title: formData.title.trim(),
          description: formData.description.trim(),
          opportunity_type: formData.opportunity_type,
          company_name: formData.company_name.trim(),
          location: formData.location.trim() || null,
          is_remote: formData.is_remote,
          employment_type: formData.employment_type,
          skills: formData.skills.trim() || null,
          minimum_qualification: formData.minimum_qualification.trim() || null,
          experience_required: formData.experience_required.trim() || null,
          salary_min: parsedSalaryMin,
          salary_max: parsedSalaryMax,
          application_deadline: deadlineISO,
          is_active: formData.is_active,
        };

        const created = await createJob(payload);
        onSuccess(created);
        onClose();
      }
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      if (Array.isArray(apiError?.detail)) {
        const backendFieldErrors: Record<string, string> = {};
        apiError.detail.forEach((item: ValidationErrorDetail) => {
          const field = item.loc[item.loc.length - 1];
          if (typeof field === 'string') {
            backendFieldErrors[field] = item.msg;
          }
        });
        setFieldErrors((prev) => ({ ...prev, ...backendFieldErrors }));
      }
      const message =
        typeof apiError?.detail === 'string'
          ? apiError.detail
          : apiError?.message || 'Failed to save job posting. Please check your inputs and try again.';
      setGeneralError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="cb-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div
        className="cb-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-form-modal-title"
        data-testid="job-form-modal"
        style={{ maxWidth: '650px' }}
      >
        <div className="cb-modal-header">
          <h2 id="job-form-modal-title" className="cb-modal-title">
            {isEditMode ? 'Edit Job Posting' : 'Create New Job Posting'}
          </h2>
          <button
            type="button"
            className="cb-modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close job form dialog"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="cb-modal-body" noValidate>
          {generalError && (
            <div className="cb-alert cb-alert-danger" role="alert" data-testid="job-form-error">
              {generalError}
            </div>
          )}

          {/* Job Title */}
          <div className="cb-form-group">
            <label htmlFor="job-title" className="cb-filter-label">
              Job Title <span style={{ color: 'var(--cb-danger)' }}>*</span>
            </label>
            <input
              id="job-title"
              name="title"
              type="text"
              className={`cb-input ${fieldErrors.title ? 'cb-input-error' : ''}`}
              placeholder="e.g. Frontend Software Engineer"
              value={formData.title}
              onChange={handleChange}
              disabled={isSubmitting}
              maxLength={150}
              required
            />
            {fieldErrors.title && (
              <span className="cb-field-error" role="alert" data-testid="title-error">
                {fieldErrors.title}
              </span>
            )}
          </div>

          {/* Company Name */}
          <div className="cb-form-group">
            <label htmlFor="company-name" className="cb-filter-label">
              Company Name <span style={{ color: 'var(--cb-danger)' }}>*</span>
            </label>
            <input
              id="company-name"
              name="company_name"
              type="text"
              className={`cb-input ${fieldErrors.company_name ? 'cb-input-error' : ''}`}
              placeholder="e.g. Acme Innovations"
              value={formData.company_name}
              onChange={handleChange}
              disabled={isSubmitting}
              maxLength={150}
              required
            />
            {fieldErrors.company_name && (
              <span className="cb-field-error" role="alert" data-testid="company_name-error">
                {fieldErrors.company_name}
              </span>
            )}
          </div>

          {/* Opportunity & Employment Types */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="cb-form-group">
              <label htmlFor="opportunity-type" className="cb-filter-label">
                Opportunity Type <span style={{ color: 'var(--cb-danger)' }}>*</span>
              </label>
              <select
                id="opportunity-type"
                name="opportunity_type"
                className="cb-select"
                value={formData.opportunity_type}
                onChange={handleChange}
                disabled={isSubmitting}
              >
                <option value="job">Job</option>
                <option value="internship">Internship</option>
              </select>
            </div>

            <div className="cb-form-group">
              <label htmlFor="employment-type" className="cb-filter-label">
                Employment Type <span style={{ color: 'var(--cb-danger)' }}>*</span>
              </label>
              <select
                id="employment-type"
                name="employment_type"
                className="cb-select"
                value={formData.employment_type}
                onChange={handleChange}
                disabled={isSubmitting}
              >
                <option value="full_time">Full-time</option>
                <option value="part_time">Part-time</option>
                <option value="contract">Contract</option>
              </select>
            </div>
          </div>

          {/* Location & Remote */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', alignItems: 'center' }}>
            <div className="cb-form-group">
              <label htmlFor="job-location" className="cb-filter-label">
                Location
              </label>
              <input
                id="job-location"
                name="location"
                type="text"
                className={`cb-input ${fieldErrors.location ? 'cb-input-error' : ''}`}
                placeholder="e.g. San Francisco, CA"
                value={formData.location}
                onChange={handleChange}
                disabled={isSubmitting}
                maxLength={150}
              />
              {fieldErrors.location && (
                <span className="cb-field-error" role="alert">
                  {fieldErrors.location}
                </span>
              )}
            </div>

            <div className="cb-form-group" style={{ marginTop: '1.25rem' }}>
              <label
                htmlFor="is-remote"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '0.9rem',
                }}
              >
                <input
                  id="is-remote"
                  name="is_remote"
                  type="checkbox"
                  checked={formData.is_remote}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
                Remote Opportunity
              </label>
            </div>
          </div>

          {/* Description */}
          <div className="cb-form-group">
            <label htmlFor="job-description" className="cb-filter-label">
              Description <span style={{ color: 'var(--cb-danger)' }}>*</span>
            </label>
            <textarea
              id="job-description"
              name="description"
              className={`cb-textarea ${fieldErrors.description ? 'cb-input-error' : ''}`}
              rows={5}
              placeholder="Describe the role responsibilities, team, culture, and key outcomes..."
              value={formData.description}
              onChange={handleChange}
              disabled={isSubmitting}
              required
            />
            {fieldErrors.description && (
              <span className="cb-field-error" role="alert" data-testid="description-error">
                {fieldErrors.description}
              </span>
            )}
          </div>

          {/* Skills */}
          <div className="cb-form-group">
            <SkillTagInput
              id="job-skills"
              label="Required Skills"
              value={formData.skills}
              onChange={(val) => {
                setFormData((prev) => ({ ...prev, skills: val }));
                if (fieldErrors.skills) {
                  setFieldErrors((prev) => {
                    const copy = { ...prev };
                    delete copy.skills;
                    return copy;
                  });
                }
              }}
              placeholder="e.g. React, TypeScript, Node.js, Python"
              disabled={isSubmitting}
              error={fieldErrors.skills}
              helperText="Type or search skills and press Enter or comma."
            />
          </div>

          {/* Qualifications & Experience */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="cb-form-group">
              <label htmlFor="minimum-qualification" className="cb-filter-label">
                Minimum Qualification
              </label>
              <input
                id="minimum-qualification"
                name="minimum_qualification"
                type="text"
                className={`cb-input ${fieldErrors.minimum_qualification ? 'cb-input-error' : ''}`}
                placeholder="e.g. Bachelor in Computer Science"
                value={formData.minimum_qualification}
                onChange={handleChange}
                disabled={isSubmitting}
                maxLength={100}
              />
              {fieldErrors.minimum_qualification && (
                <span className="cb-field-error" role="alert">
                  {fieldErrors.minimum_qualification}
                </span>
              )}
            </div>

            <div className="cb-form-group">
              <label htmlFor="experience-required" className="cb-filter-label">
                Experience Required
              </label>
              <input
                id="experience-required"
                name="experience_required"
                type="text"
                className={`cb-input ${fieldErrors.experience_required ? 'cb-input-error' : ''}`}
                placeholder="e.g. 1-2 years or Entry Level"
                value={formData.experience_required}
                onChange={handleChange}
                disabled={isSubmitting}
                maxLength={50}
              />
              {fieldErrors.experience_required && (
                <span className="cb-field-error" role="alert">
                  {fieldErrors.experience_required}
                </span>
              )}
            </div>
          </div>

          {/* Salary Min & Max */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="cb-form-group">
              <label htmlFor="salary-min" className="cb-filter-label">
                Minimum Salary ($)
              </label>
              <input
                id="salary-min"
                name="salary_min"
                type="number"
                min="0"
                step="1"
                className={`cb-input ${fieldErrors.salary_min ? 'cb-input-error' : ''}`}
                placeholder="e.g. 50000"
                value={formData.salary_min}
                onChange={handleChange}
                disabled={isSubmitting}
              />
              {fieldErrors.salary_min && (
                <span className="cb-field-error" role="alert" data-testid="salary_min-error">
                  {fieldErrors.salary_min}
                </span>
              )}
            </div>

            <div className="cb-form-group">
              <label htmlFor="salary-max" className="cb-filter-label">
                Maximum Salary ($)
              </label>
              <input
                id="salary-max"
                name="salary_max"
                type="number"
                min="0"
                step="1"
                className={`cb-input ${fieldErrors.salary_max ? 'cb-input-error' : ''}`}
                placeholder="e.g. 80000"
                value={formData.salary_max}
                onChange={handleChange}
                disabled={isSubmitting}
              />
              {fieldErrors.salary_max && (
                <span className="cb-field-error" role="alert" data-testid="salary_max-error">
                  {fieldErrors.salary_max}
                </span>
              )}
            </div>
          </div>

          {/* Deadline & Active Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem', alignItems: 'center' }}>
            <div className="cb-form-group">
              <label htmlFor="application-deadline" className="cb-filter-label">
                Application Deadline
              </label>
              <input
                id="application-deadline"
                name="application_deadline"
                type="datetime-local"
                className={`cb-input ${fieldErrors.application_deadline ? 'cb-input-error' : ''}`}
                value={formData.application_deadline}
                onChange={handleChange}
                disabled={isSubmitting}
              />
              {fieldErrors.application_deadline && (
                <span className="cb-field-error" role="alert" data-testid="deadline-error">
                  {fieldErrors.application_deadline}
                </span>
              )}
            </div>

            <div className="cb-form-group" style={{ marginTop: '1.25rem' }}>
              <label
                htmlFor="is-active"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '0.9rem',
                }}
              >
                <input
                  id="is-active"
                  name="is_active"
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
                Active (Published)
              </label>
            </div>
          </div>

          <div className="cb-modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="cb-btn cb-btn-secondary"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cb-btn cb-btn-primary"
              disabled={isSubmitting}
              data-testid="job-form-submit-btn"
            >
              {isSubmitting
                ? isEditMode
                  ? 'Saving Changes...'
                  : 'Creating Posting...'
                : isEditMode
                ? 'Save Changes'
                : 'Create Posting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
