# Test Command

Run comprehensive tests with coverage reporting.

## Usage

```
/test [scope]
```

**Scopes:**
- `all` - Run all tests (default)
- `unit` - Run unit tests only
- `integration` - Run integration tests only
- `e2e` - Run end-to-end tests only
- `[feature]` - Run tests for a specific feature
- `coverage` - Run with coverage report
- `watch` - Run in watch mode

## Instructions

### Full Test Suite

Run all tests across the project:

```bash
# From project root
npm test
```

This runs:
1. Server unit tests (`server/tests/unit/`)
2. Server integration tests (`server/tests/integration/`)
3. Client component tests (`client/src/**/*.test.tsx`)
4. Client hook tests (`client/src/**/*.test.ts`)

### Unit Tests Only

```bash
# Server unit tests
cd server && npm test -- --testPathPattern=unit

# Or with filter
npm test -- --testPathPattern="task.service"
```

### Integration Tests Only

```bash
# Server integration tests
cd server && npm test -- --testPathPattern=integration
```

### Feature-Specific Tests

```bash
# All tests for a feature
npm test -- --testPathPattern="[feature]"

# Example: all task-related tests
npm test -- --testPathPattern="task"
```

### Coverage Report

```bash
# Generate coverage
npm test -- --coverage

# With HTML report
npm test -- --coverage --coverageReporters=html
# Open coverage/index.html in browser
```

### Watch Mode

```bash
# Watch for changes
npm test -- --watch

# Watch specific files
npm test -- --watch --testPathPattern="task"
```

## Test Verification Workflow

When `/test` is invoked:

1. **Check Test Environment**
   ```bash
   # Verify test database is available
   cd server && npx prisma migrate status
   
   # Reset test database if needed
   npx prisma migrate reset --force
   ```

2. **Run Linting First**
   ```bash
   npm run lint
   ```
   Fix any linting errors before proceeding.

3. **Run Unit Tests**
   ```bash
   npm test -- --testPathPattern=unit
   ```
   
   Expected output:
   - All tests pass
   - No console errors
   - Fast execution (<30s)

4. **Run Integration Tests**
   ```bash
   npm test -- --testPathPattern=integration
   ```
   
   Expected output:
   - All tests pass
   - Database interactions work
   - API contracts validated

5. **Run Client Tests**
   ```bash
   cd client && npm test
   ```
   
   Expected output:
   - Components render correctly
   - User interactions work
   - Services handle API calls correctly
   - Signal state management works

6. **Generate Coverage Report**
   ```bash
   npm test -- --coverage
   ```
   
   Review coverage:
   - Services: Target 90%+
   - Controllers: Target 80%+
   - Components: Target 70%+
   - Overall: Target 80%+

7. **Identify Gaps**
   
   Look for:
   - Uncovered branches
   - Missing error case tests
   - Untested edge cases

8. **Report Results**
   
   Provide summary:
   - Total tests: X passed, Y failed
   - Coverage: X%
   - Problem areas
   - Recommendations

## Common Test Scenarios

### Testing a New Feature

```bash
# 1. Create test files following patterns in tester.md
# 2. Run feature tests
npm test -- --testPathPattern="[feature]"

# 3. Check coverage for feature
npm test -- --coverage --collectCoverageFrom="**/[feature]/**"
```

### Debugging Failing Tests

```bash
# Run single test with verbose output
npm test -- --testNamePattern="creates a task" --verbose

# Run with debugger
node --inspect-brk node_modules/.bin/vitest run [test-file]
```

### Testing API Endpoints

```bash
# Start server in test mode
NODE_ENV=test npm run dev:server

# In another terminal, use curl or httpie
curl -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Test task", "projectId": "proj_123"}'
```

## Test Quality Checklist

Before marking tests complete:

- [ ] All tests pass consistently (no flaky tests)
- [ ] Happy path covered
- [ ] Error cases covered
- [ ] Edge cases covered
- [ ] Async operations properly awaited
- [ ] Test isolation (no shared state)
- [ ] Meaningful assertions
- [ ] Descriptive test names
- [ ] No skipped tests without reason
- [ ] Coverage meets targets

## Troubleshooting

### Database Connection Issues

```bash
# Check DATABASE_URL in .env.test
# Ensure test database exists
createdb app_test

# Reset migrations
cd server && npx prisma migrate reset --force
```

### HttpClient Testing Issues

```typescript
// Ensure HttpClientTestingModule is imported
TestBed.configureTestingModule({
  imports: [HttpClientTestingModule],
  providers: [YourService],
});

// Verify all HTTP requests are flushed
httpMock.verify();
```

### Timeout Issues

```typescript
// Increase timeout for slow tests (Jest)
it('slow test', async () => {
  // ...
}, 10000); // 10 second timeout

// Or globally in jest.config.js
testTimeout: 10000

// For backend (Vitest)
// In vitest.config.ts
testTimeout: 10000
```

### Import/Module Errors

```bash
# Clear Jest cache (frontend)
npm test -- --clearCache

# Clear Vitest cache (backend)
cd server && npm test -- --clearCache

# Check tsconfig paths match module aliases
```

## Output

After running tests, report:

1. **Summary**
   ```
   Test Suites: X passed, Y failed, Z total
   Tests:       X passed, Y failed, Z total
   Time:        Xs
   ```

2. **Coverage**
   ```
   File          | % Stmts | % Branch | % Funcs | % Lines
   --------------|---------|----------|---------|--------
   All files     |   85.2  |   78.4   |   82.1  |   85.9
   ```

3. **Issues Found**
   - List any failing tests
   - Identify coverage gaps
   - Note flaky tests

4. **Recommendations**
   - Tests to add
   - Areas needing attention
   - Refactoring suggestions
