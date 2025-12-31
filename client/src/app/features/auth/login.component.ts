import { Component, inject, signal } from '@angular/core';
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
          <p class="mt-2 text-center text-sm text-gray-600">
            Or <a href="#" class="font-medium text-indigo-600 hover:text-indigo-500">contact admin</a>
          </p>
        </div>
        
        <div *ngIf="sent()" class="rounded-md bg-green-50 p-4">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-green-800">Check your email</h3>
              <div class="mt-2 text-sm text-green-700">
                <p>We sent a magic link to {{ email() }}. Click the link to log in.</p>
                
                <div *ngIf="devLink()" class="mt-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
                    <p class="font-bold text-xs uppercase tracking-wide mb-1">Dev Mode Link:</p>
                    <a [href]="devLink()" class="break-all underline hover:text-yellow-900">{{ devLink() }}</a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <form *ngIf="!sent()" class="mt-8 space-y-6" (ngSubmit)="onSubmit()">
          <div class="rounded-md shadow-sm -space-y-px">
            <div>
              <label for="email-address" class="sr-only">Email address</label>
              <input 
                id="email-address" 
                name="email" 
                type="email" 
                [(ngModel)]="email"
                required 
                class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm" 
                placeholder="Email address">
            </div>
          </div>

          <div>
            <button 
                type="submit" 
                [disabled]="loading()"
                class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
              <span class="absolute left-0 inset-y-0 flex items-center pl-3">
                <svg class="h-5 w-5 text-indigo-500 group-hover:text-indigo-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
                </svg>
              </span>
              {{ loading() ? 'Sending...' : 'Sign in with Email' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class LoginComponent {
  authService = inject(AuthService);
  email = signal('');
  loading = signal(false);
  sent = signal(false);
  devLink = signal('');

  onSubmit() {
    if (!this.email()) return;
    this.loading.set(true);
    this.authService.sendMagicLink(this.email()).subscribe({
      next: (res: any) => {
        this.loading.set(false);
        this.sent.set(true);
        if (res.dev_magic_link) {
          this.devLink.set(res.dev_magic_link);
        }
      },
      error: (err) => {
        console.error(err);
        this.loading.set(false);
        alert('Failed to send login link');
      }
    });
  }
}
