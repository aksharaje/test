import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AiModelConfig {
    model: string;
}

@Injectable({
    providedIn: 'root'
})
export class AiSettingsService {
    private http = inject(HttpClient);
    private apiUrl = '/api/settings/ai-model';

    getActiveModel(): Observable<AiModelConfig> {
        return this.http.get<AiModelConfig>(this.apiUrl);
    }

    updateActiveModel(model: string): Observable<AiModelConfig> {
        return this.http.put<AiModelConfig>(this.apiUrl, { model });
    }
}
