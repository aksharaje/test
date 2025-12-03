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
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
      },
      {
        path: 'knowledge-bases',
        loadComponent: () =>
          import('./features/knowledge-bases/knowledge-bases-list.component').then(
            (m) => m.KnowledgeBasesListComponent
          ),
      },
      {
        path: 'knowledge-bases/:id',
        loadComponent: () =>
          import('./features/knowledge-bases/knowledge-base-detail.component').then(
            (m) => m.KnowledgeBaseDetailComponent
          ),
      },
      {
        path: 'knowledge-bases/:id/search',
        loadComponent: () =>
          import('./features/knowledge-bases/knowledge-base-search.component').then(
            (m) => m.KnowledgeBaseSearchComponent
          ),
      },
      {
        path: 'story-generator',
        loadComponent: () =>
          import('./features/story-generator/story-generator.component').then(
            (m) => m.StoryGeneratorComponent
          ),
      },
      {
        path: 'story-generator/output/:id',
        loadComponent: () =>
          import('./features/story-generator/story-generator-output.component').then(
            (m) => m.StoryGeneratorOutputComponent
          ),
      },
      {
        path: 'code-chat',
        loadComponent: () =>
          import('./features/code-chat/code-chat.component').then(
            (m) => m.CodeChatComponent
          ),
      },
      {
        path: 'optimize',
        loadComponent: () =>
          import('./features/agent-optimize/optimize-list.component').then(
            (m) => m.OptimizeListComponent
          ),
      },
      {
        path: 'optimize/:flowId',
        loadComponent: () =>
          import('./features/agent-optimize/optimize-detail.component').then(
            (m) => m.OptimizeDetailComponent
          ),
      },
    ],
  },
];
