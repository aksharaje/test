# SDLC Agent System - Quick Start Guide

This system provides a comprehensive set of Claude Code agents and commands to automate the software development lifecycle.

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        SDLC AGENT SYSTEM                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  AGENTS (Specialized Expertise)                                 │
│  ├── architect.md   - System design, schemas, API contracts    │
│  ├── backend.md     - Express routes, services, controllers    │
│  ├── frontend.md    - React components, hooks, styling         │
│  ├── tester.md      - Unit, integration, E2E tests             │
│  ├── deployer.md    - Build, deploy, infrastructure            │
│  └── documenter.md  - README, API docs, code comments          │
│                                                                 │
│  COMMANDS (Orchestrated Workflows)                              │
│  ├── /scaffold      - Initialize projects or modules           │
│  ├── /build-feature - Complete feature implementation          │
│  ├── /test          - Run comprehensive tests                  │
│  ├── /deploy        - Build and deploy to production           │
│  └── /full-cycle    - End-to-end SDLC execution                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Angular 17+, TypeScript, spartan/ui, Tailwind CSS |
| Backend | Node.js 20, Express.js, TypeScript |
| Database | SQLite (dev) / PostgreSQL (prod) with Prisma ORM |
| Testing | Jest + Angular Testing Library (frontend), Vitest + Supertest (backend) |
| Deployment | PM2, Nginx, rsync or GitHub Actions |

**Primary Color:** `#006450` (Teal/Forest Green)

## Getting Started

### 1. Copy Agent Files to Your Project

Copy the `.claude` directory to your project root:

```bash
cp -r .claude /path/to/your/project/
cp CLAUDE.md /path/to/your/project/
```

### 2. Initialize a New Project

Use the scaffold command:

```
/scaffold project my-app
```

This creates the full project structure with:
- React frontend with shadcn/ui configured
- Express backend with Prisma
- Shared types directory
- Test setup
- Deployment scripts

### 3. Build Your First Feature

```
/build-feature Create a user authentication system with:
- User registration with email and password
- Login with JWT tokens
- Password reset via email
- Profile management
```

Claude will:
1. Design the User model and API
2. Implement backend auth endpoints
3. Build React login/register forms
4. Write comprehensive tests
5. Document everything

### 4. Run Tests

```
/test all
```

Or for specific scopes:
```
/test unit
/test integration
/test coverage
```

### 5. Deploy

Direct to server:
```
/deploy production
```

Or via GitHub:
```
/deploy github
```

## Command Reference

### /scaffold

Initialize new projects or modules.

```
/scaffold project my-app      # New full project
/scaffold feature tasks       # New feature module
/scaffold api comments        # New API resource
/scaffold component UserCard  # New React component
```

### /build-feature

Build a complete feature from description.

```
/build-feature [description of feature]

Options:
  --skip-tests      Skip test generation
  --backend-only    Only generate backend
  --frontend-only   Only generate frontend
  --dry-run         Show plan without executing
```

### /test

Run tests with various scopes.

```
/test all           # All tests
/test unit          # Unit tests only
/test integration   # Integration tests only
/test coverage      # With coverage report
/test [feature]     # Tests for specific feature
/test watch         # Watch mode
```

### /deploy

Deploy to production.

```
/deploy production  # Deploy to production server
/deploy staging     # Deploy to staging
/deploy preview     # Build only, no deploy
/deploy github      # Push to trigger CI/CD
```

### /full-cycle

Complete SDLC from scope to deployment.

```
/full-cycle [scope description]

Options:
  --skip-deploy     Skip deployment phase
  --backend-only    Only architecture + backend
  --no-checkpoints  Skip confirmation pauses
  --resume [phase]  Resume from specific phase
```

## Project Structure

After scaffolding, your project will have:

```
my-app/
├── client/                    # Angular frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/         # Singleton services, guards, interceptors
│   │   │   ├── shared/       # Shared components, directives, pipes
│   │   │   ├── features/     # Feature modules (lazy-loaded)
│   │   │   ├── ui/           # spartan/ui components
│   │   │   ├── app.component.ts
│   │   │   ├── app.config.ts
│   │   │   └── app.routes.ts
│   │   ├── environments/
│   │   └── styles.css
│   ├── angular.json
│   ├── jest.config.js
│   ├── tailwind.config.js
│   └── package.json
├── server/                    # Express backend
│   ├── src/
│   │   ├── routes/           # Route definitions
│   │   ├── controllers/      # Request handlers
│   │   ├── services/         # Business logic
│   │   ├── middleware/       # Express middleware
│   │   ├── validators/       # Zod schemas
│   │   └── utils/            # Helpers
│   ├── prisma/               # Database schema
│   ├── tests/                # Backend tests
│   └── package.json
├── shared/                    # Shared types
├── scripts/                   # Deploy scripts
├── .claude/                   # Agent system
│   ├── agents/
│   └── commands/
├── .github/workflows/         # CI/CD
├── CLAUDE.md                  # Project conventions
├── ecosystem.config.js        # PM2 config
└── package.json               # Root workspace
```

## Deployment Setup

### Option 1: Direct Deploy (Recommended for Prototyping)

1. Configure your server in `.env`:
   ```
   DEPLOY_USER=deploy
   DEPLOY_HOST=your-server.com
   DEPLOY_PATH=/var/www/app
   ```

2. Set up your server (one-time):
   ```bash
   ssh your-server.com
   # Run the setup script from deployer.md
   ```

3. Deploy:
   ```bash
   ./scripts/deploy.sh
   ```

### Option 2: GitHub Actions

1. Add secrets to your GitHub repo:
   - `SERVER_HOST`
   - `SERVER_USER`
   - `SSH_PRIVATE_KEY`

2. Push to main branch to trigger deployment.

## Customization

### Changing the Primary Color

Edit `client/src/styles.css`:

```css
:root {
  --primary: 160 100% 20%;  /* HSL values */
}
```

### Adding spartan/ui Components

```bash
cd client
npx @spartan-ng/cli@latest add [component-name]
```

### Modifying Agent Behavior

Edit the agent files in `.claude/agents/` to customize:
- Code patterns and conventions
- File structure preferences
- Testing strategies
- Documentation styles

## Tips

1. **Start with /full-cycle for new features** - It ensures nothing is missed.

2. **Use checkpoints** - The system pauses for confirmation at key points. Use this to review before proceeding.

3. **Commit frequently** - Each phase creates a logical commit point.

4. **Read agent files** - Understanding the agents helps you provide better prompts.

5. **Customize for your needs** - These are starting templates. Modify them to match your preferences.

## Troubleshooting

### Database Issues
```bash
cd server
npx prisma migrate reset  # Reset and rerun migrations
npx prisma generate       # Regenerate client
```

### Build Failures
```bash
npm run lint              # Check for linting errors
npm run typecheck         # Check TypeScript
```

### Deployment Issues
```bash
ssh deploy@server "pm2 logs"    # Check application logs
ssh deploy@server "pm2 status"  # Check process status
```

## Support

- Refer to individual agent files for detailed patterns
- Check CLAUDE.md for project conventions
- Review command files for workflow details
