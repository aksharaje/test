import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface LibraryBook {
    id: number;
    knowledgeBaseId: number;
    title: string;
    description: string | null;
    status: 'generating' | 'ready' | 'error';
    error: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface LibraryPage {
    id: number;
    bookId: number;
    parentId: number | null;
    title: string;
    content: string;
    order: number;
    type: 'content' | 'integration_index' | 'integration_detail';
    createdAt: string;
    updatedAt: string;
    children?: LibraryPage[];
}

@Injectable({
    providedIn: 'root',
})
export class LibraryService {
    private http = inject(HttpClient);
    private apiUrl = '/api/library';

    listBooks(): Observable<LibraryBook[]> {
        return this.http.get<LibraryBook[]>(`${this.apiUrl}/books`);
    }

    createBook(knowledgeBaseId: number): Observable<LibraryBook> {
        return this.http.post<LibraryBook>(`${this.apiUrl}/books`, { knowledgeBaseId });
    }

    getBook(id: number): Observable<LibraryBook> {
        return this.http.get<LibraryBook>(`${this.apiUrl}/books/${id}`);
    }

    getBookPages(id: number): Observable<LibraryPage[]> {
        return this.http.get<LibraryPage[]>(`${this.apiUrl}/books/${id}/pages`);
    }

    getPage(id: number): Observable<LibraryPage> {
        return this.http.get<LibraryPage>(`${this.apiUrl}/pages/${id}`);
    }

    deleteBook(id: number): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/books/${id}`);
    }
}
