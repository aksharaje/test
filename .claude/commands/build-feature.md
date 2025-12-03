# Build Feature Command

Develop a complete feature from scope to tested implementation using a test-driven approach with automatic failure detection and retry.

## Usage

```
/build-feature [scope or description]
```

The scope can be:
- A text description of the feature
- A reference to a scope document
- A user story or requirement

## Core Principle: Test-Driven Verification

Every implementation phase includes a **verification loop** that:
1. Runs relevant tests
2. Captures and analyzes failures
3. Fixes issues automatically
4. Repeats until all tests pass (max 5 attempts per phase)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Implement  │────▶│  Run Tests  │────▶│  Analyze    │
│  Code       │     │             │     │  Output     │
└─────────────┘     └──────┬──────┘     └──────┬──────┘
       ▲                   │                   │
       │                   ▼                   ▼
       │           ┌─────────────┐     ┌─────────────┐
       │           │  All Pass?  │────▶│  Next Phase │
       │           └──────┬──────┘ YES └─────────────┘
       │                  │ NO
       │                  ▼
       │           ┌─────────────┐
       └───────────│  Fix Issues │
                   └─────────────┘
```

## Workflow

This command orchestrates multiple agents to build a feature end-to-end:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Architect  │────▶│  Backend    │────▶│  Frontend   │
│  Agent      │     │  + Tests    │     │  + Tests    │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                    ┌─────────────┐     ┌─────┴───────┐
                    │ Documenter  │◀────│  Final      │
                    │ Agent       │     │  Verify     │
                    └─────────────┘     └─────────────┘
```

## Phase 1: Architecture (Architect Agent)

Reference: `.claude/agents/architect.md`

**Actions:**
1. Analyze the provided scope/requirements
2. Identify entities and relationships
3. Design database schema (Prisma)
4. Define API contract (endpoints, types)
5. Plan component architecture
6. Document technical decisions

**Output:**
- Prisma schema additions
- API contract in `shared/types/`
- Component hierarchy plan

**Checkpoint:** Confirm architecture before proceeding

## Phase 2: Backend Implementation (Backend Agent)

Reference: `.claude/agents/backend.md`

**Actions:**
1. Update Prisma schema and run migration
   ```bash
   cd server
   npx prisma migrate dev --name add_[feature]
   npx prisma generate
   ```

2. Create shared types in `shared/types/[feature].ts`

3. Create validator schemas in `server/src/validators/[feature].validator.ts`

4. Create service in `server/src/services/[feature].service.ts`
   - CRUD methods
   - Business logic
   - Pagination support

5. Create controller in `server/src/controllers/[feature].controller.ts`
   - Request handling
   - Error handling
   - Response formatting

6. Create routes in `server/src/routes/[feature].routes.ts`
   - Route definitions
   - Middleware (validation)

7. Register routes in `server/src/routes/index.ts`

8. **Write tests BEFORE verification:**
   - Create fixtures in `server/tests/fixtures/[feature].fixtures.ts`
   - Create unit tests in `server/tests/unit/[feature].service.test.ts`
   - Create integration tests in `server/tests/integration/[feature].routes.test.ts`

### Backend Verification Loop

```
ATTEMPT = 1
MAX_ATTEMPTS = 5

WHILE ATTEMPT <= MAX_ATTEMPTS:
    
    1. Run backend tests and capture output:
       ```bash
       cd server && npm test -- --testPathPattern="[feature]" 2>&1 | tee test-output.txt
       ```
    
    2. Check exit code and parse output:
       - If ALL TESTS PASS → Exit loop, proceed to Phase 3
       - If TESTS FAIL → Continue to step 3
    
    3. Analyze failures from test-output.txt:
       - Identify which tests failed
       - Extract error messages and stack traces
       - Determine root cause (typo, logic error, missing mock, etc.)
    
    4. Apply fixes based on failure analysis:
       - Fix service logic errors
       - Fix controller response handling
       - Fix route configuration
       - Fix test assertions if test itself is wrong
       - Add missing error handling
    
    5. ATTEMPT = ATTEMPT + 1
    
END WHILE

IF ATTEMPT > MAX_ATTEMPTS:
    - Report: "Backend tests failed after 5 attempts"
    - List remaining failures
    - Request human intervention
```

**Output:**
- Working API endpoints
- Passing backend tests
- Database schema

## Phase 3: Frontend Implementation (Frontend Agent)

Reference: `.claude/agents/frontend.md`

**Actions:**
1. Create types (import from shared or create locally)

2. Create service in `client/src/app/features/[feature]/`
   - `[feature].service.ts` - API calls with signals for state

3. Create components in `client/src/app/features/[feature]/`
   - List component (smart, fetches data)
   - Card/item component (dumb, presentational)
   - Form component (with reactive forms validation)
   - Dialog component if needed
   - Export from `index.ts`

4. Add route to `client/src/app/app.routes.ts`
   ```typescript
   {
     path: '[feature]',
     loadComponent: () =>
       import('./features/[feature]/[feature]-list.component')
         .then(m => m.[Feature]ListComponent),
   },
   ```

5. **Write tests BEFORE verification:**
   - Create service tests in `[feature].service.spec.ts`
   - Create component tests in `[feature]-*.component.spec.ts`

### Frontend Verification Loop

```
ATTEMPT = 1
MAX_ATTEMPTS = 5

WHILE ATTEMPT <= MAX_ATTEMPTS:
    
    1. Run frontend tests and capture output:
       ```bash
       cd client && npm test -- --testPathPattern="[feature]" 2>&1 | tee test-output.txt
       ```
    
    2. Check exit code and parse output:
       - If ALL TESTS PASS → Exit loop, proceed to Phase 4
       - If TESTS FAIL → Continue to step 3
    
    3. Analyze failures from test-output.txt:
       - Identify which tests failed
       - Extract error messages (e.g., "Expected X but received Y")
       - Check for common issues:
         * Missing imports in test file
         * Component not rendering (missing providers)
         * Signal not updating (async timing)
         * HttpClient mock not configured
         * Form validation errors
    
    4. Apply fixes based on failure analysis:
       - Fix component logic
       - Fix service API calls
       - Add missing TestBed providers
       - Fix async/await handling in tests
       - Update signal handling
    
    5. ATTEMPT = ATTEMPT + 1
    
END WHILE

IF ATTEMPT > MAX_ATTEMPTS:
    - Report: "Frontend tests failed after 5 attempts"
    - List remaining failures with error messages
    - Request human intervention
```

**Output:**
- Working UI connected to API
- Passing frontend tests
- Proper loading and error states

## Phase 4: Full Integration Testing (Tester Agent)

Reference: `.claude/agents/tester.md`

This phase runs ALL tests together and ensures the complete feature works end-to-end.

### Full Test Suite Verification Loop

```
ATTEMPT = 1
MAX_ATTEMPTS = 5

WHILE ATTEMPT <= MAX_ATTEMPTS:
    
    1. Run complete test suite from project root:
       ```bash
       npm test 2>&1 | tee full-test-output.txt
       EXIT_CODE=$?
       ```
    
    2. Also run lint and type check:
       ```bash
       npm run lint 2>&1 | tee lint-output.txt
       npm run typecheck 2>&1 | tee typecheck-output.txt  # if available
       ```
    
    3. Check all results:
       - If ALL PASS (exit code 0) → Exit loop, proceed to Phase 5
       - If ANY FAIL → Continue to step 4
    
    4. Categorize and analyze failures:
    
       **Test Failures:**
       - Parse test-output.txt for failed test names
       - Extract assertion errors and expected vs actual values
       - Identify if failure is in service, component, or integration test
       
       **Lint Failures:**
       - Parse lint-output.txt for file:line:column errors
       - Identify unused variables, missing types, style issues
       
       **Type Errors:**
       - Parse typecheck-output.txt for TS errors
       - Identify type mismatches, missing properties
    
    5. Apply fixes in priority order:
       a. Type errors (they often cause test failures)
       b. Lint errors (quick fixes)
       c. Test failures (logic/implementation issues)
    
    6. ATTEMPT = ATTEMPT + 1
    
END WHILE

IF ATTEMPT > MAX_ATTEMPTS:
    - Report: "Full test suite failed after 5 attempts"
    - Provide summary:
      * Number of passing tests
      * Number of failing tests
      * List of specific failures with messages
    - Suggest potential fixes human could investigate
    - DO NOT proceed to deployment
```

### Test Coverage Check

After tests pass, verify coverage meets targets:

```bash
npm test -- --coverage 2>&1 | tee coverage-output.txt
```

Parse coverage report:
- Services: Require 90%+ (WARN if below)
- Components: Require 70%+ (WARN if below)
- Overall: Require 80%+ (WARN if below)

If coverage is below thresholds:
1. Identify uncovered lines/branches
2. Add additional tests for edge cases
3. Re-run verification loop

**Output:**
- All tests passing
- Lint passing
- Type check passing
- Coverage report with any warnings

## Phase 5: Documentation (Documenter Agent)

Reference: `.claude/agents/documenter.md`

**Actions:**
1. Add JSDoc comments to public functions

2. Update API documentation in `docs/API.md`
   - Document new endpoints
   - Include request/response examples

3. Update README if significant feature

4. Add inline comments for complex logic

**Output:**
- Complete documentation
- Clear code comments

## Execution Steps

When running `/build-feature`:

1. **Understand the Scope**
   - Parse the provided requirements
   - Ask clarifying questions if needed
   - Confirm understanding

2. **Run Architecture Phase**
   - Execute Architect agent workflow
   - Present design for approval
   - Wait for confirmation before proceeding

3. **Implement Backend with Tests**
   - Execute Backend agent workflow
   - Write tests alongside implementation
   - **Run Backend Verification Loop** (max 5 attempts)
   - Only proceed when all backend tests pass
   - Commit checkpoint: `git commit -m "feat: add [feature] backend with tests"`

4. **Implement Frontend with Tests**
   - Execute Frontend agent workflow
   - Write tests alongside implementation
   - **Run Frontend Verification Loop** (max 5 attempts)
   - Only proceed when all frontend tests pass
   - Commit checkpoint: `git commit -m "feat: add [feature] frontend with tests"`

5. **Full Integration Verification**
   - **Run Full Test Suite Verification Loop** (max 5 attempts)
   - Verify lint passes
   - Check coverage meets thresholds
   - Only proceed when everything passes
   - Commit checkpoint: `git commit -m "test: verify [feature] integration"`

6. **Add Documentation**
   - Execute Documenter agent workflow
   - Commit: `git commit -m "docs: document [feature]"`

7. **Final Build Verification**
   ```bash
   npm run build
   ```
   If build fails, fix and retry (max 3 attempts)

8. **Report Summary**
   - Files created/modified
   - Test results (X passed, 0 failed)
   - Coverage percentages
   - Any warnings or notes

## Common Test Failure Patterns & Fixes

### Backend Failures

| Error Pattern | Likely Cause | Fix |
|---------------|--------------|-----|
| `Cannot find module` | Missing import | Add import statement |
| `is not a function` | Wrong export/import | Check export type (default vs named) |
| `Expected 200, got 404` | Route not registered | Add to routes/index.ts |
| `Expected 200, got 500` | Service throws error | Check service logic, add try/catch |
| `Validation failed` | Zod schema mismatch | Update validator to match test data |
| `Cannot read property of undefined` | Null/undefined value | Add null checks, fix data flow |
| `UNIQUE constraint failed` | Duplicate test data | Reset DB or use unique values |

### Frontend Failures

| Error Pattern | Likely Cause | Fix |
|---------------|--------------|-----|
| `NullInjectorError` | Missing provider | Add to TestBed providers |
| `No provider for HttpClient` | Missing HttpClientTestingModule | Add to TestBed imports |
| `Expected 0 to be 1` | Async not awaited | Add waitFor() or fakeAsync |
| `Cannot find element` | Element not rendered | Check @if conditions, async timing |
| `Signal is not a function` | Calling signal wrong | Use signal() not signal |
| `Expected spy to have been called` | Event not firing | Check event binding, use fireEvent |
| `Form invalid` | Validation not met | Set required fields in test |

### General TypeScript Errors

| Error Pattern | Likely Cause | Fix |
|---------------|--------------|-----|
| `Type X is not assignable to Y` | Type mismatch | Fix type or add assertion |
| `Property X does not exist` | Missing interface field | Update interface |
| `Object is possibly undefined` | Missing null check | Add optional chaining `?.` |
| `Argument of type X` | Wrong argument type | Cast or fix function signature |

## Example

```
/build-feature Create a task management feature where users can:
- View a list of tasks with status and priority
- Create new tasks with title, description, due date
- Edit existing tasks
- Mark tasks as complete
- Filter tasks by status
```

This will:
1. Design Task model and API
2. Build POST/GET/PATCH/DELETE endpoints + tests → verify loop until passing
3. Create TaskList, TaskCard, TaskForm components + tests → verify loop until passing
4. Run full integration test suite → verify loop until passing
5. Document the feature

**Expected verification loops:**
```
Backend:  Attempt 1 → 2 failures → fix → Attempt 2 → PASS ✓
Frontend: Attempt 1 → 1 failure → fix → Attempt 2 → PASS ✓  
Full:     Attempt 1 → PASS ✓
```

## Options

- `--skip-tests` - Skip test generation (not recommended)
- `--backend-only` - Only generate backend
- `--frontend-only` - Only generate frontend (requires existing API)
- `--dry-run` - Show plan without executing
- `--max-attempts N` - Override max retry attempts (default: 5)
- `--verbose` - Show full test output during verification loops

## Failure Handling

If a verification loop exceeds max attempts:

1. **Stop execution** - Do not proceed to next phase
2. **Report status** - Show what passed and what's still failing
3. **Provide diagnostics:**
   - Full error output from last attempt
   - Files that were modified
   - Suggested manual fixes
4. **Offer options:**
   - "Retry from this phase"
   - "Skip this test and continue (not recommended)"
   - "Abort and rollback changes"
