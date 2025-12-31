import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface DashboardStats {
    counts: {
        prd: number;
        feasibility: number;
        ideation: number;
        business_case: number;
        journey_mapper: number;
        research_planner: number;
        release_prep: number;
        roadmap_planner: number;
        story_to_code: number;
        competitive_analysis: number;
        scope_definition: number;
        scope_monitor: number;
        measurement_framework: number;
        kpi_assignment: number;
        okr_generator: number;
        goal_setting: number;
        scenario_modeler: number;
        gap_analyzer: number;
        cx_recommender: number;
        roadmap_communicator: number;
        total: number;
    };
    roi: {
        hoursReclaimed: number;
        velocityMultiplier: number;
        strategicFocus: number;
    };
    gamification?: {
        level: number;
        totalXp: number;
        nextLevelXp: number;
        progressXp: number;
        masteryScore: number;
        streakWeeks: number;
        badges: {
            strategy: boolean;
            research: boolean;
            execution: boolean;
        };
    };
    timeframe: '30d' | 'all';
}

export interface ReportItem {
    id: number;
    title: string;
    date: string;
    type: string;
}

export interface ReportGroup {
    id: string;
    label: string;
    hours_per_unit: number;
    total_hours: number;
    count: number;
    items: ReportItem[];
}

export interface DashboardReport {
    groups: ReportGroup[];
    total_hours: number;
    total_count: number;
}

@Injectable({
    providedIn: 'root'
})
export class DashboardService {
    private http = inject(HttpClient);
    // private apiUrl = `${environment.apiUrl}/dashboard`; 
    // Prototype environment often lacks environment.apiUrl config or uses /api proxy
    private apiUrl = '/api/dashboard';

    getStats(timeframe: '30d' | 'all' = '30d'): Observable<DashboardStats> {
        const params = new HttpParams().set('timeframe', timeframe);
        return this.http.get<DashboardStats>(`${this.apiUrl}/stats`, { params });
    }

    getReport(timeframe: '30d' | 'all', type: 'productivity' | 'velocity'): Observable<DashboardReport> {
        const params = new HttpParams()
            .set('timeframe', timeframe)
            .set('report_type', type);
        return this.http.get<DashboardReport>(`${this.apiUrl}/report`, { params });
    }
}
