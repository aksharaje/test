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
# Frontend tests
cd client && npm test

# Backend tests (Python)
cd server && pytest
```

This runs:
1. Python backend tests (`server/tests/`)
2. Client component tests (`client/src/**/*.spec.ts`)
3. Client service tests (`client/src/**/*.spec.ts`)

### Unit Tests Only

```bash
# Python backend unit tests
cd server && pytest tests/test_*_service.py -v

# Frontend unit tests
cd client && npm test -- --testPathPattern="service"
```

### Integration Tests Only

```bash
# Python backend API tests
cd server && pytest tests/test_*_api.py -v
```

### Feature-Specific Tests

```bash
# All backend tests for a feature
cd server && pytest tests/test_[feature]*.py -v

# All frontend tests for a feature
cd client && npm test -- --testPathPattern="[feature]"
```

### Coverage Report

```bash
# Python backend coverage
cd server && pytest --cov=app --cov-report=html
# Open htmlcov/index.html in browser

# Frontend coverage
cd client && npm test -- --coverage
# Open coverage/index.html in browser
```

### Watch Mode

```bash
# Frontend watch for changes
cd client && npm test -- --watch

# Python watch (requires pytest-watch)
cd server && ptw
```

## Test Verification Workflow

When `/test` is invoked:

1. **Check Test Environment**
   ```bash
   # Verify database migrations are up to date
   cd server && npm run db:push

   # Ensure Python virtual environment is active
   cd server && source venv/bin/activate
   ```

2. **Run Linting First**
   ```bash
   # Frontend linting
   cd client && npm run lint

   # Backend linting
   cd server && ruff check .
   ```
   Fix any linting errors before proceeding.

3. **Run Backend Tests**
   ```bash
   cd server && pytest -v
   ```

   Expected output:
   - All tests pass
   - No console errors
   - Fast execution (<30s)

4. **Run Frontend Tests**
   ```bash
   cd client && npm test
   ```

   Expected output:
   - Components render correctly
   - User interactions work
   - Services handle API calls correctly
   - Signal state management works

5. **Generate Coverage Reports**
   ```bash
   # Backend coverage
   cd server && pytest --cov=app --cov-report=html

   # Frontend coverage
   cd client && npm test -- --coverage
   ```

   Review coverage:
   - Services: Target 90%+
   - Routers/Components: Target 80%+
   - Overall: Target 80%+

6. **Identify Gaps**

   Look for:
   - Uncovered branches
   - Missing error case tests
   - Untested edge cases

7. **Report Results**

   Provide summary:
   - Total tests: X passed, Y failed
   - Coverage: X%
   - Problem areas
   - Recommendations

## Common Test Scenarios

### Testing a New Feature

```bash
# 1. Create test files following patterns in tester.md

# 2. Run backend feature tests
cd server && pytest tests/test_[feature]*.py -v

# 3. Run frontend feature tests
cd client && npm test -- --testPathPattern="[feature]"

# 4. Check coverage for feature
cd server && pytest tests/test_[feature]*.py --cov=app/services/[feature] --cov-report=term
```

### Debugging Failing Tests

```bash
# Python: Run single test with verbose output
cd server && pytest tests/test_tasks.py::test_create_task -v -s

# Python: Run with debugger (use pdb)
cd server && pytest tests/test_tasks.py --pdb

# Frontend: Run single test
cd client && npm test -- --testNamePattern="creates a task" --verbose
```

### Testing API Endpoints

```bash
# Start Python server in development mode
cd server && uvicorn app.main:app --reload --port 8000

# In another terminal, use curl or httpie
curl -X POST http://localhost:8000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Test task", "project_id": "proj_123"}'

# Or use FastAPI's interactive docs
# Open http://localhost:8000/docs in browser
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
# Check DATABASE_URL in .env
# Ensure test database exists
createdb app_test

# Reset migrations
cd server && npm run db:push
```

### Python Test Issues

```python
# Ensure virtual environment is activated
source server/venv/bin/activate

# Install test dependencies
pip install pytest pytest-asyncio httpx pytest-cov

# Check for async issues - use proper fixtures
@pytest.fixture
async def client():
    async with AsyncClient(...) as ac:
        yield ac
```

### HttpClient Testing Issues (Angular)

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
```

```python
# For Python (pytest)
# In pytest.ini
[pytest]
asyncio_mode = auto
timeout = 30
```

### Import/Module Errors

```bash
# Clear Jest cache (frontend)
cd client && npm test -- --clearCache

# Python import issues - check PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:$(pwd)/server"

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
