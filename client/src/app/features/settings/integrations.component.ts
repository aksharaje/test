import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HlmButtonDirective } from '../../ui/button';
import { HlmIconDirective } from '../../ui/icon';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucidePlus,
  lucideRefreshCw,
  lucideTrash2,
  lucideCheck,
  lucideAlertCircle,
  lucideExternalLink,
  lucideSettings,
  lucideLink,
} from '@ng-icons/lucide';
import { IntegrationService } from './integration.service';
import type { Integration } from './integration.types';

@Component({
  selector: 'app-integrations',
  standalone: true,
  imports: [CommonModule, FormsModule, HlmButtonDirective, HlmIconDirective, NgIconComponent],
  providers: [
    provideIcons({
      lucidePlus,
      lucideRefreshCw,
      lucideTrash2,
      lucideCheck,
      lucideAlertCircle,
      lucideExternalLink,
      lucideSettings,
      lucideLink,
    }),
  ],
  template: `
    <div class="container mx-auto p-6 max-w-4xl">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold">Integrations</h1>
          <p class="text-muted-foreground mt-1">
            Connect your project management account to create issues from PRDs and artifacts
          </p>
        </div>
      </div>

      @if (successMessage()) {
        <div class="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <ng-icon hlmIcon name="lucideCheck" class="h-5 w-5 text-green-600" />
          <span class="text-green-800">{{ successMessage() }}</span>
        </div>
      }

      @if (service.error()) {
        <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <ng-icon hlmIcon name="lucideAlertCircle" class="h-5 w-5 text-red-600" />
          <span class="text-red-800">{{ service.error() }}</span>
        </div>
      }

      <!-- Available Integrations -->
      <div class="mb-8">
        <h2 class="text-lg font-semibold mb-4">Available Integrations</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          @for (provider of supportedIntegrations; track provider.id) {
            <div class="bg-card rounded-lg border p-6 flex items-start justify-between">
              <div class="flex gap-4">
                  <div
                    class="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center shrink-0"
                  >
                    @if (provider.id === 'ado') {
                         <span class="text-2xl font-bold text-blue-600">A</span>
                    } @else if (provider.id === 'servicenow') {
                         <span class="text-2xl font-bold text-green-700">NOW</span>
                    } @else if (provider.id === 'zendesk') {
                         <span class="text-2xl font-bold text-green-600">Z</span>
                    } @else if (provider.id === 'qualtrics') {
                         <span class="text-2xl font-bold text-blue-500">XM</span>
                    } @else {
                      <img [src]="provider.icon" [alt]="provider.name" class="h-6 w-6" />
                    }
                  </div>
                <div>
                  <h3 class="font-semibold text-lg">{{ provider.name }}</h3>
                  <p class="text-sm text-muted-foreground">{{ provider.description }}</p>
                </div>
              </div>
              @if (isProviderConnected(provider.id)) {
                <button hlmBtn variant="outline" size="sm" disabled class="opacity-60">
                  <ng-icon hlmIcon name="lucideCheck" class="mr-2 h-4 w-4 text-green-600" />
                  Connected
                </button>
              } @else {
                <button hlmBtn variant="outline" size="sm" (click)="initiateConnection(provider.id)">
                  Connect
                </button>
              }
            </div>
          }
        </div>
      </div>

      <!-- Connected Integrations -->
      @if (service.hasIntegrations()) {
        <div class="space-y-4">
            <h2 class="text-lg font-semibold mb-4">Connected Integrations</h2>
          @for (integration of service.integrations(); track integration.id) {
            <div
              class="bg-card rounded-lg border p-6 hover:border-primary/50 transition-colors"
            >
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-4">
                  <div
                    class="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center"
                  >
                    @if (integration.provider === 'ado') {
                         <span class="text-2xl font-bold text-blue-600">A</span>
                    } @else if (integration.provider === 'servicenow') {
                         <span class="text-2xl font-bold text-green-700">NOW</span>
                    } @else if (integration.provider === 'zendesk') {
                         <span class="text-2xl font-bold text-green-600">Z</span>
                    } @else if (integration.provider === 'qualtrics') {
                         <span class="text-2xl font-bold text-blue-500">XM</span>
                    } @else if (integration.provider === 'jira') {
                        <img
                        src="https://wac-cdn.atlassian.com/assets/img/favicons/atlassian/favicon.png"
                        alt="Jira"
                        class="h-6 w-6"
                        />
                    }
                  </div>
                  <div>
                    <h3 class="font-semibold text-lg">{{ integration.name }}</h3>
                    <p class="text-sm text-muted-foreground">
                      {{ integration.baseUrl }}
                    </p>
                    <div class="flex items-center gap-2 mt-1">
                      @if (integration.status === 'connected') {
                        <span
                          class="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full"
                        >
                          <ng-icon hlmIcon name="lucideCheck" class="h-3 w-3" />
                          Connected
                        </span>
                      } @else if (integration.status === 'error') {
                        <span
                          class="inline-flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full"
                        >
                          <ng-icon hlmIcon name="lucideAlertCircle" class="h-3 w-3" />
                          Error
                        </span>
                      } @else {
                        <span
                          class="inline-flex items-center gap-1 text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full"
                        >
                          <ng-icon hlmIcon name="lucideAlertCircle" class="h-3 w-3" />
                          Needs Reauth
                        </span>
                      }
                      <span class="text-xs text-muted-foreground">
                        {{ integration.authType === 'oauth' ? 'OAuth' : 'PAT' }}
                      </span>
                      @if (integration.lastSyncAt) {
                        <span class="text-xs text-muted-foreground">
                          Last synced: {{ formatDate(integration.lastSyncAt) }}
                        </span>
                      }
                    </div>
                    @if (integration.errorMessage) {
                      <p class="text-xs text-red-500 mt-1">
                        {{ integration.errorMessage }}
                      </p>
                    }
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    hlmBtn
                    variant="outline"
                    size="sm"
                    (click)="goToFieldMappings(integration)"
                  >
                    <ng-icon hlmIcon name="lucideSettings" class="mr-2 h-4 w-4" />
                    <span>Field Mappings</span>
                  </button>
                  <button
                    hlmBtn
                    variant="outline"
                    size="sm"
                    (click)="syncIntegration(integration)"
                    [disabled]="syncing() === integration.id"
                  >
                    <ng-icon
                      hlmIcon
                      name="lucideRefreshCw"
                      class="mr-2 h-4 w-4"
                      [class.animate-spin]="syncing() === integration.id"
                    />
                    <span>Sync</span>
                  </button>
                  <button
                    hlmBtn
                    variant="outline"
                    size="sm"
                    (click)="confirmDelete(integration)"
                  >
                    <ng-icon hlmIcon name="lucideTrash2" class="h-4 w-4 text-destructive" />
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- Connect Dialog -->
      @if (showConnectDialog()) {
        <div
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          (click)="showConnectDialog.set(false)"
        >
          <div
            class="bg-card rounded-lg border shadow-lg w-full max-w-md mx-4 p-6"
            (click)="$event.stopPropagation()"
          >
            <h2 class="text-xl font-semibold mb-4">Connect to Jira</h2>

            <div class="space-y-4">
              <!-- Jira Cloud -->
              <div>
                <h3 class="font-medium mb-2">Jira Cloud (OAuth)</h3>
                <p class="text-sm text-muted-foreground mb-3">
                  Recommended for Jira Cloud. Securely connect using OAuth.
                </p>
                <button
                  hlmBtn
                  variant="default"
                  class="w-full"
                  (click)="startOAuth('jira')"
                  [disabled]="service.loading()"
                >
                  <ng-icon hlmIcon name="lucideExternalLink" class="mr-2 h-4 w-4" />
                  <span>Connect with Atlassian</span>
                </button>
              </div>

              <!-- Separator -->
              <div class="relative">
                <div class="absolute inset-0 flex items-center">
                  <div class="w-full border-t"></div>
                </div>
                <div class="relative flex justify-center text-xs uppercase">
                  <span class="bg-card px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <!-- Jira PAT -->
              <div>
                <h3 class="font-medium mb-2">Jira Server / Data Center (PAT)</h3>
                <p class="text-sm text-muted-foreground mb-3">
                  For self-hosted Jira instances using Personal Access Token.
                </p>

                <div class="space-y-3">
                  <div>
                    <label class="block text-sm font-medium mb-1">Jira URL</label>
                    <input
                      type="url"
                      [(ngModel)]="patForm.baseUrl"
                      placeholder="https://jira.your-company.com"
                      class="w-full px-3 py-2 border rounded-md bg-background"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium mb-1">Personal Access Token</label>
                    <input
                      type="password"
                      [(ngModel)]="patForm.pat"
                      placeholder="Your PAT"
                      class="w-full px-3 py-2 border rounded-md bg-background"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium mb-1">Name (optional)</label>
                    <input
                      type="text"
                      [(ngModel)]="patForm.name"
                      placeholder="My Jira"
                      class="w-full px-3 py-2 border rounded-md bg-background"
                    />
                  </div>
                  <button
                    hlmBtn
                    variant="outline"
                    class="w-full"
                    (click)="connectWithPAT()"
                    [disabled]="!patForm.baseUrl || !patForm.pat || service.loading()"
                  >
                    Connect with PAT
                  </button>
                </div>
              </div>
            </div>

            <div class="mt-6 flex justify-end">
              <button
                hlmBtn
                variant="ghost"
                (click)="showConnectDialog.set(false)"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Delete Confirmation Dialog -->
      @if (deleteCandidate()) {
        <div
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          (click)="deleteCandidate.set(null)"
        >
          <div
            class="bg-card rounded-lg border shadow-lg w-full max-w-md mx-4 p-6"
            (click)="$event.stopPropagation()"
          >
            <h2 class="text-xl font-semibold mb-2">Disconnect Integration</h2>
            <p class="text-muted-foreground mb-4">
              Are you sure you want to disconnect
              <strong>{{ deleteCandidate()?.name }}</strong>? This will remove all
              synced data for this integration.
            </p>
            <div class="flex justify-end gap-2">
              <button hlmBtn variant="ghost" (click)="deleteCandidate.set(null)">
                Cancel
              </button>
              <button
                hlmBtn
                variant="destructive"
                (click)="deleteIntegration()"
                [disabled]="service.loading()"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class IntegrationsComponent implements OnInit {
  protected service = inject(IntegrationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  showConnectDialog = signal(false);
  deleteCandidate = signal<Integration | null>(null);
  syncing = signal<number | null>(null);
  successMessage = signal<string | null>(null);

  patForm = {
    baseUrl: '',
    pat: '',
    name: '',
  };

  supportedIntegrations = [
    {
      id: 'jira',
      name: 'Jira',
      description: 'Connect to Jira Cloud or Data Center to sync issues.',
      icon: 'https://wac-cdn.atlassian.com/assets/img/favicons/atlassian/favicon.png',
      type: 'pm'
    },
    {
      id: 'ado',
      name: 'Azure DevOps',
      description: 'Connect to Azure DevOps Services to sync work items.',
      icon: 'A', // We'll handle this in template
      type: 'pm'
    },
    {
      id: 'servicenow',
      name: 'ServiceNow',
      description: 'Connect to ServiceNow to sync incidents and requests.',
      icon: 'https://www.servicenow.com/favicon.ico', // Placeholder
      type: 'itsm'
    },
    {
      id: 'zendesk',
      name: 'Zendesk',
      description: 'Connect to Zendesk to sync support tickets.',
      icon: 'https://d1eipm3vz40hy0.cloudfront.net/images/logos/favicons/favicon.ico', // Placeholder
      type: 'support'
    },
    {
      id: 'qualtrics',
      name: 'Qualtrics',
      description: 'Connect to Qualtrics to sync survey data.',
      icon: 'https://www.qualtrics.com/favicon.ico', // Placeholder
      type: 'cx'
    }
  ];

  ngOnInit() {
    this.service.loadIntegrations();

    // Check for OAuth callback success
    const queryParams = this.route.snapshot.queryParams;
    if (queryParams['success'] === 'true' && queryParams['integration_id']) {
      this.successMessage.set('Successfully connected to Jira!');
      this.service.loadIntegrations();
      // Clear the query params
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        replaceUrl: true,
      });
    } else if (queryParams['error']) {
      this.service.clearError();
      // The error will be shown via the service error signal
    }
  }

  isProviderConnected(providerId: string): boolean {
    return this.service.integrations().some(
      (i) => i.provider === providerId && i.status === 'connected'
    );
  }

  initiateConnection(providerId: string) {
    if (providerId === 'ado') {
      this.startOAuth('ado');
    } else if (providerId === 'servicenow') {
      this.startOAuth('servicenow' as any);
    } else if (providerId === 'zendesk') {
      this.startOAuth('zendesk' as any);
    } else if (providerId === 'qualtrics') {
      this.startOAuth('qualtrics' as any);
    } else {
      // Jira logic (OAuth or PAT)
      this.showConnectDialog.set(true);
    }
  }

  startOAuth(provider: 'jira' | 'ado' | 'servicenow' | 'zendesk' | 'qualtrics' = 'jira') {
    this.service.startOAuthFlow('/settings/integrations', provider);
  }

  async connectWithPAT() {
    const result = await this.service.connectWithPAT(
      this.patForm.baseUrl,
      this.patForm.pat,
      this.patForm.name || undefined
    );

    if (result) {
      this.showConnectDialog.set(false);
      this.successMessage.set('Successfully connected to Jira!');
      this.patForm = { baseUrl: '', pat: '', name: '' };
    }
  }

  async syncIntegration(integration: Integration) {
    this.syncing.set(integration.id);
    await this.service.syncIntegration(integration.id);
    this.syncing.set(null);
  }

  confirmDelete(integration: Integration) {
    this.deleteCandidate.set(integration);
  }

  async deleteIntegration() {
    const candidate = this.deleteCandidate();
    if (!candidate) return;

    await this.service.deleteIntegration(candidate.id);
    this.deleteCandidate.set(null);
  }

  goToFieldMappings(integration: Integration) {
    this.router.navigate(['/settings/integrations', integration.id, 'mappings']);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  }
}
