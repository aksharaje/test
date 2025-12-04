import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/authenticated-shell/authenticated-shell.component').then(
        (m) => m.AuthenticatedShellComponent
      ),
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        title: 'Dashboard | Product Studio',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
      },
      {
        path: 'knowledge-bases',
        title: 'Knowledge Bases | Product Studio',
        loadComponent: () =>
          import('./features/knowledge-bases/knowledge-bases-list.component').then(
            (m) => m.KnowledgeBasesListComponent
          ),
      },
      {
        path: 'knowledge-bases/:id',
        title: 'Knowledge Base | Product Studio',
        loadComponent: () =>
          import('./features/knowledge-bases/knowledge-base-detail.component').then(
            (m) => m.KnowledgeBaseDetailComponent
          ),
      },
      {
        path: 'knowledge-bases/:id/search',
        title: 'Search Knowledge Base | Product Studio',
        loadComponent: () =>
          import('./features/knowledge-bases/knowledge-base-search.component').then(
            (m) => m.KnowledgeBaseSearchComponent
          ),
      },
      {
        path: 'prd-generator',
        title: 'PRD Generator | Product Studio',
        loadComponent: () =>
          import('./features/prd-generator/prd-generator.component').then(
            (m) => m.PrdGeneratorComponent
          ),
      },
      {
        path: 'prd-generator/output/:id',
        title: 'PRD Output | Product Studio',
        loadComponent: () =>
          import('./features/prd-generator/prd-generator-output.component').then(
            (m) => m.PrdGeneratorOutputComponent
          ),
      },
      {
        path: 'story-generator',
        title: 'Epic/Feature/Story Creator | Product Studio',
        loadComponent: () =>
          import('./features/story-generator/story-generator.component').then(
            (m) => m.StoryGeneratorComponent
          ),
      },
      {
        path: 'story-generator/output/:id',
        title: 'Story Output | Product Studio',
        loadComponent: () =>
          import('./features/story-generator/story-generator-output.component').then(
            (m) => m.StoryGeneratorOutputComponent
          ),
      },
      {
        path: 'code-chat',
        title: 'Code Chat | Product Studio',
        loadComponent: () =>
          import('./features/code-chat/code-chat.component').then(
            (m) => m.CodeChatComponent
          ),
      },
      {
        path: 'optimize',
        title: 'Agent Optimization | Product Studio',
        loadComponent: () =>
          import('./features/agent-optimize/optimize-list.component').then(
            (m) => m.OptimizeListComponent
          ),
      },
      {
        path: 'optimize/:flowId',
        title: 'Optimization Details | Product Studio',
        loadComponent: () =>
          import('./features/agent-optimize/optimize-detail.component').then(
            (m) => m.OptimizeDetailComponent
          ),
      },
      {
        path: 'optimize/:flowId/feedback',
        title: 'Feedback | Product Studio',
        loadComponent: () =>
          import('./features/agent-optimize/feedback-page.component').then(
            (m) => m.FeedbackPageComponent
          ),
      },
      {
        path: 'settings/integrations',
        title: 'Integrations | Product Studio',
        loadComponent: () =>
          import('./features/settings/integrations.component').then(
            (m) => m.IntegrationsComponent
          ),
      },
      {
        path: 'settings/integrations/:id/mappings',
        title: 'Field Mappings | Product Studio',
        loadComponent: () =>
          import('./features/settings/field-mappings.component').then(
            (m) => m.FieldMappingsComponent
          ),
      },
      {
        path: 'pi-planning',
        title: 'PI Planning | Product Studio',
        loadComponent: () =>
          import('./features/pi-planning/pi-planning-list.component').then(
            (m) => m.PiPlanningListComponent
          ),
      },
      {
        path: 'pi-planning/:integrationId/:sessionId',
        title: 'PI Planning Board | Product Studio',
        loadComponent: () =>
          import('./features/pi-planning/pi-planning-board.component').then(
            (m) => m.PiPlanningBoardComponent
          ),
      },
    ],
  },
];
