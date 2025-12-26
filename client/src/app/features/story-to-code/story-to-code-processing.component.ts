import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
    lucideLoader2,
    lucideCheck,
    lucideX,
    lucideCode,
    lucideArrowLeft,
    lucideRotateCw,
    lucideAlertCircle,
} from '@ng-icons/lucide';
import { StoryToCodeService } from './story-to-code.service';
import { HlmButtonDirective } from '../../ui/button';

@Component({
    selector: 'app-story-to-code-processing',
    standalone: true,
    imports: [NgIcon, HlmButtonDirective],
    viewProviders: [
        provideIcons({
            lucideLoader2,
            lucideCheck,
            lucideX,
            lucideCode,
            lucideArrowLeft,
            lucideRotateCw,
            lucideAlertCircle,
        }),
    ],
    template: `
        <div class="h-full flex flex-col items-center justify-center p-8">
            <div class="max-w-lg w-full">
                <!-- Back button -->
                <button
                    hlmBtn variant="ghost" size="sm"
                    class="mb-8"
                    (click)="goBack()"
                >
                    <ng-icon name="lucideArrowLeft" class="mr-2 h-4 w-4" />
                    Back to Input
                </button>

                <!-- Main Content -->
                <div class="rounded-xl border bg-card p-8 text-center shadow-sm">
                    <!-- Icon -->
                    <div class="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6"
                         [class.bg-primary/10]="isProcessing()"
                         [class.bg-green-100]="isCompleted()"
                         [class.bg-red-100]="isFailed()">
                        @if (isProcessing()) {
                            <ng-icon name="lucideLoader2" class="h-8 w-8 text-primary animate-spin" />
                        } @else if (isCompleted()) {
                            <ng-icon name="lucideCheck" class="h-8 w-8 text-green-600" />
                        } @else if (isFailed()) {
                            <ng-icon name="lucideX" class="h-8 w-8 text-red-600" />
                        }
                    </div>

                    <!-- Title -->
                    <h2 class="text-xl font-bold mb-2">
                        @if (isProcessing()) {
                            Generating Code...
                        } @else if (isCompleted()) {
                            Code Generated!
                        } @else if (isFailed()) {
                            Generation Failed
                        } @else {
                            Loading...
                        }
                    </h2>

                    <!-- Progress Message -->
                    <p class="text-muted-foreground mb-6">
                        {{ service.currentSession()?.progressMessage || 'Initializing...' }}
                    </p>

                    <!-- Progress Steps -->
                    @if (isProcessing()) {
                        <div class="flex justify-center gap-2 mb-6">
                            @for (step of [1, 2, 3, 4, 5]; track step) {
                                <div
                                    class="h-2 w-8 rounded-full transition-colors"
                                    [class.bg-primary]="currentStep() >= step"
                                    [class.bg-muted]="currentStep() < step"
                                ></div>
                            }
                        </div>
                    }

                    <!-- Error Message -->
                    @if (isFailed() && service.currentSession()?.errorMessage) {
                        <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 mb-6 text-left">
                            <div class="flex gap-2">
                                <ng-icon name="lucideAlertCircle" class="h-5 w-5 text-destructive flex-shrink-0" />
                                <p class="text-sm text-destructive">
                                    {{ service.currentSession()?.errorMessage }}
                                </p>
                            </div>
                        </div>
                    }

                    <!-- Actions -->
                    <div class="flex justify-center gap-3">
                        @if (isCompleted()) {
                            <button hlmBtn (click)="viewResults()">
                                <ng-icon name="lucideCode" class="mr-2 h-4 w-4" />
                                View Generated Code
                            </button>
                        } @else if (isFailed()) {
                            <button hlmBtn variant="outline" (click)="goBack()">
                                Back to Input
                            </button>
                            <button hlmBtn (click)="retry()">
                                <ng-icon name="lucideRotateCw" class="mr-2 h-4 w-4" />
                                Retry Generation
                            </button>
                        }
                    </div>
                </div>

                <!-- Session Details -->
                @if (service.currentSession()) {
                    <div class="mt-6 rounded-lg border bg-muted/30 p-4">
                        <h3 class="text-sm font-medium mb-2">Session Details</h3>
                        <div class="text-xs text-muted-foreground space-y-1">
                            <p><span class="font-medium">Title:</span> {{ service.currentSession()?.title }}</p>
                            <p><span class="font-medium">Status:</span> {{ service.currentSession()?.status }}</p>
                            @if (service.currentSession()?.generationMetadata?.fileCount) {
                                <p><span class="font-medium">Files:</span> {{ service.currentSession()?.generationMetadata?.fileCount }}</p>
                            }
                        </div>
                    </div>
                }
            </div>
        </div>
    `,
    styles: `
        :host {
            display: block;
            height: 100%;
        }
    `,
})
export class StoryToCodeProcessingComponent implements OnInit, OnDestroy {
    service = inject(StoryToCodeService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);

    currentStep = computed(() => this.service.currentSession()?.progressStep || 0);

    isProcessing = computed(() => {
        const status = this.service.currentSession()?.status;
        return status === 'pending' || status === 'generating';
    });

    isCompleted = computed(() => this.service.currentSession()?.status === 'completed');
    isFailed = computed(() => this.service.currentSession()?.status === 'failed');

    async ngOnInit() {
        const id = parseInt(this.route.snapshot.paramMap.get('id') || '0', 10);
        if (id) {
            await this.service.getSession(id);
            if (this.isProcessing()) {
                this.service.startPolling(id);
            }
        } else {
            this.router.navigate(['/story-to-code']);
        }
    }

    ngOnDestroy() {
        this.service.stopPolling();
    }

    goBack() {
        this.service.clearCurrentSession();
        this.router.navigate(['/story-to-code']);
    }

    viewResults() {
        const id = this.service.currentSession()?.id;
        if (id) {
            this.router.navigate(['/story-to-code/results', id]);
        }
    }

    async retry() {
        const id = this.service.currentSession()?.id;
        if (id) {
            await this.service.retrySession(id);
            if (this.isProcessing()) {
                this.service.startPolling(id);
            }
        }
    }
}
