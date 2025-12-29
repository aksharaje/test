import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { DocsService } from './docs.service';
import { MarkdownModule } from 'ngx-markdown';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideSearch,
  lucideLightbulb,
  lucideCheckCircle,
  lucideUsers,
  lucideFileText,
  lucideCalendar,
  lucideCode,
  lucideArrowRight,
} from '@ng-icons/lucide';

@Component({
  selector: 'app-doc-viewer',
  standalone: true,
  imports: [CommonModule, MarkdownModule, NgIcon],
  viewProviders: [
    provideIcons({
      lucideSearch,
      lucideLightbulb,
      lucideCheckCircle,
      lucideUsers,
      lucideFileText,
      lucideCalendar,
      lucideCode,
      lucideArrowRight,
    }),
  ],
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

      <!-- Product Studio Overview -->
      <div *ngIf="!loading() && !content()" class="not-prose">
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold text-slate-900">Welcome to Product Studio</h1>
          <p class="mt-3 text-lg text-slate-600 max-w-2xl mx-auto">
            Your AI-powered product management platform. From research to development,
            our intelligent agents guide you through every stage of the product lifecycle.
          </p>
        </div>

        <!-- Workflow Stages -->
        <div class="mb-10">
          <h2 class="text-lg font-semibold text-slate-800 mb-4">The Product Development Journey</h2>
          <div class="grid grid-cols-7 gap-2">
            <div *ngFor="let stage of workflowStages" class="text-center">
              <div class="w-12 h-12 mx-auto rounded-full flex items-center justify-center"
                   [style.background-color]="stage.bgColor">
                <ng-icon [name]="stage.icon" class="h-5 w-5" [style.color]="stage.color"></ng-icon>
              </div>
              <p class="mt-2 text-xs font-medium text-slate-700">{{ stage.name }}</p>
            </div>
          </div>
          <div class="mt-3 h-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 rounded-full opacity-30"></div>
        </div>

        <!-- Stage Descriptions -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div *ngFor="let stage of stageDetails"
               class="p-4 rounded-lg border border-slate-200 hover:border-primary/50 hover:shadow-sm transition-all">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                   [style.background-color]="stage.bgColor">
                <ng-icon [name]="stage.icon" class="h-5 w-5" [style.color]="stage.color"></ng-icon>
              </div>
              <div>
                <h3 class="font-semibold text-slate-900">{{ stage.name }}</h3>
                <p class="mt-1 text-sm text-slate-600">{{ stage.description }}</p>
                <div class="mt-2 flex flex-wrap gap-1">
                  <span *ngFor="let tool of stage.tools"
                        class="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {{ tool }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Getting Started -->
        <div class="bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl p-6 border border-primary/20">
          <h2 class="text-lg font-semibold text-slate-900 mb-2">Getting Started</h2>
          <p class="text-slate-600 mb-4">
            Select a tool from the sidebar to learn how it works and what inputs it needs.
            Each tool includes detailed field descriptions and examples to help you get the most out of Product Studio.
          </p>
          <div class="flex items-center gap-2 text-sm text-primary font-medium">
            <ng-icon name="lucideArrowRight" class="h-4 w-4"></ng-icon>
            <span>Choose a category from the sidebar to explore</span>
          </div>
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

  // Workflow stages for the visual flow
  workflowStages = [
    { name: 'Research', icon: 'lucideSearch', color: '#10b981', bgColor: '#d1fae5' },
    { name: 'Ideation', icon: 'lucideLightbulb', color: '#f59e0b', bgColor: '#fef3c7' },
    { name: 'Feasibility', icon: 'lucideCheckCircle', color: '#3b82f6', bgColor: '#dbeafe' },
    { name: 'CX', icon: 'lucideUsers', color: '#8b5cf6', bgColor: '#ede9fe' },
    { name: 'Backlog', icon: 'lucideFileText', color: '#ec4899', bgColor: '#fce7f3' },
    { name: 'PI Planning', icon: 'lucideCalendar', color: '#06b6d4', bgColor: '#cffafe' },
    { name: 'Development', icon: 'lucideCode', color: '#6366f1', bgColor: '#e0e7ff' },
  ];

  // Detailed stage descriptions
  stageDetails = [
    {
      name: 'Research',
      icon: 'lucideSearch',
      color: '#10b981',
      bgColor: '#d1fae5',
      description: 'Gather insights from documents, knowledge bases, and existing research to inform your product decisions.',
      tools: ['Code Chat', 'Knowledge Base'],
    },
    {
      name: 'Ideation',
      icon: 'lucideLightbulb',
      color: '#f59e0b',
      bgColor: '#fef3c7',
      description: 'Generate and prioritize product ideas with AI-powered brainstorming and opportunity scoring.',
      tools: ['Ideation Manager', 'Opportunity Linker'],
    },
    {
      name: 'Feasibility',
      icon: 'lucideCheckCircle',
      color: '#3b82f6',
      bgColor: '#dbeafe',
      description: 'Assess technical feasibility, estimate effort, and build business cases for your ideas.',
      tools: ['Feasibility Analyzer', 'Business Case'],
    },
    {
      name: 'Customer Experience',
      icon: 'lucideUsers',
      color: '#8b5cf6',
      bgColor: '#ede9fe',
      description: 'Map customer journeys, identify pain points, analyze gaps, and generate improvement recommendations.',
      tools: ['Research Planner', 'Journey Mapper', 'Gap Analyzer', 'CX Recommender'],
    },
    {
      name: 'Backlog Authoring',
      icon: 'lucideFileText',
      color: '#ec4899',
      bgColor: '#fce7f3',
      description: 'Create detailed PRDs and user stories with AI assistance for clear requirements.',
      tools: ['PRD Generator', 'Story Generator'],
    },
    {
      name: 'PI Planning',
      icon: 'lucideCalendar',
      color: '#06b6d4',
      bgColor: '#cffafe',
      description: 'Plan your program increments with intelligent capacity planning and dependency management.',
      tools: ['PI Planning Board'],
    },
    {
      name: 'Development',
      icon: 'lucideCode',
      color: '#6366f1',
      bgColor: '#e0e7ff',
      description: 'Transform stories into code and prepare release documentation with AI-generated artifacts.',
      tools: ['Story to Code', 'Release Prep'],
    },
  ];

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
