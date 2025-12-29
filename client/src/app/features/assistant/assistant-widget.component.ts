import { Component, inject, ElementRef, ViewChild, AfterViewChecked, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AssistantService } from './assistant.service';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideMessageSquare, lucideX, lucideSend, lucideBot } from '@ng-icons/lucide';
import { MarkdownModule } from 'ngx-markdown';

@Component({
    selector: 'app-assistant-widget',
    standalone: true,
    imports: [CommonModule, FormsModule, NgIconComponent, MarkdownModule],
    viewProviders: [provideIcons({ lucideMessageSquare, lucideX, lucideSend, lucideBot })],
    template: `
    <!-- Floating Toggle Button -->
    <button 
      (click)="service.toggleChat()"
      class="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 flex items-center justify-center transition-transform hover:scale-105 z-50"
      [class.hidden]="service.isOpen()"
    >
      <ng-icon name="lucideBot" class="h-8 w-8" />
    </button>

    <!-- Chat Window -->
    <div 
      *ngIf="service.isOpen()"
      class="fixed bottom-6 right-6 w-96 h-[600px] max-h-[80vh] bg-background border border-border rounded-xl shadow-2xl flex flex-col z-50 animate-in fade-in slide-in-from-bottom-10 duration-200"
    >
      <!-- Header -->
      <div class="h-14 border-b border-border flex items-center justify-between px-4 bg-primary text-primary-foreground rounded-t-xl">
        <div class="flex items-center gap-2 font-semibold">
           <ng-icon name="lucideBot" class="h-5 w-5" />
           <span>Navigator</span>
        </div>
        <button (click)="service.toggleChat()" class="hover:bg-primary-foreground/20 p-1 rounded-md transition-colors">
            <ng-icon name="lucideX" class="h-5 w-5" />
        </button>
      </div>

      <!-- Messages Area -->
      <div class="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50" #scrollContainer (click)="onMessagesClick($event)">
        <!-- Welcome Message -->
        <div *ngIf="service.messages().length === 0" class="text-center py-8 text-muted-foreground text-sm">
            <div class="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <ng-icon name="lucideBot" class="h-8 w-8 text-primary" />
            </div>
            <p>Hi! I'm Navigator.</p>
            <p class="mt-2">Ask me how to creating something (e.g. "Create a PRD") or to find your old work (e.g. "Find my login story").</p>
        </div>

        <div *ngFor="let msg of service.messages()" 
             class="flex gap-3" 
             [class.justify-end]="msg.role === 'user'">
            
            <div *ngIf="msg.role === 'assistant'" class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                <ng-icon name="lucideBot" class="h-4 w-4 text-primary" />
            </div>

            <div class="max-w-[80%] rounded-lg px-4 py-2 text-sm shadow-sm"
                 [ngClass]="msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-white border border-border text-foreground'">
                 <markdown [data]="msg.content"></markdown>
            </div>
        </div>

        <div *ngIf="service.isLoading()" class="flex gap-3">
             <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                <ng-icon name="lucideBot" class="h-4 w-4 text-primary" />
            </div>
            <div class="bg-white border border-border rounded-lg px-4 py-3 shadow-sm">
                <div class="flex gap-1">
                    <div class="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                    <div class="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    <div class="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
            </div>
        </div>
      </div>

      <!-- Input Area -->
      <div class="p-4 border-t border-border bg-background rounded-b-xl">
        <div class="flex gap-2">
            <input 
                [(ngModel)]="inputMessage" 
                (keyup.enter)="send()"
                type="text" 
                class="flex-1 h-10 rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Type a message..."
                [disabled]="service.isLoading()"
            />
            <button 
                (click)="send()"
                [disabled]="!inputMessage.trim() || service.isLoading()"
                class="h-10 w-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-50"
            >
                <ng-icon name="lucideSend" class="h-4 w-4" />
            </button>
        </div>
      </div>
    </div>
  `
})
export class AssistantWidgetComponent implements AfterViewChecked {
    service = inject(AssistantService);
    private router = inject(Router);
    inputMessage = '';

    @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

    ngAfterViewChecked() {
        this.scrollToBottom();
    }

    scrollToBottom(): void {
        if (this.scrollContainer) {
            try {
                this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
            } catch (err) { }
        }
    }

    onMessagesClick(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        const anchor = target.closest('a');

        if (anchor) {
            const href = anchor.getAttribute('href');
            // Handle internal links (starting with /)
            if (href && href.startsWith('/')) {
                event.preventDefault();
                this.router.navigateByUrl(href);
                this.service.toggleChat(); // Close chat after navigation
            }
        }
    }

    send() {
        if (this.inputMessage.trim()) {
            this.service.sendMessage(this.inputMessage);
            this.inputMessage = '';
        }
    }
}
