import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-md w-full space-y-8">
        <div>
          <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">Sign in to your account</h2>
          @if (!authService.isDevMode()) {
            <p class="mt-2 text-center text-sm text-gray-600">
              Contact your administrator for access
            </p>
          } @else {
            <p class="mt-2 text-center text-sm text-gray-600">
              Development Mode - No password required
            </p>
          }
        </div>

        @if (error()) {
          <div class="rounded-md bg-red-50 p-4">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-red-700">{{ error() }}</p>
              </div>
            </div>
          </div>
        }

        <!-- Dev Mode: Registration Form (when user doesn't exist) -->
        @if (showRegistration()) {
          <form class="mt-8 space-y-6" (ngSubmit)="onRegister()">
            <div class="rounded-md bg-blue-50 p-4 mb-4">
              <p class="text-sm text-blue-700">
                <strong>New user detected!</strong> Please enter your full name to create your account.
              </p>
            </div>

            <div class="rounded-md shadow-sm space-y-4">
              <div>
                <label for="reg-email" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  id="reg-email"
                  type="email"
                  [value]="email()"
                  disabled
                  class="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-500 rounded-md bg-gray-100 sm:text-sm"
                >
              </div>
              <div>
                <label for="full-name" class="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  id="full-name"
                  name="fullName"
                  type="text"
                  [(ngModel)]="fullName"
                  required
                  class="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                  placeholder="Enter your full name"
                >
              </div>
            </div>

            <div class="flex gap-3">
              <button
                type="button"
                (click)="cancelRegistration()"
                class="flex-1 py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                Back
              </button>
              <button
                type="submit"
                [disabled]="loading() || !fullName()"
                class="flex-1 py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
              >
                {{ loading() ? 'Creating...' : 'Create Account' }}
              </button>
            </div>
          </form>
        } @else {
          <!-- Main Login Form -->
          <form class="mt-8 space-y-6" (ngSubmit)="onSubmit()">
            <div class="rounded-md shadow-sm space-y-4">
              <div>
                <label for="email-address" class="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  [(ngModel)]="email"
                  required
                  class="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                  placeholder="Enter your email"
                >
              </div>

              @if (!authService.isDevMode()) {
                <div>
                  <label for="password" class="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    [(ngModel)]="password"
                    required
                    class="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                    placeholder="Enter your password"
                  >
                </div>
              }
            </div>

            <div>
              <button
                type="submit"
                [disabled]="loading() || !email() || (!authService.isDevMode() && !password())"
                class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
              >
                <span class="absolute left-0 inset-y-0 flex items-center pl-3">
                  <svg class="h-5 w-5 text-primary-foreground/70 group-hover:text-primary-foreground/80" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
                  </svg>
                </span>
                {{ loading() ? 'Signing in...' : 'Sign in' }}
              </button>
            </div>
          </form>
        }
      </div>
    </div>
  `
})
export class LoginComponent implements OnInit {
  authService = inject(AuthService);
  private router = inject(Router);

  email = signal('');
  password = signal('');
  fullName = signal('');
  loading = signal(false);
  error = signal('');
  showRegistration = signal(false);

  ngOnInit() {
    // If already authenticated, redirect to dashboard
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/']);
    }
  }

  onSubmit() {
    if (!this.email()) return;

    this.loading.set(true);
    this.error.set('');

    this.authService.login(this.email(), this.password() || undefined).subscribe({
      next: (response) => {
        this.loading.set(false);

        if (response.needs_registration) {
          // Dev mode: user doesn't exist, show registration form
          this.showRegistration.set(true);
          return;
        }

        if (response.needs_onboarding) {
          this.router.navigate(['/auth/onboarding']);
        } else {
          this.router.navigate(['/']);
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.detail || 'Login failed. Please check your credentials.');
      }
    });
  }

  onRegister() {
    if (!this.email() || !this.fullName()) return;

    this.loading.set(true);
    this.error.set('');

    this.authService.devRegister(this.email(), this.fullName()).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.detail || 'Registration failed. Please try again.');
      }
    });
  }

  cancelRegistration() {
    this.showRegistration.set(false);
    this.fullName.set('');
    this.error.set('');
  }
}
