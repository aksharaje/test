# Project Intelligence

## Stack Overview

This project uses a modern, simple stack optimized for rapid prototyping and easy deployment:

- **Frontend:** Angular 17+ with standalone components, spartan/ui, Tailwind CSS
- **Backend:** Node.js with Express.js
- **Database:** SQLite (dev) / PostgreSQL (prod) via Prisma ORM
- **Process Manager:** PM2
- **Deployment:** Linux server via rsync or GitHub Actions

## Design System

### Brand Colors
```
Primary: #006450 (Teal/Forest Green)
Primary Foreground: #ffffff

Use CSS variables in styles.css:
--primary: 160 100% 20%
--primary-foreground: 0 0% 100%
```

### spartan/ui Configuration
All components use spartan/ui with the custom primary color. When generating UI:
- Use spartan/ui components exclusively (brn prefix for brain, hlm prefix for helm)
- Follow the established color system
- Maintain consistent spacing (4px base unit)
- Use Lucide icons via @ng-icons/lucide or ngx-lucide

## Project Structure

```
project-root/
├── client/                 # Angular frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/      # Singleton services, guards, interceptors
│   │   │   ├── shared/    # Shared components, directives, pipes
│   │   │   ├── features/  # Feature modules (lazy-loaded)
│   │   │   └── ui/        # spartan/ui components
│   │   ├── assets/
│   │   └── styles/
│   │       └── styles.css
│   ├── angular.json
│   └── package.json
├── server/                 # Express backend
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── middleware/
│   │   └── utils/
│   ├── prisma/
│   │   └── schema.prisma
│   └── package.json
├── shared/                 # Shared types/utilities
│   └── types/
├── .claude/
│   ├── agents/
│   └── commands/
├── scripts/
│   ├── deploy.sh
│   └── setup.sh
├── ecosystem.config.js     # PM2 configuration
└── package.json            # Root workspace
```

## Agent System

This project uses specialized agents for different SDLC phases. Agents are located in `.claude/agents/` and can be invoked via commands in `.claude/commands/`.

### Available Agents
- **architect** - System design, database schema, API contracts
- **frontend** - Angular components, services, styling
- **backend** - Express routes, controllers, services
- **tester** - Unit tests, integration tests, E2E tests
- **deployer** - Build, deploy, infrastructure
- **documenter** - README, API docs, inline comments

### Available Commands
- `/build-feature` - Full feature development cycle
- `/scaffold` - Initialize new project or module
- `/test` - Run comprehensive test suite
- `/deploy` - Build and deploy to server
- `/full-cycle` - Complete SDLC from scope to deployment

## Code Conventions

### TypeScript
- Strict mode enabled
- Use interfaces over types for object shapes
- Explicit return types on functions
- No `any` - use `unknown` if type is truly unknown

### Angular
- Standalone components by default
- Signals for reactive state
- New control flow syntax (@if, @for, @switch)
- Services for shared state and API calls
- Smart/dumb component pattern
- Lazy-loaded feature routes

### Express
- Controller pattern for route handlers
- Service layer for business logic
- Middleware for cross-cutting concerns
- Consistent error handling with custom error classes

### Testing
- Jest for unit tests
- Angular Testing Library for component tests
- Supertest for API tests
- Playwright for E2E (when needed)

### Git
- Conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`
- Branch naming: `feature/`, `fix/`, `chore/`

## Error Handling Pattern

```typescript
// Backend: Custom error class
class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
  }
}

// Frontend: Error interceptor + toast notifications via spartan/ui HlmToaster
```

## Environment Variables

```bash
# Server
NODE_ENV=development|production
PORT=3001
DATABASE_URL=

# Client (Angular environments)
# src/environments/environment.ts
# src/environments/environment.prod.ts
```

## When Developing

1. **Always check existing patterns** before creating new ones
2. **Run tests** before committing: `npm test`
3. **Lint and format**: `npm run lint && npm run format`
4. **Update documentation** when adding new features
5. **Use the agent system** for complex features

## Deployment Checklist

- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Build successful
- [ ] PM2 ecosystem file updated
- [ ] Deployment script executed
