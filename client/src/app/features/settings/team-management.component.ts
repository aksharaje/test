import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, ManagedUser } from '../../core/auth/auth.service';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideUsers, lucidePlus, lucideTrash2, lucideUserX, lucideUserCheck, lucideKey, lucideCopy, lucideCheck, lucideLoader2 } from '@ng-icons/lucide';

@Component({
    selector: 'app-team-management',
    standalone: true,
    imports: [CommonModule, FormsModule, NgIcon],
    viewProviders: [provideIcons({ lucideUsers, lucidePlus, lucideTrash2, lucideUserX, lucideUserCheck, lucideKey, lucideCopy, lucideCheck, lucideLoader2 })],
    template: `
    <div class="px-4 sm:px-6 lg:px-8 py-8 max-w-5xl mx-auto">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <div class="flex items-center gap-3">
            <div class="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ng-icon name="lucideUsers" class="h-5 w-5 text-primary" />
            </div>
            <h1 class="text-2xl font-bold">User Management</h1>
          </div>
          <p class="mt-2 text-sm text-muted-foreground">Manage users who have access to the system.</p>
        </div>
        <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            type="button"
            (click)="showAddModal.set(true)"
            class="inline-flex items-center gap-2 rounded-lg border border-transparent bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
            <ng-icon name="lucidePlus" class="h-4 w-4" />
            Add User
          </button>
        </div>
      </div>

      @if (error()) {
        <div class="mt-4 rounded-lg border border-destructive bg-destructive/10 p-4">
          <p class="text-sm text-destructive">{{ error() }}</p>
        </div>
      }

      @if (successMessage()) {
        <div class="mt-4 rounded-lg border border-green-500 bg-green-50 p-4">
          <p class="text-sm text-green-700">{{ successMessage() }}</p>
        </div>
      }

      <!-- Users List -->
      <div class="mt-8 rounded-lg border bg-background overflow-hidden">
        <table class="min-w-full divide-y divide-border">
          <thead class="bg-muted/50">
            <tr>
              <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold sm:pl-6">User</th>
              <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold">Role</th>
              <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold">Status</th>
              <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold">Created</th>
              <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span class="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            @if (loading()) {
              <tr>
                <td colspan="5" class="py-10 text-center">
                  <ng-icon name="lucideLoader2" class="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </td>
              </tr>
            } @else if (users().length === 0) {
              <tr>
                <td colspan="5" class="py-10 text-center text-muted-foreground">No users found</td>
              </tr>
            } @else {
              @for (user of users(); track user.id) {
                <tr [class.bg-muted/30]="!user.isActive">
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 sm:pl-6">
                    <div class="flex flex-col">
                      <div class="font-medium">{{ user.fullName || 'No name' }}</div>
                      <div class="text-sm text-muted-foreground">{{ user.email }}</div>
                    </div>
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm">
                    <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                          [class.bg-purple-100]="user.role === 'admin'"
                          [class.text-purple-800]="user.role === 'admin'"
                          [class.bg-blue-100]="user.role === 'member'"
                          [class.text-blue-800]="user.role === 'member'">
                      {{ user.role }}
                    </span>
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm">
                    <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                          [class.bg-green-100]="user.isActive"
                          [class.text-green-800]="user.isActive"
                          [class.bg-gray-100]="!user.isActive"
                          [class.text-gray-800]="!user.isActive">
                      {{ user.isActive ? 'Active' : 'Disabled' }}
                    </span>
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-muted-foreground">
                    {{ user.createdAt ? (user.createdAt | date:'mediumDate') : '-' }}
                  </td>
                  <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <div class="flex items-center justify-end gap-2">
                      @if (user.id !== currentUserId()) {
                        <button
                          type="button"
                          (click)="openResetPassword(user)"
                          class="p-2 rounded-lg hover:bg-muted"
                          title="Reset password">
                          <ng-icon name="lucideKey" class="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          (click)="toggleActive(user)"
                          class="p-2 rounded-lg hover:bg-muted"
                          [title]="user.isActive ? 'Disable user' : 'Enable user'">
                          <ng-icon [name]="user.isActive ? 'lucideUserX' : 'lucideUserCheck'" class="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          (click)="deleteUser(user)"
                          class="p-2 rounded-lg hover:bg-muted text-destructive"
                          title="Delete user">
                          <ng-icon name="lucideTrash2" class="h-4 w-4" />
                        </button>
                      } @else {
                        <span class="text-xs text-muted-foreground">(You)</span>
                      }
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>

      <!-- Add User Modal -->
      @if (showAddModal()) {
        <div class="relative z-50" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
          <div class="fixed inset-0 z-10 overflow-y-auto">
            <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div class="relative transform overflow-hidden rounded-lg bg-background px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div>
                  <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <ng-icon name="lucidePlus" class="h-6 w-6 text-primary" />
                  </div>
                  <div class="mt-3 text-center sm:mt-5">
                    <h3 class="text-lg font-medium leading-6" id="modal-title">Add New User</h3>
                    <p class="mt-2 text-sm text-muted-foreground">Create a new user account. The password will be shown for you to share.</p>
                  </div>
                </div>

                <form class="mt-6 space-y-4" (ngSubmit)="createUser()">
                  <div>
                    <label class="block text-sm font-medium mb-1">Full Name</label>
                    <input
                      type="text"
                      [(ngModel)]="newUser.fullName"
                      name="fullName"
                      required
                      class="w-full rounded-lg border bg-background p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="John Doe">
                  </div>
                  <div>
                    <label class="block text-sm font-medium mb-1">Email</label>
                    <input
                      type="email"
                      [(ngModel)]="newUser.email"
                      name="email"
                      required
                      class="w-full rounded-lg border bg-background p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="john@example.com">
                  </div>
                  <div>
                    <label class="block text-sm font-medium mb-1">Password</label>
                    <div class="flex gap-2">
                      <input
                        type="text"
                        [(ngModel)]="newUser.password"
                        name="password"
                        required
                        class="flex-1 rounded-lg border bg-background p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                        placeholder="Enter password">
                      <button
                        type="button"
                        (click)="generatePassword()"
                        class="px-3 py-2 rounded-lg border hover:bg-muted text-sm">
                        Generate
                      </button>
                    </div>
                  </div>
                  <div>
                    <label class="block text-sm font-medium mb-1">Role</label>
                    <select
                      [(ngModel)]="newUser.role"
                      name="role"
                      class="w-full rounded-lg border bg-background p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                    <button
                      type="submit"
                      [disabled]="addLoading() || !newUser.email || !newUser.fullName || !newUser.password"
                      class="inline-flex w-full justify-center rounded-lg border border-transparent bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:col-start-2 disabled:opacity-50">
                      {{ addLoading() ? 'Creating...' : 'Create User' }}
                    </button>
                    <button
                      type="button"
                      (click)="closeAddModal()"
                      class="mt-3 inline-flex w-full justify-center rounded-lg border px-4 py-2 text-sm font-medium shadow-sm hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:col-start-1 sm:mt-0">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Created User Credentials Modal -->
      @if (createdUser()) {
        <div class="relative z-50" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
          <div class="fixed inset-0 z-10 overflow-y-auto">
            <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div class="relative transform overflow-hidden rounded-lg bg-background px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div>
                  <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                    <ng-icon name="lucideCheck" class="h-6 w-6 text-green-600" />
                  </div>
                  <div class="mt-3 text-center sm:mt-5">
                    <h3 class="text-lg font-medium leading-6" id="modal-title">User Created Successfully</h3>
                    <p class="mt-2 text-sm text-muted-foreground">Share these credentials with the user. The password won't be shown again.</p>
                  </div>
                </div>

                <div class="mt-6 space-y-4">
                  <div class="rounded-lg bg-muted p-4 space-y-3">
                    <div>
                      <label class="text-xs text-muted-foreground uppercase tracking-wide">Email</label>
                      <div class="flex items-center gap-2 mt-1">
                        <code class="flex-1 font-mono text-sm">{{ createdUser()!.email }}</code>
                        <button
                          type="button"
                          (click)="copyToClipboard(createdUser()!.email)"
                          class="p-1.5 rounded hover:bg-background">
                          <ng-icon name="lucideCopy" class="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label class="text-xs text-muted-foreground uppercase tracking-wide">Password</label>
                      <div class="flex items-center gap-2 mt-1">
                        <code class="flex-1 font-mono text-sm">{{ createdUser()!.password }}</code>
                        <button
                          type="button"
                          (click)="copyToClipboard(createdUser()!.password)"
                          class="p-1.5 rounded hover:bg-background">
                          <ng-icon name="lucideCopy" class="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="mt-5 sm:mt-6">
                  <button
                    type="button"
                    (click)="createdUser.set(null)"
                    class="inline-flex w-full justify-center rounded-lg border border-transparent bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Reset Password Modal -->
      @if (resetPasswordUser()) {
        <div class="relative z-50" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
          <div class="fixed inset-0 z-10 overflow-y-auto">
            <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div class="relative transform overflow-hidden rounded-lg bg-background px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div>
                  <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
                    <ng-icon name="lucideKey" class="h-6 w-6 text-yellow-600" />
                  </div>
                  <div class="mt-3 text-center sm:mt-5">
                    <h3 class="text-lg font-medium leading-6" id="modal-title">Reset Password</h3>
                    <p class="mt-2 text-sm text-muted-foreground">
                      Reset password for <strong>{{ resetPasswordUser()!.email }}</strong>
                    </p>
                  </div>
                </div>

                <form class="mt-6 space-y-4" (ngSubmit)="doResetPassword()">
                  <div>
                    <label class="block text-sm font-medium mb-1">New Password</label>
                    <div class="flex gap-2">
                      <input
                        type="text"
                        [(ngModel)]="newPassword"
                        name="newPassword"
                        required
                        class="flex-1 rounded-lg border bg-background p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                        placeholder="Enter new password">
                      <button
                        type="button"
                        (click)="generateNewPassword()"
                        class="px-3 py-2 rounded-lg border hover:bg-muted text-sm">
                        Generate
                      </button>
                    </div>
                  </div>

                  <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                    <button
                      type="submit"
                      [disabled]="resetLoading() || !newPassword()"
                      class="inline-flex w-full justify-center rounded-lg border border-transparent bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:col-start-2 disabled:opacity-50">
                      {{ resetLoading() ? 'Resetting...' : 'Reset Password' }}
                    </button>
                    <button
                      type="button"
                      (click)="resetPasswordUser.set(null); newPassword.set('')"
                      class="mt-3 inline-flex w-full justify-center rounded-lg border px-4 py-2 text-sm font-medium shadow-sm hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:col-start-1 sm:mt-0">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Reset Password Success Modal -->
      @if (resetPasswordResult()) {
        <div class="relative z-50" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
          <div class="fixed inset-0 z-10 overflow-y-auto">
            <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div class="relative transform overflow-hidden rounded-lg bg-background px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div>
                  <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                    <ng-icon name="lucideCheck" class="h-6 w-6 text-green-600" />
                  </div>
                  <div class="mt-3 text-center sm:mt-5">
                    <h3 class="text-lg font-medium leading-6" id="modal-title">Password Reset Successfully</h3>
                    <p class="mt-2 text-sm text-muted-foreground">Share the new password with the user.</p>
                  </div>
                </div>

                <div class="mt-6">
                  <div class="rounded-lg bg-muted p-4">
                    <label class="text-xs text-muted-foreground uppercase tracking-wide">New Password</label>
                    <div class="flex items-center gap-2 mt-1">
                      <code class="flex-1 font-mono text-sm">{{ resetPasswordResult()!.password }}</code>
                      <button
                        type="button"
                        (click)="copyToClipboard(resetPasswordResult()!.password)"
                        class="p-1.5 rounded hover:bg-background">
                        <ng-icon name="lucideCopy" class="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div class="mt-5 sm:mt-6">
                  <button
                    type="button"
                    (click)="resetPasswordResult.set(null)"
                    class="inline-flex w-full justify-center rounded-lg border border-transparent bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class TeamManagementComponent implements OnInit {
    private authService = inject(AuthService);

    users = signal<ManagedUser[]>([]);
    loading = signal(true);
    error = signal('');
    successMessage = signal('');

    showAddModal = signal(false);
    addLoading = signal(false);
    newUser = {
        fullName: '',
        email: '',
        password: '',
        role: 'member'
    };

    createdUser = signal<{ email: string; password: string } | null>(null);

    resetPasswordUser = signal<ManagedUser | null>(null);
    newPassword = signal('');
    resetLoading = signal(false);
    resetPasswordResult = signal<{ password: string } | null>(null);

    currentUserId = signal<number | null>(null);

    ngOnInit() {
        this.loadUsers();
        const currentUser = this.authService.currentUser();
        if (currentUser) {
            this.currentUserId.set(currentUser.id);
        }
    }

    loadUsers() {
        this.loading.set(true);
        this.error.set('');
        this.authService.listUsers().subscribe({
            next: (users) => {
                this.users.set(users);
                this.loading.set(false);
            },
            error: (err) => {
                this.error.set(err.error?.detail || 'Failed to load users');
                this.loading.set(false);
            }
        });
    }

    generatePassword() {
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        let password = '';
        for (let i = 0; i < 12; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        this.newUser.password = password;
    }

    generateNewPassword() {
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        let password = '';
        for (let i = 0; i < 12; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        this.newPassword.set(password);
    }

    createUser() {
        if (!this.newUser.email || !this.newUser.fullName || !this.newUser.password) return;

        this.addLoading.set(true);
        this.error.set('');

        this.authService.createUser({
            email: this.newUser.email,
            full_name: this.newUser.fullName,
            password: this.newUser.password,
            role: this.newUser.role
        }).subscribe({
            next: (result) => {
                this.addLoading.set(false);
                this.showAddModal.set(false);
                this.createdUser.set({
                    email: result.email,
                    password: result.password
                });
                this.newUser = { fullName: '', email: '', password: '', role: 'member' };
                this.loadUsers();
            },
            error: (err) => {
                this.addLoading.set(false);
                this.error.set(err.error?.detail || 'Failed to create user');
            }
        });
    }

    closeAddModal() {
        this.showAddModal.set(false);
        this.newUser = { fullName: '', email: '', password: '', role: 'member' };
    }

    toggleActive(user: ManagedUser) {
        const action = user.isActive ? 'disable' : 'enable';
        if (!confirm(`Are you sure you want to ${action} ${user.email}?`)) return;

        this.authService.toggleUserActive(user.id).subscribe({
            next: () => {
                this.successMessage.set(`User ${action}d successfully`);
                setTimeout(() => this.successMessage.set(''), 3000);
                this.loadUsers();
            },
            error: (err) => {
                this.error.set(err.error?.detail || `Failed to ${action} user`);
            }
        });
    }

    deleteUser(user: ManagedUser) {
        if (!confirm(`Are you sure you want to delete ${user.email}? This action cannot be undone.`)) return;

        this.authService.deleteUser(user.id).subscribe({
            next: () => {
                this.successMessage.set('User deleted successfully');
                setTimeout(() => this.successMessage.set(''), 3000);
                this.loadUsers();
            },
            error: (err) => {
                this.error.set(err.error?.detail || 'Failed to delete user');
            }
        });
    }

    openResetPassword(user: ManagedUser) {
        this.resetPasswordUser.set(user);
        this.newPassword.set('');
    }

    doResetPassword() {
        const user = this.resetPasswordUser();
        if (!user || !this.newPassword()) return;

        this.resetLoading.set(true);
        this.authService.resetUserPassword(user.id, this.newPassword()).subscribe({
            next: (result) => {
                this.resetLoading.set(false);
                this.resetPasswordUser.set(null);
                this.resetPasswordResult.set({ password: result.password });
                this.newPassword.set('');
            },
            error: (err) => {
                this.resetLoading.set(false);
                this.error.set(err.error?.detail || 'Failed to reset password');
            }
        });
    }

    copyToClipboard(text: string) {
        navigator.clipboard.writeText(text);
    }
}
