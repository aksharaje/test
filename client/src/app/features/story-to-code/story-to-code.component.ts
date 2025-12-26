import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StoryToCodeService } from './story-to-code.service';
import { StoryToCodeInputComponent } from './components/story-to-code-input.component';
import { StoryToCodeHistoryComponent } from './components/story-to-code-history.component';
import { StoryToCodeResultComponent } from './components/story-to-code-result.component';

@Component({
    selector: 'app-story-to-code',
    standalone: true,
    imports: [
        CommonModule,
        StoryToCodeInputComponent,
        StoryToCodeHistoryComponent,
        StoryToCodeResultComponent
    ],
    template: `
    <div class="h-full flex flex-col md:flex-row bg-background">
      <!-- Sidebar / History -->
      <div class="w-full md:w-80 border-r border-border bg-card">
        <app-story-to-code-history></app-story-to-code-history>
      </div>

      <!-- Main Content -->
      <div class="flex-1 overflow-hidden flex flex-col">
        <!-- Header -->
        <header class="h-14 border-b border-border flex items-center px-6 bg-card shrink-0">
            <h1 class="text-lg font-semibold text-foreground">AI Story-to-Code</h1>
        </header>

        <!-- Dynamic View: Input or Result -->
        <div class="flex-1 overflow-auto p-6">
            @if (service.currentArtifact()) {
                <app-story-to-code-result></app-story-to-code-result>
            } @else {
                <app-story-to-code-input></app-story-to-code-input>
            }
        </div>
      </div>
    </div>
  `
})
export class StoryToCodeComponent implements OnInit {
    service = inject(StoryToCodeService);

    ngOnInit() {
        this.service.loadHistory();
    }
}
