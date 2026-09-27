import React, { useState, useEffect } from 'react';
import {
  EvaluationRecommendation,
  EvaluationSkillAssessmentCreate,
  ProjectEvaluation,
  ProjectEvaluationCreate,
  SkillAssessmentProficiency,
} from '@/types/projectEvaluation';
import { InnovationProject } from '@/types/innovationProject';

interface ProjectEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: ProjectEvaluationCreate, submitImmediately?: boolean) => Promise<void>;
  project: InnovationProject;
  existingEvaluation?: ProjectEvaluation | null;
  isLoading?: boolean;
}

export const ProjectEvaluationModal: React.FC<ProjectEvaluationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  project,
  existingEvaluation,
  isLoading = false,
}) => {
  const [technicalQuality, setTechnicalQuality] = useState<number | ''>('');
  const [problemSolving, setProblemSolving] = useState<number | ''>('');
  const [execution, setExecution] = useState<number | ''>('');
  const [communication, setCommunication] = useState<number | ''>('');
  const [evidenceQuality, setEvidenceQuality] = useState<number | ''>('');
  const [recommendation, setRecommendation] = useState<EvaluationRecommendation | ''>('');
  const [strengths, setStrengths] = useState('');
  const [improvementAreas, setImprovementAreas] = useState('');
  const [feedback, setFeedback] = useState('');
  const [skillAssessments, setSkillAssessments] = useState<
    Array<{ skillId: number; skillName: string; proficiency: SkillAssessmentProficiency; comments: string }>
  >([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize form state
  useEffect(() => {
    if (existingEvaluation) {
      setTechnicalQuality(existingEvaluation.technical_quality_score ?? '');
      setProblemSolving(existingEvaluation.problem_solving_score ?? '');
      setExecution(existingEvaluation.execution_score ?? '');
      setCommunication(existingEvaluation.communication_documentation_score ?? '');
      setEvidenceQuality(existingEvaluation.evidence_quality_score ?? '');
      setRecommendation(existingEvaluation.recommendation ?? '');
      setStrengths(existingEvaluation.strengths || '');
      setImprovementAreas(existingEvaluation.improvement_areas || '');
      setFeedback(existingEvaluation.feedback || '');

      // Load skill assessments
      if (existingEvaluation.skill_assessments && existingEvaluation.skill_assessments.length > 0) {
        setSkillAssessments(
          existingEvaluation.skill_assessments.map((sa) => ({
            skillId: sa.skill_id,
            skillName: sa.skill_name || `Skill #${sa.skill_id}`,
            proficiency: sa.proficiency,
            comments: sa.comments || '',
          }))
        );
      } else if (project.structured_skills && project.structured_skills.length > 0) {
        setSkillAssessments(
          project.structured_skills.map((s) => ({
            skillId: s.id,
            skillName: s.name,
            proficiency: 'not_observed',
            comments: '',
          }))
        );
      }
    } else {
      setTechnicalQuality('');
      setProblemSolving('');
      setExecution('');
      setCommunication('');
      setEvidenceQuality('');
      setRecommendation('');
      setStrengths('');
      setImprovementAreas('');
      setFeedback('');

      // Populate default project skills
      if (project.structured_skills && project.structured_skills.length > 0) {
        setSkillAssessments(
          project.structured_skills.map((s) => ({
            skillId: s.id,
            skillName: s.name,
            proficiency: 'not_observed',
            comments: '',
          }))
        );
      } else {
        setSkillAssessments([]);
      }
    }
    setValidationError(null);
  }, [existingEvaluation, project, isOpen]);

  if (!isOpen) return null;

  const handleSkillProficiencyChange = (
    index: number,
    proficiency: SkillAssessmentProficiency
  ) => {
    const next = [...skillAssessments];
    next[index].proficiency = proficiency;
    setSkillAssessments(next);
  };

  const handleSkillCommentChange = (index: number, comments: string) => {
    const next = [...skillAssessments];
    next[index].comments = comments;
    setSkillAssessments(next);
  };

  const buildPayload = (): ProjectEvaluationCreate => {
    const skillsPayload: EvaluationSkillAssessmentCreate[] = skillAssessments.map((sa) => ({
      skill_id: sa.skillId,
      proficiency: sa.proficiency,
      comments: sa.comments.trim() || undefined,
    }));

    return {
      technical_quality_score: technicalQuality !== '' ? Number(technicalQuality) : undefined,
      problem_solving_score: problemSolving !== '' ? Number(problemSolving) : undefined,
      execution_score: execution !== '' ? Number(execution) : undefined,
      communication_documentation_score:
        communication !== '' ? Number(communication) : undefined,
      evidence_quality_score: evidenceQuality !== '' ? Number(evidenceQuality) : undefined,
      recommendation: recommendation !== '' ? recommendation : undefined,
      strengths: strengths.trim() || undefined,
      improvement_areas: improvementAreas.trim() || undefined,
      feedback: feedback.trim() || undefined,
      skill_assessments: skillsPayload.length > 0 ? skillsPayload : undefined,
    };
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    try {
      const payload = buildPayload();
      await onSave(payload, false);
    } catch (err: any) {
      setValidationError(err.response?.data?.detail || err.message || 'Failed to save draft.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validate all 5 scores
    if (
      technicalQuality === '' ||
      problemSolving === '' ||
      execution === '' ||
      communication === '' ||
      evidenceQuality === ''
    ) {
      setValidationError('All 5 dimensional scores (1 to 5) are required for submission.');
      return;
    }

    // Validate recommendation
    if (!recommendation) {
      setValidationError('A recommendation is required to submit this evaluation.');
      return;
    }

    try {
      const payload = buildPayload();
      await onSave(payload, true);
    } catch (err: any) {
      setValidationError(err.response?.data?.detail || err.message || 'Failed to submit evaluation.');
    }
  };

  return (
    <div className="cb-modal-overlay" data-testid="project-evaluation-modal">
      <div className="cb-modal-content" style={{ maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="cb-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#f8fafc' }}>
            {existingEvaluation ? 'Edit Project Evaluation' : 'Evaluate Innovation Project'}
          </h3>
          <button
            type="button"
            className="cb-btn-close"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: '#94a3b8' }}>
          Evaluating: <strong style={{ color: '#cbd5e1' }}>{project.title}</strong>
        </p>

        {validationError && (
          <div className="cb-alert cb-alert-danger" style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#7f1d1d', color: '#fecaca', borderRadius: '0.375rem', fontSize: '0.875rem' }} data-testid="evaluation-form-error">
            {validationError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="cb-form">
          {/* Dimensional Scores */}
          <fieldset style={{ border: '1px solid #334155', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1rem' }}>
            <legend style={{ padding: '0 0.5rem', color: '#38bdf8', fontSize: '0.9rem', fontWeight: 600 }}>
              Structured Scoring (1 = Poor, 5 = Exceptional)
            </legend>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="cb-form-group">
                <label htmlFor="eval-tech-score" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  Technical Quality (1-5) *
                </label>
                <select
                  id="eval-tech-score"
                  className="cb-input"
                  value={technicalQuality}
                  onChange={(e) => setTechnicalQuality(e.target.value === '' ? '' : Number(e.target.value))}
                  disabled={isLoading}
                  data-testid="eval-tech-score-select"
                >
                  <option value="">Select score...</option>
                  <option value="1">1 - Needs Significant Work</option>
                  <option value="2">2 - Below Expectations</option>
                  <option value="3">3 - Meets Requirements</option>
                  <option value="4">4 - Strong Technical Execution</option>
                  <option value="5">5 - Exceptional Architecture</option>
                </select>
              </div>

              <div className="cb-form-group">
                <label htmlFor="eval-problem-score" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  Problem Solving (1-5) *
                </label>
                <select
                  id="eval-problem-score"
                  className="cb-input"
                  value={problemSolving}
                  onChange={(e) => setProblemSolving(e.target.value === '' ? '' : Number(e.target.value))}
                  disabled={isLoading}
                  data-testid="eval-problem-score-select"
                >
                  <option value="">Select score...</option>
                  <option value="1">1 - Shallow Approach</option>
                  <option value="2">2 - Basic Solution</option>
                  <option value="3">3 - Solid Approach</option>
                  <option value="4">4 - Highly Effective</option>
                  <option value="5">5 - Innovative & Insightful</option>
                </select>
              </div>

              <div className="cb-form-group">
                <label htmlFor="eval-exec-score" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  Execution & Scope (1-5) *
                </label>
                <select
                  id="eval-exec-score"
                  className="cb-input"
                  value={execution}
                  onChange={(e) => setExecution(e.target.value === '' ? '' : Number(e.target.value))}
                  disabled={isLoading}
                  data-testid="eval-exec-score-select"
                >
                  <option value="">Select score...</option>
                  <option value="1">1 - Incomplete</option>
                  <option value="2">2 - Minimal Progress</option>
                  <option value="3">3 - Working Prototype</option>
                  <option value="4">4 - Polished Deliverable</option>
                  <option value="5">5 - Production-Ready</option>
                </select>
              </div>

              <div className="cb-form-group">
                <label htmlFor="eval-comm-score" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  Communication & Docs (1-5) *
                </label>
                <select
                  id="eval-comm-score"
                  className="cb-input"
                  value={communication}
                  onChange={(e) => setCommunication(e.target.value === '' ? '' : Number(e.target.value))}
                  disabled={isLoading}
                  data-testid="eval-comm-score-select"
                >
                  <option value="">Select score...</option>
                  <option value="1">1 - No Documentation</option>
                  <option value="2">2 - Sparse Docs</option>
                  <option value="3">3 - Clear Overview</option>
                  <option value="4">4 - Thorough Readme & Specs</option>
                  <option value="5">5 - Exemplary Documentation</option>
                </select>
              </div>
            </div>

            <div className="cb-form-group" style={{ marginTop: '0.75rem' }}>
              <label htmlFor="eval-evidence-score" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                Evidence & Artifacts Quality (1-5) *
              </label>
              <select
                id="eval-evidence-score"
                className="cb-input"
                value={evidenceQuality}
                onChange={(e) => setEvidenceQuality(e.target.value === '' ? '' : Number(e.target.value))}
                disabled={isLoading}
                data-testid="eval-evidence-score-select"
              >
                <option value="">Select score...</option>
                <option value="1">1 - Unverifiable / Broken Links</option>
                <option value="2">2 - Weak Evidence</option>
                <option value="3">3 - Working Links / Artifacts</option>
                <option value="4">4 - Strong Verified Evidence</option>
                <option value="5">5 - Comprehensive Multi-Artifact Proof</option>
              </select>
            </div>
          </fieldset>

          {/* Recommendation */}
          <div className="cb-form-group" style={{ marginBottom: '1rem' }}>
            <label htmlFor="eval-recommendation" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 600 }}>
              Hiring Recommendation *
            </label>
            <select
              id="eval-recommendation"
              className="cb-input"
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value as EvaluationRecommendation)}
              disabled={isLoading}
              data-testid="eval-recommendation-select"
            >
              <option value="">Select recommendation...</option>
              <option value="not_recommended">Not Recommended</option>
              <option value="developing">Developing Candidate</option>
              <option value="recommended">Recommended for Interview</option>
              <option value="strongly_recommended">Strongly Recommended (Fast-Track)</option>
            </select>
          </div>

          {/* Skills Assessment */}
          {skillAssessments.length > 0 && (
            <fieldset style={{ border: '1px solid #334155', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1rem' }}>
              <legend style={{ padding: '0 0.5rem', color: '#38bdf8', fontSize: '0.9rem', fontWeight: 600 }}>
                Skill Proficiency Assessment
              </legend>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {skillAssessments.map((sa, idx) => (
                  <div key={sa.skillId} style={{ display: 'grid', gridTemplateColumns: '120px 140px 1fr', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9' }}>
                      {sa.skillName}
                    </span>
                    <select
                      className="cb-input"
                      style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem' }}
                      value={sa.proficiency}
                      onChange={(e) => handleSkillProficiencyChange(idx, e.target.value as SkillAssessmentProficiency)}
                      disabled={isLoading}
                      data-testid={`skill-proficiency-${sa.skillId}`}
                    >
                      <option value="not_observed">Not Observed</option>
                      <option value="basic">Basic</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                    <input
                      type="text"
                      className="cb-input"
                      style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem' }}
                      placeholder="Optional notes..."
                      value={sa.comments}
                      onChange={(e) => handleSkillCommentChange(idx, e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                ))}
              </div>
            </fieldset>
          )}

          {/* Qualitative Feedback */}
          <div className="cb-form-group" style={{ marginBottom: '0.75rem' }}>
            <label htmlFor="eval-strengths" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
              Observed Strengths
            </label>
            <textarea
              id="eval-strengths"
              className="cb-input cb-textarea"
              rows={2}
              placeholder="Highlight standout technical abilities or problem-solving traits..."
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              disabled={isLoading}
              data-testid="eval-strengths-input"
            />
          </div>

          <div className="cb-form-group" style={{ marginBottom: '0.75rem' }}>
            <label htmlFor="eval-improvement" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
              Growth & Improvement Areas
            </label>
            <textarea
              id="eval-improvement"
              className="cb-input cb-textarea"
              rows={2}
              placeholder="Constructive feedback to help candidate improve..."
              value={improvementAreas}
              onChange={(e) => setImprovementAreas(e.target.value)}
              disabled={isLoading}
              data-testid="eval-improvement-input"
            />
          </div>

          <div className="cb-form-group" style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="eval-feedback" style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
              Overall Feedback Summary
            </label>
            <textarea
              id="eval-feedback"
              className="cb-input cb-textarea"
              rows={2}
              placeholder="Summary notes for the student..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              disabled={isLoading}
              data-testid="eval-feedback-input"
            />
          </div>

          {/* Modal Actions */}
          <div className="cb-modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              className="cb-btn cb-btn-secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="cb-btn cb-btn-secondary"
              onClick={handleSaveDraft}
              disabled={isLoading}
              data-testid="save-draft-btn"
            >
              {isLoading ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              type="submit"
              className="cb-btn cb-btn-primary"
              disabled={isLoading}
              data-testid="submit-modal-btn"
            >
              {isLoading ? 'Submitting...' : 'Submit Evaluation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
