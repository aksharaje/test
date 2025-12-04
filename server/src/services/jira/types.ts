// Jira API Types

export interface JiraUser {
  accountId: string;
  emailAddress?: string;
  displayName: string;
  avatarUrls?: Record<string, string>;
  active: boolean;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
  avatarUrls?: Record<string, string>;
}

export interface JiraIssueType {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  subtask: boolean;
  hierarchyLevel?: number;
}

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

export interface JiraBoard {
  id: number;
  name: string;
  type: 'scrum' | 'kanban' | 'simple';
  location?: {
    projectId?: number;
    projectKey?: string;
    projectName?: string;
  };
}

export interface JiraSprint {
  id: number;
  name: string;
  state: 'future' | 'active' | 'closed';
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  goal?: string;
  originBoardId?: number;
}

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description?: string | { content: unknown[] }; // Can be string or ADF
    issuetype: JiraIssueType;
    status: {
      id: string;
      name: string;
      statusCategory: {
        id: number;
        key: string;
        name: string;
      };
    };
    priority?: {
      id: string;
      name: string;
    };
    assignee?: JiraUser;
    reporter?: JiraUser;
    labels?: string[];
    components?: Array<{ id: string; name: string }>;
    project: {
      id: string;
      key: string;
      name: string;
    };
    created: string;
    updated: string;
    resolutiondate?: string;
    parent?: {
      id: string;
      key: string;
      fields?: {
        summary: string;
        issuetype: JiraIssueType;
      };
    };
    // Custom fields accessed via customfield_XXXXX
    [key: string]: unknown;
  };
}

export interface JiraCreateMeta {
  projects: Array<{
    id: string;
    key: string;
    name: string;
    issuetypes: Array<{
      id: string;
      name: string;
      fields: Record<string, JiraFieldMeta>;
    }>;
  }>;
}

export interface JiraFieldMeta {
  required: boolean;
  name: string;
  key: string;
  schema: {
    type: string;
    custom?: string;
    customId?: number;
    items?: string;
  };
  operations?: string[];
  allowedValues?: Array<{
    id: string;
    name?: string;
    value?: string;
  }>;
}

export interface JiraSprintReport {
  sprint: JiraSprint;
  contents: {
    completedIssues: JiraIssue[];
    issuesNotCompletedInCurrentSprint: JiraIssue[];
    puntedIssues: JiraIssue[];
    issuesCompletedInAnotherSprint: JiraIssue[];
    completedIssuesEstimateSum: { value: number };
    issuesNotCompletedInCurrentSprintEstimateSum: { value: number };
    allIssuesEstimateSum: { value: number };
  };
}

export interface JiraVelocityReport {
  sprints: Array<{
    id: number;
    name: string;
    state: string;
    startDate: string;
    endDate: string;
  }>;
  velocityStatEntries: Record<
    string,
    {
      estimated: { value: number };
      completed: { value: number };
    }
  >;
}

export interface JiraAccessibleResource {
  id: string;
  name: string;
  url: string;
  scopes: string[];
  avatarUrl?: string;
}

export interface JiraOAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export interface JiraSearchResult {
  expand: string;
  startAt: number;
  maxResults: number;
  total: number;
  issues: JiraIssue[];
}

// Pagination
export interface JiraPaginatedResponse<T> {
  maxResults: number;
  startAt: number;
  total?: number;
  isLast?: boolean;
  values: T[];
}

// Error
export interface JiraErrorResponse {
  errorMessages?: string[];
  errors?: Record<string, string>;
}
