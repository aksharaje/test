import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-verify',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-md w-full space-y-8 text-center">
        <h2 *ngIf="verifying()" class="mt-6 text-3xl font-extrabold text-gray-900">Verifying your login...</h2>
        <h2 *ngIf="error()" class="mt-6 text-3xl font-extrabold text-red-600">Verification Failed</h2>
        <p *ngIf="error()" class="mt-2 text-sm text-gray-600">{{ error() }}</p>
        <p *ngIf="verifying()" class="mt-2 text-sm text-gray-600">Please wait while we log you in.</p>
        
        <div *ngIf="verifying()" class="flex justify-center mt-4">
             <svg class="animate-spin -ml-1 mr-3 h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
        </div>
      </div>
    </div>
  `
})
export class VerifyComponent implements OnInit {
    route = inject(ActivatedRoute);
    router = inject(Router);
    authService = inject(AuthService);

    verifying = signal(true);
    error = signal('');

    ngOnInit() {
        const token = this.route.snapshot.queryParamMap.get('token');
        if (!token) {
            this.error.set('Invalid link');
            this.verifying.set(false);
            return;
        }

        this.authService.verifyMagicToken(token).subscribe({
            next: (res) => {
                this.verifying.set(false);
                // Redirect to dashboard or where they came from
                if (res.is_new) {
                    // Maybe go to onboarding?
                    this.router.navigate(['/']);
                } else {
                    this.router.navigate(['/']);
                }
            },
            error: (err) => {
                console.error(err);
                this.verifying.set(false);
                const msg = err.error?.detail || 'The link is invalid or has expired. Please try logging in again.';
                this.error.set(msg);
            }
        });
    }
}
