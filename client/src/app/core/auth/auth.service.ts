import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of, map, throwError } from 'rxjs';


export interface User {
    id: number;
    email: string;
    name?: string;
    full_name?: string;
    role: 'admin' | 'member';
    account_id?: number;
    has_accepted_terms: boolean;
    is_active: boolean;
}

export interface AuthResponse {
    access_token: string;
    token_type: string;
    user: User;
    is_new?: boolean;
    needs_onboarding?: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private http = inject(HttpClient);
    private router = inject(Router);
    // Removed unused apiUrl property since we use full paths

    // Signals
    private _currentUser = signal<User | null>(null);
    currentUser = this._currentUser.asReadonly();
    isLoading = signal(true);
    isAuthenticated = computed(() => !!this._currentUser());

    // Public setter for isAuthenticated to allow testing/mocking if needed
    // but primarily we derive it from currentUser.
    // However, some components might check it synchronously before currentUser is loaded?
    // Let's keep a private signal that we update.
    private _isAuthenticated = signal(false);

    constructor() {
        this.checkAuth().subscribe(() => {
            this.isLoading.set(false);
        });
    }

    checkAuth(): Observable<boolean> {
        if (!localStorage.getItem('access_token')) {
            this._isAuthenticated.set(false);
            this._currentUser.set(null);
            return of(false);
        }

        // Use /api/auth/me (bypassing /v1 prefix issue)
        return this.http.get<User>(`/api/auth/me`).pipe(
            map(user => {
                this._currentUser.set(user);
                this._isAuthenticated.set(true);
                return true;
            }),
            catchError(() => {
                this.logout();
                return of(false);
            })
        );
    }

    sendMagicLink(email: string): Observable<any> {
        return this.http.post(`/api/auth/login`, { email });
    }

    verifyMagicToken(token: string): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`/api/auth/verify`, { token }).pipe(
            tap(response => {
                this.setSession(response);
            })
        );
    }

    joinTeam(data: { token: string, name: string, accept_terms: boolean }): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`/api/users/join`, data).pipe(
            tap(response => {
                this.setSession(response);
            })
        );
    }

    inviteMember(email: string): Observable<any> {
        return this.http.post(`/api/users/invite`, { email });
    }

    updateProfile(data: { full_name?: string }): Observable<User> {
        return this.http.put<User>(`/api/users/me`, data).pipe(
            tap(updatedUser => {
                this._currentUser.set(updatedUser);
            })
        );
    }

    completeProfile(data: { full_name: string; accept_terms: boolean }): Observable<User> {
        return this.http.post<User>(`/api/auth/complete-profile`, data).pipe(
            tap(updatedUser => {
                this._currentUser.set(updatedUser);
            })
        );
    }

    logout(): void {
        localStorage.removeItem('access_token');
        this._currentUser.set(null);
        this._isAuthenticated.set(false);
        this.router.navigate(['/auth/login']);
    }

    private setSession(authResult: AuthResponse): void {
        localStorage.setItem('access_token', authResult.access_token);
        this._currentUser.set(authResult.user);
        this._isAuthenticated.set(true);
    }
}
