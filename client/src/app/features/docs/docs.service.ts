import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { map, Observable, tap } from 'rxjs';

export interface DocManifestItem {
    name: string;
    filename: string;
    category?: string;
    summary: string;
}

@Injectable({
    providedIn: 'root'
})
export class DocsService {
    private http = inject(HttpClient);

    // Signals for state
    manifest = signal<DocManifestItem[]>([]);
    isLoading = signal<boolean>(false);
    error = signal<string | null>(null);

    constructor() {
        this.loadManifest();
    }

    loadManifest() {
        this.isLoading.set(true);
        this.http.get<DocManifestItem[]>('/assets/docs/manifest.json').pipe(
            tap({
                next: (data) => {
                    this.manifest.set(data);
                    this.isLoading.set(false);
                },
                error: (err) => {
                    console.error('Failed to load docs manifest', err);
                    this.error.set('Failed to load documentation manifest.');
                    this.isLoading.set(false);
                }
            })
        ).subscribe();
    }

    getDocContent(filename: string): Observable<string> {
        return this.http.get(`/assets/docs/${filename}`, { responseType: 'text' });
    }
}
