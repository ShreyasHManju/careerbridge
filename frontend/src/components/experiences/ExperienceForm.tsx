import React, { useState } from 'react';
import {
  ExperienceRecord,
  ExperienceRecordCreate,
  ExperienceRecordUpdate,
  ExperienceType,
} from '@/types/experience';
import { SkillTagInput } from '@/components/ui/SkillTagInput';

export interface ExperienceFormProps {
  initialData?: ExperienceRecord | null;
  onSubmit: (data: ExperienceRecordCreate | ExperienceRecordUpdate) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const EXPERIENCE_TYPE_OPTIONS: { value: ExperienceType; label: string }[] = [
  { value: 'work', label: 'Work Experience' },
  { value: 'internship', label: 'Internship' },
  { value: 'project', label: 'Project' },
  { value: 'research', label: 'Research' },
  { value: 'leadership', label: 'Leadership' },
  { value: 'certification', label: 'Certification' },
];

export const ExperienceForm: React.FC<ExperienceFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [title, setTitle] = useState<string>(initialData?.title || '');
  const [organizationName, setOrganizationName] = useState<string>(
    initialData?.organization_name || ''
  );
  const [experienceType, setExperienceType] = useState<ExperienceType>(
    initialData?.experience_type || 'work'
  );
  const [startDate, setStartDate] = useState<string>(initialData?.start_date || '');
  const [endDate, setEndDate] = useState<string>(initialData?.end_date || '');
  const [isCurrent, setIsCurrent] = useState<boolean>(initialData?.is_current || false);
  const [description, setDescription] = useState<string>(initialData?.description || '');
  const [skills, setSkills] = useState<string>(initialData?.skills || '');
  const [innovationProjectId, setInnovationProjectId] = useState<string>(
    initialData?.innovation_project_id ? String(initialData.innovation_project_id) : ''
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const isEditMode = Boolean(initialData?.id);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    const cleanTitle = title.trim();
    if (!cleanTitle || cleanTitle.length < 2) {
      newErrors.title = 'Title must be at least 2 characters long.';
    } else if (cleanTitle.length > 150) {
      newErrors.title = 'Title cannot exceed 150 characters.';
    }

    if (organizationName.trim().length > 150) {
      newErrors.organizationName = 'Organization name cannot exceed 150 characters.';
    }

    if (!startDate.trim()) {
      newErrors.startDate = 'Start date is required.';
    }

    if (!isCurrent && endDate.trim() && startDate.trim()) {
      if (new Date(endDate) < new Date(startDate)) {
        newErrors.endDate = 'End date cannot precede start date.';
      }
    }

    const cleanDesc = description.trim();
    if (!cleanDesc || cleanDesc.length < 10) {
      newErrors.description = 'Description must be at least 10 characters long.';
    } else if (cleanDesc.length > 5000) {
      newErrors.description = 'Description cannot exceed 5000 characters.';
    }

    if (skills.length > 1000) {
      newErrors.skills = 'Skills cannot exceed 1000 characters.';
    }

    if (innovationProjectId.trim()) {
      const parsedId = parseInt(innovationProjectId.trim(), 10);
      if (isNaN(parsedId) || parsedId < 1) {
        newErrors.innovationProjectId = 'Innovation project ID must be a valid positive integer.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleIsCurrentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsCurrent(checked);
    if (checked) {
      setEndDate('');
      if (errors.endDate) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.endDate;
          return next;
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) {
      return;
    }

    const cleanProjectId = innovationProjectId.trim()
      ? parseInt(innovationProjectId.trim(), 10)
      : null;

    const payload: ExperienceRecordCreate | ExperienceRecordUpdate = {
      title: title.trim(),
      organization_name: organizationName.trim() || null,
      experience_type: experienceType,
      start_date: startDate.trim(),
      end_date: isCurrent ? null : endDate.trim() || null,
      is_current: isCurrent,
      description: description.trim(),
      skills: skills.trim() || null,
      innovation_project_id: cleanProjectId,
    };

    try {
      await onSubmit(payload);
    } catch (err: any) {
      const msg =
        err.message ||
        err.detail ||
        (typeof err === 'string' ? err : 'An error occurred while saving the experience record.');
      setServerError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="cb-experience-form"
      data-testid="experience-form"
      noValidate
    >
      <h2 className="cb-form-title">
        {isEditMode ? 'Edit Experience Record' : 'Add Experience Record'}
      </h2>

      {serverError && (
        <div className="cb-alert cb-alert-danger" role="alert">
          {serverError}
        </div>
      )}

      {/* Title */}
      <div className="cb-form-group">
        <label htmlFor="exp-title" className="cb-label">
          Title / Role <span className="cb-required-star" aria-hidden="true">*</span>
        </label>
        <input
          id="exp-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Software Engineering Intern, ML Researcher"
          className={`cb-input ${errors.title ? 'cb-input-error' : ''}`}
          aria-required="true"
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? 'exp-title-error' : undefined}
          disabled={isLoading}
        />
        {errors.title && (
          <span id="exp-title-error" className="cb-field-error" role="alert">
            {errors.title}
          </span>
        )}
      </div>

      {/* Organization and Experience Type */}
      <div className="cb-form-row">
        <div className="cb-form-group cb-form-col">
          <label htmlFor="exp-org" className="cb-label">
            Organization / Company / Lab
          </label>
          <input
            id="exp-org"
            type="text"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            placeholder="e.g. Acme Tech, Robotics Institute"
            className={`cb-input ${errors.organizationName ? 'cb-input-error' : ''}`}
            aria-invalid={Boolean(errors.organizationName)}
            aria-describedby={errors.organizationName ? 'exp-org-error' : undefined}
            disabled={isLoading}
          />
          {errors.organizationName && (
            <span id="exp-org-error" className="cb-field-error" role="alert">
              {errors.organizationName}
            </span>
          )}
        </div>

        <div className="cb-form-group cb-form-col">
          <label htmlFor="exp-type" className="cb-label">
            Experience Type <span className="cb-required-star" aria-hidden="true">*</span>
          </label>
          <select
            id="exp-type"
            value={experienceType}
            onChange={(e) => setExperienceType(e.target.value as ExperienceType)}
            className="cb-select"
            aria-required="true"
            disabled={isLoading}
          >
            {EXPERIENCE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Date Fields & Current Checkbox */}
      <div className="cb-form-row">
        <div className="cb-form-group cb-form-col">
          <label htmlFor="exp-start-date" className="cb-label">
            Start Date <span className="cb-required-star" aria-hidden="true">*</span>
          </label>
          <input
            id="exp-start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={`cb-input ${errors.startDate ? 'cb-input-error' : ''}`}
            aria-required="true"
            aria-invalid={Boolean(errors.startDate)}
            aria-describedby={errors.startDate ? 'exp-start-date-error' : undefined}
            disabled={isLoading}
          />
          {errors.startDate && (
            <span id="exp-start-date-error" className="cb-field-error" role="alert">
              {errors.startDate}
            </span>
          )}
        </div>

        <div className="cb-form-group cb-form-col">
          <label htmlFor="exp-end-date" className="cb-label">
            End Date
          </label>
          <input
            id="exp-end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={isCurrent || isLoading}
            className={`cb-input ${errors.endDate ? 'cb-input-error' : ''}`}
            aria-invalid={Boolean(errors.endDate)}
            aria-describedby={errors.endDate ? 'exp-end-date-error' : undefined}
          />
          {errors.endDate && (
            <span id="exp-end-date-error" className="cb-field-error" role="alert">
              {errors.endDate}
            </span>
          )}
        </div>
      </div>

      {/* Is Current Checkbox */}
      <div className="cb-form-group cb-form-checkbox-group">
        <label htmlFor="exp-is-current" className="cb-checkbox-label">
          <input
            id="exp-is-current"
            type="checkbox"
            checked={isCurrent}
            onChange={handleIsCurrentChange}
            disabled={isLoading}
            className="cb-checkbox"
          />
          <span>I am currently working / active in this role</span>
        </label>
      </div>

      {/* Description */}
      <div className="cb-form-group">
        <label htmlFor="exp-description" className="cb-label">
          Description & Responsibilities <span className="cb-required-star" aria-hidden="true">*</span>
        </label>
        <textarea
          id="exp-description"
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your key responsibilities, technologies utilized, and measurable outcomes (min 10 characters)..."
          className={`cb-textarea ${errors.description ? 'cb-input-error' : ''}`}
          aria-required="true"
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? 'exp-desc-error' : undefined}
          disabled={isLoading}
        />
        {errors.description && (
          <span id="exp-desc-error" className="cb-field-error" role="alert">
            {errors.description}
          </span>
        )}
      </div>

      {/* Canonical Skills Input */}
      <div className="cb-form-group">
        <SkillTagInput
          id="exp-skills"
          label="Skills & Technologies"
          value={skills}
          onChange={setSkills}
          placeholder="e.g. React, Python, PostgreSQL (type and select suggestions)"
          helperText="Select structured canonical skills for verified recruiter search matching."
          error={errors.skills}
          disabled={isLoading}
        />
      </div>

      {/* Optional Linked Innovation Project */}
      <div className="cb-form-group">
        <label htmlFor="exp-project-id" className="cb-label">
          Linked Innovation Project ID (Optional)
        </label>
        <input
          id="exp-project-id"
          type="number"
          min="1"
          value={innovationProjectId}
          onChange={(e) => setInnovationProjectId(e.target.value)}
          placeholder="e.g. 1"
          className={`cb-input ${errors.innovationProjectId ? 'cb-input-error' : ''}`}
          aria-invalid={Boolean(errors.innovationProjectId)}
          aria-describedby={errors.innovationProjectId ? 'exp-project-id-error' : undefined}
          disabled={isLoading}
        />
        {errors.innovationProjectId && (
          <span id="exp-project-id-error" className="cb-field-error" role="alert">
            {errors.innovationProjectId}
          </span>
        )}
        <small className="cb-input-hint" style={{ display: 'block', marginTop: '0.25rem', color: 'var(--cb-text-muted)' }}>
          Link this experience claim to a project from your Innovation Projects portfolio.
        </small>
      </div>

      {/* Form Action Buttons */}
      <div className="cb-form-actions">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="cb-btn cb-btn-secondary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="cb-btn cb-btn-primary"
          data-testid="submit-experience-btn"
        >
          {isLoading ? 'Saving...' : isEditMode ? 'Update Experience' : 'Add Experience'}
        </button>
      </div>
    </form>
  );
};
