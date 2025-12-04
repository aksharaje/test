import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  AuthenticatedLayoutComponent,
  type NavItem,
} from '../../shared/layouts/authenticated-layout';
import type { User } from '../../shared/components/user-menu';

@Component({
  selector: 'app-authenticated-shell',
  standalone: true,
  imports: [AuthenticatedLayoutComponent],
  template: `
    <app-authenticated-layout
      [user]="currentUser()"
      [navItems]="navItems"
      brandName="My App"
      (onProfile)="handleProfile()"
      (onSettings)="handleSettings()"
      (onLogout)="handleLogout()"
    />
  `,
})
export class AuthenticatedShellComponent {
  private router = inject(Router);

  // In a real app, this would come from an auth service
  currentUser = signal<User>({
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    avatarUrl: undefined,
  });

  navItems: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard', icon: 'lucideHome' },
    {
      label: 'Ideate',
      path: '/ideate',
      icon: 'lucideLightbulb',
      children: [
        { label: 'Code Chat', path: '/code-chat' },
      ],
    },
    {
      label: 'Design',
      path: '/design',
      icon: 'lucidePalette',
      children: [
        { label: 'PRD Generator', path: '/prd-generator' },
        { label: 'Epic/Feature/Story Creator', path: '/story-generator' },
      ],
    },
    {
      label: 'Plan',
      path: '/plan',
      icon: 'lucideCalendarDays',
      children: [
        { label: 'PI Planning', path: '/pi-planning' },
      ],
    },
    {
      label: 'Deliver',
      path: '/deliver',
      icon: 'lucideRocket',
      children: [],
    },
    {
      label: 'Optimize',
      path: '/optimize-section',
      icon: 'lucideFlaskConical',
      children: [
        { label: 'Agent Optimization', path: '/optimize' },
      ],
    },
    { label: 'Knowledge Bases', path: '/knowledge-bases', icon: 'lucideBookOpen' },
    {
      label: 'Settings',
      path: '/settings',
      icon: 'lucideSettings',
      children: [
        { label: 'Integrations', path: '/settings/integrations' },
      ],
    },
  ];

  handleProfile(): void {
    this.router.navigate(['/profile']);
  }

  handleSettings(): void {
    this.router.navigate(['/settings/integrations']);
  }

  handleLogout(): void {
    // In a real app, this would call an auth service to log out
    console.log('Logging out...');
    this.router.navigate(['/login']);
  }
}
