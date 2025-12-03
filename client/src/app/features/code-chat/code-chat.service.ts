import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  CodeChatSession,
  CodeChatMessage,
  KnowledgeBaseInfo,
  SessionWithMessages,
  SendMessageResponse,
} from './code-chat.types';

@Injectable({
  providedIn: 'root',
})
export class CodeChatService {
  private http = inject(HttpClient);
  private baseUrl = '/api/code-chat';

  // State
  private _sessions = signal<CodeChatSession[]>([]);
  private _currentSession = signal<CodeChatSession | null>(null);
  private _messages = signal<CodeChatMessage[]>([]);
  private _knowledgeBases = signal<KnowledgeBaseInfo[]>([]);
  private _selectedKbIds = signal<number[]>([]);
  private _loading = signal(false);
  private _sending = signal(false);
  private _error = signal<string | null>(null);

  // Readonly accessors
  readonly sessions = this._sessions.asReadonly();
  readonly currentSession = this._currentSession.asReadonly();
  readonly messages = this._messages.asReadonly();
  readonly knowledgeBases = this._knowledgeBases.asReadonly();
  readonly selectedKbIds = this._selectedKbIds.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly sending = this._sending.asReadonly();
  readonly error = this._error.asReadonly();

  // Computed
  readonly hasSessions = computed(() => this._sessions().length > 0);
  readonly hasSelectedKbs = computed(() => this._selectedKbIds().length > 0);
  readonly selectedKnowledgeBases = computed(() =>
    this._knowledgeBases().filter((kb) => this._selectedKbIds().includes(kb.id))
  );

  // Load available code knowledge bases
  async loadKnowledgeBases(): Promise<void> {
    try {
      const kbs = await firstValueFrom(
        this.http.get<KnowledgeBaseInfo[]>(`${this.baseUrl}/knowledge-bases`)
      );
      this._knowledgeBases.set(kbs);
    } catch (err) {
      console.error('Failed to load knowledge bases:', err);
      this._error.set('Failed to load knowledge bases');
    }
  }

  // Toggle knowledge base selection
  toggleKnowledgeBase(id: number): void {
    this._selectedKbIds.update((ids) => {
      if (ids.includes(id)) {
        return ids.filter((i) => i !== id);
      } else {
        return [...ids, id];
      }
    });
  }

  // Set selected knowledge bases
  setSelectedKnowledgeBases(ids: number[]): void {
    this._selectedKbIds.set(ids);
  }

  // Load all sessions
  async loadSessions(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const sessions = await firstValueFrom(
        this.http.get<CodeChatSession[]>(`${this.baseUrl}/sessions`)
      );
      this._sessions.set(sessions);
    } catch (err) {
      this._error.set('Failed to load chat sessions');
      console.error(err);
    } finally {
      this._loading.set(false);
    }
  }

  // Create a new session
  async createSession(knowledgeBaseIds?: number[]): Promise<CodeChatSession | null> {
    const kbIds = knowledgeBaseIds || this._selectedKbIds();

    if (kbIds.length === 0) {
      this._error.set('Please select at least one knowledge base');
      return null;
    }

    this._loading.set(true);
    this._error.set(null);

    try {
      const session = await firstValueFrom(
        this.http.post<CodeChatSession>(`${this.baseUrl}/sessions`, {
          knowledgeBaseIds: kbIds,
        })
      );

      this._sessions.update((arr) => [session, ...arr]);
      this._currentSession.set(session);
      this._messages.set([]);
      this._selectedKbIds.set(kbIds);
      return session;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create chat session';
      this._error.set(message);
      console.error(err);
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  // Load a session with messages
  async loadSession(sessionId: number): Promise<SessionWithMessages | null> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.get<SessionWithMessages>(`${this.baseUrl}/sessions/${sessionId}`)
      );

      this._currentSession.set(result.session);
      this._messages.set(result.messages);
      this._selectedKbIds.set(result.session.knowledgeBaseIds);
      return result;
    } catch (err) {
      this._error.set('Failed to load chat session');
      console.error(err);
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  // Delete a session
  async deleteSession(sessionId: number): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.delete(`${this.baseUrl}/sessions/${sessionId}`)
      );

      this._sessions.update((arr) => arr.filter((s) => s.id !== sessionId));
      if (this._currentSession()?.id === sessionId) {
        this._currentSession.set(null);
        this._messages.set([]);
      }
      return true;
    } catch (err) {
      this._error.set('Failed to delete session');
      console.error(err);
      return false;
    }
  }

  // Send a message
  async sendMessage(content: string): Promise<SendMessageResponse | null> {
    const session = this._currentSession();
    if (!session) {
      this._error.set('No active chat session');
      return null;
    }

    if (!content.trim()) {
      this._error.set('Message cannot be empty');
      return null;
    }

    this._sending.set(true);
    this._error.set(null);

    // Optimistically add user message
    const tempUserMsg: CodeChatMessage = {
      id: -1,
      sessionId: session.id,
      role: 'user',
      content: content.trim(),
      citations: [],
      metadata: null,
      createdAt: new Date().toISOString(),
    };
    this._messages.update((arr) => [...arr, tempUserMsg]);

    try {
      const response = await firstValueFrom(
        this.http.post<SendMessageResponse>(
          `${this.baseUrl}/sessions/${session.id}/messages`,
          { content: content.trim() }
        )
      );

      // Replace temp message with actual messages
      this._messages.update((arr) => {
        const filtered = arr.filter((m) => m.id !== -1);
        return [...filtered, response.userMsg, response.assistantMsg];
      });

      // Update session in list
      this._sessions.update((arr) =>
        arr.map((s) =>
          s.id === session.id
            ? { ...s, title: response.userMsg.content.substring(0, 50), updatedAt: new Date().toISOString() }
            : s
        )
      );

      return response;
    } catch (err) {
      // Remove optimistic message on error
      this._messages.update((arr) => arr.filter((m) => m.id !== -1));

      const message = err instanceof Error ? err.message : 'Failed to send message';
      this._error.set(message);
      console.error(err);
      return null;
    } finally {
      this._sending.set(false);
    }
  }

  // Clear current session
  clearCurrentSession(): void {
    this._currentSession.set(null);
    this._messages.set([]);
  }

  // Clear error
  clearError(): void {
    this._error.set(null);
  }
}
