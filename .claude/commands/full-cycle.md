# Full Cycle Command

Execute the complete Software Development Lifecycle from scope to deployment.

## Usage

```
/full-cycle [scope]
```

The scope can be:
- A text description of features to build
- A reference to a requirements document
- A user story or PRD

## Overview

This command orchestrates all agents and commands to take a feature from concept to production:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FULL CYCLE WORKFLOW                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐        │
│  │  SCOPE   │──▶│  DESIGN  │──▶│  BUILD   │──▶│   TEST   │        │
│  │ Analysis │   │ Architect│   │ Backend  │   │  Tester  │        │
│  └──────────┘   └──────────┘   │ Frontend │   └────┬─────┘        │
│                                └──────────┘        │               │
│                                                    ▼               │
│                 ┌──────────┐   ┌──────────┐   ┌──────────┐        │
│                 │  DEPLOY  │◀──│ DOCUMENT │◀──│  REVIEW  │        │
│                 │ Deployer │   │Documenter│   │  (Human) │        │
│                 └──────────┘   └──────────┘   └──────────┘        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Phases

### Phase 1: Scope Analysis

**Objective:** Understand and validate requirements

**Actions:**
1. Parse the provided scope/requirements
2. Extract:
   - User personas
   - Features needed
   - Acceptance criteria
   - Non-functional requirements
3. Identify ambiguities or missing information
4. Generate clarifying questions if needed

**Output:**
```markdown
## Scope Summary

### Users
- [Persona 1]: [Description]
- [Persona 2]: [Description]

### Features
1. [Feature 1]
   - [Sub-feature]
   - [Sub-feature]
2. [Feature 2]

### Acceptance Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]

### Constraints
- [Technical constraints]
- [Business constraints]

### Questions
- [Any clarifying questions]
```

**Checkpoint:** ⏸️ Confirm scope before proceeding

---

### Phase 2: Architecture Design

**Agent:** Architect (`.claude/agents/architect.md`)

**Actions:**
1. Design data model (Prisma schema)
2. Define API contracts (endpoints, types)
3. Plan component architecture
4. Identify dependencies
5. Document technical decisions

**Output:**
- Database schema
- API specification
- Component hierarchy
- Architecture Decision Records (ADRs)

**Checkpoint:** ⏸️ Review architecture before implementation

---

### Phase 3: Backend Implementation

**Agent:** Backend (`.claude/agents/backend.md`)

**Actions:**
1. Update Prisma schema
2. Run database migration
3. Create validators (Zod)
4. Implement services
5. Implement controllers
6. Define routes
7. Manual API verification

**Commands:**
```bash
# Run migration
cd server && npx prisma migrate dev --name [feature]

# Generate client
npx prisma generate

# Start server
npm run dev:server

# Verify endpoints
curl http://localhost:3001/api/[resource]
```

**Checkpoint:** API endpoints working ✓

---

### Phase 4: Frontend Implementation

**Agent:** Frontend (`.claude/agents/frontend.md`)

**Actions:**
1. Create/import types
2. Create service for API communication with signals
3. Build components:
   - List/table views (smart components)
   - Forms with validation (reactive forms)
   - Cards/items (dumb components)
   - Dialogs/modals
4. Add route to app.routes.ts
5. Visual verification

**Commands:**
```bash
# Install any new spartan components
npx @spartan-ng/cli@latest add [component]

# Start dev server
npm run dev

# Open browser
# http://localhost:4200/[feature]
```

**Checkpoint:** UI functional ✓

---

### Phase 5: Testing & Verification

**Agent:** Tester (`.claude/agents/tester.md`)

**Actions:**
1. Write tests alongside implementation (done in phases 3-4)
2. Run full test verification loop

**Test Verification Loop:**
```
ATTEMPT = 1
MAX_ATTEMPTS = 5

WHILE ATTEMPT <= MAX_ATTEMPTS:
    1. Run: npm test 2>&1 | tee test-output.txt
    2. Run: npm run lint 2>&1 | tee lint-output.txt
    3. If ALL PASS → proceed to Phase 6
    4. If FAIL → analyze output, fix issues
    5. ATTEMPT++
END

If still failing: Report failures, request human help
```

**Quality Gates:**
- All tests pass
- Lint passes
- Coverage ≥ 80%

**Checkpoint:** All tests passing ✓

**Commands:**
```bash
# Run all tests
npm test

# With coverage
npm test -- --coverage

# Watch mode during development
npm test -- --watch
```

**Quality Gates:**
- All tests pass
- Coverage ≥ 80%
- No skipped tests

**Checkpoint:** Tests passing ✓

---

### Phase 6: Documentation

**Agent:** Documenter (`.claude/agents/documenter.md`)

**Actions:**
1. Add JSDoc to public APIs
2. Update API documentation
3. Add inline comments for complex logic
4. Update README if needed
5. Generate changelog entry

**Output:**
- Updated `docs/API.md`
- JSDoc comments in code
- CHANGELOG entry

**Checkpoint:** Documentation complete ✓

---

### Phase 7: Code Review

**Objective:** Human review before deployment

**Checklist for Review:**
- [ ] Code follows project conventions
- [ ] No security vulnerabilities
- [ ] Performance considerations addressed
- [ ] Error handling comprehensive
- [ ] Tests are meaningful
- [ ] Documentation is clear

**Commands:**
```bash
# Run linting
npm run lint

# Run type checking
npm run typecheck

# Build to verify
npm run build
```

**Checkpoint:** ⏸️ Await human approval

---

### Phase 8: Deployment

**Agent:** Deployer (`.claude/agents/deployer.md`)

**Actions:**
1. Final build verification
2. Create deployment package
3. Deploy to server
4. Run database migrations
5. Restart application
6. Verify health check
7. Monitor logs

**Commands:**
```bash
# Deploy to production
./scripts/deploy.sh

# Or push to trigger CI/CD
git push origin main
```

**Verification:**
```bash
# Check health
curl https://your-domain.com/health

# Check logs
ssh deploy@server "pm2 logs --lines 50"
```

**Checkpoint:** Deployed and verified ✓

---

## Execution Flow

When `/full-cycle` is invoked:

```
1. SCOPE ANALYSIS
   │
   ├─▶ Parse requirements
   ├─▶ Generate scope summary
   └─▶ ⏸️ CHECKPOINT: Confirm scope
   
2. ARCHITECTURE
   │
   ├─▶ Invoke Architect agent
   ├─▶ Generate designs
   └─▶ ⏸️ CHECKPOINT: Approve architecture
   
3. BACKEND
   │
   ├─▶ Invoke Backend agent
   ├─▶ Implement API
   ├─▶ Verify endpoints
   └─▶ git commit "feat: [feature] backend"
   
4. FRONTEND
   │
   ├─▶ Invoke Frontend agent
   ├─▶ Implement UI
   ├─▶ Verify in browser
   └─▶ git commit "feat: [feature] frontend"
   
5. TESTING
   │
   ├─▶ Invoke Tester agent
   ├─▶ Write & run tests
   ├─▶ Verify coverage
   └─▶ git commit "test: [feature] tests"
   
6. DOCUMENTATION
   │
   ├─▶ Invoke Documenter agent
   ├─▶ Update docs
   └─▶ git commit "docs: [feature] documentation"
   
7. REVIEW
   │
   ├─▶ Run final checks
   ├─▶ Generate PR/summary
   └─▶ ⏸️ CHECKPOINT: Human approval
   
8. DEPLOY
   │
   ├─▶ Invoke Deployer agent
   ├─▶ Deploy to production
   ├─▶ Verify deployment
   └─▶ ✓ COMPLETE
```

## Progress Tracking

Throughout execution, maintain status:

```markdown
## Full Cycle Progress: [Feature Name]

| Phase | Status | Notes |
|-------|--------|-------|
| Scope Analysis | ✅ Complete | Confirmed by user |
| Architecture | ✅ Complete | Schema + API defined |
| Backend | ✅ Complete | 5 endpoints created |
| Frontend | 🔄 In Progress | 3/5 components done |
| Testing | ⏳ Pending | - |
| Documentation | ⏳ Pending | - |
| Review | ⏳ Pending | - |
| Deployment | ⏳ Pending | - |

### Current Task
Building TaskForm component with validation...

### Blockers
None

### Files Modified
- server/prisma/schema.prisma
- server/src/services/task.service.ts
- server/src/controllers/task.controller.ts
- server/src/routes/task.routes.ts
- client/src/components/features/tasks/TaskList.tsx
- client/src/components/features/tasks/TaskCard.tsx
```

## Options

- `--skip-deploy` - Complete all phases except deployment
- `--backend-only` - Only architecture + backend phases
- `--no-checkpoints` - Skip confirmation checkpoints (use with caution)
- `--resume [phase]` - Resume from a specific phase

## Example

```
/full-cycle Build a project management feature where teams can:
- Create and manage projects with name, description, and status
- Add team members to projects with different roles
- Track project progress with milestones
- Generate project status reports
```

This will:
1. Analyze and confirm scope
2. Design Project, TeamMember, Milestone models
3. Build full CRUD API for all resources
4. Create ProjectList, ProjectDetail, MilestoneTracker UI
5. Write comprehensive tests
6. Document all endpoints
7. Request review
8. Deploy to production

## Estimated Timeline

| Phase | Typical Duration |
|-------|------------------|
| Scope Analysis | 5-10 minutes |
| Architecture | 10-15 minutes |
| Backend | 20-30 minutes |
| Frontend | 30-45 minutes |
| Testing | 20-30 minutes |
| Documentation | 10-15 minutes |
| Review | Variable (human) |
| Deployment | 5-10 minutes |

**Total:** ~2-3 hours for a medium feature

## Error Handling

If any phase fails:

1. **Log the error** with full context
2. **Attempt auto-fix** for common issues
3. **Checkpoint** if manual intervention needed
4. **Resume capability** from last successful phase
5. **Rollback option** if deployment fails
