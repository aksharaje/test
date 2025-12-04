// Jira API Client - handles all communication with Jira REST API

import type {
  JiraUser,
  JiraProject,
  JiraIssueType,
  JiraField,
  JiraBoard,
  JiraSprint,
  JiraIssue,
  JiraCreateMeta,
  JiraSearchResult,
  JiraPaginatedResponse,
  JiraVelocityReport,
  JiraAccessibleResource,
  JiraOAuthTokenResponse,
  JiraErrorResponse,
} from './types.js';

export interface JiraClientConfig {
  baseUrl: string;
  cloudId?: string;
  accessToken: string;
  isCloud: boolean;
}

export class JiraApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public jiraErrors?: JiraErrorResponse
  ) {
    super(message);
    this.name = 'JiraApiError';
  }
}

export class JiraClient {
  private baseUrl: string;
  private accessToken: string;
  private isCloud: boolean;

  constructor(config: JiraClientConfig) {
    this.accessToken = config.accessToken;
    this.isCloud = config.isCloud;

    // For Jira Cloud, we use the cloud API with cloudId
    // For Server/Data Center, we use the base URL directly
    if (config.isCloud && config.cloudId) {
      this.baseUrl = `https://api.atlassian.com/ex/jira/${config.cloudId}`;
    } else {
      this.baseUrl = config.baseUrl.replace(/\/$/, '');
    }
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorBody: JiraErrorResponse | undefined;
      try {
        errorBody = await response.json();
      } catch {
        // Ignore JSON parse errors
      }

      const errorMessage = errorBody?.errorMessages?.join(', ') ||
        Object.values(errorBody?.errors || {}).join(', ') ||
        `Jira API error: ${response.status} ${response.statusText}`;

      throw new JiraApiError(errorMessage, response.status, errorBody);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  // ==================
  // Authentication
  // ==================

  static async getAccessibleResources(accessToken: string): Promise<JiraAccessibleResource[]> {
    const response = await fetch(
      'https://api.atlassian.com/oauth/token/accessible-resources',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new JiraApiError(
        'Failed to get accessible resources',
        response.status
      );
    }

    return response.json();
  }

  static async exchangeCodeForTokens(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string
  ): Promise<JiraOAuthTokenResponse> {
    const response = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new JiraApiError(
        `Failed to exchange code for tokens: ${error}`,
        response.status
      );
    }

    return response.json();
  }

  static async refreshAccessToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string
  ): Promise<JiraOAuthTokenResponse> {
    const response = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new JiraApiError(
        `Failed to refresh token: ${error}`,
        response.status
      );
    }

    return response.json();
  }

  // ==================
  // User
  // ==================

  async getCurrentUser(): Promise<JiraUser> {
    return this.request<JiraUser>('/rest/api/3/myself');
  }

  // ==================
  // Projects
  // ==================

  async getProjects(): Promise<JiraProject[]> {
    const result = await this.request<JiraPaginatedResponse<JiraProject>>(
      '/rest/api/3/project/search?expand=description'
    );
    return result.values;
  }

  async getProject(projectIdOrKey: string): Promise<JiraProject> {
    return this.request<JiraProject>(`/rest/api/3/project/${projectIdOrKey}`);
  }

  // ==================
  // Issue Types
  // ==================

  async getIssueTypes(projectIdOrKey: string): Promise<JiraIssueType[]> {
    const project = await this.request<{ issueTypes: JiraIssueType[] }>(
      `/rest/api/3/project/${projectIdOrKey}`
    );
    return project.issueTypes || [];
  }

  // ==================
  // Fields
  // ==================

  async getFields(): Promise<JiraField[]> {
    return this.request<JiraField[]>('/rest/api/3/field');
  }

  async getCreateMeta(
    projectKeys: string[],
    issueTypeIds?: string[]
  ): Promise<JiraCreateMeta> {
    const params = new URLSearchParams({
      projectKeys: projectKeys.join(','),
      expand: 'projects.issuetypes.fields',
    });
    if (issueTypeIds?.length) {
      params.set('issuetypeIds', issueTypeIds.join(','));
    }
    return this.request<JiraCreateMeta>(
      `/rest/api/3/issue/createmeta?${params.toString()}`
    );
  }

  // ==================
  // Boards (Agile API)
  // ==================

  async getBoards(projectKeyOrId?: string): Promise<JiraBoard[]> {
    const params = new URLSearchParams({ maxResults: '100' });
    if (projectKeyOrId) {
      params.set('projectKeyOrId', projectKeyOrId);
    }

    const result = await this.request<JiraPaginatedResponse<JiraBoard>>(
      `/rest/agile/1.0/board?${params.toString()}`
    );
    return result.values;
  }

  async getBoard(boardId: number): Promise<JiraBoard> {
    return this.request<JiraBoard>(`/rest/agile/1.0/board/${boardId}`);
  }

  async getBoardConfiguration(boardId: number): Promise<{
    estimation?: { field?: { fieldId: string; displayName: string } };
  }> {
    return this.request(`/rest/agile/1.0/board/${boardId}/configuration`);
  }

  // ==================
  // Sprints
  // ==================

  async getSprints(
    boardId: number,
    state?: 'future' | 'active' | 'closed'
  ): Promise<JiraSprint[]> {
    const params = new URLSearchParams({ maxResults: '100' });
    if (state) {
      params.set('state', state);
    }

    const result = await this.request<JiraPaginatedResponse<JiraSprint>>(
      `/rest/agile/1.0/board/${boardId}/sprint?${params.toString()}`
    );
    return result.values;
  }

  async getSprint(sprintId: number): Promise<JiraSprint> {
    return this.request<JiraSprint>(`/rest/agile/1.0/sprint/${sprintId}`);
  }

  async getSprintIssues(
    sprintId: number,
    fields?: string[]
  ): Promise<JiraIssue[]> {
    const params = new URLSearchParams({ maxResults: '100' });
    if (fields?.length) {
      params.set('fields', fields.join(','));
    }

    const result = await this.request<{ issues: JiraIssue[] }>(
      `/rest/agile/1.0/sprint/${sprintId}/issue?${params.toString()}`
    );
    return result.issues;
  }

  // ==================
  // Velocity & Reports
  // ==================

  async getVelocityReport(boardId: number): Promise<JiraVelocityReport> {
    // Note: This endpoint might not be available on all Jira versions
    // It's part of Jira Software reports
    return this.request<JiraVelocityReport>(
      `/rest/greenhopper/1.0/rapid/charts/velocity?rapidViewId=${boardId}`
    );
  }

  // ==================
  // Issues
  // ==================

  async getIssue(issueIdOrKey: string, fields?: string[]): Promise<JiraIssue> {
    const params = new URLSearchParams();
    if (fields?.length) {
      params.set('fields', fields.join(','));
    }
    const queryString = params.toString();
    const path = `/rest/api/3/issue/${issueIdOrKey}${queryString ? `?${queryString}` : ''}`;
    return this.request<JiraIssue>(path);
  }

  async searchIssues(
    jql: string,
    fields?: string[],
    startAt = 0,
    maxResults = 50
  ): Promise<JiraSearchResult> {
    return this.request<JiraSearchResult>('/rest/api/3/search', {
      method: 'POST',
      body: JSON.stringify({
        jql,
        fields: fields || ['summary', 'status', 'issuetype', 'priority', 'assignee'],
        startAt,
        maxResults,
      }),
    });
  }

  async createIssue(
    projectKey: string,
    issueTypeId: string,
    fields: Record<string, unknown>
  ): Promise<JiraIssue> {
    const result = await this.request<{ id: string; key: string }>(
      '/rest/api/3/issue',
      {
        method: 'POST',
        body: JSON.stringify({
          fields: {
            project: { key: projectKey },
            issuetype: { id: issueTypeId },
            ...fields,
          },
        }),
      }
    );

    // Fetch the created issue to get full details
    return this.getIssue(result.key);
  }

  async updateIssue(
    issueIdOrKey: string,
    fields: Record<string, unknown>
  ): Promise<void> {
    await this.request(`/rest/api/3/issue/${issueIdOrKey}`, {
      method: 'PUT',
      body: JSON.stringify({ fields }),
    });
  }

  async moveIssueToSprint(issueKeys: string[], sprintId: number): Promise<void> {
    await this.request(`/rest/agile/1.0/sprint/${sprintId}/issue`, {
      method: 'POST',
      body: JSON.stringify({ issues: issueKeys }),
    });
  }

  // ==================
  // Backlog
  // ==================

  async getBacklogIssues(
    boardId: number,
    fields?: string[]
  ): Promise<JiraIssue[]> {
    const params = new URLSearchParams({ maxResults: '100' });
    if (fields?.length) {
      params.set('fields', fields.join(','));
    }

    const result = await this.request<{ issues: JiraIssue[] }>(
      `/rest/agile/1.0/board/${boardId}/backlog?${params.toString()}`
    );
    return result.issues;
  }

  // ==================
  // Epic Children
  // ==================

  async getEpicIssues(epicIdOrKey: string): Promise<JiraIssue[]> {
    // Search for issues with this epic as parent
    const result = await this.searchIssues(
      `"Epic Link" = ${epicIdOrKey} OR parent = ${epicIdOrKey}`,
      ['summary', 'status', 'issuetype', 'priority', 'assignee', 'parent']
    );
    return result.issues;
  }
}

// Factory function to create a client from stored integration
export function createJiraClient(integration: {
  baseUrl: string;
  cloudId?: string | null;
  accessToken: string;
}): JiraClient {
  const isCloud = !!integration.cloudId;
  return new JiraClient({
    baseUrl: integration.baseUrl,
    cloudId: integration.cloudId || undefined,
    accessToken: integration.accessToken,
    isCloud,
  });
}
