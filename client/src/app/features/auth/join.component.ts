import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-join',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-md w-full space-y-8">
        <div>
          <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">Join the Team</h2>
          <p class="mt-2 text-center text-sm text-gray-600">
            Accept your invitation to collaborate.
          </p>
        </div>

        <form class="mt-8 space-y-6" (ngSubmit)="onSubmit()">
          
          <div class="rounded-md shadow-sm -space-y-px">
            <div>
              <label for="full-name" class="sr-only">Full Name</label>
              <input 
                id="full-name" 
                name="name" 
                type="text" 
                [(ngModel)]="name"
                required 
                class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm" 
                placeholder="Full Name">
            </div>
          </div>

          <div class="flex items-center">
            <input 
                id="terms" 
                name="terms" 
                type="checkbox" 
                [(ngModel)]="acceptTerms"
                class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded">
            <label for="terms" class="ml-2 block text-sm text-gray-900">
              I agree to the <a href="#" class="text-indigo-600 hover:text-indigo-500">Terms of Service</a> and <a href="#" class="text-indigo-600 hover:text-indigo-500">Privacy Policy</a>
            </label>
          </div>

          <div>
             <p *ngIf="error()" class="text-red-500 text-sm mb-2">{{ error() }}</p>
            <button 
                type="submit" 
                [disabled]="loading() || !acceptTerms"
                class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
              {{ loading() ? 'Joining...' : 'Join Team' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class JoinComponent implements OnInit {
  route = inject(ActivatedRoute);
  router = inject(Router);
  authService = inject(AuthService);

  token = '';
  name = '';
  acceptTerms = false;
  loading = signal(false);
  error = signal('');

  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!this.token) {
      this.error.set("Invalid invitation link.");
    }
  }

  onSubmit() {
    if (!this.token || !this.name || !this.acceptTerms) return;

    this.loading.set(true);
    this.authService.joinTeam({ token: this.token, name: this.name, accept_terms: this.acceptTerms }).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/']);
      },
      error: (err) => {
        console.error(err);
        this.loading.set(false);
        this.error.set(err.error?.detail || 'Failed to join team');
      }
    });
  }
}
