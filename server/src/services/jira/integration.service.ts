// Integration Service - manages Jira connections and OAuth flow

import { db } from '../../db/index.js';
import {
  integrations,
  fieldMappings,
  jiraProjects,
  jiraBoards,
  jiraSprints,
  jiraIssues,
  requiredFields,
  type IntegrationProvider,
  type IntegrationStatus,
  type MappableField,
  type RequiredFieldInfo,
} from '../../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { JiraClient, JiraApiError, createJiraClient } from './client.js';
import type { JiraField, JiraBoard, JiraSprint } from './types.js';

// Environment variables for OAuth
const JIRA_CLIENT_ID = process.env.JIRA_CLIENT_ID || '';
const JIRA_CLIENT_SECRET = process.env.JIRA_CLIENT_SECRET || '';
const JIRA_REDIRECT_URI = process.env.JIRA_REDIRECT_URI || 'http://localhost:3000/api/integrations/jira/oauth/callback';

// OAuth scopes we need
const JIRA_SCOPES = [
  'read:jira-work',
  'write:jira-work',
  'read:jira-user',
  'read:sprint:jira-software',
  'read:board-scope:jira-software',
  'read:project:jira',
  'offline_access',
];

export interface Integration {
  id: number;
  provider: IntegrationProvider;
  name: string;
  baseUrl: string;
  cloudId: string | null;
  authType: 'oauth' | 'pat';
  status: IntegrationStatus;
  lastSyncAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
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

// ==================
// OAuth Flow
// ==================

export function getOAuthAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: JIRA_CLIENT_ID,
    scope: JIRA_SCOPES.join(' '),
    redirect_uri: JIRA_REDIRECT_URI,
    state,
    response_type: 'code',
    prompt: 'consent',
  });

  return `https://auth.atlassian.com/authorize?${params.toString()}`;
}

export async function handleOAuthCallback(code: string): Promise<Integration> {
  // Exchange code for tokens
  const tokens = await JiraClient.exchangeCodeForTokens(
    code,
    JIRA_CLIENT_ID,
    JIRA_CLIENT_SECRET,
    JIRA_REDIRECT_URI
  );

  // Get accessible resources (sites)
  const resources = await JiraClient.getAccessibleResources(tokens.access_token);

  if (resources.length === 0) {
    throw new Error('No accessible Jira sites found');
  }

  // Use the first resource (in multi-site scenarios, we'd let user choose)
  const resource = resources[0];

  // Calculate token expiry
  const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  // Create integration record
  const [integration] = await db
    .insert(integrations)
    .values({
      provider: 'jira',
      name: resource.name,
      baseUrl: resource.url,
      cloudId: resource.id,
      authType: 'oauth',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt,
      scopes: JIRA_SCOPES,
      status: 'connected',
    })
    .returning();

  // Trigger initial sync
  await syncIntegrationData(integration.id);

  return mapIntegration(integration);
}

export async function connectWithPAT(
  baseUrl: string,
  pat: string,
  name?: string
): Promise<Integration> {
  // Validate the PAT by making a test request
  const client = new JiraClient({
    baseUrl,
    accessToken: pat,
    isCloud: false,
  });

  try {
    const user = await client.getCurrentUser();

    // Create integration record
    const [integration] = await db
      .insert(integrations)
      .values({
        provider: 'jira',
        name: name || `Jira - ${baseUrl}`,
        baseUrl,
        cloudId: null,
        authType: 'pat',
        accessToken: pat,
        refreshToken: null,
        tokenExpiresAt: null, // PATs don't expire (usually)
        scopes: [],
        status: 'connected',
      })
      .returning();

    // Trigger initial sync
    await syncIntegrationData(integration.id);

    return mapIntegration(integration);
  } catch (error) {
    if (error instanceof JiraApiError && error.statusCode === 401) {
      throw new Error('Invalid Personal Access Token');
    }
    throw error;
  }
}

// ==================
// Integration CRUD
// ==================

export async function listIntegrations(): Promise<Integration[]> {
  const results = await db
    .select()
    .from(integrations)
    .orderBy(desc(integrations.createdAt));

  return results.map(mapIntegration);
}

export async function getIntegration(id: number): Promise<Integration | null> {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(eq(integrations.id, id));

  return integration ? mapIntegration(integration) : null;
}

export async function getIntegrationWithCredentials(id: number) {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(eq(integrations.id, id));

  return integration || null;
}

export async function deleteIntegration(id: number): Promise<boolean> {
  const result = await db
    .delete(integrations)
    .where(eq(integrations.id, id))
    .returning();

  return result.length > 0;
}

export async function updateIntegrationStatus(
  id: number,
  status: IntegrationStatus,
  errorMessage?: string
): Promise<void> {
  await db
    .update(integrations)
    .set({
      status,
      errorMessage: errorMessage || null,
      updatedAt: new Date(),
    })
    .where(eq(integrations.id, id));
}

// ==================
// Token Management
// ==================

export async function refreshIntegrationToken(id: number): Promise<void> {
  const integration = await getIntegrationWithCredentials(id);
  if (!integration) {
    throw new Error('Integration not found');
  }

  if (integration.authType !== 'oauth' || !integration.refreshToken) {
    throw new Error('Cannot refresh token for non-OAuth integration');
  }

  try {
    const tokens = await JiraClient.refreshAccessToken(
      integration.refreshToken,
      JIRA_CLIENT_ID,
      JIRA_CLIENT_SECRET
    );

    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await db
      .update(integrations)
      .set({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || integration.refreshToken,
        tokenExpiresAt,
        status: 'connected',
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, id));
  } catch (error) {
    await updateIntegrationStatus(id, 'needs_reauth', 'Token refresh failed');
    throw error;
  }
}

export async function ensureValidToken(id: number): Promise<string> {
  const integration = await getIntegrationWithCredentials(id);
  if (!integration) {
    throw new Error('Integration not found');
  }

  // Check if token is expired or about to expire (5 min buffer)
  if (
    integration.authType === 'oauth' &&
    integration.tokenExpiresAt &&
    new Date(integration.tokenExpiresAt).getTime() < Date.now() + 5 * 60 * 1000
  ) {
    await refreshIntegrationToken(id);
    const updated = await getIntegrationWithCredentials(id);
    return updated!.accessToken;
  }

  return integration.accessToken;
}

// ==================
// Data Sync
// ==================

export async function syncIntegrationData(integrationId: number): Promise<void> {
  const integration = await getIntegrationWithCredentials(integrationId);
  if (!integration) {
    throw new Error('Integration not found');
  }

  const client = createJiraClient(integration);

  try {
    // Sync projects
    const projects = await client.getProjects();
    for (const project of projects) {
      await db
        .insert(jiraProjects)
        .values({
          integrationId,
          jiraId: project.id,
          key: project.key,
          name: project.name,
          projectType: project.projectTypeKey,
          avatarUrl: project.avatarUrls?.['48x48'],
          syncedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [jiraProjects.integrationId, jiraProjects.jiraId],
          set: {
            key: project.key,
            name: project.name,
            projectType: project.projectTypeKey,
            avatarUrl: project.avatarUrls?.['48x48'],
            syncedAt: new Date(),
          },
        });
    }

    // Sync boards
    const boards = await client.getBoards();
    for (const board of boards) {
      await db
        .insert(jiraBoards)
        .values({
          integrationId,
          jiraId: board.id,
          name: board.name,
          type: board.type === 'simple' ? 'kanban' : board.type,
          projectId: board.location?.projectId?.toString(),
          projectKey: board.location?.projectKey,
          syncedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [jiraBoards.integrationId, jiraBoards.jiraId],
          set: {
            name: board.name,
            type: board.type === 'simple' ? 'kanban' : board.type,
            projectId: board.location?.projectId?.toString(),
            projectKey: board.location?.projectKey,
            syncedAt: new Date(),
          },
        });
    }

    // Auto-discover field mappings
    await discoverFieldMappings(integrationId, client);

    // Update sync timestamp
    await db
      .update(integrations)
      .set({
        lastSyncAt: new Date(),
        status: 'connected',
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, integrationId));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed';
    await updateIntegrationStatus(integrationId, 'error', message);
    throw error;
  }
}

// ==================
// Field Mapping
// ==================

const FIELD_PATTERNS: Record<
  MappableField,
  {
    namePatterns: string[];
    excludePatterns?: string[];
    schemaMatch?: (schema: JiraField['schema']) => boolean;
    fieldIdMatch?: string; // Match specific standard field IDs
  }
> = {
  story_points: {
    // Must contain "story point" - avoid matching "points" alone or "time"
    namePatterns: ['story points', 'story point', 'story point estimate'],
    excludePatterns: ['time', 'spent', 'original', 'remaining'],
    schemaMatch: (schema) => schema?.type === 'number' && schema?.custom?.includes('storypoint'),
  },
  sprint: {
    namePatterns: ['sprint'],
    schemaMatch: (schema) => schema?.custom?.includes('sprint') ?? false,
  },
  parent: {
    // "Parent" is the modern standard field in Jira Cloud
    namePatterns: ['parent'],
    fieldIdMatch: 'parent', // Standard field ID
    schemaMatch: (schema) => schema?.type === 'issuelink' || schema?.type === 'issuetype',
  },
  team: {
    namePatterns: ['team', 'squad', 'scrum team', 'development team'],
    excludePatterns: ['account'],
  },
  priority: {
    namePatterns: ['priority'],
    fieldIdMatch: 'priority',
  },
  labels: {
    namePatterns: ['labels'],
    fieldIdMatch: 'labels',
  },
  components: {
    namePatterns: ['components'],
    fieldIdMatch: 'components',
  },
};

function calculateFieldConfidence(
  field: JiraField,
  patterns: {
    namePatterns: string[];
    excludePatterns?: string[];
    schemaMatch?: (schema: JiraField['schema']) => boolean;
    fieldIdMatch?: string;
  }
): number {
  const nameLower = field.name.toLowerCase();
  const fieldIdLower = field.id.toLowerCase();

  // Check for exclusion patterns first - if matched, skip this field
  if (patterns.excludePatterns?.some((p) => nameLower.includes(p))) {
    return 0;
  }

  // Check exact field ID match (highest confidence for standard fields)
  if (patterns.fieldIdMatch && fieldIdLower === patterns.fieldIdMatch) {
    return 100;
  }

  // Check schema match (high confidence for custom fields)
  if (patterns.schemaMatch && field.schema && patterns.schemaMatch(field.schema)) {
    return 95;
  }

  // Check exact name match
  if (patterns.namePatterns.some((p) => nameLower === p)) {
    return 90;
  }

  // Check partial name match
  if (patterns.namePatterns.some((p) => nameLower.includes(p))) {
    return 70;
  }

  return 0;
}

async function discoverFieldMappings(
  integrationId: number,
  client: JiraClient
): Promise<void> {
  const fields = await client.getFields();

  for (const [ourField, patterns] of Object.entries(FIELD_PATTERNS) as Array<
    [MappableField, typeof FIELD_PATTERNS[MappableField]]
  >) {
    // Find best matching field
    let bestMatch: { field: JiraField; confidence: number } | null = null;

    for (const field of fields) {
      const confidence = calculateFieldConfidence(field, patterns);
      if (confidence > 0 && (!bestMatch || confidence > bestMatch.confidence)) {
        bestMatch = { field, confidence };
      }
    }

    if (bestMatch && bestMatch.confidence >= 70) {
      // Check if mapping already exists
      const [existing] = await db
        .select()
        .from(fieldMappings)
        .where(
          and(
            eq(fieldMappings.integrationId, integrationId),
            eq(fieldMappings.ourField, ourField)
          )
        );

      if (!existing) {
        await db.insert(fieldMappings).values({
          integrationId,
          ourField,
          providerFieldId: bestMatch.field.id,
          providerFieldName: bestMatch.field.name,
          providerFieldType: bestMatch.field.schema?.type || null,
          confidence: bestMatch.confidence,
          adminConfirmed: 0,
        });
      }
    }
  }
}

export async function getFieldMappings(
  integrationId: number
): Promise<FieldMapping[]> {
  const results = await db
    .select()
    .from(fieldMappings)
    .where(eq(fieldMappings.integrationId, integrationId));

  return results.map((m) => ({
    ...m,
    adminConfirmed: m.adminConfirmed === 1,
  }));
}

export async function updateFieldMapping(
  integrationId: number,
  ourField: MappableField,
  providerFieldId: string,
  providerFieldName: string,
  providerFieldType?: string
): Promise<FieldMapping> {
  const [existing] = await db
    .select()
    .from(fieldMappings)
    .where(
      and(
        eq(fieldMappings.integrationId, integrationId),
        eq(fieldMappings.ourField, ourField)
      )
    );

  if (existing) {
    const [updated] = await db
      .update(fieldMappings)
      .set({
        providerFieldId,
        providerFieldName,
        providerFieldType: providerFieldType || null,
        confidence: 100,
        adminConfirmed: 1,
        updatedAt: new Date(),
      })
      .where(eq(fieldMappings.id, existing.id))
      .returning();

    return { ...updated, adminConfirmed: true };
  } else {
    const [created] = await db
      .insert(fieldMappings)
      .values({
        integrationId,
        ourField,
        providerFieldId,
        providerFieldName,
        providerFieldType: providerFieldType || null,
        confidence: 100,
        adminConfirmed: 1,
      })
      .returning();

    return { ...created, adminConfirmed: true };
  }
}

export async function deleteFieldMapping(
  integrationId: number,
  ourField: MappableField
): Promise<boolean> {
  const result = await db
    .delete(fieldMappings)
    .where(
      and(
        eq(fieldMappings.integrationId, integrationId),
        eq(fieldMappings.ourField, ourField)
      )
    )
    .returning();

  return result.length > 0;
}

// ==================
// Available Fields
// ==================

export async function getAvailableFields(
  integrationId: number
): Promise<JiraField[]> {
  const integration = await getIntegrationWithCredentials(integrationId);
  if (!integration) {
    throw new Error('Integration not found');
  }

  const client = createJiraClient(integration);
  return client.getFields();
}

// ==================
// Required Fields
// ==================

export async function syncRequiredFields(
  integrationId: number,
  projectKey: string
): Promise<void> {
  const integration = await getIntegrationWithCredentials(integrationId);
  if (!integration) {
    throw new Error('Integration not found');
  }

  const client = createJiraClient(integration);
  const createMeta = await client.getCreateMeta([projectKey]);

  const project = createMeta.projects[0];
  if (!project) return;

  for (const issueType of project.issuetypes) {
    const requiredFieldsList: RequiredFieldInfo[] = [];

    for (const [fieldId, fieldMeta] of Object.entries(issueType.fields)) {
      if (fieldMeta.required || fieldId === 'summary') {
        requiredFieldsList.push({
          fieldId,
          fieldName: fieldMeta.name,
          fieldType: fieldMeta.schema.type,
          required: fieldMeta.required,
          allowedValues: fieldMeta.allowedValues?.slice(0, 50), // Limit allowed values
        });
      }
    }

    await db
      .insert(requiredFields)
      .values({
        integrationId,
        projectId: project.id,
        projectKey: project.key,
        issueTypeId: issueType.id,
        issueTypeName: issueType.name,
        fields: requiredFieldsList,
      })
      .onConflictDoUpdate({
        target: [
          requiredFields.integrationId,
          requiredFields.projectId,
          requiredFields.issueTypeId,
        ],
        set: {
          fields: requiredFieldsList,
          updatedAt: new Date(),
        },
      });
  }
}

export async function getRequiredFieldsForProject(
  integrationId: number,
  projectKey: string
) {
  const results = await db
    .select()
    .from(requiredFields)
    .where(
      and(
        eq(requiredFields.integrationId, integrationId),
        eq(requiredFields.projectKey, projectKey)
      )
    );

  return results;
}

// ==================
// Helpers
// ==================

function mapIntegration(row: typeof integrations.$inferSelect): Integration {
  return {
    id: row.id,
    provider: row.provider as IntegrationProvider,
    name: row.name,
    baseUrl: row.baseUrl,
    cloudId: row.cloudId,
    authType: row.authType as 'oauth' | 'pat',
    status: row.status as IntegrationStatus,
    lastSyncAt: row.lastSyncAt,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const integrationService = {
  // OAuth
  getOAuthAuthorizationUrl,
  handleOAuthCallback,
  connectWithPAT,

  // CRUD
  list: listIntegrations,
  get: getIntegration,
  delete: deleteIntegration,

  // Token
  refreshToken: refreshIntegrationToken,
  ensureValidToken,

  // Sync
  sync: syncIntegrationData,

  // Field Mappings
  getFieldMappings,
  updateFieldMapping,
  deleteFieldMapping,
  getAvailableFields,

  // Required Fields
  syncRequiredFields,
  getRequiredFieldsForProject,
};
