import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  AuthenticatedLayoutComponent,
  type NavItem,
} from '../../shared/layouts/authenticated-layout';
import type { User } from '../../shared/components/user-menu';
import { AssistantWidgetComponent } from '../assistant/assistant-widget.component';

@Component({
  selector: 'app-authenticated-shell',
  standalone: true,
  imports: [AuthenticatedLayoutComponent, AssistantWidgetComponent],
  template: `
    <app-authenticated-layout
      [user]="currentUser()"
      [navItems]="navItems"
      [bottomNavItems]="bottomNavItems"
      brandName="My App"
      (onProfile)="handleProfile()"
      (onSettings)="handleSettings()"
      (onLogout)="handleLogout()"
    />
    <app-assistant-widget />
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
    {
      label: 'Feasibility',
      path: '/feasibility-section',
      children: [
        { label: 'Feasibility Analyzer', path: '/feasibility' },
        { label: 'Business Case Builder', path: '/business-case' },
      ],
    },
    {
      label: 'Roadmapping',
      path: '/roadmapping',
      children: [
        { label: 'Roadmap Planner', path: '/roadmapping/planner' },
        { label: 'Scenario Modeler', path: '/roadmapping/scenario-modeler' },
        { label: 'Roadmap Communicator', path: '/roadmapping/communicator' },
      ],
    },
    {
      label: 'Customer Experience',
      path: '/customer-experience-section',
      children: [
        { label: 'Research Planner', path: '/research-planner' },
        { label: 'Journey Mapper', path: '/journey-mapper' },
        { label: 'Gap Analyzer', path: '/gap-analyzer' },
        { label: 'CX Recommender', path: '/cx-recommender' },
      ],
    },
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
    {
      label: 'Development',
      path: '/development-section',
      children: [
        { label: 'Story to Code', path: '/story-to-code' },
        { label: 'Release Prep', path: '/release-prep' },
      ],
    },
    { label: 'Testing', path: '/testing', children: [] },
    { label: 'Stakeholder Mgmt', path: '/stakeholder-mgmt', children: [] },
  ];

  bottomNavItems: NavItem[] = [
    {
      label: 'Resources',
      path: '/resources-section',
      icon: 'lucideLayers',
      children: [
        { label: 'Knowledge Bases', path: '/knowledge-bases' },
        { label: 'Library', path: '/library' },
        { label: 'Optimize', path: '/optimize' },
        { label: 'Docs', path: '/docs', external: true },
      ],
    },
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
