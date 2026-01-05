import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of, map } from 'rxjs';


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
    needs_registration?: boolean;
    email?: string;
}

export interface AuthMode {
    dev_mode: boolean;
    allowed_domains: string[];
}

export interface ManagedUser {
    id: number;
    email: string;
    fullName: string | null;
    role: string;
    isActive: boolean;
    createdAt: string | null;
}

export interface CreateUserResponse {
    id: number;
    email: string;
    fullName: string;
    role: string;
    password: string;
    message: string;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private http = inject(HttpClient);
    private router = inject(Router);

    // Signals
    private _currentUser = signal<User | null>(null);
    currentUser = this._currentUser.asReadonly();
    isLoading = signal(true);
    isAuthenticated = computed(() => !!this._currentUser());

    // Auth mode
    authMode = signal<AuthMode | null>(null);
    isDevMode = computed(() => this.authMode()?.dev_mode ?? false);

    private _isAuthenticated = signal(false);

    constructor() {
        this.loadAuthMode();
        this.checkAuth().subscribe(() => {
            this.isLoading.set(false);
        });
    }

    loadAuthMode(): void {
        this.http.get<AuthMode>('/api/auth/mode').subscribe({
            next: (mode) => this.authMode.set(mode),
            error: () => this.authMode.set({ dev_mode: true, allowed_domains: [] })
        });
    }

    checkAuth(): Observable<boolean> {
        if (!localStorage.getItem('access_token')) {
            this._isAuthenticated.set(false);
            this._currentUser.set(null);
            return of(false);
        }

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

    login(email: string, password?: string): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`/api/auth/login`, { email, password }).pipe(
            tap(response => {
                if (response.access_token) {
                    this.setSession(response);
                }
            })
        );
    }

    devRegister(email: string, fullName: string): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`/api/auth/dev-register`, {
            email,
            full_name: fullName
        }).pipe(
            tap(response => {
                if (response.access_token) {
                    this.setSession(response);
                }
            })
        );
    }

    // Keep for backwards compatibility but deprecated
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

    // ==================== Admin User Management ====================

    listUsers(): Observable<ManagedUser[]> {
        return this.http.get<ManagedUser[]>('/api/auth/users');
    }

    createUser(data: { email: string; full_name: string; password: string; role: string }): Observable<CreateUserResponse> {
        return this.http.post<CreateUserResponse>('/api/auth/users', data);
    }

    deleteUser(userId: number): Observable<any> {
        return this.http.delete(`/api/auth/users/${userId}`);
    }

    toggleUserActive(userId: number): Observable<any> {
        return this.http.patch(`/api/auth/users/${userId}/toggle-active`, {});
    }

    resetUserPassword(userId: number, newPassword: string): Observable<any> {
        return this.http.patch(`/api/auth/users/${userId}/reset-password`, { new_password: newPassword });
    }
}
