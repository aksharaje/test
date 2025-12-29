import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import {
  RoadmapSession,
  RoadmapSessionResponse,
  RoadmapItem,
  RoadmapItemSegment,
  RoadmapDependency,
  RoadmapTheme,
  RoadmapMilestone,
  SprintSummary,
  DependencyGraph,
  AvailableArtifactForRoadmap,
  AvailableFeasibilityForRoadmap,
  AvailableIdeaForRoadmap,
  AllAvailableSourcesResponse,
  RoadmapSessionCreate,
  RoadmapItemUpdate,
  RoadmapDependencyCreate,
  RoadmapMilestoneCreate,
  RoadmapMilestoneUpdate,
  RoadmapSegmentCreate,
  RoadmapSegmentUpdate,
  RoadmapSegmentBulkUpdate,
  PipelineStatus,
} from './roadmap-planner.types';

@Injectable({
  providedIn: 'root',
})
export class RoadmapPlannerService {
  private http = inject(HttpClient);
  private apiUrl = '/api/roadmap-planner';

  // Reactive state
  sessions = signal<RoadmapSession[]>([]);
  currentSession = signal<RoadmapSessionResponse | null>(null);
  availableArtifacts = signal<AvailableArtifactForRoadmap[]>([]);
  availableFeasibility = signal<AvailableFeasibilityForRoadmap[]>([]);
  availableIdeation = signal<AvailableIdeaForRoadmap[]>([]);
  sprintSummaries = signal<SprintSummary[]>([]);
  dependencyGraph = signal<DependencyGraph | null>(null);
  pipelineStatus = signal<PipelineStatus | null>(null);

  loading = signal(false);
  error = signal<string | null>(null);

  // =========================================================================
  // Sessions
  // =========================================================================

  loadSessions(): Observable<RoadmapSession[]> {
    return this.http.get<RoadmapSession[]>(`${this.apiUrl}/sessions`);
  }

  fetchSessions(): void {
    this.loading.set(true);
    this.loadSessions().subscribe({
      next: (sessions) => {
        this.sessions.set(sessions);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }

  createSession(data: RoadmapSessionCreate): Observable<RoadmapSession> {
    return this.http.post<RoadmapSession>(`${this.apiUrl}/sessions`, data);
  }

  getSession(sessionId: number): Observable<RoadmapSessionResponse> {
    return this.http.get<RoadmapSessionResponse>(`${this.apiUrl}/sessions/${sessionId}`);
  }

  fetchSession(sessionId: number): void {
    this.loading.set(true);
    this.getSession(sessionId).subscribe({
      next: (response) => {
        this.currentSession.set(response);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }

  deleteSession(sessionId: number): Observable<{ status: string }> {
    return this.http.delete<{ status: string }>(`${this.apiUrl}/sessions/${sessionId}`);
  }

  // =========================================================================
  // Pipeline
  // =========================================================================

  startPipeline(sessionId: number): Observable<{ status: string; message: string }> {
    return this.http.post<{ status: string; message: string }>(
      `${this.apiUrl}/sessions/${sessionId}/generate`,
      {}
    );
  }

  getStatus(sessionId: number): Observable<PipelineStatus> {
    return this.http.get<PipelineStatus>(`${this.apiUrl}/sessions/${sessionId}/status`);
  }

  pollStatus(sessionId: number, intervalMs = 2000): void {
    const poll = () => {
      this.getStatus(sessionId).subscribe({
        next: (status) => {
          this.pipelineStatus.set(status);
          if (status.status === 'completed' || status.status === 'failed') {
            // Stop polling, refresh session data
            this.fetchSession(sessionId);
          } else {
            setTimeout(poll, intervalMs);
          }
        },
        error: (err) => {
          this.error.set(err.message);
        },
      });
    };
    poll();
  }

  // =========================================================================
  // Available Sources (Artifacts, Feasibility, Ideation)
  // =========================================================================

  loadAllAvailableSources(): Observable<AllAvailableSourcesResponse> {
    return this.http.get<AllAvailableSourcesResponse>(`${this.apiUrl}/available-sources`);
  }

  fetchAllAvailableSources(): void {
    this.loading.set(true);
    this.loadAllAvailableSources().subscribe({
      next: (response) => {
        this.availableArtifacts.set(response.artifacts);
        this.availableFeasibility.set(response.feasibilityAnalyses);
        this.availableIdeation.set(response.ideationIdeas);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }

  loadAvailableArtifacts(): Observable<AvailableArtifactForRoadmap[]> {
    return this.http.get<AvailableArtifactForRoadmap[]>(`${this.apiUrl}/available-artifacts`);
  }

  fetchAvailableArtifacts(): void {
    this.loading.set(true);
    this.loadAvailableArtifacts().subscribe({
      next: (artifacts) => {
        this.availableArtifacts.set(artifacts);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }

  // =========================================================================
  // Items
  // =========================================================================

  getItems(sessionId: number): Observable<RoadmapItem[]> {
    return this.http.get<RoadmapItem[]>(`${this.apiUrl}/sessions/${sessionId}/items`);
  }

  updateItem(sessionId: number, itemId: number, data: RoadmapItemUpdate): Observable<RoadmapItem> {
    return this.http.patch<RoadmapItem>(
      `${this.apiUrl}/sessions/${sessionId}/items/${itemId}`,
      data
    );
  }

  // =========================================================================
  // Segments
  // =========================================================================

  getSegments(sessionId: number): Observable<RoadmapItemSegment[]> {
    return this.http.get<RoadmapItemSegment[]>(`${this.apiUrl}/sessions/${sessionId}/segments`);
  }

  getItemSegments(sessionId: number, itemId: number): Observable<RoadmapItemSegment[]> {
    return this.http.get<RoadmapItemSegment[]>(
      `${this.apiUrl}/sessions/${sessionId}/items/${itemId}/segments`
    );
  }

  createSegment(sessionId: number, data: RoadmapSegmentCreate): Observable<RoadmapItemSegment> {
    return this.http.post<RoadmapItemSegment>(
      `${this.apiUrl}/sessions/${sessionId}/segments`,
      data
    );
  }

  updateSegment(
    sessionId: number,
    segmentId: number,
    data: RoadmapSegmentUpdate
  ): Observable<RoadmapItemSegment> {
    return this.http.patch<RoadmapItemSegment>(
      `${this.apiUrl}/sessions/${sessionId}/segments/${segmentId}`,
      data
    );
  }

  updateSegmentsBulk(
    sessionId: number,
    data: RoadmapSegmentBulkUpdate
  ): Observable<RoadmapItemSegment[]> {
    return this.http.put<RoadmapItemSegment[]>(
      `${this.apiUrl}/sessions/${sessionId}/segments/bulk`,
      data
    );
  }

  deleteSegment(sessionId: number, segmentId: number): Observable<{ status: string }> {
    return this.http.delete<{ status: string }>(
      `${this.apiUrl}/sessions/${sessionId}/segments/${segmentId}`
    );
  }

  regenerateItemSegments(sessionId: number, itemId: number): Observable<RoadmapItemSegment[]> {
    return this.http.post<RoadmapItemSegment[]>(
      `${this.apiUrl}/sessions/${sessionId}/items/${itemId}/regenerate-segments`,
      {}
    );
  }

  // =========================================================================
  // Dependencies
  // =========================================================================

  getDependencies(sessionId: number): Observable<RoadmapDependency[]> {
    return this.http.get<RoadmapDependency[]>(`${this.apiUrl}/sessions/${sessionId}/dependencies`);
  }

  createDependency(sessionId: number, data: RoadmapDependencyCreate): Observable<RoadmapDependency> {
    return this.http.post<RoadmapDependency>(
      `${this.apiUrl}/sessions/${sessionId}/dependencies`,
      data
    );
  }

  deleteDependency(sessionId: number, depId: number): Observable<{ status: string }> {
    return this.http.delete<{ status: string }>(
      `${this.apiUrl}/sessions/${sessionId}/dependencies/${depId}`
    );
  }

  getDependencyGraph(sessionId: number): Observable<DependencyGraph> {
    return this.http.get<DependencyGraph>(`${this.apiUrl}/sessions/${sessionId}/dependency-graph`);
  }

  fetchDependencyGraph(sessionId: number): void {
    this.getDependencyGraph(sessionId).subscribe({
      next: (graph) => this.dependencyGraph.set(graph),
      error: (err) => this.error.set(err.message),
    });
  }

  // =========================================================================
  // Themes
  // =========================================================================

  getThemes(sessionId: number): Observable<RoadmapTheme[]> {
    return this.http.get<RoadmapTheme[]>(`${this.apiUrl}/sessions/${sessionId}/themes`);
  }

  // =========================================================================
  // Milestones
  // =========================================================================

  getMilestones(sessionId: number): Observable<RoadmapMilestone[]> {
    return this.http.get<RoadmapMilestone[]>(`${this.apiUrl}/sessions/${sessionId}/milestones`);
  }

  createMilestone(sessionId: number, data: RoadmapMilestoneCreate): Observable<RoadmapMilestone> {
    return this.http.post<RoadmapMilestone>(
      `${this.apiUrl}/sessions/${sessionId}/milestones`,
      data
    );
  }

  updateMilestone(
    sessionId: number,
    milestoneId: number,
    data: RoadmapMilestoneUpdate
  ): Observable<RoadmapMilestone> {
    return this.http.patch<RoadmapMilestone>(
      `${this.apiUrl}/sessions/${sessionId}/milestones/${milestoneId}`,
      data
    );
  }

  deleteMilestone(sessionId: number, milestoneId: number): Observable<{ status: string }> {
    return this.http.delete<{ status: string }>(
      `${this.apiUrl}/sessions/${sessionId}/milestones/${milestoneId}`
    );
  }

  // =========================================================================
  // Sprints
  // =========================================================================

  getSprintSummaries(sessionId: number): Observable<SprintSummary[]> {
    return this.http.get<SprintSummary[]>(`${this.apiUrl}/sessions/${sessionId}/sprints`);
  }

  fetchSprintSummaries(sessionId: number): void {
    this.getSprintSummaries(sessionId).subscribe({
      next: (summaries) => this.sprintSummaries.set(summaries),
      error: (err) => this.error.set(err.message),
    });
  }

  // =========================================================================
  // Export
  // =========================================================================

  exportJson(sessionId: number): Observable<object> {
    return this.http.get<object>(`${this.apiUrl}/sessions/${sessionId}/export/json`);
  }

  getExportCsvUrl(sessionId: number): string {
    return `${this.apiUrl}/sessions/${sessionId}/export/csv`;
  }
}
