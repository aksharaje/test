import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
    selector: 'app-onboarding',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
        <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div class="max-w-md w-full space-y-8">
                <div>
                    <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Complete Your Profile
                    </h2>
                    <p class="mt-2 text-center text-sm text-gray-600">
                        Just a few more details to get started
                    </p>
                </div>

                <form class="mt-8 space-y-6" (ngSubmit)="onSubmit()">
                    <div class="rounded-md shadow-sm -space-y-px">
                        <div>
                            <label for="fullName" class="sr-only">Full Name</label>
                            <input
                                id="fullName"
                                name="fullName"
                                type="text"
                                required
                                [(ngModel)]="fullName"
                                class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                                placeholder="Your full name"
                            />
                        </div>
                    </div>

                    <div class="flex items-center">
                        <input
                            id="acceptTerms"
                            name="acceptTerms"
                            type="checkbox"
                            [(ngModel)]="acceptTerms"
                            class="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                        />
                        <label for="acceptTerms" class="ml-2 block text-sm text-gray-900">
                            I accept the <a href="#" class="text-primary hover:underline">Terms of Service</a>
                        </label>
                    </div>

                    <div *ngIf="error()" class="text-red-600 text-sm text-center">
                        {{ error() }}
                    </div>

                    <div>
                        <button
                            type="submit"
                            [disabled]="submitting() || !fullName || !acceptTerms"
                            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span *ngIf="submitting()" class="absolute left-0 inset-y-0 flex items-center pl-3">
                                <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            </span>
                            {{ submitting() ? 'Saving...' : 'Continue' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `
})
export class OnboardingComponent {
    private authService = inject(AuthService);
    private router = inject(Router);

    fullName = '';
    acceptTerms = false;
    submitting = signal(false);
    error = signal('');

    onSubmit() {
        if (!this.fullName || !this.acceptTerms) {
            this.error.set('Please fill in all fields and accept the terms.');
            return;
        }

        this.submitting.set(true);
        this.error.set('');

        this.authService.completeProfile({
            full_name: this.fullName,
            accept_terms: this.acceptTerms
        }).subscribe({
            next: () => {
                this.submitting.set(false);
                this.router.navigate(['/']);
            },
            error: (err) => {
                this.submitting.set(false);
                this.error.set(err.error?.detail || 'Failed to save profile. Please try again.');
            }
        });
    }
}
