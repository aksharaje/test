import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StoryToCodeService } from '../story-to-code.service';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideHistory, lucideChevronRight, lucidePlus } from '@ng-icons/lucide';

@Component({
    selector: 'app-story-to-code-history',
    standalone: true,
    imports: [CommonModule, NgIconComponent],
    viewProviders: [provideIcons({ lucideHistory, lucideChevronRight, lucidePlus })],
    template: `
    <div class="flex flex-col h-full">
      <div class="p-4 border-b border-border">
         <button 
            (click)="newSession()"
            class="w-full inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
        >
            <ng-icon name="lucidePlus" class="h-4 w-4" />
            New Generation
         </button>
      </div>

      <div class="flex-1 overflow-auto p-2 space-y-1">
        @if (service.history().length === 0) {
            <div class="text-sm text-muted-foreground text-center py-8">
                No history yet.
            </div>
        }

        @for (item of service.history(); track item.id) {
            <button
                (click)="service.getGeneration(item.id)"
                [class.bg-accent]="service.currentArtifact()?.id === item.id"
                class="w-full text-left px-3 py-3 rounded-lg text-sm transition-colors hover:bg-accent group flex flex-col gap-1"
            >
                <div class="font-medium truncate text-foreground w-full">
                    {{ item.title }}
                </div>
                <div class="text-xs text-muted-foreground flex justify-between">
                    <span>{{ item.createdAt | date:'shortDate' }}</span>
                    @if (item.generationMetadata?.techStack) {
                        <span class="truncate max-w-[80px]">{{ item.generationMetadata?.techStack }}</span>
                    }
                </div>
            </button>
        }
      </div>
    </div>
  `
})
export class StoryToCodeHistoryComponent {
    service = inject(StoryToCodeService);

    newSession() {
        this.service.currentArtifact.set(null);
    }
}
