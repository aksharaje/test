import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

@Injectable({
    providedIn: 'root'
})
export class AssistantService {
    private http = inject(HttpClient);
    private apiUrl = '/api/assistant';

    messages = signal<ChatMessage[]>([]);
    isLoading = signal<boolean>(false);
    isOpen = signal<boolean>(false);

    toggleChat() {
        this.isOpen.update(v => !v);
    }

    sendMessage(content: string) {
        if (!content.trim()) return;

        // Add user message immediately
        const userMsg: ChatMessage = { role: 'user', content };
        this.messages.update(msgs => [...msgs, userMsg]);
        this.isLoading.set(true);

        // Prepare history (last 10 messages max)
        const history = this.messages()
            .slice(0, -1) // Exclude the just added one (redundant if we pass it, but better to keep history purely past)
            .slice(-10);

        this.http.post<ChatMessage>(`${this.apiUrl}/chat`, {
            message: content,
            history
        }).subscribe({
            next: (response) => {
                this.messages.update(msgs => [...msgs, response]);
                this.isLoading.set(false);
            },
            error: (err) => {
                console.error('Chat error', err);
                const detail = err.error?.detail || err.statusText || 'Unknown error';
                this.messages.update(msgs => [...msgs, {
                    role: 'assistant',
                    content: `Sorry, I encountered an error (${detail}). Please try again.`
                }]);
                this.isLoading.set(false);
            }
        });
    }
}
