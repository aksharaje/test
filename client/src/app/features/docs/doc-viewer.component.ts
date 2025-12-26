import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { DocsService } from './docs.service';
import { MarkdownModule } from 'ngx-markdown';

@Component({
  selector: 'app-doc-viewer',
  standalone: true,
  imports: [CommonModule, MarkdownModule],
  template: `
    <div class="p-8 prose prose-slate max-w-none">
      <div *ngIf="loading()" class="animate-pulse space-y-4">
        <div class="h-8 bg-slate-200 rounded w-1/3"></div>
        <div class="space-y-2">
          <div class="h-4 bg-slate-200 rounded"></div>
          <div class="h-4 bg-slate-200 rounded w-5/6"></div>
        </div>
      </div>
      
      <!-- FIX: Use markdown component with data binding, avoiding innerHTML pipe issues -->
      <markdown *ngIf="content()" [data]="content()"></markdown>

      <div *ngIf="!loading() && !content()" class="text-center text-slate-500 py-12">
        <p>Select a workflow from the sidebar to view documentation.</p>
        <div class="mt-4 text-sm text-slate-400">
           Select items from the sidebar to see how our AI Agents work.
        </div>
      </div>

      <div *ngIf="error()" class="bg-red-50 text-red-700 p-4 rounded-md border border-red-200">
        {{ error() }}
      </div>
    </div>
  `
})
export class DocViewerComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private docsService = inject(DocsService);

  content = signal<string | null>(null);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.loadDoc(id);
      } else {
        this.content.set(null);
      }
    });
  }

  loadDoc(name: string) {
    this.loading.set(true);
    this.error.set(null);
    this.content.set(null);

    // Convert nameService -> name-service
    const filename = this.camelToKebab(name) + '.md';

    this.docsService.getDocContent(filename).subscribe({
      next: (data) => {
        this.content.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(`Failed to load documentation for ${name}`);
        this.loading.set(false);
        console.error(err);
      }
    });
  }

  private camelToKebab(str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }
}
