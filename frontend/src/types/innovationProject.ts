import { Skill } from './skill';

export type ProjectType =
  | 'software'
  | 'hardware'
  | 'research'
  | 'academic'
  | 'entrepreneurship'
  | 'social_impact'
  | 'other';

export type ProjectStatus = 'draft' | 'active' | 'archived';

export type ProjectVisibility = 'private' | 'public';

export type MilestoneStatus = 'todo' | 'in_progress' | 'completed';

export interface ProjectMilestone {
  id: number;
  innovation_project_id: number;
  title: string;
  description?: string | null;
  status: MilestoneStatus;
  display_order: number;
  due_date?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMilestoneCreate {
  title: string;
  description?: string | null;
  status?: MilestoneStatus;
  display_order?: number;
  due_date?: string | null;
}

export interface ProjectMilestoneUpdate {
  title?: string;
  description?: string | null;
  status?: MilestoneStatus;
  display_order?: number;
  due_date?: string | null;
}

export interface ProjectMilestoneListResponse {
  items: ProjectMilestone[];
  total: number;
  completed: number;
  progress_percentage: number;
}

export interface InnovationProject {
  id: number;
  student_id: number;
  title: string;
  slug: string;
  short_description?: string | null;
  description: string;
  project_type: ProjectType;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  skills?: string | null;
  structured_skills?: Skill[];
  repository_url?: string | null;
  live_demo_url?: string | null;
  created_at: string;
  updated_at: string;
  owner_name?: string | null;
  milestones?: ProjectMilestone[];
  total_milestones?: number | null;
  completed_milestones?: number | null;
  progress_percentage?: number | null;
}

export interface InnovationProjectCreate {
  title: string;
  short_description?: string | null;
  description: string;
  project_type?: ProjectType;
  status?: ProjectStatus;
  visibility?: ProjectVisibility;
  skills?: string | null;
  repository_url?: string | null;
  live_demo_url?: string | null;
}

export interface InnovationProjectUpdate {
  title?: string;
  short_description?: string | null;
  description?: string;
  project_type?: ProjectType;
  status?: ProjectStatus;
  visibility?: ProjectVisibility;
  skills?: string | null;
  repository_url?: string | null;
  live_demo_url?: string | null;
}

export interface InnovationProjectPaginationResponse {
  items: InnovationProject[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

// =========================================================================
// Project Evidence Types (Milestone R5)
// =========================================================================

export type EvidenceType =
  | 'repository'
  | 'document'
  | 'image'
  | 'video'
  | 'demo'
  | 'presentation'
  | 'link'
  | 'other';

export interface ProjectEvidence {
  id: number;
  innovation_project_id: number;
  milestone_id?: number | null;
  title: string;
  description?: string | null;
  evidence_type: EvidenceType;
  url: string;
  created_at: string;
  updated_at: string;
  verification?: ProjectEvidenceVerification | null;
}

export interface ProjectEvidenceCreate {
  title: string;
  description?: string | null;
  evidence_type?: EvidenceType;
  url: string;
  milestone_id?: number | null;
}

export interface ProjectEvidenceUpdate {
  title?: string;
  description?: string | null;
  evidence_type?: EvidenceType;
  url?: string;
  milestone_id?: number | null;
}

export interface ProjectEvidenceListResponse {
  project_id: number;
  total_count: number;
  items: ProjectEvidence[];
}

// =========================================================================
// Project Evidence Verification Types (Milestone R6)
// =========================================================================

export type EvidenceVerificationStatus = 'pending' | 'verified' | 'rejected';

export interface ProjectEvidenceVerification {
  id: number;
  evidence_id: number;
  verifier_id?: number | null;
  status: EvidenceVerificationStatus;
  notes?: string | null;
  verified_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EvidenceVerificationCreate {
  status?: EvidenceVerificationStatus;
  notes?: string | null;
}

export interface EvidenceVerificationUpdate {
  status?: EvidenceVerificationStatus;
  notes?: string | null;
}
