// Issue Creation Service - creates Jira issues from PRDs and artifacts

import { db } from '../../db/index.js';
import {
  artifactJiraLinks,
  fieldMappings,
  generatedArtifacts,
  generatedPrds,
  requiredFields,
} from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { createJiraClient } from './client.js';
import { getIntegrationWithCredentials, ensureValidToken } from './integration.service.js';
import type { JiraIssue } from './types.js';

// ==================
// Types
// ==================

export interface CreateIssueRequest {
  integrationId: number;
  projectKey: string;
  issueTypeId: string;
  summary: string;
  description?: string;
  // Optional fields
  storyPoints?: number;
  labels?: string[];
  components?: string[];
  priority?: string;
  // For linking
  parentIssueKey?: string; // Epic or parent story
  sprintId?: number;
  // For tracking
  artifactType?: 'prd' | 'generated_artifact';
  artifactId?: number;
}

export interface BulkCreateRequest {
  integrationId: number;
  projectKey: string;
  epicIssueTypeId: string;
  storyIssueTypeId: string;
  items: Array<{
    type: 'epic' | 'feature' | 'user_story';
    title: string;
    description?: string;
    storyPoints?: number;
    labels?: string[];
    parentIndex?: number; // Index in items array for parent
    artifactType?: 'prd' | 'generated_artifact';
    artifactId?: number;
  }>;
}

export interface CreatedIssue {
  jiraId: string;
  key: string;
  summary: string;
  issueType: string;
  artifactType?: 'prd' | 'generated_artifact';
  artifactId?: number;
}

// ==================
// Single Issue Creation
// ==================

export async function createIssue(request: CreateIssueRequest): Promise<CreatedIssue> {
  const integration = await getIntegrationWithCredentials(request.integrationId);
  if (!integration) {
    throw new Error('Integration not found');
  }

  // Ensure token is valid
  await ensureValidToken(request.integrationId);
  const updatedIntegration = await getIntegrationWithCredentials(request.integrationId);
  const client = createJiraClient(updatedIntegration!);

  // Get field mappings
  const mappings = await db
    .select()
    .from(fieldMappings)
    .where(eq(fieldMappings.integrationId, request.integrationId));

  const mappingsMap = new Map(mappings.map(m => [m.ourField, m.providerFieldId]));

  // Build fields object
  const fields: Record<string, unknown> = {
    summary: request.summary,
  };

  // Add description
  if (request.description) {
    // Convert to ADF format for Jira Cloud
    fields.description = {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: request.description,
            },
          ],
        },
      ],
    };
  }

  // Add story points
  if (request.storyPoints !== undefined) {
    const storyPointsField = mappingsMap.get('story_points');
    if (storyPointsField) {
      fields[storyPointsField] = request.storyPoints;
    }
  }

  // Add labels
  if (request.labels?.length) {
    fields.labels = request.labels;
  }

  // Add components
  if (request.components?.length) {
    fields.components = request.components.map(name => ({ name }));
  }

  // Add priority
  if (request.priority) {
    fields.priority = { name: request.priority };
  }

  // Add parent (epic link)
  if (request.parentIssueKey) {
    // Try epic link field first
    const epicLinkField = mappingsMap.get('epic_link');
    if (epicLinkField) {
      fields[epicLinkField] = request.parentIssueKey;
    } else {
      // Use native parent for next-gen projects
      fields.parent = { key: request.parentIssueKey };
    }
  }

  // Create the issue
  const issue = await client.createIssue(
    request.projectKey,
    request.issueTypeId,
    fields
  );

  // Move to sprint if specified
  if (request.sprintId) {
    try {
      await client.moveIssueToSprint([issue.key], request.sprintId);
    } catch (error) {
      console.error('Failed to move issue to sprint:', error);
      // Don't fail the whole operation if sprint move fails
    }
  }

  // Link artifact if specified
  if (request.artifactType && request.artifactId) {
    await db.insert(artifactJiraLinks).values({
      artifactType: request.artifactType,
      artifactId: request.artifactId,
      integrationId: request.integrationId,
      jiraIssueId: issue.id,
      jiraIssueKey: issue.key,
      jiraProjectKey: request.projectKey,
    });
  }

  return {
    jiraId: issue.id,
    key: issue.key,
    summary: issue.fields.summary,
    issueType: issue.fields.issuetype?.name || 'Unknown',
    artifactType: request.artifactType,
    artifactId: request.artifactId,
  };
}

// ==================
// Bulk Issue Creation
// ==================

export async function bulkCreateIssues(request: BulkCreateRequest): Promise<CreatedIssue[]> {
  const results: CreatedIssue[] = [];
  const keyMap = new Map<number, string>(); // Maps item index to created issue key

  // Sort items: epics first, then features, then stories
  const sortedItems = request.items
    .map((item, index) => ({ ...item, originalIndex: index }))
    .sort((a, b) => {
      const order = { epic: 0, feature: 1, user_story: 2 };
      return order[a.type] - order[b.type];
    });

  for (const item of sortedItems) {
    // Determine issue type ID
    const issueTypeId = item.type === 'epic' ? request.epicIssueTypeId : request.storyIssueTypeId;

    // Get parent key if specified
    let parentKey: string | undefined;
    if (item.parentIndex !== undefined) {
      parentKey = keyMap.get(item.parentIndex);
    }

    const created = await createIssue({
      integrationId: request.integrationId,
      projectKey: request.projectKey,
      issueTypeId,
      summary: item.title,
      description: item.description,
      storyPoints: item.storyPoints,
      labels: item.labels,
      parentIssueKey: parentKey,
      artifactType: item.artifactType,
      artifactId: item.artifactId,
    });

    // Store key for child items
    keyMap.set(item.originalIndex, created.key);
    results.push(created);
  }

  return results;
}

// ==================
// Create from PRD
// ==================

export interface CreateFromPrdRequest {
  integrationId: number;
  prdId: number;
  projectKey: string;
  epicIssueTypeId: string;
  storyIssueTypeId: string;
  includeEpic?: boolean; // Create parent epic from PRD title
  defaultLabels?: string[];
}

export async function createIssuesFromPrd(request: CreateFromPrdRequest): Promise<CreatedIssue[]> {
  // Get the PRD
  const [prd] = await db
    .select()
    .from(generatedPrds)
    .where(eq(generatedPrds.id, request.prdId));

  if (!prd) {
    throw new Error('PRD not found');
  }

  const results: CreatedIssue[] = [];
  let epicKey: string | undefined;

  // Create epic from PRD title if requested
  if (request.includeEpic) {
    const epic = await createIssue({
      integrationId: request.integrationId,
      projectKey: request.projectKey,
      issueTypeId: request.epicIssueTypeId,
      summary: prd.title,
      description: prd.concept,
      labels: request.defaultLabels,
      artifactType: 'prd',
      artifactId: prd.id,
    });
    epicKey = epic.key;
    results.push(epic);
  }

  // Parse PRD content for user stories
  // PRD content is stored as JSON with sections
  let prdContent: { sections?: Array<{ type: string; title: string; content: string }> };
  try {
    prdContent = JSON.parse(prd.content);
  } catch {
    // If content is not JSON, treat it as plain text
    prdContent = {};
  }

  // Extract user stories from PRD sections
  const userStorySections = prdContent.sections?.filter(
    s => s.type === 'user_stories' || s.type === 'requirements' || s.type === 'features'
  ) || [];

  for (const section of userStorySections) {
    // Parse stories from section content (assuming markdown bullet points or numbered list)
    const stories = parseStoriesFromContent(section.content);

    for (const story of stories) {
      const created = await createIssue({
        integrationId: request.integrationId,
        projectKey: request.projectKey,
        issueTypeId: request.storyIssueTypeId,
        summary: story.title,
        description: story.description,
        storyPoints: story.storyPoints,
        labels: request.defaultLabels,
        parentIssueKey: epicKey,
        artifactType: 'prd',
        artifactId: prd.id,
      });
      results.push(created);
    }
  }

  return results;
}

// ==================
// Create from Generated Artifacts
// ==================

export interface CreateFromArtifactsRequest {
  integrationId: number;
  artifactIds: number[];
  projectKey: string;
  epicIssueTypeId: string;
  storyIssueTypeId: string;
  defaultLabels?: string[];
  targetSprintId?: number;
}

export async function createIssuesFromArtifacts(
  request: CreateFromArtifactsRequest
): Promise<CreatedIssue[]> {
  // Get the artifacts
  const artifacts = await db
    .select()
    .from(generatedArtifacts)
    .where(
      eq(generatedArtifacts.id, request.artifactIds[0]) // TODO: Use inArray when needed
    );

  // For multiple artifacts, we need to query them differently
  const allArtifacts = request.artifactIds.length > 1
    ? await Promise.all(
        request.artifactIds.map(async id => {
          const [artifact] = await db
            .select()
            .from(generatedArtifacts)
            .where(eq(generatedArtifacts.id, id));
          return artifact;
        })
      ).then(results => results.filter(Boolean))
    : artifacts;

  if (allArtifacts.length === 0) {
    throw new Error('No artifacts found');
  }

  // Group by type for hierarchical creation
  const epics = allArtifacts.filter(a => a.type === 'epic');
  const features = allArtifacts.filter(a => a.type === 'feature');
  const stories = allArtifacts.filter(a => a.type === 'user_story');

  const results: CreatedIssue[] = [];
  const artifactToKeyMap = new Map<number, string>(); // Maps artifact ID to created issue key

  // Create epics first
  for (const epic of epics) {
    const created = await createIssue({
      integrationId: request.integrationId,
      projectKey: request.projectKey,
      issueTypeId: request.epicIssueTypeId,
      summary: epic.title,
      description: epic.content,
      labels: request.defaultLabels,
      artifactType: 'generated_artifact',
      artifactId: epic.id,
    });
    artifactToKeyMap.set(epic.id, created.key);
    results.push(created);
  }

  // Create features (as stories under epics)
  for (const feature of features) {
    // Find parent epic
    const parentKey = feature.parentId ? artifactToKeyMap.get(feature.parentId) : undefined;

    const created = await createIssue({
      integrationId: request.integrationId,
      projectKey: request.projectKey,
      issueTypeId: request.storyIssueTypeId, // Features become stories in Jira
      summary: feature.title,
      description: feature.content,
      labels: request.defaultLabels,
      parentIssueKey: parentKey,
      sprintId: request.targetSprintId,
      artifactType: 'generated_artifact',
      artifactId: feature.id,
    });
    artifactToKeyMap.set(feature.id, created.key);
    results.push(created);
  }

  // Create user stories
  for (const story of stories) {
    // Find parent (could be epic or feature)
    const parentKey = story.parentId ? artifactToKeyMap.get(story.parentId) : undefined;

    // Parse story points from content if available
    const storyPoints = parseStoryPoints(story.content);

    const created = await createIssue({
      integrationId: request.integrationId,
      projectKey: request.projectKey,
      issueTypeId: request.storyIssueTypeId,
      summary: story.title,
      description: story.content,
      storyPoints,
      labels: request.defaultLabels,
      parentIssueKey: parentKey,
      sprintId: request.targetSprintId,
      artifactType: 'generated_artifact',
      artifactId: story.id,
    });
    results.push(created);
  }

  return results;
}

// ==================
// Get Linked Issues
// ==================

export async function getLinkedIssues(
  artifactType: 'prd' | 'generated_artifact',
  artifactId: number
): Promise<Array<{ id: number; jiraIssueKey: string; jiraProjectKey: string; createdAt: Date }>> {
  const links = await db
    .select()
    .from(artifactJiraLinks)
    .where(
      and(
        eq(artifactJiraLinks.artifactType, artifactType),
        eq(artifactJiraLinks.artifactId, artifactId)
      )
    );

  return links;
}

// ==================
// Helpers
// ==================

function parseStoriesFromContent(content: string): Array<{
  title: string;
  description?: string;
  storyPoints?: number;
}> {
  const stories: Array<{ title: string; description?: string; storyPoints?: number }> = [];

  // Split by lines and look for bullet points or numbered items
  const lines = content.split('\n');
  let currentStory: { title: string; description?: string; storyPoints?: number } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check if this is a new story item (bullet or number)
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
    const numberMatch = trimmed.match(/^\d+\.\s+(.+)$/);

    if (bulletMatch || numberMatch) {
      // Save previous story
      if (currentStory) {
        stories.push(currentStory);
      }

      const title = (bulletMatch?.[1] || numberMatch?.[1] || '').trim();
      const storyPoints = parseStoryPoints(title);

      currentStory = {
        title: title.replace(/\s*\(?\d+\s*(pts?|points?|sp)\)?/i, '').trim(), // Remove points from title
        storyPoints,
      };
    } else if (trimmed && currentStory) {
      // Add to description
      currentStory.description = currentStory.description
        ? `${currentStory.description}\n${trimmed}`
        : trimmed;
    }
  }

  // Don't forget the last story
  if (currentStory) {
    stories.push(currentStory);
  }

  return stories;
}

function parseStoryPoints(text: string): number | undefined {
  // Look for patterns like "3 points", "5 pts", "(8 SP)", etc.
  const match = text.match(/\(?\s*(\d+)\s*(pts?|points?|sp)\s*\)?/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  return undefined;
}

export const issueCreationService = {
  createIssue,
  bulkCreateIssues,
  createIssuesFromPrd,
  createIssuesFromArtifacts,
  getLinkedIssues,
};
