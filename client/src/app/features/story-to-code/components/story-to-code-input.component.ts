import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoryToCodeService } from '../story-to-code.service';

@Component({
    selector: 'app-story-to-code-input',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div class="space-y-2">
        <h2 class="text-2xl font-bold tracking-tight">Generate Code from Stories</h2>
        <p class="text-muted-foreground">
          Paste your user stories or requirements, define your stack, and let AI scaffold your project.
        </p>
      </div>

      <!-- Stories Input -->
      <div class="space-y-4">
        <label class="block text-sm font-medium">
            User Stories / Requirements
            <span class="text-red-500">*</span>
        </label>
        <textarea 
            [(ngModel)]="stories" 
            class="w-full h-48 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none font-mono"
            placeholder="As a user, I want to authenticate via Google so that I can access my dashboard..."
        ></textarea>
        <p class="text-xs text-muted-foreground">
            Tip: Be specific about data models and validation rules for better results.
        </p>
      </div>

      <!-- Tech Stack -->
      <div class="space-y-4">
        <label class="block text-sm font-medium">
            Technical Stack
        </label>
        <input 
            type="text" 
            [(ngModel)]="techStack"
            class="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="e.g. Python FastAPI, Pydantic, PostgreSQL"
        />
      </div>

      <!-- Knowledge Base Selection (Simplified for MVP as IDs input, later can be a dropdown) -->
      <div class="space-y-4">
        <label class="block text-sm font-medium">
            Knowledge Base IDs (Optional)
        </label>
        <input 
            type="text" 
            [(ngModel)]="kbIdsString"
            class="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="e.g. 1, 5 (comma separated)"
        />
        <p class="text-xs text-muted-foreground">
           IDs of existing Knowledge Bases to use for context (e.g. coding standards).
        </p>
      </div>

      <!-- Action -->
      <div class="pt-4">
        <button 
            (click)="generate()" 
            [disabled]="!stories() || service.isLoading()"
            class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-8 py-2 w-full md:w-auto"
        >
            @if (service.isLoading()) {
                Generating...
            } @else {
                Generate Code Structure
            }
        </button>
      </div>

    </div>
  `
})
export class StoryToCodeInputComponent {
    service = inject(StoryToCodeService);

    // Signals/Models
    stories = signal('');
    techStack = signal('');
    kbIdsString = signal('');

    generate() {
        if (!this.stories()) return;

        const kbIds = this.kbIdsString()
            .split(',')
            .map(s => parseInt(s.trim()))
            .filter(n => !isNaN(n));

        this.service.generate({
            stories: this.stories(),
            techStack: this.techStack(),
            knowledgeBaseIds: kbIds,
            title: this.stories().substring(0, 30) + '...'
        });
    }
}
