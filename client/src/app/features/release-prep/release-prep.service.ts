/**
 * Release Prep Service
 *
 * Angular service for the Release Prep feature.
 * Handles API calls and state management using signals.
 */
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, interval, takeWhile, switchMap, tap, finalize, of } from 'rxjs';
import type {
  AvailableStory,
  ReleasePrepSession,
  ReleasePrepSessionDetail,
  PipelineStatusResponse,
  CreateSessionRequest,
  ReleaseNote,
  UpdateReleaseNoteRequest,
  Decision,
  UpdateDecisionRequest,
  TechnicalDebtItem,
  UpdateDebtItemRequest,
  CreateDebtItemRequest,
  ExportResponse,
} from './release-prep.types';
import type { KnowledgeBase } from '../knowledge-bases/knowledge-base.types';

@Injectable({
  providedIn: 'root',
})
export class ReleasePrepService {
  private http = inject(HttpClient);
  private readonly baseUrl = '/api/release-prep';

  // State signals
  readonly sessions = signal<ReleasePrepSession[]>([]);
  readonly currentSession = signal<ReleasePrepSessionDetail | null>(null);
  readonly availableStories = signal<AvailableStory[]>([]);
  readonly knowledgeBases = signal<KnowledgeBase[]>([]);
  readonly pipelineStatus = signal<PipelineStatusResponse | null>(null);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // Computed values
  readonly releaseNotes = computed(() => this.currentSession()?.releaseNotes ?? []);
  readonly decisions = computed(() => this.currentSession()?.decisions ?? []);
  readonly debtItems = computed(() => this.currentSession()?.debtItems ?? []);

  readonly activeReleaseNotes = computed(() =>
    this.releaseNotes().filter((n) => !n.isExcluded)
  );
  readonly activeDecisions = computed(() =>
    this.decisions().filter((d) => !d.isExcluded)
  );
  readonly activeDebtItems = computed(() =>
    this.debtItems().filter((d) => !d.isExcluded)
  );

  // Categories for release notes
  readonly notesByCategory = computed(() => {
    const notes = this.activeReleaseNotes();
    return {
      feature: notes.filter((n) => n.category === 'feature'),
      improvement: notes.filter((n) => n.category === 'improvement'),
      fix: notes.filter((n) => n.category === 'fix'),
      security: notes.filter((n) => n.category === 'security'),
      performance: notes.filter((n) => n.category === 'performance'),
      breaking_change: notes.filter((n) => n.category === 'breaking_change'),
    };
  });

  // Impact levels for debt
  readonly debtByImpact = computed(() => {
    const items = this.activeDebtItems();
    return {
      critical: items.filter((d) => d.impactLevel === 'critical'),
      high: items.filter((d) => d.impactLevel === 'high'),
      medium: items.filter((d) => d.impactLevel === 'medium'),
      low: items.filter((d) => d.impactLevel === 'low'),
    };
  });

  // --- Session Management ---

  loadSessions(): Observable<ReleasePrepSession[]> {
    this.loading.set(true);
    this.error.set(null);

    return this.http.get<ReleasePrepSession[]>(`${this.baseUrl}/sessions`).pipe(
      tap((sessions) => this.sessions.set(sessions)),
      finalize(() => this.loading.set(false))
    );
  }

  loadSession(sessionId: number): Observable<ReleasePrepSessionDetail> {
    this.loading.set(true);
    this.error.set(null);

    return this.http
      .get<ReleasePrepSessionDetail>(`${this.baseUrl}/sessions/${sessionId}`)
      .pipe(
        tap((detail) => this.currentSession.set(detail)),
        finalize(() => this.loading.set(false))
      );
  }

  createSession(request: CreateSessionRequest): Observable<ReleasePrepSession> {
    this.loading.set(true);
    this.error.set(null);

    return this.http
      .post<ReleasePrepSession>(`${this.baseUrl}/sessions`, request)
      .pipe(finalize(() => this.loading.set(false)));
  }

  deleteSession(sessionId: number): Observable<{ status: string }> {
    return this.http
      .delete<{ status: string }>(`${this.baseUrl}/sessions/${sessionId}`)
      .pipe(
        tap(() => {
          this.sessions.update((sessions) =>
            sessions.filter((s) => s.id !== sessionId)
          );
          if (this.currentSession()?.session.id === sessionId) {
            this.currentSession.set(null);
          }
        })
      );
  }

  // --- Available Stories ---

  loadAvailableStories(): Observable<AvailableStory[]> {
    return this.http
      .get<AvailableStory[]>(`${this.baseUrl}/stories/available`)
      .pipe(tap((stories) => this.availableStories.set(stories)));
  }

  // --- Knowledge Bases (only ready KBs for select dropdown) ---

  loadKnowledgeBases(): Observable<KnowledgeBase[]> {
    return this.http
      .get<KnowledgeBase[]>('/api/knowledge-bases/selectable')
      .pipe(tap((kbs) => this.knowledgeBases.set(kbs)));
  }

  // --- Pipeline Execution ---

  runPipeline(sessionId: number): Observable<{ status: string; sessionId: number }> {
    this.error.set(null);

    return this.http
      .post<{ status: string; sessionId: number }>(
        `${this.baseUrl}/sessions/${sessionId}/run`,
        {}
      )
      .pipe(
        tap(() => {
          // Start polling for status
          this.pollPipelineStatus(sessionId);
        })
      );
  }

  private pollPipelineStatus(sessionId: number): void {
    interval(1500)
      .pipe(
        switchMap(() => this.getPipelineStatus(sessionId)),
        takeWhile(
          (status) =>
            status.status !== 'completed' && status.status !== 'failed',
          true
        ),
        tap((status) => {
          this.pipelineStatus.set(status);

          // Update current session status if loaded
          if (this.currentSession()?.session.id === sessionId) {
            this.currentSession.update((detail) => {
              if (!detail) return null;
              return {
                ...detail,
                session: {
                  ...detail.session,
                  status: status.status as any,
                  progressStep: status.progressStep,
                  progressMessage: status.progressMessage,
                  errorMessage: status.errorMessage,
                },
              };
            });
          }
        }),
        finalize(() => {
          // Reload session when pipeline completes
          this.loadSession(sessionId).subscribe();
        })
      )
      .subscribe();
  }

  getPipelineStatus(sessionId: number): Observable<PipelineStatusResponse> {
    return this.http.get<PipelineStatusResponse>(
      `${this.baseUrl}/sessions/${sessionId}/status`
    );
  }

  // --- Release Notes ---

  updateReleaseNote(
    noteId: number,
    update: UpdateReleaseNoteRequest
  ): Observable<ReleaseNote> {
    return this.http
      .patch<ReleaseNote>(`${this.baseUrl}/release-notes/${noteId}`, update)
      .pipe(
        tap((updatedNote) => {
          this.currentSession.update((detail) => {
            if (!detail) return null;
            return {
              ...detail,
              releaseNotes: detail.releaseNotes.map((n) =>
                n.id === noteId ? updatedNote : n
              ),
            };
          });
        })
      );
  }

  // --- Decisions ---

  updateDecision(
    decisionId: number,
    update: UpdateDecisionRequest
  ): Observable<Decision> {
    return this.http
      .patch<Decision>(`${this.baseUrl}/decisions/${decisionId}`, update)
      .pipe(
        tap((updatedDecision) => {
          this.currentSession.update((detail) => {
            if (!detail) return null;
            return {
              ...detail,
              decisions: detail.decisions.map((d) =>
                d.id === decisionId ? updatedDecision : d
              ),
            };
          });
        })
      );
  }

  // --- Technical Debt ---

  updateDebtItem(
    itemId: number,
    update: UpdateDebtItemRequest
  ): Observable<TechnicalDebtItem> {
    return this.http
      .patch<TechnicalDebtItem>(`${this.baseUrl}/debt-items/${itemId}`, update)
      .pipe(
        tap((updatedItem) => {
          this.currentSession.update((detail) => {
            if (!detail) return null;
            return {
              ...detail,
              debtItems: detail.debtItems.map((d) =>
                d.id === itemId ? updatedItem : d
              ),
            };
          });
        })
      );
  }

  createDebtItem(
    sessionId: number,
    request: CreateDebtItemRequest
  ): Observable<TechnicalDebtItem> {
    return this.http
      .post<TechnicalDebtItem>(
        `${this.baseUrl}/sessions/${sessionId}/debt-items`,
        request
      )
      .pipe(
        tap((newItem) => {
          this.currentSession.update((detail) => {
            if (!detail) return null;
            return {
              ...detail,
              debtItems: [...detail.debtItems, newItem],
              session: {
                ...detail.session,
                totalDebtItems: detail.session.totalDebtItems + 1,
              },
            };
          });
        })
      );
  }

  // --- Export ---

  exportReleaseNotes(
    sessionId: number,
    format: 'markdown' | 'html' = 'markdown'
  ): Observable<ExportResponse> {
    return this.http.get<ExportResponse>(
      `${this.baseUrl}/sessions/${sessionId}/export/release-notes?format=${format}`
    );
  }

  exportDecisionLog(sessionId: number): Observable<ExportResponse> {
    return this.http.get<ExportResponse>(
      `${this.baseUrl}/sessions/${sessionId}/export/decision-log`
    );
  }

  exportDebtInventory(sessionId: number): Observable<ExportResponse> {
    return this.http.get<ExportResponse>(
      `${this.baseUrl}/sessions/${sessionId}/export/debt-inventory`
    );
  }

  // --- Release Tracking ---

  unreleaseArtifact(artifactId: number): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(
      `${this.baseUrl}/artifacts/${artifactId}/unrelease`,
      {}
    );
  }

  unreleaseSessionArtifacts(sessionId: number): Observable<{ success: boolean; count: number }> {
    return this.http.post<{ success: boolean; count: number }>(
      `${this.baseUrl}/sessions/${sessionId}/unrelease-all`,
      {}
    );
  }

  // --- Helpers ---

  downloadMarkdown(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  copyToClipboard(content: string): void {
    navigator.clipboard.writeText(content);
  }
}
