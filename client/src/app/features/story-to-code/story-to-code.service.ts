import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface StoryToCodeSession {
    id: number;
    userId?: number;
    title: string;
    inputSource: string;
    inputDescription: string;
    sourceArtifactId?: number;
    techStack?: string;
    knowledgeBaseIds: number[];
    generatedFiles?: Record<string, string>;
    status: string;
    progressStep: number;
    progressMessage?: string;
    errorMessage?: string;
    generationMetadata?: {
        model?: string;
        fileCount?: number;
        generationTimeMs?: number;
    };
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
}

export interface StoryArtifact {
    id: number;
    type: string;
    title: string;
    description: string;
    createdAt: string;
}

export interface CodeKnowledgeBase {
    id: number;
    name: string;
    description?: string;
    documentCount: number;
    totalChunks: number;
    createdAt: string;
}

export interface CreateSessionRequest {
    inputDescription: string;
    title?: string;
    inputSource?: string;
    sourceArtifactId?: number;
    techStack?: string;
    knowledgeBaseIds?: number[];
}

// Common tech stacks for easy selection
export const TECH_STACK_OPTIONS = [
    { id: 'python-fastapi', label: 'Python + FastAPI', value: 'Python 3.11+, FastAPI, Pydantic, SQLAlchemy, PostgreSQL' },
    { id: 'node-express', label: 'Node.js + Express', value: 'Node.js, Express, TypeScript, Prisma, PostgreSQL' },
    { id: 'angular', label: 'Angular', value: 'Angular 17+, TypeScript, Tailwind CSS, RxJS' },
    { id: 'react', label: 'React', value: 'React 18+, TypeScript, Tailwind CSS, React Query' },
    { id: 'vue', label: 'Vue.js', value: 'Vue 3, TypeScript, Tailwind CSS, Pinia' },
    { id: 'nextjs', label: 'Next.js', value: 'Next.js 14, TypeScript, Tailwind CSS, Prisma' },
    { id: 'django', label: 'Django', value: 'Python 3.11+, Django 4+, Django REST Framework, PostgreSQL' },
    { id: 'spring', label: 'Spring Boot', value: 'Java 17+, Spring Boot 3, JPA, PostgreSQL' },
    { id: 'go', label: 'Go', value: 'Go 1.21+, Gin/Echo, GORM, PostgreSQL' },
    { id: 'rust', label: 'Rust', value: 'Rust, Actix-web, Diesel, PostgreSQL' },
];

@Injectable({
    providedIn: 'root'
})
export class StoryToCodeService {
    private http = inject(HttpClient);
    private apiUrl = '/api/story-to-code';

    // State
    sessions = signal<StoryToCodeSession[]>([]);
    currentSession = signal<StoryToCodeSession | null>(null);
    artifacts = signal<StoryArtifact[]>([]);
    knowledgeBases = signal<CodeKnowledgeBase[]>([]);
    loading = signal(false);
    error = signal<string | null>(null);
    hasMore = signal(true);
    private skip = 0;
    private limit = 20;

    // Computed
    isProcessing = computed(() => {
        const session = this.currentSession();
        return session?.status === 'pending' || session?.status === 'generating';
    });

    // --- Session Management ---

    async loadSessions(reset = false): Promise<void> {
        if (reset) {
            this.skip = 0;
            this.sessions.set([]);
            this.hasMore.set(true);
        }

        this.loading.set(true);
        try {
            const sessions = await firstValueFrom(
                this.http.get<StoryToCodeSession[]>(`${this.apiUrl}/sessions`, {
                    params: { skip: this.skip.toString(), limit: this.limit.toString() }
                })
            );
            if (reset) {
                this.sessions.set(sessions);
            } else {
                this.sessions.update(s => [...s, ...sessions]);
            }
            this.hasMore.set(sessions.length === this.limit);
            this.skip += sessions.length;
        } catch (e: any) {
            this.error.set(e.message || 'Failed to load sessions');
        } finally {
            this.loading.set(false);
        }
    }

    async getSession(id: number): Promise<StoryToCodeSession | null> {
        try {
            const session = await firstValueFrom(
                this.http.get<StoryToCodeSession>(`${this.apiUrl}/sessions/${id}`)
            );
            this.currentSession.set(session);
            return session;
        } catch (e: any) {
            this.error.set(e.message || 'Failed to load session');
            return null;
        }
    }

    async createSession(request: CreateSessionRequest): Promise<StoryToCodeSession | null> {
        this.loading.set(true);
        this.error.set(null);
        try {
            const session = await firstValueFrom(
                this.http.post<StoryToCodeSession>(`${this.apiUrl}/sessions`, request)
            );
            this.currentSession.set(session);
            // Add to history
            this.sessions.update(s => [session, ...s]);
            return session;
        } catch (e: any) {
            this.error.set(e.message || 'Failed to create session');
            return null;
        } finally {
            this.loading.set(false);
        }
    }

    async deleteSession(id: number): Promise<boolean> {
        try {
            await firstValueFrom(
                this.http.delete(`${this.apiUrl}/sessions/${id}`)
            );
            this.sessions.update(s => s.filter(sess => sess.id !== id));
            if (this.currentSession()?.id === id) {
                this.currentSession.set(null);
            }
            return true;
        } catch (e: any) {
            this.error.set(e.message || 'Failed to delete session');
            return false;
        }
    }

    async retrySession(id: number): Promise<StoryToCodeSession | null> {
        this.loading.set(true);
        try {
            const session = await firstValueFrom(
                this.http.post<StoryToCodeSession>(`${this.apiUrl}/sessions/${id}/retry`, {})
            );
            this.currentSession.set(session);
            // Update in history
            this.sessions.update(s => s.map(sess => sess.id === id ? session : sess));
            return session;
        } catch (e: any) {
            this.error.set(e.message || 'Failed to retry session');
            return null;
        } finally {
            this.loading.set(false);
        }
    }

    downloadZip(id: number): void {
        window.open(`${this.apiUrl}/sessions/${id}/download`, '_blank');
    }

    // --- Source Data ---

    async loadArtifacts(): Promise<void> {
        try {
            const artifacts = await firstValueFrom(
                this.http.get<StoryArtifact[]>(`${this.apiUrl}/artifacts`)
            );
            this.artifacts.set(artifacts);
        } catch (e: any) {
            console.error('Failed to load artifacts:', e);
        }
    }

    async loadKnowledgeBases(): Promise<void> {
        try {
            const kbs = await firstValueFrom(
                this.http.get<CodeKnowledgeBase[]>(`${this.apiUrl}/knowledge-bases`)
            );
            this.knowledgeBases.set(kbs);
        } catch (e: any) {
            console.error('Failed to load knowledge bases:', e);
        }
    }

    // --- Polling ---

    private pollInterval: any;

    startPolling(sessionId: number, intervalMs = 2000): void {
        this.stopPolling();
        this.pollInterval = setInterval(async () => {
            const session = await this.getSession(sessionId);
            if (session && (session.status === 'completed' || session.status === 'failed')) {
                this.stopPolling();
            }
        }, intervalMs);
    }

    stopPolling(): void {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    clearCurrentSession(): void {
        this.currentSession.set(null);
        this.stopPolling();
    }
}
