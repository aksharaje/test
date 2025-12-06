import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HlmButtonDirective } from '../../ui/button';
import { HlmIconDirective } from '../../ui/icon';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucidePlus,
  lucideCalendar,
  lucideUsers,
  lucidePlay,
  lucideLock,
  lucideCheck,
  lucideTrash2,
  lucideFileEdit,
} from '@ng-icons/lucide';
import { PiPlanningService } from './pi-planning.service';
import { IntegrationService } from '../settings/integration.service';
import { SessionWizardComponent } from './session-wizard.component';
import type { PiSession, PlannableIssueType } from './pi-planning.types';
import type { JiraBoard } from '../settings/integration.types';

@Component({
  selector: 'app-pi-planning-list',
  standalone: true,
  imports: [CommonModule, FormsModule, HlmButtonDirective, HlmIconDirective, NgIcon, SessionWizardComponent],
  providers: [
    provideIcons({
      lucidePlus,
      lucideCalendar,
      lucideUsers,
      lucidePlay,
      lucideLock,
      lucideCheck,
      lucideTrash2,
      lucideFileEdit,
    }),
  ],
  template: `
    <div class="container mx-auto p-6 max-w-6xl">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold">PI Planning</h1>
          <p class="text-muted-foreground mt-1">
            Plan work across multiple teams and sprints
          </p>
        </div>
        @if (hasIntegration()) {
          <button
            hlmBtn
            variant="default"
            (click)="showCreateDialog.set(true)"
            [disabled]="service.loading()"
          >
            <ng-icon hlmIcon name="lucidePlus" class="mr-2 h-4 w-4" />
            New PI Session
          </button>
        }
      </div>

      @if (service.error()) {
        <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <span class="text-red-800">{{ service.error() }}</span>
        </div>
      }

      @if (!hasIntegration()) {
        <div class="text-center py-12 bg-muted/30 rounded-lg border border-dashed">
          <ng-icon hlmIcon name="lucideUsers" class="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 class="font-medium text-lg mb-2">No Jira Integration</h3>
          <p class="text-muted-foreground mb-4">
            Connect your Jira account to start PI Planning.
          </p>
          <button hlmBtn variant="default" (click)="goToIntegrations()">
            Connect Jira
          </button>
        </div>
      } @else if (service.loading() && !service.hasSessions()) {
        <div class="space-y-4">
          @for (i of [1, 2, 3]; track i) {
            <div class="bg-card rounded-lg border p-6 animate-pulse">
              <div class="h-6 bg-muted rounded w-1/3 mb-3"></div>
              <div class="h-4 bg-muted rounded w-1/2"></div>
            </div>
          }
        </div>
      } @else if (service.hasSessions()) {
        <div class="space-y-4">
          @for (session of service.sessions(); track session.id) {
            <div
              class="bg-card rounded-lg border p-6 hover:border-primary/50 transition-colors cursor-pointer"
              (click)="openSession(session)"
            >
              <div class="flex items-start justify-between">
                <div>
                  <div class="flex items-center gap-2">
                    <h3 class="font-semibold text-lg">{{ session.name }}</h3>
                    @switch (session.status) {
                      @case ('draft') {
                        <span class="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                          Draft
                        </span>
                      }
                      @case ('active') {
                        <span class="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <ng-icon hlmIcon name="lucidePlay" class="h-3 w-3" />
                          Active
                        </span>
                      }
                      @case ('locked') {
                        <span class="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <ng-icon hlmIcon name="lucideLock" class="h-3 w-3" />
                          Locked
                        </span>
                      }
                      @case ('completed') {
                        <span class="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <ng-icon hlmIcon name="lucideCheck" class="h-3 w-3" />
                          Completed
                        </span>
                      }
                    }
                  </div>
                  @if (session.description) {
                    <p class="text-muted-foreground mt-1">{{ session.description }}</p>
                  }
                  <div class="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span class="flex items-center gap-1">
                      <ng-icon hlmIcon name="lucideUsers" class="h-4 w-4" />
                      {{ session.boards?.length || 0 }} teams
                    </span>
                    <span class="flex items-center gap-1">
                      <ng-icon hlmIcon name="lucideCalendar" class="h-4 w-4" />
                      {{ session.sprintCount }} sprints
                    </span>
                    <span class="flex items-center gap-1">
                      <ng-icon hlmIcon name="lucideFileEdit" class="h-4 w-4" />
                      {{ formatIssueType(session.plannableIssueType) }}
                    </span>
                    @if (session.startDate) {
                      <span>
                        {{ formatDate(session.startDate) }}
                        @if (session.endDate) {
                          - {{ formatDate(session.endDate) }}
                        }
                      </span>
                    }
                  </div>
                </div>
                <button
                  hlmBtn
                  variant="ghost"
                  size="sm"
                  (click)="confirmDelete(session, $event)"
                >
                  <ng-icon hlmIcon name="lucideTrash2" class="h-4 w-4 text-destructive" />
                </button>
              </div>
            </div>
          }
        </div>
      } @else {
        <div class="text-center py-12 bg-muted/30 rounded-lg border border-dashed">
          <ng-icon hlmIcon name="lucideCalendar" class="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 class="font-medium text-lg mb-2">No PI Sessions</h3>
          <p class="text-muted-foreground mb-4">
            Create your first PI planning session to start planning work across teams.
          </p>
          <button hlmBtn variant="default" (click)="showCreateDialog.set(true)">
            <ng-icon hlmIcon name="lucidePlus" class="mr-2 h-4 w-4" />
            New PI Session
          </button>
        </div>
      }

      <!-- Session Wizard -->
      @if (showCreateDialog() && integrationId()) {
        <app-session-wizard
          [integrationId]="integrationId()!"
          (onClose)="showCreateDialog.set(false)"
          (onCreated)="onSessionCreated($event)"
        />
      }

      <!-- Delete Confirmation -->
      @if (deleteCandidate()) {
        <div
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          (click)="deleteCandidate.set(null)"
        >
          <div
            class="bg-card rounded-lg border shadow-lg w-full max-w-md mx-4 p-6"
            (click)="$event.stopPropagation()"
          >
            <h2 class="text-xl font-semibold mb-2">Delete PI Session</h2>
            <p class="text-muted-foreground mb-4">
              Are you sure you want to delete
              <strong>{{ deleteCandidate()?.name }}</strong>? This will remove all
              planned items in this session.
            </p>
            <div class="flex justify-end gap-2">
              <button hlmBtn variant="ghost" (click)="deleteCandidate.set(null)">
                Cancel
              </button>
              <button
                hlmBtn
                variant="destructive"
                (click)="deleteSession()"
                [disabled]="service.loading()"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class PiPlanningListComponent implements OnInit {
  protected service = inject(PiPlanningService);
  private integrationService = inject(IntegrationService);
  private router = inject(Router);

  showCreateDialog = signal(false);
  deleteCandidate = signal<PiSession | null>(null);
  integrationId = signal<number | null>(null);

  async ngOnInit() {
    await this.integrationService.loadIntegrations();

    const connected = this.integrationService.connectedIntegrations();
    if (connected.length > 0) {
      const integration = connected[0];
      this.integrationId.set(integration.id);
      await this.service.loadSessions(integration.id);
    }
  }

  hasIntegration(): boolean {
    return this.integrationId() !== null;
  }

  onSessionCreated(session: PiSession): void {
    this.showCreateDialog.set(false);
    this.openSession(session);
  }

  openSession(session: PiSession): void {
    const integrationId = this.integrationId();
    if (integrationId) {
      this.router.navigate(['/pi-planning', integrationId, session.id]);
    }
  }

  confirmDelete(session: PiSession, event: Event): void {
    event.stopPropagation();
    this.deleteCandidate.set(session);
  }

  async deleteSession(): Promise<void> {
    const integrationId = this.integrationId();
    const session = this.deleteCandidate();
    if (!integrationId || !session) return;

    await this.service.deleteSession(integrationId, session.id);
    this.deleteCandidate.set(null);
  }

  goToIntegrations(): void {
    this.router.navigate(['/settings/integrations']);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  formatIssueType(type: PlannableIssueType): string {
    const labels: Record<PlannableIssueType, string> = {
      epic: 'Epics',
      feature: 'Features',
      story: 'Stories',
      custom: 'Custom',
    };
    return labels[type] || type;
  }
}
