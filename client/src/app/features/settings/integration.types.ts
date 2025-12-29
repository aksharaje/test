// Jira Integration Types

export interface Integration {
  id: number;
  provider: 'jira' | 'ado' | 'servicenow' | 'zendesk' | 'qualtrics';
  name: string;
  baseUrl: string;
  cloudId: string | null;
  authType: 'oauth' | 'pat';
  status: 'connected' | 'error' | 'needs_reauth';
  lastSyncAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FieldMapping {
  id: number;
  integrationId: number;
  ourField: MappableField;
  providerFieldId: string;
  providerFieldName: string;
  providerFieldType: string | null;
  confidence: number;
  adminConfirmed: boolean;
}

export type MappableField =
  | 'story_points'
  | 'sprint'
  | 'parent'
  | 'team'
  | 'priority'
  | 'labels'
  | 'components';

export interface JiraField {
  id: string;
  key: string;
  name: string;
  custom: boolean;
  schema?: {
    type: string;
    custom?: string;
    customId?: number;
    items?: string;
  };
}

export interface JiraProject {
  id: number;
  jiraId: string;
  key: string;
  name: string;
  projectType: string | null;
  avatarUrl: string | null;
}

export interface JiraBoard {
  id: number;
  jiraId: number;
  name: string;
  type: 'scrum' | 'kanban';
  projectId?: string;
  projectKey?: string;
  velocityAvg?: number;
  velocityLastN?: number;
  syncedAt: string;
}

export interface OAuthStartResponse {
  authUrl: string;
  state: string;
}

export const MAPPABLE_FIELD_LABELS: Record<MappableField, string> = {
  story_points: 'Story Points',
  sprint: 'Sprint',
  parent: 'Parent',
  team: 'Team',
  priority: 'Priority',
  labels: 'Labels',
  components: 'Components',
};
