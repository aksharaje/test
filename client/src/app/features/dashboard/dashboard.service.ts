import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface DashboardStats {
    counts: {
        prd: number;
        feasibility: number;
        ideation: number;
        total: number;
    };
    roi: {
        hoursReclaimed: number;
        velocityMultiplier: number;
        strategicFocus: number;
    };
    timeframe: '30d' | 'all';
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
}
