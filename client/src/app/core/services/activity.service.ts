import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface Shortcut {
    id: string;
    name: string;
    icon: string;
    url: string;
    description: string;
    count: number;
}

@Injectable({
    providedIn: 'root',
})
export class ActivityService {
    private http = inject(HttpClient);
    private baseUrl = '/api/activity';

    // State
    private _shortcuts = signal<Shortcut[]>([]);
    readonly shortcuts = this._shortcuts.asReadonly();

    async logActivity(featureKey: string, metadata?: string): Promise<void> {
        try {
            await firstValueFrom(
                this.http.post(`${this.baseUrl}/log`, { feature_key: featureKey, metadata })
            );
            // Optional: Refresh shortcuts immediately to feel responsive?
            // Or let it be updated on next dashboard load.
        } catch (err) {
            console.error('Failed to log activity', err);
        }
    }

    async loadShortcuts(limit: number = 4): Promise<void> {
        try {
            const shortcuts = await firstValueFrom(
                this.http.get<Shortcut[]>(`${this.baseUrl}/shortcuts?limit=${limit}`)
            );
            this._shortcuts.set(shortcuts);
        } catch (err) {
            console.error('Failed to load shortcuts', err);
        }
    }

    async getRecentOutputs(limit: number = 5): Promise<any[]> {
        return firstValueFrom(this.http.get<any[]>(`/api/activity/outputs?limit=${limit}`));
    }
}
