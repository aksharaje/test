import { Component, inject, ElementRef, ViewChild, AfterViewChecked, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AssistantService } from './assistant.service';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideMessageSquare, lucideX, lucideSend, lucideBot, lucideSearch, lucideSparkles, lucideHelpCircle, lucideArrowLeft } from '@ng-icons/lucide';
import { MarkdownModule } from 'ngx-markdown';

@Component({
    selector: 'app-assistant-widget',
    standalone: true,
    imports: [CommonModule, FormsModule, NgIconComponent, MarkdownModule],
    viewProviders: [provideIcons({ lucideMessageSquare, lucideX, lucideSend, lucideBot, lucideSearch, lucideSparkles, lucideHelpCircle, lucideArrowLeft })],
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
      <div class="h-14 border-b border-border flex items-center justify-center relative px-4 bg-primary text-primary-foreground rounded-t-xl shrink-0">
        <!-- Back Button (Left) -->
        <button 
            *ngIf="service.messages().length > 0"
            (click)="service.resetChat()" 
            class="absolute left-4 hover:bg-primary-foreground/20 p-1.5 rounded-md transition-colors text-primary-foreground/80 hover:text-primary-foreground"
            title="Back to Start"
        >
            <ng-icon name="lucideArrowLeft" class="h-5 w-5" />
        </button>

        <!-- Centered Title -->
        <div class="flex items-center gap-2 font-semibold select-none">
           <ng-icon name="lucideBot" class="h-5 w-5" />
           <span>Navigator</span>
        </div>

        <!-- Close Button (Right) -->
        <button 
            (click)="service.toggleChat()" 
            class="absolute right-4 hover:bg-primary-foreground/20 p-1 rounded-md transition-colors"
        >
            <ng-icon name="lucideX" class="h-5 w-5" />
        </button>
      </div>

      <!-- Messages Area -->
      <div class="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50" #scrollContainer (click)="onMessagesClick($event)">
        <!-- Welcome Message & Quick Actions -->
        <div *ngIf="service.messages().length === 0" class="flex flex-col items-center justify-center h-full text-center px-4 pb-8">
            <div class="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <ng-icon name="lucideBot" class="h-8 w-8 text-primary" />
            </div>
            <h3 class="font-semibold text-lg text-foreground mb-2">How can I help you?</h3>
            <p class="text-sm text-muted-foreground mb-6 leading-relaxed">
                I'm here to help you get work done. Ask me anything or choose a starting point below.
            </p>

            <div class="grid gap-2 w-full">
                <button (click)="sendQuery('Find my past work')" 
                        class="text-sm bg-white hover:bg-slate-100 border border-slate-200 rounded-lg p-3 text-left transition-colors flex items-center gap-3 group shadow-sm">
                    <div class="bg-blue-50 text-blue-600 p-2 rounded-md group-hover:bg-blue-100 transition-colors">
                        <ng-icon name="lucideSearch" class="h-4 w-4" />
                    </div>
                    <div>
                        <div class="font-medium text-foreground">Find past work</div>
                        <div class="text-xs text-muted-foreground">Search historical sessions</div>
                    </div>
                </button>

                <button (click)="sendQuery('What outputs can I create?')" 
                        class="text-sm bg-white hover:bg-slate-100 border border-slate-200 rounded-lg p-3 text-left transition-colors flex items-center gap-3 group shadow-sm">
                    <div class="bg-purple-50 text-purple-600 p-2 rounded-md group-hover:bg-purple-100 transition-colors">
                        <ng-icon name="lucideSparkles" class="h-4 w-4" />
                    </div>
                    <div>
                        <div class="font-medium text-foreground">What can I build?</div>
                        <div class="text-xs text-muted-foreground">Discover available flows</div>
                    </div>
                </button>

                <button (click)="sendQuery('Help me with the ' + getCurrentPageName() + ' page')" 
                        class="text-sm bg-white hover:bg-slate-100 border border-slate-200 rounded-lg p-3 text-left transition-colors flex items-center gap-3 group shadow-sm">
                    <div class="bg-emerald-50 text-emerald-600 p-2 rounded-md group-hover:bg-emerald-100 transition-colors">
                        <ng-icon name="lucideHelpCircle" class="h-4 w-4" />
                    </div>
                    <div>
                        <div class="font-medium text-foreground">Help with this page</div>
                        <div class="text-xs text-muted-foreground">Get docs & guidance</div>
                    </div>
                </button>
            </div>
        </div>

        <div *ngFor="let msg of service.messages()" 
             class="flex gap-3" 
             [class.justify-end]="msg.role === 'user'">
            
            <div *ngIf="msg.role === 'assistant'" class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                <ng-icon name="lucideBot" class="h-4 w-4 text-primary" />
            </div>

            <div class="max-w-[85%] rounded-lg px-4 py-2 text-sm shadow-sm overflow-hidden"
                 [ngClass]="msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-white border border-border text-foreground prose prose-sm max-w-none'">
                 <!-- Wrap markdown in overflow-x-auto for tables -->
                 <div class="overflow-x-auto">
                    <markdown [data]="msg.content"></markdown>
                 </div>
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
      <div class="p-4 border-t border-border bg-background rounded-b-xl shrink-0">
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

    sendQuery(query: string) {
        this.service.sendMessage(query);
    }

    getCurrentPageName(): string {
        const url = this.router.url.split('/')[1]; // Get first segment
        if (!url) return 'home';
        // Convert kebab-case to Title Case
        return url
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
}
