import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';

@Component({
    selector: 'app-profile-settings',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="px-4 sm:px-6 lg:px-8 py-8">
      <div class="max-w-3xl mx-auto">
        <h1 class="text-2xl font-bold text-gray-900 mb-6">Profile Settings</h1>
        
        <div class="bg-white shadow rounded-lg overflow-hidden">
          <div class="p-6 space-y-6">
            
            <!-- Avatar Section (Placeholder) -->
            <div class="flex items-center space-x-4">
               <div class="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xl font-bold">
                  {{ getInitials() }}
               </div>
               <div>
                  <h3 class="text-lg font-medium text-gray-900">{{ authService.currentUser()?.full_name || authService.currentUser()?.email }}</h3>
                  <p class="text-sm text-gray-500">{{ authService.currentUser()?.email }}</p>
               </div>
            </div>

            <div class="border-t border-gray-200"></div>

            <!-- Form -->
            <form (ngSubmit)="saveProfile()">
               <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                  
                  <div class="sm:col-span-4">
                     <label for="full-name" class="block text-sm font-medium text-gray-700">Full Name</label>
                     <div class="mt-1">
                        <input 
                           type="text" 
                           name="full-name" 
                           id="full-name" 
                           [(ngModel)]="fullName"
                           class="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        >
                     </div>
                  </div>

                  <div class="sm:col-span-4">
                     <label for="email" class="block text-sm font-medium text-gray-700">Email</label>
                     <div class="mt-1">
                        <input 
                           type="email" 
                           name="email" 
                           id="email" 
                           [value]="authService.currentUser()?.email"
                           disabled
                           class="shadow-sm bg-gray-50 block w-full sm:text-sm border-gray-300 rounded-md text-gray-500 cursor-not-allowed"
                        >
                     </div>
                     <p class="mt-1 text-xs text-gray-500">Email cannot be changed.</p>
                  </div>

               </div>

               <div class="mt-6 flex items-center justify-end">
                  <div *ngIf="successMessage()" class="mr-4 text-sm text-green-600 font-medium fade-in">
                     {{ successMessage() }}
                  </div>
                   <div *ngIf="errorMessage()" class="mr-4 text-sm text-red-600 font-medium fade-in">
                     {{ errorMessage() }}
                  </div>
                  <button 
                     type="submit" 
                     [disabled]="saving()"
                     class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
                     {{ saving() ? 'Saving...' : 'Save' }}
                  </button>
               </div>
            </form>

          </div>
        </div>
      </div>
    </div>
  `
})
export class ProfileSettingsComponent {
    authService = inject(AuthService);

    fullName = '';
    saving = signal(false);
    successMessage = signal('');
    errorMessage = signal('');

    constructor() {
        effect(() => {
            const user = this.authService.currentUser();
            if (user) {
                this.fullName = user.full_name || '';
            }
        });
    }

    getInitials(): string {
        const name = this.authService.currentUser()?.full_name || '';
        if (!name) return this.authService.currentUser()?.email?.substring(0, 2).toUpperCase() || '??';
        return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    }

    saveProfile() {
        this.saving.set(true);
        this.successMessage.set('');
        this.errorMessage.set('');

        this.authService.updateProfile({ full_name: this.fullName }).subscribe({
            next: () => {
                this.saving.set(false);
                this.successMessage.set('Profile updated successfully.');
                setTimeout(() => this.successMessage.set(''), 3000);
            },
            error: (err: any) => {
                console.error(err);
                this.saving.set(false);
                this.errorMessage.set('Failed to update profile.');
            }
        });
    }
}
