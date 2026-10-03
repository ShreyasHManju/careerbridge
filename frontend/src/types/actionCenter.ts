import { NotificationType } from './notification';

export type ActionPriority = 'urgent' | 'high' | 'medium' | 'standard' | 'low';

export type ActionCategory =
  | 'application'
  | 'interview'
  | 'invitation'
  | 'experience_verification'
  | 'project_evaluation'
  | 'recruiter_verification'
  | 'job_moderation'
  | 'user_governance'
  | 'profile'
  | 'talent_sourcing'
  | 'general';

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  destination: string;
  ctaLabel: string;
  priority: ActionPriority;
  category: ActionCategory;
  count?: number;
  badgeText?: string;
  sourceDomain?: 'student' | 'recruiter' | 'admin' | 'platform';
  notificationType?: NotificationType;
  metadata?: Record<string, unknown>;
}

export interface ActionCenterSectionConfig {
  title?: string;
  subtitle?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  maxItems?: number;
  className?: string;
}
