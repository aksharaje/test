import { Routes } from '@angular/router';
import { DocsLayoutComponent } from './docs-layout.component';
import { DocViewerComponent } from './doc-viewer.component';

export const DOCS_ROUTES: Routes = [
    {
        path: '',
        component: DocsLayoutComponent,
        children: [
            {
                path: '',
                component: DocViewerComponent // Shows "Select a workflow" state
            },
            {
                path: ':id',
                component: DocViewerComponent
            }
        ]
    }
];
