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
        path: 'epic-creator',
        title: 'Epic Creator | Product Studio',
        data: { type: 'epic' },
        loadComponent: () =>
          import('./features/story-generator/story-generator.component').then(
            (m) => m.StoryGeneratorComponent
          ),
      },
      {
        path: 'feature-creator',
        title: 'Feature Creator | Product Studio',
        data: { type: 'feature' },
        loadComponent: () =>
          import('./features/story-generator/story-generator.component').then(
            (m) => m.StoryGeneratorComponent
          ),
      },
      {
        path: 'user-story-creator',
        title: 'User Story Creator | Product Studio',
        data: { type: 'user_story' },
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
        path: 'ideation',
        title: 'Ideation | Product Studio',
        loadComponent: () =>
          import('./features/ideation/ideation-input.component').then(
            (m) => m.IdeationInputComponent
          ),
      },
      {
        path: 'ideation/processing/:sessionId',
        title: 'Processing | Product Studio',
        loadComponent: () =>
          import('./features/ideation/ideation-processing.component').then(
            (m) => m.IdeationProcessingComponent
          ),
      },
      {
        path: 'ideation/results/:sessionId',
        title: 'Results | Product Studio',
        loadComponent: () =>
          import('./features/ideation/ideation-results.component').then(
            (m) => m.IdeationResultsComponent
          ),
      },
      {
        path: 'opportunity-linker/results/:sessionId',
        title: 'Prioritized Backlog | Product Studio',
        loadComponent: () =>
          import('./features/opportunity-linker/opportunity-linker-results.component').then(
            (m) => m.OpportunityLinkerResultsComponent
          ),
      },
      {
        path: 'feasibility',
        title: 'Feasibility Analyzer | Product Studio',
        loadComponent: () =>
          import('./features/feasibility/feasibility-input.component').then(
            (m) => m.FeasibilityInputComponent
          ),
      },
      {
        path: 'feasibility/processing/:sessionId',
        title: 'Analyzing | Product Studio',
        loadComponent: () =>
          import('./features/feasibility/feasibility-processing.component').then(
            (m) => m.FeasibilityProcessingComponent
          ),
      },
      {
        path: 'feasibility/results/:sessionId',
        title: 'Feasibility Results | Product Studio',
        loadComponent: () =>
          import('./features/feasibility/feasibility-results.component').then(
            (m) => m.FeasibilityResultsComponent
          ),
      },
      {
        path: 'business-case',
        title: 'Business Case Builder | Product Studio',
        loadComponent: () =>
          import('./features/business-case/business-case-input.component').then(
            (m) => m.BusinessCaseInputComponent
          ),
      },
      {
        path: 'business-case/processing/:sessionId',
        title: 'Building Business Case | Product Studio',
        loadComponent: () =>
          import('./features/business-case/business-case-processing.component').then(
            (m) => m.BusinessCaseProcessingComponent
          ),
      },
      {
        path: 'business-case/results/:sessionId',
        title: 'Business Case Results | Product Studio',
        loadComponent: () =>
          import('./features/business-case/business-case-results.component').then(
            (m) => m.BusinessCaseResultsComponent
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
      {
        path: 'library',
        title: 'Library | Product Studio',
        loadComponent: () =>
          import('./features/library/library-list.component').then(
            (m) => m.LibraryListComponent
          ),
      },
      {
        path: 'library/:id',
        title: 'Book Viewer | Product Studio',
        loadComponent: () =>
          import('./features/library/book-viewer.component').then(
            (m) => m.BookViewerComponent
          ),
      },
      {
        path: 'research-planner',
        title: 'Research Planner | Product Studio',
        loadComponent: () =>
          import('./features/research-planner/research-planner-input.component').then(
            (m) => m.ResearchPlannerInputComponent
          ),
      },
      {
        path: 'research-planner/processing/:sessionId',
        title: 'Processing | Product Studio',
        loadComponent: () =>
          import('./features/research-planner/research-planner-processing.component').then(
            (m) => m.ResearchPlannerProcessingComponent
          ),
      },
      {
        path: 'research-planner/results/:sessionId',
        title: 'Research Plan | Product Studio',
        loadComponent: () =>
          import('./features/research-planner/research-planner-results.component').then(
            (m) => m.ResearchPlannerResultsComponent
          ),
      },
      {
        path: 'journey-mapper',
        title: 'Journey Mapper | Product Studio',
        loadComponent: () =>
          import('./features/journey-mapper/journey-mapper.component').then(
            (m) => m.JourneyMapperComponent
          ),
      },
      {
        path: 'journey-mapper/processing/:sessionId',
        title: 'Generating Journey | Product Studio',
        loadComponent: () =>
          import('./features/journey-mapper/journey-mapper-processing.component').then(
            (m) => m.JourneyMapperProcessingComponent
          ),
      },
      {
        path: 'journey-mapper/results/:sessionId',
        title: 'Journey Map | Product Studio',
        loadComponent: () =>
          import('./features/journey-mapper/journey-mapper-results.component').then(
            (m) => m.JourneyMapperResultsComponent
          ),
      },
      {
        path: 'gap-analyzer',
        title: 'Experience Gap Analyzer | Product Studio',
        loadComponent: () =>
          import('./features/experience-gap-analyzer/experience-gap-analyzer.component').then(
            (m) => m.ExperienceGapAnalyzerComponent
          ),
      },
      {
        path: 'gap-analyzer/processing/:id',
        title: 'Analyzing Gaps | Product Studio',
        loadComponent: () =>
          import('./features/experience-gap-analyzer/experience-gap-analyzer-processing.component').then(
            (m) => m.ExperienceGapAnalyzerProcessingComponent
          ),
      },
      {
        path: 'gap-analyzer/results/:id',
        title: 'Gap Analysis Results | Product Studio',
        loadComponent: () =>
          import('./features/experience-gap-analyzer/experience-gap-analyzer-results.component').then(
            (m) => m.ExperienceGapAnalyzerResultsComponent
          ),
      },
    ],
  },
  {
    path: 'story-to-code',
    title: 'Story to Code | Product Studio',
    loadChildren: () => import('./features/story-to-code/story-to-code.routes').then(m => m.STORY_TO_CODE_ROUTES)
  },
  {
    path: 'docs',
    title: 'Documentation | Product Studio',
    loadChildren: () => import('./features/docs/docs.routes').then(m => m.DOCS_ROUTES)
  }
];
