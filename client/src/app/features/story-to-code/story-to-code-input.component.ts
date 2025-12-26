import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UpperCasePipe, SlicePipe } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
    lucideChevronDown,
    lucideChevronRight,
    lucideHistory,
    lucideLoader2,
    lucideSparkles,
    lucideTrash2,
    lucideFileText,
    lucideLayers,
    lucideX,
    lucideCode,
    lucideCheck,
    lucideDatabase,
    lucideRotateCw,
    lucideGitBranch,
} from '@ng-icons/lucide';
import { StoryToCodeService, StoryArtifact, CodeKnowledgeBase, TECH_STACK_OPTIONS, StoryToCodeSession } from './story-to-code.service';
import { HlmButtonDirective } from '../../ui/button';

type SourceType = 'manual' | 'artifact';

@Component({
    selector: 'app-story-to-code-input',
    standalone: true,
    imports: [NgIcon, HlmButtonDirective, UpperCasePipe, SlicePipe],
    viewProviders: [
        provideIcons({
            lucideChevronDown,
            lucideChevronRight,
            lucideHistory,
            lucideLoader2,
            lucideSparkles,
            lucideTrash2,
            lucideFileText,
            lucideLayers,
            lucideX,
            lucideCode,
            lucideCheck,
            lucideDatabase,
            lucideRotateCw,
            lucideGitBranch,
        }),
    ],
    template: `
        <div class="flex h-full">
            <!-- Left Panel: Input Form -->
            <div class="w-1/2 border-r p-6 overflow-y-auto">
                <div class="max-w-xl mx-auto">
                    <h1 class="text-2xl font-bold text-foreground">AI Story-to-Code</h1>
                    <p class="mt-1 text-muted-foreground">
                        Convert user stories and requirements into production-ready code.
                    </p>

                    @if (service.error()) {
                        <div class="mt-4 rounded-lg border border-destructive bg-destructive/10 p-4">
                            <p class="text-sm text-destructive">{{ service.error() }}</p>
                        </div>
                    }

                    <form class="mt-6 space-y-6" (submit)="onSubmit($event)">
                        <!-- Source Selection -->
                        @if (hasImportOptions()) {
                            <div class="rounded-lg border bg-muted/30 p-4">
                                <p class="text-sm font-medium mb-3">Source</p>

                                <div class="flex gap-2 mb-3">
                                    @if (service.artifacts().length > 0) {
                                        <button
                                            type="button"
                                            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors"
                                            [class.bg-primary]="sourceType() === 'artifact'"
                                            [class.text-primary-foreground]="sourceType() === 'artifact'"
                                            [class.bg-muted]="sourceType() !== 'artifact'"
                                            [class.hover:bg-muted/80]="sourceType() !== 'artifact'"
                                            (click)="setSourceType('artifact')"
                                        >
                                            <ng-icon name="lucideLayers" class="h-3.5 w-3.5" />
                                            From Stories
                                        </button>
                                    }
                                    <button
                                        type="button"
                                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors"
                                        [class.bg-primary]="sourceType() === 'manual'"
                                        [class.text-primary-foreground]="sourceType() === 'manual'"
                                        [class.bg-muted]="sourceType() !== 'manual'"
                                        [class.hover:bg-muted/80]="sourceType() !== 'manual'"
                                        (click)="setSourceType('manual')"
                                    >
                                        <ng-icon name="lucideFileText" class="h-3.5 w-3.5" />
                                        Write Custom
                                    </button>
                                </div>

                                <!-- Artifact Selection -->
                                @if (sourceType() === 'artifact') {
                                    @if (selectedArtifact()) {
                                        <div class="flex items-center justify-between gap-2 rounded-lg border bg-background p-3">
                                            <div class="flex items-center gap-2 min-w-0">
                                                <ng-icon
                                                    [name]="selectedArtifact()!.type === 'epic' ? 'lucideLayers' : selectedArtifact()!.type === 'feature' ? 'lucideFileText' : 'lucideCode'"
                                                    class="h-4 w-4 flex-shrink-0"
                                                    [class.text-purple-600]="selectedArtifact()!.type === 'epic'"
                                                    [class.text-blue-600]="selectedArtifact()!.type === 'feature'"
                                                    [class.text-green-600]="selectedArtifact()!.type === 'user_story'"
                                                />
                                                <span class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                    {{ selectedArtifact()!.type.replace('_', ' ') }}
                                                </span>
                                                <span class="text-sm font-medium truncate">{{ selectedArtifact()!.title }}</span>
                                            </div>
                                            <button
                                                type="button"
                                                class="p-1 hover:bg-muted rounded"
                                                (click)="clearArtifactSelection()"
                                                title="Clear selection"
                                            >
                                                <ng-icon name="lucideX" class="h-4 w-4 text-muted-foreground" />
                                            </button>
                                        </div>
                                    } @else {
                                        <select
                                            class="w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                            (change)="onArtifactSelect($event)"
                                        >
                                            <option value="">Select an epic, feature, or user story...</option>
                                            @for (item of service.artifacts(); track item.id) {
                                                <option [value]="item.id">
                                                    [{{ item.type.replace('_', ' ') | uppercase }}] {{ item.title }}
                                                </option>
                                            }
                                        </select>
                                    }
                                }

                                <!-- Manual hint -->
                                @if (sourceType() === 'manual') {
                                    <p class="text-xs text-muted-foreground">
                                        Write your own user stories or requirements below.
                                    </p>
                                }
                            </div>
                        }

                        <!-- Requirements Description -->
                        <div>
                            <label class="text-sm font-medium">
                                User Stories / Requirements <span class="text-destructive">*</span>
                            </label>
                            <p class="text-xs text-muted-foreground mt-1">
                                Describe what you want to build (minimum 50 characters)
                            </p>
                            <textarea
                                class="mt-2 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[150px] font-mono"
                                [value]="inputDescription()"
                                (input)="onDescriptionInput($event)"
                                placeholder="As a user, I want to...

Feature requirements:
- User authentication with email/password
- Dashboard with analytics
- REST API for mobile app
..."
                                required
                            ></textarea>
                            <p class="text-xs mt-1" [class.text-muted-foreground]="charCount() === 0 || charCount() >= 50" [class.text-destructive]="charCount() > 0 && charCount() < 50">
                                {{ charCount() }} characters (min 50)
                            </p>
                        </div>

                        <!-- Knowledge Base Selection -->
                        @if (service.knowledgeBases().length > 0) {
                            <div class="rounded-lg border bg-muted/30 p-4">
                                <div class="flex items-center gap-2 mb-3">
                                    <ng-icon name="lucideGitBranch" class="h-4 w-4 text-muted-foreground" />
                                    <span class="text-sm font-medium">Codebase Context (Optional)</span>
                                </div>
                                <p class="text-xs text-muted-foreground mb-3">
                                    Select knowledge bases with your existing code to follow its patterns.
                                </p>
                                <div class="space-y-2">
                                    @for (kb of service.knowledgeBases(); track kb.id) {
                                        <label class="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                [checked]="selectedKbIds().includes(kb.id)"
                                                (change)="toggleKbSelection(kb.id)"
                                            />
                                            <div class="flex-1 min-w-0">
                                                <p class="text-sm font-medium">{{ kb.name }}</p>
                                                <p class="text-xs text-muted-foreground">
                                                    {{ kb.documentCount }} files, {{ kb.totalChunks }} chunks
                                                </p>
                                            </div>
                                        </label>
                                    }
                                </div>
                            </div>
                        }

                        <!-- Tech Stack Selection (only if no KB selected) -->
                        @if (selectedKbIds().length === 0) {
                            <div class="rounded-lg border bg-muted/30 p-4">
                                <div class="flex items-center gap-2 mb-3">
                                    <ng-icon name="lucideCode" class="h-4 w-4 text-muted-foreground" />
                                    <span class="text-sm font-medium">Tech Stack</span>
                                </div>
                                <p class="text-xs text-muted-foreground mb-3">
                                    Select a tech stack or describe your own.
                                </p>

                                <!-- Quick select buttons -->
                                <div class="flex flex-wrap gap-2 mb-3">
                                    @for (option of techStackOptions; track option.id) {
                                        <button
                                            type="button"
                                            class="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                                            [class.bg-primary]="selectedTechStack() === option.id"
                                            [class.text-primary-foreground]="selectedTechStack() === option.id"
                                            [class.bg-muted]="selectedTechStack() !== option.id"
                                            [class.hover:bg-muted/80]="selectedTechStack() !== option.id"
                                            (click)="selectTechStack(option.id)"
                                        >
                                            {{ option.label }}
                                        </button>
                                    }
                                </div>

                                <!-- Custom input -->
                                <input
                                    type="text"
                                    class="w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                    [value]="customTechStack()"
                                    (input)="onCustomTechStackInput($event)"
                                    placeholder="Or describe your stack: Python FastAPI, Vue.js, PostgreSQL..."
                                />
                            </div>
                        } @else {
                            <p class="text-xs text-muted-foreground italic">
                                Tech stack will be inferred from your selected codebase context.
                            </p>
                        }

                        <!-- Generate Button -->
                        <div class="pt-2">
                            <button
                                hlmBtn
                                class="w-full"
                                type="submit"
                                [disabled]="!canSubmit() || service.loading()"
                            >
                                @if (service.loading()) {
                                    <ng-icon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" />
                                    Starting Generation...
                                } @else {
                                    <ng-icon name="lucideSparkles" class="mr-2 h-4 w-4" />
                                    Generate Code
                                }
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- Right Panel: History -->
            <div class="w-1/2 flex flex-col bg-muted/30">
                <!-- History Header -->
                <div class="border-b bg-background p-4">
                    <div class="flex items-center gap-2">
                        <ng-icon name="lucideHistory" class="h-5 w-5 text-muted-foreground" />
                        <h2 class="font-semibold">Generation History</h2>
                    </div>
                    <p class="mt-1 text-sm text-muted-foreground">
                        View and download past code generations
                    </p>
                </div>

                <!-- History List -->
                <div class="flex-1 overflow-y-auto">
                    @if (service.loading() && service.sessions().length === 0) {
                        <div class="p-4">
                            <div class="animate-pulse space-y-3">
                                @for (i of [1, 2, 3, 4, 5]; track i) {
                                    <div class="rounded-lg border bg-background p-4">
                                        <div class="h-4 bg-muted rounded w-3/4"></div>
                                        <div class="mt-2 h-3 bg-muted rounded w-1/2"></div>
                                    </div>
                                }
                            </div>
                        </div>
                    } @else if (service.sessions().length === 0) {
                        <div class="flex-1 flex items-center justify-center p-6 h-full">
                            <div class="text-center">
                                <ng-icon name="lucideCode" class="mx-auto h-12 w-12 text-muted-foreground/50" />
                                <h3 class="mt-4 text-lg font-medium text-muted-foreground">No history yet</h3>
                                <p class="mt-2 text-sm text-muted-foreground max-w-xs">
                                    Your generated code projects will appear here.
                                </p>
                            </div>
                        </div>
                    } @else {
                        <div class="p-4 space-y-2">
                            @for (session of service.sessions(); track session.id) {
                                <div
                                    class="group rounded-lg border bg-background p-4 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer"
                                    (click)="viewSession(session)"
                                >
                                    <div class="flex items-start justify-between">
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-2">
                                                <span
                                                    class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                                                    [class.bg-green-100]="session.status === 'completed'"
                                                    [class.text-green-700]="session.status === 'completed'"
                                                    [class.bg-yellow-100]="isProcessing(session.status)"
                                                    [class.text-yellow-700]="isProcessing(session.status)"
                                                    [class.bg-red-100]="session.status === 'failed'"
                                                    [class.text-red-700]="session.status === 'failed'"
                                                    [class.bg-gray-100]="session.status === 'pending'"
                                                    [class.text-gray-700]="session.status === 'pending'"
                                                >
                                                    {{ formatStatus(session.status) }}
                                                </span>
                                                @if (session.generationMetadata?.fileCount) {
                                                    <span class="text-xs text-muted-foreground">
                                                        {{ session.generationMetadata?.fileCount }} files
                                                    </span>
                                                }
                                                <span class="text-xs text-muted-foreground">
                                                    {{ formatDate(session.createdAt) }}
                                                </span>
                                            </div>
                                            <p class="mt-1 text-sm font-medium text-foreground truncate">
                                                {{ session.title }}
                                            </p>
                                            <p class="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                                                {{ session.inputDescription | slice:0:100 }}
                                            </p>
                                        </div>
                                        <div class="flex items-center gap-1 ml-2">
                                            @if (session.status === 'failed') {
                                                <button
                                                    type="button"
                                                    class="p-1 text-muted-foreground hover:text-primary transition-colors"
                                                    (click)="retrySession($event, session)"
                                                    title="Retry Generation"
                                                >
                                                    <ng-icon name="lucideRotateCw" class="h-4 w-4" />
                                                </button>
                                            }
                                            <button
                                                type="button"
                                                class="p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                (click)="deleteSession($event, session)"
                                                title="Delete"
                                            >
                                                <ng-icon name="lucideTrash2" class="h-4 w-4" />
                                            </button>
                                            <ng-icon name="lucideChevronRight" class="h-5 w-5 text-muted-foreground" />
                                        </div>
                                    </div>
                                </div>
                            }

                            @if (service.hasMore()) {
                                <div class="pt-2 pb-4 text-center">
                                    <button
                                        hlmBtn variant="ghost" size="sm"
                                        (click)="loadMoreSessions()"
                                        [disabled]="service.loading()"
                                    >
                                        @if (service.loading()) {
                                            <ng-icon name="lucideLoader2" class="mr-2 h-4 w-4 animate-spin" />
                                        }
                                        Load More
                                    </button>
                                </div>
                            }
                        </div>
                    }
                </div>
            </div>
        </div>
    `,
    styles: `
        :host {
            display: block;
            height: 100%;
        }
        .line-clamp-1 {
            display: -webkit-box;
            -webkit-line-clamp: 1;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
    `,
})
export class StoryToCodeInputComponent implements OnInit {
    service = inject(StoryToCodeService);
    private router = inject(Router);

    // Form state
    sourceType = signal<SourceType>('manual');
    selectedArtifact = signal<StoryArtifact | null>(null);
    inputDescription = signal('');
    selectedKbIds = signal<number[]>([]);
    selectedTechStack = signal<string | null>(null);
    customTechStack = signal('');

    // Tech stack options
    techStackOptions = TECH_STACK_OPTIONS;

    // Computed
    charCount = computed(() => this.inputDescription().length);
    canSubmit = computed(() => this.charCount() >= 50);
    hasImportOptions = computed(() => this.service.artifacts().length > 0);

    async ngOnInit() {
        await Promise.all([
            this.service.loadSessions(true),
            this.service.loadArtifacts(),
            this.service.loadKnowledgeBases(),
        ]);
    }

    setSourceType(type: SourceType) {
        this.sourceType.set(type);
        if (type === 'manual') {
            this.selectedArtifact.set(null);
            this.inputDescription.set('');
        }
    }

    onArtifactSelect(event: Event) {
        const select = event.target as HTMLSelectElement;
        const id = parseInt(select.value, 10);
        if (!id) {
            this.selectedArtifact.set(null);
            return;
        }

        const artifact = this.service.artifacts().find(a => a.id === id);
        if (artifact) {
            this.selectedArtifact.set(artifact);
            const description = `${artifact.title}\n\n${artifact.description}`;
            this.inputDescription.set(description);
        }
    }

    clearArtifactSelection() {
        this.selectedArtifact.set(null);
        this.inputDescription.set('');
    }

    onDescriptionInput(event: Event) {
        this.inputDescription.set((event.target as HTMLTextAreaElement).value);
    }

    toggleKbSelection(kbId: number) {
        this.selectedKbIds.update(ids => {
            if (ids.includes(kbId)) {
                return ids.filter(id => id !== kbId);
            }
            return [...ids, kbId];
        });
    }

    selectTechStack(stackId: string) {
        this.selectedTechStack.set(stackId === this.selectedTechStack() ? null : stackId);
        this.customTechStack.set('');
    }

    onCustomTechStackInput(event: Event) {
        this.customTechStack.set((event.target as HTMLInputElement).value);
        this.selectedTechStack.set(null);
    }

    getTechStackValue(): string | undefined {
        if (this.selectedKbIds().length > 0) {
            return undefined; // Will be inferred from KB
        }
        if (this.customTechStack()) {
            return this.customTechStack();
        }
        if (this.selectedTechStack()) {
            const option = this.techStackOptions.find(o => o.id === this.selectedTechStack());
            return option?.value;
        }
        return undefined;
    }

    async onSubmit(event: Event) {
        event.preventDefault();
        if (!this.canSubmit()) return;

        const session = await this.service.createSession({
            inputDescription: this.inputDescription(),
            title: this.inputDescription().substring(0, 50) + (this.inputDescription().length > 50 ? '...' : ''),
            inputSource: this.sourceType(),
            sourceArtifactId: this.selectedArtifact()?.id,
            techStack: this.getTechStackValue(),
            knowledgeBaseIds: this.selectedKbIds(),
        });

        if (session) {
            this.router.navigate(['/story-to-code/processing', session.id]);
        }
    }

    viewSession(session: StoryToCodeSession) {
        if (session.status === 'completed') {
            this.router.navigate(['/story-to-code/results', session.id]);
        } else {
            this.router.navigate(['/story-to-code/processing', session.id]);
        }
    }

    async deleteSession(event: Event, session: StoryToCodeSession) {
        event.stopPropagation();
        if (confirm('Are you sure you want to delete this generation?')) {
            await this.service.deleteSession(session.id);
        }
    }

    async retrySession(event: Event, session: StoryToCodeSession) {
        event.stopPropagation();
        await this.service.retrySession(session.id);
        this.router.navigate(['/story-to-code/processing', session.id]);
    }

    loadMoreSessions() {
        this.service.loadSessions();
    }

    isProcessing(status: string): boolean {
        return status === 'pending' || status === 'generating';
    }

    formatStatus(status: string): string {
        const labels: Record<string, string> = {
            pending: 'Pending',
            generating: 'Generating',
            completed: 'Completed',
            failed: 'Failed',
        };
        return labels[status] || status;
    }

    formatDate(dateStr: string): string {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }
}
