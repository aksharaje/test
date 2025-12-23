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
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Goals', path: '/goals', children: [] },
    { label: 'Measurements', path: '/measurements', children: [] },
    { label: 'Scoping', path: '/scoping', children: [] },
    {
      label: 'Research',
      path: '/research',
      children: [
        { label: 'Code Chat', path: '/code-chat' },
      ],
    },
    {
      label: 'Ideation',
      path: '/ideation-section',
      children: [
        { label: 'Brainstormer', path: '#' },
        { label: 'Ideation Engine', path: '/ideation' },
      ],
    },
    { label: 'Feasibility', path: '/feasibility', children: [] },
    { label: 'Roadmapping', path: '/roadmapping', children: [] },
    { label: 'Customer Experience', path: '/customer-experience', children: [] },
    {
      label: 'Backlog Authoring',
      path: '/backlog-authoring',
      children: [
        { label: 'PRD Generator', path: '/prd-generator' },
        { label: 'Epic Creator', path: '/epic-creator' },
        { label: 'Feature Creator', path: '/feature-creator' },
        { label: 'User Story Creator', path: '/user-story-creator' },
      ],
    },
    {
      label: 'PI Planning',
      path: '/pi-planning-section',
      children: [
        { label: 'PI Planning', path: '/pi-planning' },
      ],
    },
    { label: 'Sprint Planning', path: '/sprint-planning', children: [] },
    { label: 'Development', path: '/development', children: [] },
    { label: 'Testing', path: '/testing', children: [] },
    { label: 'Stakeholder Mgmt', path: '/stakeholder-mgmt', children: [] },
    {
      label: 'Optimize',
      path: '/optimize-section',
      children: [
        { label: 'Agent Optimization', path: '/optimize' },
      ],
    },
    { label: 'Knowledge Bases', path: '/knowledge-bases' },
    { label: 'Library', path: '/library' },
    {
      label: 'Settings',
      path: '/settings',
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
