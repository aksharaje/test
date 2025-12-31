import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';

@Component({
    selector: 'app-team-management',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="px-4 sm:px-6 lg:px-8 py-8">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-xl font-semibold text-gray-900">Team Members</h1>
          <p class="mt-2 text-sm text-gray-700">A list of all the users in your account including their name, title, email and role.</p>
        </div>
        <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button 
            type="button" 
            (click)="showInviteModal.set(true)"
            class="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto">
            Invite user
          </button>
        </div>
      </div>
      
      <!-- List would go here (requires an endpoint to fetch team members which we haven't built yet fully) -->
      <!-- For now just show invite functionality -->
      
      <div *ngIf="showInviteModal()" class="relative z-10" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
        <div class="fixed inset-0 z-10 overflow-y-auto">
          <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <div>
                <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
                  <svg class="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3.75 7.5l.625 10.632a2.25 2.25 0 002.247 2.118H6.682A19.31 19.31 0 017.5 11.25a2.25 2.25 0 00-2.247 2.118H18.75a2.25 2.25 0 00-2.247 2.118H6.682a2.25 2.25 0 002.247 2.118M3.75 7.5h16.5" />
                  </svg>
                </div>
                <div class="mt-3 text-center sm:mt-5">
                  <h3 class="text-lg font-medium leading-6 text-gray-900" id="modal-title">Invite Team Member</h3>
                  <div class="mt-2">
                    <p class="text-sm text-gray-500">Send an email invitation to join your team.</p>
                    <input 
                        type="email" 
                        [(ngModel)]="inviteEmail"
                        class="mt-4 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" 
                        placeholder="colleague@example.com">
                  </div>
                </div>
              </div>
              <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                <button 
                    type="button" 
                    [disabled]="inviteLoading()"
                    (click)="sendInvite()"
                    class="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:col-start-2 sm:text-sm disabled:opacity-50">
                  {{ inviteLoading() ? 'Sending...' : 'Invite' }}
                </button>
                <button 
                    type="button" 
                    (click)="showInviteModal.set(false)"
                    class="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:col-start-1 sm:mt-0 sm:text-sm">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class TeamManagementComponent {
    authService = inject(AuthService);
    showInviteModal = signal(false);
    inviteEmail = signal('');
    inviteLoading = signal(false);

    sendInvite() {
        if (!this.inviteEmail()) return;
        this.inviteLoading.set(true);
        this.authService.inviteMember(this.inviteEmail()).subscribe({
            next: () => {
                this.inviteLoading.set(false);
                this.showInviteModal.set(false);
                this.inviteEmail.set('');
                alert('Invitation sent!');
            },
            error: (err) => {
                console.error(err);
                this.inviteLoading.set(false);
                alert('Failed to send invite.');
            }
        });
    }
}
