# Jira Integration Architecture

## Overview

This document outlines the architecture for Jira integration, enabling:
1. Creating epics/stories/features from PRD and Story generators
2. Historical point estimates and velocity tracking for sprint/PI planning
3. User's current work status
4. Issue hierarchy for dashboards

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Provider abstraction | Yes | Future ADO support |
| Auth | OAuth (Cloud + Server), PAT fallback | Enterprise compatibility |
| Field mapping | Org-wide, auto-discover | Simplicity for MVP |
| Team concept | Board = Team | Native Jira structure, velocity per board |
| Data sync | Pull on page load | Simpler infrastructure |
| Sprint alignment | Synchronized | MVP simplification |
| Write operations | One-way create | No bi-directional sync yet |

---

## Database Schema

### Core Integration Tables

```typescript
// Integration connection - stores OAuth credentials
integrations
├── id: serial PK
├── org_id: integer (nullable for now, FK to future orgs table)
├── provider: 'jira' | 'ado'
├── name: text (user-friendly name)
├── base_url: text (e.g., 'https://company.atlassian.net' or on-prem URL)
├── cloud_id: text (for Jira Cloud)
├── auth_type: 'oauth' | 'pat'
├── access_token: text (encrypted)
├── refresh_token: text (encrypted, for OAuth)
├── token_expires_at: timestamp
├── scopes: text[] (granted OAuth scopes)
├── status: 'connected' | 'error' | 'needs_reauth'
├── last_sync_at: timestamp
├── error_message: text
├── created_at: timestamp
├── updated_at: timestamp

// Field mappings - maps our concepts to Jira fields
jira_field_mappings
├── id: serial PK
├── integration_id: integer FK
├── our_field: 'story_points' | 'sprint' | 'epic_link' | 'team' | 'priority' | 'labels' | 'components'
├── jira_field_id: text (e.g., 'customfield_10001')
├── jira_field_name: text (human-readable)
├── jira_field_type: text (e.g., 'number', 'array', 'option')
├── confidence: decimal (0-1, auto-detection confidence)
├── admin_confirmed: boolean
├── created_at: timestamp
├── updated_at: timestamp
└── UNIQUE(integration_id, our_field)

// Required fields per project/issue type
jira_required_fields
├── id: serial PK
├── integration_id: integer FK
├── project_id: text (Jira project ID)
├── project_key: text
├── issue_type_id: text
├── issue_type_name: text
├── required_fields: jsonb[] (array of {fieldId, fieldName, fieldType})
├── created_at: timestamp
├── updated_at: timestamp
└── UNIQUE(integration_id, project_id, issue_type_id)
```

### Cached Jira Data

```typescript
// Projects cache
jira_projects
├── id: serial PK
├── integration_id: integer FK
├── jira_id: text (Jira's project ID)
├── key: text (e.g., 'PROJ')
├── name: text
├── project_type: text (e.g., 'software', 'business')
├── avatar_url: text
├── synced_at: timestamp
├── created_at: timestamp
└── UNIQUE(integration_id, jira_id)

// Boards cache (Board = Team)
jira_boards
├── id: serial PK
├── integration_id: integer FK
├── jira_id: integer (Jira's board ID)
├── name: text
├── type: 'scrum' | 'kanban'
├── project_id: text (FK to jira_projects.jira_id)
├── project_key: text
├── velocity_avg: decimal (calculated average)
├── velocity_last_n: integer (number of sprints used)
├── synced_at: timestamp
├── created_at: timestamp
└── UNIQUE(integration_id, jira_id)

// Sprints cache
jira_sprints
├── id: serial PK
├── integration_id: integer FK
├── board_id: integer (FK to jira_boards.jira_id)
├── jira_id: integer (Jira's sprint ID)
├── name: text
├── state: 'future' | 'active' | 'closed'
├── start_date: timestamp
├── end_date: timestamp
├── completed_points: decimal
├── committed_points: decimal
├── goal: text
├── synced_at: timestamp
├── created_at: timestamp
└── UNIQUE(integration_id, jira_id)

// Issues cache (epics, features, stories, tasks)
jira_issues
├── id: serial PK
├── integration_id: integer FK
├── jira_id: text (Jira's issue ID, e.g., '10001')
├── key: text (e.g., 'PROJ-123')
├── summary: text
├── description: text
├── issue_type: text (e.g., 'Epic', 'Story', 'Task')
├── issue_type_id: text
├── status: text
├── status_category: 'todo' | 'in_progress' | 'done'
├── priority: text
├── assignee_id: text
├── assignee_name: text
├── reporter_id: text
├── reporter_name: text
├── story_points: decimal
├── sprint_id: integer (current sprint)
├── epic_key: text (parent epic)
├── parent_key: text (direct parent for sub-tasks)
├── labels: text[]
├── components: text[]
├── project_key: text
├── created_date: timestamp
├── updated_date: timestamp
├── resolution_date: timestamp
├── synced_at: timestamp
├── created_at: timestamp
└── UNIQUE(integration_id, jira_id)
└── INDEX(integration_id, key)
└── INDEX(integration_id, epic_key)
└── INDEX(integration_id, sprint_id)
└── INDEX(integration_id, assignee_id)
```

### PI Planning Tables

```typescript
// PI Planning Sessions
pi_planning_sessions
├── id: serial PK
├── integration_id: integer FK
├── name: text (e.g., 'Q1 2025 Planning')
├── description: text
├── start_date: date
├── end_date: date
├── sprint_count: integer (number of sprints in PI)
├── status: 'draft' | 'active' | 'locked' | 'completed'
├── created_by: integer (user_id)
├── created_at: timestamp
├── updated_at: timestamp

// Boards participating in PI
pi_session_boards
├── id: serial PK
├── session_id: integer FK
├── board_id: integer (FK to jira_boards.id)
├── velocity_override: decimal (optional manual override)
├── capacity_adjustment: decimal (e.g., 0.8 for 80% capacity due to PTO)
├── created_at: timestamp
└── UNIQUE(session_id, board_id)

// Planned items in PI
pi_planned_items
├── id: serial PK
├── session_id: integer FK
├── jira_issue_id: text (FK to jira_issues.jira_id)
├── jira_issue_key: text
├── assigned_board_id: integer (which team)
├── target_sprint_id: integer (which sprint)
├── sequence_order: integer (for ordering)
├── estimated_points: decimal (AI or manual estimate)
├── confidence: decimal (AI confidence in estimate)
├── dependencies: text[] (array of jira_issue_keys this depends on)
├── notes: text
├── ai_suggested: boolean
├── created_at: timestamp
├── updated_at: timestamp
└── UNIQUE(session_id, jira_issue_id)
```

### Artifact-to-Jira Linking

```typescript
// Links generated artifacts (PRDs, stories) to created Jira issues
artifact_jira_links
├── id: serial PK
├── artifact_type: 'prd' | 'generated_artifact'
├── artifact_id: integer (FK to generatedPrds or generatedArtifacts)
├── integration_id: integer FK
├── jira_issue_id: text
├── jira_issue_key: text
├── jira_project_key: text
├── created_at: timestamp
└── UNIQUE(artifact_type, artifact_id, jira_issue_id)
```

---

## API Design

### Provider Abstraction Interface

```typescript
interface IProjectManagementProvider {
  // Connection
  connect(credentials: ProviderCredentials): Promise<ConnectionResult>;
  disconnect(): Promise<void>;
  refreshToken(): Promise<void>;

  // Schema Discovery
  discoverSchema(): Promise<ProviderSchema>;
  getProjects(): Promise<Project[]>;
  getIssueTypes(projectId: string): Promise<IssueType[]>;
  getFields(): Promise<Field[]>;
  getCreateMeta(projectId: string, issueTypeId: string): Promise<CreateMeta>;

  // Boards & Teams
  getBoards(): Promise<Board[]>;
  getBoardConfiguration(boardId: string): Promise<BoardConfig>;

  // Sprints
  getSprints(boardId: string, state?: SprintState): Promise<Sprint[]>;
  getSprintVelocity(boardId: string, sprintCount?: number): Promise<VelocityData>;

  // Issues
  getIssue(issueIdOrKey: string): Promise<Issue>;
  searchIssues(jql: string, fields?: string[]): Promise<Issue[]>;
  getIssueHierarchy(epicKey: string): Promise<IssueHierarchy>;
  createIssue(projectId: string, issueTypeId: string, fields: IssueFields): Promise<Issue>;
  updateIssue(issueIdOrKey: string, fields: Partial<IssueFields>): Promise<Issue>;

  // User
  getCurrentUser(): Promise<User>;
  getUserAssignedIssues(userId: string): Promise<Issue[]>;
}
```

### REST API Endpoints

#### Integration Management
```
POST   /api/integrations/jira/oauth/start    - Start OAuth flow
GET    /api/integrations/jira/oauth/callback - OAuth callback
POST   /api/integrations/jira/pat            - Connect with PAT
GET    /api/integrations                     - List integrations
GET    /api/integrations/:id                 - Get integration details
DELETE /api/integrations/:id                 - Disconnect integration
POST   /api/integrations/:id/refresh         - Refresh OAuth token
POST   /api/integrations/:id/sync            - Force sync data
```

#### Schema & Mapping
```
GET    /api/integrations/:id/schema          - Get discovered schema
GET    /api/integrations/:id/mappings        - Get field mappings
PUT    /api/integrations/:id/mappings        - Update field mappings
GET    /api/integrations/:id/required-fields - Get required fields per project/type
```

#### Jira Data (Cached with refresh)
```
GET    /api/integrations/:id/projects        - List projects
GET    /api/integrations/:id/boards          - List boards (teams)
GET    /api/integrations/:id/boards/:boardId/sprints    - Get sprints for board
GET    /api/integrations/:id/boards/:boardId/velocity   - Get velocity metrics
GET    /api/integrations/:id/issues          - Search issues (with JQL)
GET    /api/integrations/:id/issues/:key     - Get single issue
GET    /api/integrations/:id/issues/:key/hierarchy - Get issue hierarchy
GET    /api/integrations/:id/my-work         - Get current user's assigned work
```

#### Issue Creation
```
POST   /api/integrations/:id/issues          - Create issue from mapped fields
POST   /api/integrations/:id/issues/from-prd/:prdId        - Create from PRD
POST   /api/integrations/:id/issues/from-artifact/:artId   - Create from artifact
```

#### PI Planning
```
POST   /api/pi-sessions                      - Create PI planning session
GET    /api/pi-sessions                      - List PI sessions
GET    /api/pi-sessions/:id                  - Get session with all data
PUT    /api/pi-sessions/:id                  - Update session
DELETE /api/pi-sessions/:id                  - Delete session

POST   /api/pi-sessions/:id/boards           - Add board to session
DELETE /api/pi-sessions/:id/boards/:boardId  - Remove board from session
PUT    /api/pi-sessions/:id/boards/:boardId  - Update board capacity

POST   /api/pi-sessions/:id/items            - Add item to plan
PUT    /api/pi-sessions/:id/items/:itemId    - Update planned item
DELETE /api/pi-sessions/:id/items/:itemId    - Remove item from plan
POST   /api/pi-sessions/:id/items/ai-suggest - Get AI suggestions for sequencing
POST   /api/pi-sessions/:id/push             - Push assignments to Jira sprints
```

---

## Field Auto-Discovery Logic

```typescript
const FIELD_PATTERNS = {
  story_points: {
    namePatterns: ['story points', 'points', 'estimate', 'story point estimate'],
    schemaType: 'number',
    confidence: (field: JiraField) => {
      const nameLower = field.name.toLowerCase();
      if (nameLower === 'story points') return 0.95;
      if (nameLower.includes('story') && nameLower.includes('point')) return 0.9;
      if (nameLower === 'points' || nameLower === 'estimate') return 0.7;
      return 0;
    }
  },
  sprint: {
    namePatterns: ['sprint'],
    schemaType: 'array', // Jira sprints are arrays
    customType: 'com.atlassian.jira.plugin.system.customfieldtypes:sprint',
    confidence: (field: JiraField) => {
      if (field.schema?.custom?.includes('sprint')) return 0.98;
      return 0;
    }
  },
  epic_link: {
    namePatterns: ['epic link', 'epic', 'parent'],
    confidence: (field: JiraField) => {
      if (field.schema?.custom?.includes('epic')) return 0.95;
      if (field.name.toLowerCase() === 'parent') return 0.9;
      return 0;
    }
  },
  team: {
    namePatterns: ['team', 'squad', 'scrum team', 'development team'],
    confidence: (field: JiraField) => {
      const nameLower = field.name.toLowerCase();
      if (nameLower === 'team') return 0.8;
      if (nameLower.includes('team')) return 0.6;
      return 0;
    }
  }
};
```

---

## OAuth Flow

### Jira Cloud (OAuth 2.0)
```
1. User clicks "Connect Jira"
2. Redirect to: https://auth.atlassian.com/authorize
   - client_id, redirect_uri, scope, state
   - Scopes: read:jira-work, write:jira-work, read:jira-user, offline_access
3. User authorizes
4. Callback with code
5. Exchange code for tokens at: https://auth.atlassian.com/oauth/token
6. Get accessible resources: https://api.atlassian.com/oauth/token/accessible-resources
7. Store tokens + cloud_id
```

### Jira Server/Data Center (OAuth 1.0a or PAT)
```
OAuth 1.0a:
1. Application link configured in Jira admin
2. Request token → Authorize → Access token flow

PAT (simpler):
1. User generates PAT in Jira profile
2. User enters PAT + base URL in our app
3. We validate with /rest/api/2/myself
4. Store PAT (encrypted)
```

---

## Component Architecture (Frontend)

```
features/integrations/
├── integrations.routes.ts
├── integrations.service.ts
├── types/
│   ├── integration.types.ts
│   ├── jira.types.ts
│   └── pi-planning.types.ts
├── components/
│   ├── integration-list/
│   ├── jira-connect-dialog/
│   ├── field-mapping-editor/
│   └── required-fields-view/
└── index.ts

features/pi-planning/
├── pi-planning.routes.ts
├── pi-planning.service.ts
├── components/
│   ├── pi-session-list/
│   ├── pi-session-detail/
│   ├── board-selector/
│   ├── velocity-card/
│   ├── sprint-column/
│   ├── planning-board/         # Drag-drop planning
│   ├── dependency-graph/       # Visual dependencies
│   └── ai-suggestions-panel/
└── index.ts

features/jira-dashboard/
├── jira-dashboard.routes.ts
├── jira-dashboard.service.ts
├── components/
│   ├── my-work-list/
│   ├── epic-tree/
│   ├── sprint-progress/
│   └── issue-detail-drawer/
└── index.ts
```

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Database schema (migrations)
- [ ] Integration entity + OAuth service
- [ ] Jira API client (with rate limiting)
- [ ] Basic connect/disconnect flow

### Phase 2: Schema Discovery
- [ ] Field discovery endpoint
- [ ] Auto-mapping logic
- [ ] Admin mapping UI
- [ ] Required fields detection

### Phase 3: Data Fetching
- [ ] Projects, boards, sprints endpoints
- [ ] Velocity calculation
- [ ] Issue search + hierarchy
- [ ] Caching layer with TTL

### Phase 4: Issue Creation
- [ ] Create issue endpoint
- [ ] Field mapping translation
- [ ] PRD → Jira epic
- [ ] Artifact → Jira story
- [ ] Error handling + validation

### Phase 5: PI Planning
- [ ] Session CRUD
- [ ] Multi-board view
- [ ] AI sequencing suggestions
- [ ] Sprint assignment
- [ ] Push to Jira

### Phase 6: Dashboard
- [ ] My work view
- [ ] Epic hierarchy view
- [ ] Progress tracking
- [ ] Comments/history on demand

---

## Security Considerations

1. **Token storage**: Access/refresh tokens encrypted at rest
2. **Token refresh**: Background job or on-demand refresh before expiry
3. **Scope minimization**: Request only needed OAuth scopes
4. **PAT handling**: Never log PATs, mask in UI
5. **Rate limiting**: Respect Jira's rate limits (429 handling)
6. **Audit logging**: Log all write operations to Jira
