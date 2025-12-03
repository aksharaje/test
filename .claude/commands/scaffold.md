# Scaffold Command

Initialize a new project or add a new feature module to an existing project.

## Usage

```
/scaffold [type] [name]
```

**Types:**
- `project` - Full project initialization
- `feature` - New feature module in existing project
- `api` - New API resource (route, controller, service)
- `component` - New Angular component with tests

## Instructions

### Project Scaffold

When scaffolding a new project:

1. **Create Angular app with CLI:**
   ```bash
   npx @angular/cli@latest new [name] --style=css --routing --ssr=false --standalone
   cd [name]
   ```

2. **Install and configure Tailwind CSS:**
   ```bash
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init
   ```

   Update `tailwind.config.js`:
   ```javascript
   /** @type {import('tailwindcss').Config} */
   module.exports = {
     content: ["./src/**/*.{html,ts}"],
     theme: {
       extend: {},
     },
     plugins: [],
   };
   ```

   Add to `src/styles.css`:
   ```css
   @tailwind base;
   @tailwind components;
   @tailwind utilities;
   ```

3. **Install spartan/ui CLI and components:**
   ```bash
   npx @spartan-ng/cli@latest init
   npx @spartan-ng/cli@latest add button card input label form-field select dialog table badge alert spinner
   ```

4. **Configure primary color #006450 in styles.css:**
   ```css
   @tailwind base;
   @tailwind components;
   @tailwind utilities;

   @layer base {
     :root {
       --background: 0 0% 100%;
       --foreground: 222.2 84% 4.9%;
       --card: 0 0% 100%;
       --card-foreground: 222.2 84% 4.9%;
       --popover: 0 0% 100%;
       --popover-foreground: 222.2 84% 4.9%;
       --primary: 160 100% 20%;
       --primary-foreground: 0 0% 100%;
       --secondary: 210 40% 96.1%;
       --secondary-foreground: 222.2 47.4% 11.2%;
       --muted: 210 40% 96.1%;
       --muted-foreground: 215.4 16.3% 46.9%;
       --accent: 210 40% 96.1%;
       --accent-foreground: 222.2 47.4% 11.2%;
       --destructive: 0 84.2% 60.2%;
       --destructive-foreground: 210 40% 98%;
       --border: 214.3 31.8% 91.4%;
       --input: 214.3 31.8% 91.4%;
       --ring: 160 100% 20%;
       --radius: 0.5rem;
     }
   
     .dark {
       --background: 222.2 84% 4.9%;
       --foreground: 210 40% 98%;
       --card: 222.2 84% 4.9%;
       --card-foreground: 210 40% 98%;
       --popover: 222.2 84% 4.9%;
       --popover-foreground: 210 40% 98%;
       --primary: 160 100% 30%;
       --primary-foreground: 0 0% 100%;
       --secondary: 217.2 32.6% 17.5%;
       --secondary-foreground: 210 40% 98%;
       --muted: 217.2 32.6% 17.5%;
       --muted-foreground: 215 20.2% 65.1%;
       --accent: 217.2 32.6% 17.5%;
       --accent-foreground: 210 40% 98%;
       --destructive: 0 62.8% 30.6%;
       --destructive-foreground: 210 40% 98%;
       --border: 217.2 32.6% 17.5%;
       --input: 217.2 32.6% 17.5%;
       --ring: 160 100% 30%;
     }
   }

   @layer base {
     * {
       @apply border-border;
     }
     body {
       @apply bg-background text-foreground;
     }
   }
   ```

5. **Configure Jest for testing:**
   ```bash
   npm install -D jest @types/jest jest-preset-angular @testing-library/angular @testing-library/jest-dom
   ```

   Create `jest.config.js`:
   ```javascript
   module.exports = {
     preset: 'jest-preset-angular',
     setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
     testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/'],
     moduleNameMapper: {
       '^@app/(.*)$': '<rootDir>/src/app/$1',
       '^@env/(.*)$': '<rootDir>/src/environments/$1',
       '^@shared/(.*)$': '<rootDir>/../shared/$1',
     },
   };
   ```

   Create `setup-jest.ts`:
   ```typescript
   import 'jest-preset-angular/setup-jest';
   import '@testing-library/jest-dom';
   ```

6. **Create project structure:**
   ```
   [name]/
   ├── client/                  # Move Angular app here or keep at root
   │   ├── src/
   │   │   ├── app/
   │   │   │   ├── core/       # Singleton services, guards, interceptors
   │   │   │   │   ├── interceptors/
   │   │   │   │   ├── guards/
   │   │   │   │   └── services/
   │   │   │   ├── shared/     # Shared components, directives, pipes
   │   │   │   │   ├── components/
   │   │   │   │   ├── directives/
   │   │   │   │   └── pipes/
   │   │   │   ├── features/   # Feature modules
   │   │   │   ├── ui/         # spartan/ui generated components
   │   │   │   ├── app.component.ts
   │   │   │   ├── app.config.ts
   │   │   │   └── app.routes.ts
   │   │   ├── environments/
   │   │   │   ├── environment.ts
   │   │   │   └── environment.prod.ts
   │   │   ├── styles.css
   │   │   └── main.ts
   │   ├── angular.json
   │   ├── jest.config.js
   │   ├── setup-jest.ts
   │   ├── tailwind.config.js
   │   └── package.json
   ├── server/                  # Express backend
   │   ├── src/
   │   │   ├── routes/
   │   │   │   └── index.ts
   │   │   ├── controllers/
   │   │   ├── services/
   │   │   ├── middleware/
   │   │   │   ├── errorHandler.ts
   │   │   │   └── validateRequest.ts
   │   │   ├── validators/
   │   │   ├── utils/
   │   │   │   ├── AppError.ts
   │   │   │   └── logger.ts
   │   │   ├── lib/
   │   │   │   └── prisma.ts
   │   │   ├── types/
   │   │   ├── app.ts
   │   │   └── server.ts
   │   ├── prisma/
   │   │   └── schema.prisma
   │   ├── tests/
   │   │   ├── setup.ts
   │   │   └── fixtures/
   │   ├── tsconfig.json
   │   └── package.json
   ├── shared/                  # Shared types
   │   └── types/
   │       └── index.ts
   ├── scripts/
   │   ├── deploy.sh
   │   └── setup.sh
   ├── .claude/
   │   ├── agents/
   │   └── commands/
   ├── CLAUDE.md
   ├── ecosystem.config.js
   ├── package.json
   ├── .env.example
   ├── .gitignore
   └── README.md
   ```

7. **Set up root package.json with workspaces:**
   ```json
   {
     "name": "[project-name]",
     "private": true,
     "workspaces": ["client", "server", "shared"],
     "scripts": {
       "dev": "concurrently \"npm run dev:client\" \"npm run dev:server\"",
       "dev:client": "npm run start --workspace=client",
       "dev:server": "npm run dev --workspace=server",
       "build": "npm run build:client && npm run build:server",
       "build:client": "npm run build --workspace=client",
       "build:server": "npm run build --workspace=server",
       "test": "npm run test --workspaces",
       "lint": "npm run lint --workspaces",
       "db:migrate": "npm run db:migrate --workspace=server",
       "db:generate": "npm run db:generate --workspace=server",
       "start": "pm2 start ecosystem.config.js",
       "deploy": "./scripts/deploy.sh"
     },
     "devDependencies": {
       "concurrently": "^8.2.2"
     }
   }
   ```

8. **Create environment files:**
   
   `client/src/environments/environment.ts`:
   ```typescript
   export const environment = {
     production: false,
     apiUrl: 'http://localhost:3001/api',
   };
   ```

   `client/src/environments/environment.prod.ts`:
   ```typescript
   export const environment = {
     production: true,
     apiUrl: '/api',
   };
   ```

   `.env.example`:
   ```
   # Server
   NODE_ENV=development
   PORT=3001
   DATABASE_URL=file:./dev.db
   
   # Production Database
   # DATABASE_URL=postgresql://user:password@localhost:5432/dbname
   ```

9. **Create app.config.ts with providers:**
   ```typescript
   import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
   import { provideRouter, withComponentInputBinding } from '@angular/router';
   import { provideHttpClient, withInterceptors } from '@angular/common/http';
   import { routes } from './app.routes';
   import { apiInterceptor } from './core/interceptors/api.interceptor';

   export const appConfig: ApplicationConfig = {
     providers: [
       provideZoneChangeDetection({ eventCoalescing: true }),
       provideRouter(routes, withComponentInputBinding()),
       provideHttpClient(withInterceptors([apiInterceptor])),
     ],
   };
   ```

10. **Install dependencies and initialize:**
    ```bash
    npm install
    npm run db:generate
    ```

### Feature Module Scaffold

When scaffolding a feature:

1. **Create feature directory structure:**
   ```
   client/src/app/features/[feature]/
   ├── [feature]-list.component.ts
   ├── [feature]-list.component.spec.ts
   ├── [feature]-card.component.ts
   ├── [feature]-form.component.ts
   ├── [feature]-detail.component.ts
   ├── [feature].service.ts
   ├── [feature].service.spec.ts
   └── index.ts
   
   server/src/routes/[feature].routes.ts
   server/src/controllers/[feature].controller.ts
   server/src/services/[feature].service.ts
   server/src/validators/[feature].validator.ts
   
   server/tests/unit/[feature].service.test.ts
   server/tests/integration/[feature].routes.test.ts
   
   shared/types/[feature].ts
   ```

2. **Add Prisma model to schema**

3. **Wire up routes in server/src/routes/index.ts**

4. **Add route to client/src/app/app.routes.ts:**
   ```typescript
   {
     path: '[feature]',
     loadComponent: () =>
       import('./features/[feature]/[feature]-list.component')
         .then(m => m.[Feature]ListComponent),
   },
   ```

### API Resource Scaffold

When scaffolding an API resource:

1. Create service with CRUD methods
2. Create controller with route handlers
3. Create validator schemas
4. Create route file
5. Add to routes index
6. Create test fixtures
7. Create unit tests for service
8. Create integration tests for routes

### Component Scaffold

When scaffolding a component:

1. **Generate with Angular CLI:**
   ```bash
   ng generate component features/[feature]/[component-name] --standalone
   ```

2. **Create co-located test file** (generated automatically)

3. **Add spartan/ui imports as needed**

4. **Export from feature index.ts**

## Output

After scaffolding, report:
- Files created
- Commands to run next
- Any manual steps needed
