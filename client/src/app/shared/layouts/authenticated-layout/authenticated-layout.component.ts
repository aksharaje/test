import { Component, input, output, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideHome,
  lucideMenu,
  lucideX,
  lucideChevronDown,
  lucidePalette,
  lucideBookOpen,
  lucideLayoutList,
  lucideMessageSquareCode,
  lucideLightbulb,
  lucideFlaskConical,
  lucideActivity,
  lucideFileText,
} from '@ng-icons/lucide';
import { UserMenuComponent, type User } from '../../components/user-menu';

export interface NavItem {
  label: string;
  path: string;
  icon: string;
  children?: NavItem[];
}

@Component({
  selector: 'app-authenticated-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    NgIcon,
    UserMenuComponent,
  ],
  viewProviders: [
    provideIcons({
      lucideHome,
      lucideMenu,
      lucideX,
      lucideChevronDown,
      lucidePalette,
      lucideBookOpen,
      lucideLayoutList,
      lucideMessageSquareCode,
      lucideLightbulb,
      lucideFlaskConical,
      lucideActivity,
      lucideFileText,
    }),
  ],
  template: `
    <!-- Mobile menu button -->
    <button
      (click)="toggleMobileSidebar()"
      class="fixed left-4 top-4 z-50 rounded-md p-2 lg:hidden hover:bg-accent"
    >
      <ng-icon [name]="isMobileOpen() ? 'lucideX' : 'lucideMenu'" class="h-6 w-6" />
    </button>

    <!-- Backdrop for mobile -->
    @if (isMobileOpen()) {
      <div
        (click)="closeMobileSidebar()"
        class="fixed inset-0 z-40 bg-black/50 lg:hidden"
      ></div>
    }

    <!-- Sidebar -->
    <aside
      [class]="getSidebarClasses()"
    >
      <div class="flex h-full flex-col">
        <!-- Logo/Brand area -->
        <div class="flex h-16 items-center border-b border-sidebar-border px-4">
          <img
            src="logo.png"
            alt="Moodys NWC"
            class="h-14 w-auto"
          />
        </div>

        <!-- Navigation -->
        <nav class="flex-1 space-y-1 overflow-y-auto p-4">
          @for (item of navItems(); track item.path) {
            @if (item.children && item.children.length > 0) {
              <!-- Expandable nav item -->
              <div>
                <button
                  (click)="toggleExpanded(item.path)"
                  class="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <div class="flex items-center gap-3">
                    <ng-icon [name]="item.icon" class="h-5 w-5" />
                    {{ item.label }}
                  </div>
                  <ng-icon
                    name="lucideChevronDown"
                    class="h-4 w-4 transition-transform duration-200"
                    [class.rotate-180]="isExpanded(item.path)"
                  />
                </button>
                @if (isExpanded(item.path)) {
                  <div class="ml-4 mt-1 space-y-1 border-l border-sidebar-border pl-4">
                    @for (child of item.children; track child.path) {
                      <a
                        [routerLink]="child.path"
                        routerLinkActive="bg-sidebar-accent text-sidebar-accent-foreground"
                        class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        (click)="closeMobileSidebar()"
                      >
                        <ng-icon [name]="child.icon" class="h-4 w-4" />
                        {{ child.label }}
                      </a>
                    }
                  </div>
                }
              </div>
            } @else {
              <!-- Regular nav item -->
              <a
                [routerLink]="item.path"
                routerLinkActive="bg-sidebar-accent text-sidebar-accent-foreground"
                [routerLinkActiveOptions]="{ exact: item.path === '/' }"
                class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                (click)="closeMobileSidebar()"
              >
                <ng-icon [name]="item.icon" class="h-5 w-5" />
                {{ item.label }}
              </a>
            }
          }
        </nav>

        <!-- User menu at bottom -->
        <div class="border-t border-sidebar-border p-4">
          <app-user-menu
            [user]="user()"
            (onProfile)="onProfile.emit()"
            (onSettings)="onSettings.emit()"
            (onLogout)="onLogout.emit()"
          />
        </div>
      </div>
    </aside>

    <!-- Main content -->
    <main class="lg:pl-64">
      <div class="min-h-screen">
        <router-outlet />
      </div>
    </main>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class AuthenticatedLayoutComponent {
  brandName = input<string>('App');
  user = input.required<User>();
  navItems = input<NavItem[]>([
    { label: 'Dashboard', path: '/dashboard', icon: 'lucideHome' },
    {
      label: 'Design',
      path: '/design',
      icon: 'lucidePalette',
      children: [
        { label: 'Epic/Feature/Story Creator', path: '/story-generator', icon: 'lucideLayoutList' },
      ],
    },
    { label: 'Code Chat', path: '/code-chat', icon: 'lucideMessageSquareCode' },
    { label: 'Knowledge Bases', path: '/knowledge-bases', icon: 'lucideBookOpen' },
  ]);

  onProfile = output<void>();
  onSettings = output<void>();
  onLogout = output<void>();

  protected isMobileOpen = signal(false);
  protected expandedItems = signal<Set<string>>(new Set());

  protected toggleMobileSidebar(): void {
    this.isMobileOpen.update((v) => !v);
  }

  protected closeMobileSidebar(): void {
    this.isMobileOpen.set(false);
  }

  protected toggleExpanded(path: string): void {
    this.expandedItems.update((set) => {
      const newSet = new Set(set);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  }

  protected isExpanded(path: string): boolean {
    return this.expandedItems().has(path);
  }

  protected getSidebarClasses(): string {
    const baseClasses =
      'fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border transform transition-transform duration-300 ease-in-out';
    const mobileClasses = this.isMobileOpen()
      ? 'translate-x-0'
      : '-translate-x-full lg:translate-x-0';
    return `${baseClasses} ${mobileClasses}`;
  }
}
