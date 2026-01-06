import { Component, inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import {
  AuthenticatedLayoutComponent,
  type NavItem,
} from '../../shared/layouts/authenticated-layout';
import type { User } from '../../shared/components/user-menu';
import { AssistantWidgetComponent } from '../assistant/assistant-widget.component';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-authenticated-shell',
  standalone: true,
  imports: [AuthenticatedLayoutComponent, AssistantWidgetComponent],
  template: `
    <app-authenticated-layout
      [user]="currentUser()"
      [navItems]="navItems"
      [bottomNavItems]="bottomNavItems()"
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
  private authService = inject(AuthService);

  // Get user from AuthService
  currentUser = computed<User>(() => {
    const authUser = this.authService.currentUser();
    if (authUser) {
      return {
        id: String(authUser.id),
        name: authUser.full_name || authUser.email.split('@')[0],
        email: authUser.email,
        avatarUrl: undefined,
      };
    }
    // Fallback for when user isn't loaded yet
    return {
      id: '0',
      name: 'Loading...',
      email: '',
      avatarUrl: undefined,
    };
  });

  navItems: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard' },
    {
      label: 'Goals',
      path: '/goals',
      children: [
        { label: 'Goal Setting Assistant', path: '/goals/setting' },
      ],
    },
    {
      label: 'Measurements',
      path: '/measurements',
      children: [
        { label: 'OKR Generator', path: '/measurements/okr-generator' },
        { label: 'KPI Assignment', path: '/measurements/kpi-assignment' },
        { label: 'Measurement Framework', path: '/measurements/framework' },
      ],
    },
    {
      label: 'Scoping',
      path: '/scoping',
      children: [
        { label: 'Scope Definition', path: '/scoping/definition' },
        { label: 'Scope Monitor', path: '/scoping/monitor' },
      ],
    },
    {
      label: 'Research',
      path: '/research',
      children: [
        { label: 'Competitive Analysis', path: '/research/competitive-analysis' },
        { label: 'Market Research', path: '/research/market-research' },
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
        { label: 'Progress Tracker', path: '/progress-tracker' },
        { label: 'Release Prep', path: '/release-prep' },
      ],
    },
    {
      label: 'Testing',
      path: '/testing',
      children: [
        { label: 'Defect Manager', path: '/testing/defect-manager' },
        { label: 'Release Readiness', path: '/testing/release-readiness' },
      ],
    },
    { label: 'Stakeholder Mgmt', path: '/stakeholder-mgmt', children: [] },
  ];

  bottomNavItems = computed<NavItem[]>(() => {
    const user = this.authService.currentUser();
    const isAdmin = user?.role === 'admin';

    return [
      {
        label: 'Resources',
        path: '/resources-section',
        icon: 'lucideLayers',
        children: [
          { label: 'Knowledge Bases', path: '/knowledge-bases' },
          { label: 'Library', path: '/library' },
          { label: 'Optimize', path: '/optimize' },
          { label: 'Code Chat', path: '/code-chat' },
        ],
      },
      {
        label: 'Settings',
        path: '/settings',
        icon: 'lucideSettings',
        children: [
          { label: 'Integrations', path: '/settings/integrations' },
          ...(isAdmin ? [
            { label: 'Team', path: '/settings/team' },
            { label: 'AI Models', path: '/settings/ai' }
          ] : []),
        ],
      },
    ];
  });

  handleProfile(): void {
    this.router.navigate(['/profile']);
  }

  handleSettings(): void {
    this.router.navigate(['/settings/integrations']);
  }

  handleLogout(): void {
    this.authService.logout();
  }
}

