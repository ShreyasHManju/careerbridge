import React, { useState } from 'react';
import {
  InnovationProject,
  InnovationProjectCreate,
  InnovationProjectUpdate,
  ProjectStatus,
  ProjectType,
  ProjectVisibility,
} from '@/types/innovationProject';
import { SkillTagInput } from '@/components/ui/SkillTagInput';

interface InnovationProjectFormProps {
  initialData?: InnovationProject | null;
  onSubmit: (data: InnovationProjectCreate | InnovationProjectUpdate) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const URL_REGEX = /^https?:\/\/.+/i;

export const InnovationProjectForm: React.FC<InnovationProjectFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [shortDescription, setShortDescription] = useState(initialData?.short_description || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [projectType, setProjectType] = useState<ProjectType>(initialData?.project_type || 'software');
  const [status, setStatus] = useState<ProjectStatus>(initialData?.status || 'active');
  const [visibility, setVisibility] = useState<ProjectVisibility>(initialData?.visibility || 'public');
  const [skills, setSkills] = useState(initialData?.skills || '');
  const [repositoryUrl, setRepositoryUrl] = useState(initialData?.repository_url || '');
  const [liveDemoUrl, setLiveDemoUrl] = useState(initialData?.live_demo_url || '');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim() || title.trim().length < 2) {
      newErrors.title = 'Title must be at least 2 characters long.';
    } else if (title.trim().length > 150) {
      newErrors.title = 'Title cannot exceed 150 characters.';
    }

    if (shortDescription.trim() && shortDescription.trim().length > 300) {
      newErrors.shortDescription = 'Short description cannot exceed 300 characters.';
    }

    if (!description.trim() || description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters long.';
    } else if (description.trim().length > 5000) {
      newErrors.description = 'Description cannot exceed 5000 characters.';
    }

    if (repositoryUrl.trim() && !URL_REGEX.test(repositoryUrl.trim())) {
      newErrors.repositoryUrl = 'Repository URL must start with http:// or https://';
    }

    if (liveDemoUrl.trim() && !URL_REGEX.test(liveDemoUrl.trim())) {
      newErrors.liveDemoUrl = 'Live Demo URL must start with http:// or https://';
    }

    if (skills.length > 1000) {
      newErrors.skills = 'Skills cannot exceed 1000 characters.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) {
      return;
    }

    const payload: InnovationProjectCreate | InnovationProjectUpdate = {
      title: title.trim(),
      short_description: shortDescription.trim() || null,
      description: description.trim(),
      project_type: projectType,
      status,
      visibility,
      skills: skills.trim() || null,
      repository_url: repositoryUrl.trim() || null,
      live_demo_url: liveDemoUrl.trim() || null,
    };

    try {
      await onSubmit(payload);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'An error occurred while saving the project.';
      setServerError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="cb-project-form" noValidate>
      {serverError && (
        <div className="cb-alert cb-alert-danger" role="alert">
          {serverError}
        </div>
      )}

      <div className="cb-form-group">
        <label htmlFor="project-title" className="cb-label">
          Project Title <span className="cb-required">*</span>
        </label>
        <input
          id="project-title"
          type="text"
          className={`cb-input ${errors.title ? 'cb-input-error' : ''}`}
          placeholder="e.g. Autonomous Drone Swarm Controller"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isLoading}
          required
        />
        {errors.title && <span className="cb-field-error">{errors.title}</span>}
      </div>

      <div className="cb-form-group">
        <label htmlFor="project-short-description" className="cb-label">
          Short Summary
        </label>
        <input
          id="project-short-description"
          type="text"
          className={`cb-input ${errors.shortDescription ? 'cb-input-error' : ''}`}
          placeholder="Brief 1-line elevator pitch for recruiter cards"
          value={shortDescription}
          onChange={(e) => setShortDescription(e.target.value)}
          disabled={isLoading}
        />
        {errors.shortDescription && (
          <span className="cb-field-error">{errors.shortDescription}</span>
        )}
      </div>

      <div className="cb-form-group">
        <label htmlFor="project-description" className="cb-label">
          Detailed Description <span className="cb-required">*</span>
        </label>
        <textarea
          id="project-description"
          rows={5}
          className={`cb-input cb-textarea ${errors.description ? 'cb-input-error' : ''}`}
          placeholder="Explain the technical problem, your architecture, technologies used, and key outcomes..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isLoading}
          required
        />
        {errors.description && <span className="cb-field-error">{errors.description}</span>}
      </div>

      <div className="cb-form-row">
        <div className="cb-form-group cb-form-col">
          <label htmlFor="project-type" className="cb-label">
            Project Category
          </label>
          <select
            id="project-type"
            className="cb-input cb-select"
            value={projectType}
            onChange={(e) => setProjectType(e.target.value as ProjectType)}
            disabled={isLoading}
          >
            <option value="software">Software / Web / Cloud</option>
            <option value="hardware">Hardware / Embedded / IoT</option>
            <option value="research">Research / AI & Data Science</option>
            <option value="academic">Academic / Capstone</option>
            <option value="entrepreneurship">Entrepreneurship / Startup</option>
            <option value="social_impact">Social Impact / Open Source</option>
            <option value="other">Other / Multidisciplinary</option>
          </select>
        </div>

        <div className="cb-form-group cb-form-col">
          <label htmlFor="project-visibility" className="cb-label">
            Visibility
          </label>
          <select
            id="project-visibility"
            className="cb-input cb-select"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as ProjectVisibility)}
            disabled={isLoading}
          >
            <option value="public">Public (Visible to recruiters and peers)</option>
            <option value="private">Private (Only visible to you)</option>
          </select>
        </div>

        <div className="cb-form-group cb-form-col">
          <label htmlFor="project-status" className="cb-label">
            Status
          </label>
          <select
            id="project-status"
            className="cb-input cb-select"
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            disabled={isLoading}
          >
            <option value="active">Active (Ongoing / Showcased)</option>
            <option value="draft">Draft (Work in progress)</option>
            <option value="archived">Archived (Completed / Preserved)</option>
          </select>
        </div>
      </div>

      <div className="cb-form-group">
        <label htmlFor="skills" className="cb-label">
          Technologies & Skills
        </label>
        <SkillTagInput
          value={skills}
          onChange={(newSkills) => setSkills(newSkills)}
          disabled={isLoading}
          placeholder="Type skill (e.g. PyTorch, React, ROS) and press Enter"
        />
        {errors.skills && <span className="cb-field-error">{errors.skills}</span>}
      </div>

      <div className="cb-form-row">
        <div className="cb-form-group cb-form-col">
          <label htmlFor="project-repo-url" className="cb-label">
            Repository URL
          </label>
          <input
            id="project-repo-url"
            type="url"
            className={`cb-input ${errors.repositoryUrl ? 'cb-input-error' : ''}`}
            placeholder="https://github.com/username/project"
            value={repositoryUrl}
            onChange={(e) => setRepositoryUrl(e.target.value)}
            disabled={isLoading}
          />
          {errors.repositoryUrl && (
            <span className="cb-field-error">{errors.repositoryUrl}</span>
          )}
        </div>

        <div className="cb-form-group cb-form-col">
          <label htmlFor="project-demo-url" className="cb-label">
            Live Demo / Deployment URL
          </label>
          <input
            id="project-demo-url"
            type="url"
            className={`cb-input ${errors.liveDemoUrl ? 'cb-input-error' : ''}`}
            placeholder="https://myproject.demo.app"
            value={liveDemoUrl}
            onChange={(e) => setLiveDemoUrl(e.target.value)}
            disabled={isLoading}
          />
          {errors.liveDemoUrl && (
            <span className="cb-field-error">{errors.liveDemoUrl}</span>
          )}
        </div>
      </div>

      <div className="cb-form-actions">
        <button
          type="button"
          onClick={onCancel}
          className="cb-btn cb-btn-secondary"
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="cb-btn cb-btn-primary"
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : initialData ? 'Update Project' : 'Publish Project'}
        </button>
      </div>
    </form>
  );
};
