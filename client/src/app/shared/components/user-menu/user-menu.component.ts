import { Component, ElementRef, HostListener, input, output, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideUser,
  lucideSettings,
  lucideLogOut,
  lucideChevronUp,
  lucideMoreHorizontal,
} from '@ng-icons/lucide';
import { HlmAvatarComponent } from '../../../ui/avatar';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

@Component({
  selector: 'app-user-menu',
  standalone: true,
  imports: [NgIcon, HlmAvatarComponent],
  viewProviders: [
    provideIcons({ lucideUser, lucideSettings, lucideLogOut, lucideChevronUp, lucideMoreHorizontal }),
  ],
  template: `
    <div class="relative" #menuContainer>
      <button
        (click)="toggleMenu()"
        class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-sidebar-accent"
        [attr.aria-expanded]="isOpen()"
        aria-haspopup="true"
      >
        <hlm-avatar size="sm" [src]="user().avatarUrl ?? null" [fallback]="user().name" />
        <div class="flex flex-1 flex-col overflow-hidden">
          <span class="truncate text-sm font-medium text-sidebar-foreground">
            {{ user().name }}
          </span>
          <span class="truncate text-xs text-muted-foreground">
            {{ user().email }}
          </span>
        </div>
        <ng-icon
          name="lucideMoreHorizontal"
          class="h-4 w-4 text-muted-foreground transition-transform duration-200"
          [class.rotate-90]="isOpen()"
        />
      </button>

      @if (isOpen()) {
        <div
          class="absolute bottom-full left-0 mb-2 w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2"
          role="menu"
        >
          <div class="px-2 py-1.5">
            <p class="text-sm font-medium">{{ user().name }}</p>
            <p class="text-xs text-muted-foreground">{{ user().email }}</p>
          </div>
          <div class="-mx-1 my-1 h-px bg-muted"></div>
          <button
            (click)="handleProfile()"
            role="menuitem"
            class="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
          >
            <ng-icon name="lucideUser" class="h-4 w-4" />
            Profile
          </button>
          <button
            (click)="handleSettings()"
            role="menuitem"
            class="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
          >
            <ng-icon name="lucideSettings" class="h-4 w-4" />
            Settings
          </button>
          <div class="-mx-1 my-1 h-px bg-muted"></div>
          <button
            (click)="handleLogout()"
            role="menuitem"
            class="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive outline-none transition-colors hover:bg-destructive/10 focus:bg-destructive/10"
          >
            <ng-icon name="lucideLogOut" class="h-4 w-4" />
            Log out
          </button>
        </div>
      }
    </div>
  `,
})
export class UserMenuComponent {
  user = input.required<User>();

  onProfile = output<void>();
  onSettings = output<void>();
  onLogout = output<void>();

  protected isOpen = signal(false);
  private menuContainer = viewChild<ElementRef>('menuContainer');

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const container = this.menuContainer()?.nativeElement;
    if (container && !container.contains(event.target as Node)) {
      this.isOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscapePress(): void {
    this.isOpen.set(false);
  }

  protected toggleMenu(): void {
    this.isOpen.update((v) => !v);
  }

  protected handleProfile(): void {
    this.isOpen.set(false);
    this.onProfile.emit();
  }

  protected handleSettings(): void {
    this.isOpen.set(false);
    this.onSettings.emit();
  }

  protected handleLogout(): void {
    this.isOpen.set(false);
    this.onLogout.emit();
  }
}
