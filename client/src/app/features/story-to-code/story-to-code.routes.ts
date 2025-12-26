import { Routes } from '@angular/router';

export const STORY_TO_CODE_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./story-to-code-input.component').then(m => m.StoryToCodeInputComponent)
    },
    {
        path: 'processing/:id',
        loadComponent: () =>
            import('./story-to-code-processing.component').then(m => m.StoryToCodeProcessingComponent)
    },
    {
        path: 'results/:id',
        loadComponent: () =>
            import('./story-to-code-results.component').then(m => m.StoryToCodeResultsComponent)
    }
];
