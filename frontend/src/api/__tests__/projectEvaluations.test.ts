import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../client';
import {
  createProjectEvaluation,
  getProjectEvaluations,
  getProjectEvaluationById,
  updateProjectEvaluation,
  submitProjectEvaluation,
  withdrawProjectEvaluation,
} from '../projectEvaluations';
import { ProjectEvaluation, ProjectEvaluationCreate, ProjectEvaluationUpdate } from '@/types/projectEvaluation';

describe('Project Evaluations API Module', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockEvaluation: ProjectEvaluation = {
    id: 10,
    project_id: 1,
    student_id: 2,
    recruiter_id: 3,
    status: 'draft',
    technical_quality_score: 5,
    problem_solving_score: 4,
    execution_score: 4,
    communication_documentation_score: 5,
    evidence_quality_score: 4,
    overall_score: 4.4,
    recommendation: 'strongly_recommended',
    strengths: 'Outstanding architecture and clear documentation.',
    improvement_areas: 'Could add automated integration tests.',
    feedback: 'Overall great work!',
    skill_assessments: [
      {
        id: 1,
        evaluation_id: 10,
        skill_id: 101,
        skill_name: 'Python',
        proficiency: 'advanced',
        notes: 'Demonstrated mastery',
        created_at: '2026-09-27T10:00:00Z',
      },
    ],
    recruiter_name: 'Jane Recruiter',
    recruiter_company: 'Acme Corp',
    submitted_at: null,
    created_at: '2026-09-27T10:00:00Z',
    updated_at: '2026-09-27T10:00:00Z',
  };

  it('createProjectEvaluation calls POST /innovation-projects/{id}/evaluations', async () => {
    const spy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: mockEvaluation });

    const payload: ProjectEvaluationCreate = {
      technical_quality_score: 5,
      problem_solving_score: 4,
      execution_score: 4,
      communication_documentation_score: 5,
      evidence_quality_score: 4,
      recommendation: 'strongly_recommended',
      strengths: 'Clean code',
      feedback: 'Good job',
      skill_assessments: [{ skill_id: 101, proficiency: 'advanced' }],
    };

    const res = await createProjectEvaluation(1, payload);
    expect(spy).toHaveBeenCalledWith('/innovation-projects/1/evaluations', payload);
    expect(res).toEqual(mockEvaluation);
  });

  it('getProjectEvaluations calls GET /innovation-projects/{id}/evaluations', async () => {
    const listRes = [mockEvaluation];
    const spy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: listRes });

    const res = await getProjectEvaluations(1);
    expect(spy).toHaveBeenCalledWith('/innovation-projects/1/evaluations');
    expect(res).toEqual(listRes);
  });

  it('getProjectEvaluationById calls GET /project-evaluations/{id}', async () => {
    const spy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: mockEvaluation });

    const res = await getProjectEvaluationById(10);
    expect(spy).toHaveBeenCalledWith('/project-evaluations/10');
    expect(res).toEqual(mockEvaluation);
  });

  it('updateProjectEvaluation calls PATCH /project-evaluations/{id}', async () => {
    const updated = { ...mockEvaluation, strengths: 'Updated strengths' };
    const spy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({ data: updated });

    const payload: ProjectEvaluationUpdate = { strengths: 'Updated strengths' };
    const res = await updateProjectEvaluation(10, payload);
    expect(spy).toHaveBeenCalledWith('/project-evaluations/10', payload);
    expect(res).toEqual(updated);
  });

  it('submitProjectEvaluation calls POST /project-evaluations/{id}/submit', async () => {
    const submitted = { ...mockEvaluation, status: 'submitted', submitted_at: '2026-09-27T10:05:00Z' };
    const spy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: submitted });

    const res = await submitProjectEvaluation(10);
    expect(spy).toHaveBeenCalledWith('/project-evaluations/10/submit');
    expect(res.status).toBe('submitted');
  });

  it('withdrawProjectEvaluation calls POST /project-evaluations/{id}/withdraw', async () => {
    const withdrawn = { ...mockEvaluation, status: 'withdrawn' };
    const spy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: withdrawn });

    const res = await withdrawProjectEvaluation(10);
    expect(spy).toHaveBeenCalledWith('/project-evaluations/10/withdraw');
    expect(res.status).toBe('withdrawn');
  });
});
