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
