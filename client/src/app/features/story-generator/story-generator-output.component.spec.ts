import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StoryGeneratorOutputComponent } from './story-generator-output.component';
import { StoryGeneratorService } from './story-generator.service';
import type { GeneratedArtifact, StructuredContent } from './story-generator.types';

// Mock structured content for testing
const mockEpicContent: StructuredContent = {
  type: 'epic',
  epic: {
    title: 'User Authentication System',
    vision: 'Create a secure authentication system',
    goals: ['Improve security', 'Enhance UX'],
    successMetrics: ['99.9% uptime'],
    risksAndDependencies: 'OAuth provider dependency',
    features: [
      {
        title: 'Login Feature',
        purpose: 'Allow users to authenticate',
        summary: 'Email/password login',
        businessValue: 'Core functionality',
        functionalRequirements: 'Email validation',
        nonFunctionalRequirements: 'WCAG compliance',
        dependencies: 'Auth API',
        assumptions: 'Valid emails',
        acceptanceCriteria: [
          {
            scenario: 'Successful login',
            given: 'Valid credentials',
            when: 'User submits form',
            then: 'User is redirected',
          },
        ],
        stories: [
          {
            title: 'Email Login',
            userStory: 'AS a user I WANT to login SO THAT I can access my account',
            acceptanceCriteria: [
              {
                scenario: 'Valid login',
                given: 'Correct credentials',
                when: 'Click login',
                then: 'Dashboard shown',
              },
            ],
          },
          {
            title: 'Remember Me',
            userStory: 'AS a user I WANT to stay logged in SO THAT I do not have to login again',
            acceptanceCriteria: [
              {
                scenario: 'Remember me checked',
                given: 'User checks remember me',
                when: 'User returns',
                then: 'User is still logged in',
              },
            ],
          },
        ],
      },
      {
        title: 'Registration Feature',
        purpose: 'Allow new users to register',
        summary: 'User registration flow',
        businessValue: 'User acquisition',
        functionalRequirements: 'Email verification',
        nonFunctionalRequirements: 'Performance',
        dependencies: 'Email service',
        assumptions: 'Unique emails',
        acceptanceCriteria: [
          {
            scenario: 'Successful registration',
            given: 'New user',
            when: 'Submits registration',
            then: 'Account created',
          },
        ],
        stories: [
          {
            title: 'Create Account',
            userStory: 'AS a visitor I WANT to create an account SO THAT I can use the app',
            acceptanceCriteria: [
              {
                scenario: 'Valid registration',
                given: 'Valid info',
                when: 'Submit form',
                then: 'Account created',
              },
            ],
          },
        ],
      },
    ],
  },
};

const mockFeatureContent: StructuredContent = {
  type: 'feature',
  feature: {
    title: 'Password Reset',
    purpose: 'Allow password recovery',
    summary: 'Email-based reset flow',
    businessValue: 'Reduce support tickets',
    functionalRequirements: 'Token validation',
    nonFunctionalRequirements: 'Security',
    dependencies: 'Email service',
    assumptions: 'Email access',
    acceptanceCriteria: [
      {
        scenario: 'Reset request',
        given: 'Forgot password',
        when: 'Request reset',
        then: 'Email sent',
      },
    ],
    stories: [
      {
        title: 'Request Reset',
        userStory: 'AS a user I WANT to request password reset SO THAT I can recover my account',
        acceptanceCriteria: [
          {
            scenario: 'Valid email',
            given: 'Registered email',
            when: 'Click reset',
            then: 'Confirmation shown',
          },
        ],
      },
      {
        title: 'Set New Password',
        userStory: 'AS a user I WANT to set new password SO THAT I can login again',
        acceptanceCriteria: [
          {
            scenario: 'Valid token',
            given: 'Valid reset link',
            when: 'Enter new password',
            then: 'Password updated',
          },
        ],
      },
    ],
  },
};

const mockStoriesContent: StructuredContent = {
  type: 'user_story',
  stories: [
    {
      title: 'View Profile',
      userStory: 'AS a user I WANT to view profile SO THAT I can see my info',
      acceptanceCriteria: [
        {
          scenario: 'View profile',
          given: 'Logged in',
          when: 'Navigate to profile',
          then: 'Profile displayed',
        },
      ],
    },
    {
      title: 'Edit Profile',
      userStory: 'AS a user I WANT to edit profile SO THAT I can update my info',
      acceptanceCriteria: [
        {
          scenario: 'Save changes',
          given: 'Edit fields',
          when: 'Click save',
          then: 'Changes saved',
        },
      ],
    },
  ],
};

function createMockArtifact(content: StructuredContent): GeneratedArtifact {
  return {
    id: 1,
    userId: null,
    type: content.type,
    title: content.epic?.title || content.feature?.title || content.stories?.[0]?.title || 'Test',
    content: JSON.stringify(content),
    parentId: null,
    inputDescription: 'Test description',
    inputFiles: [],
    knowledgeBaseIds: [],
    status: 'draft',
    generationMetadata: { model: 'test-model' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('StoryGeneratorOutputComponent', () => {
  let component: StoryGeneratorOutputComponent;
  let fixture: ComponentFixture<StoryGeneratorOutputComponent>;
  let mockService: Partial<StoryGeneratorService>;

  beforeEach(async () => {
    mockService = {
      currentArtifact: signal<GeneratedArtifact | null>(null),
      getArtifact: vi.fn().mockResolvedValue(null),
    };

    await TestBed.configureTestingModule({
      imports: [StoryGeneratorOutputComponent],
      providers: [
        provideRouter([]),
        { provide: StoryGeneratorService, useValue: mockService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StoryGeneratorOutputComponent);
    component = fixture.componentInstance;
  });

  describe('Epic Rendering', () => {
    beforeEach(() => {
      const artifact = createMockArtifact(mockEpicContent);
      (component as any).artifact.set(artifact);
      (component as any).loading.set(false);
      fixture.detectChanges();
    });

    it('should render epic card with primary border color', () => {
      const epicCard = fixture.nativeElement.querySelector('.border-l-primary');
      expect(epicCard).toBeTruthy();
    });

    it('should display epic title', () => {
      const epicTitle = fixture.nativeElement.textContent;
      expect(epicTitle).toContain('User Authentication System');
    });

    it('should render features nested inside epic', () => {
      const featureCards = fixture.nativeElement.querySelectorAll('.border-l-blue-500');
      expect(featureCards.length).toBe(2); // Login and Registration features
    });

    it('should render stories nested inside features', () => {
      const storyCards = fixture.nativeElement.querySelectorAll('.border-l-green-500');
      expect(storyCards.length).toBe(3); // 2 stories in Login + 1 in Registration
    });

    it('should show feature titles', () => {
      const content = fixture.nativeElement.textContent;
      expect(content).toContain('Login Feature');
      expect(content).toContain('Registration Feature');
    });

    it('should show story titles', () => {
      const content = fixture.nativeElement.textContent;
      expect(content).toContain('Email Login');
      expect(content).toContain('Remember Me');
      expect(content).toContain('Create Account');
    });
  });

  describe('Feature Rendering (standalone)', () => {
    beforeEach(() => {
      const artifact = createMockArtifact(mockFeatureContent);
      (component as any).artifact.set(artifact);
      (component as any).loading.set(false);
      fixture.detectChanges();
    });

    it('should render feature card with blue border', () => {
      const featureCard = fixture.nativeElement.querySelector('.border-l-blue-500');
      expect(featureCard).toBeTruthy();
    });

    it('should display feature title', () => {
      const content = fixture.nativeElement.textContent;
      expect(content).toContain('Password Reset');
    });

    it('should render stories nested inside feature', () => {
      const storyCards = fixture.nativeElement.querySelectorAll('.border-l-green-500');
      expect(storyCards.length).toBe(2); // Request Reset and Set New Password
    });

    it('should not render epic card for standalone feature', () => {
      const epicCard = fixture.nativeElement.querySelector('.border-l-primary');
      expect(epicCard).toBeFalsy();
    });
  });

  describe('User Stories Rendering (standalone)', () => {
    beforeEach(() => {
      const artifact = createMockArtifact(mockStoriesContent);
      (component as any).artifact.set(artifact);
      (component as any).loading.set(false);
      fixture.detectChanges();
    });

    it('should render story cards with green border', () => {
      const storyCards = fixture.nativeElement.querySelectorAll('.border-l-green-500');
      expect(storyCards.length).toBe(2);
    });

    it('should display story titles', () => {
      const content = fixture.nativeElement.textContent;
      expect(content).toContain('View Profile');
      expect(content).toContain('Edit Profile');
    });

    it('should not render epic or feature cards for standalone stories', () => {
      const epicCard = fixture.nativeElement.querySelector('.border-l-primary');
      const featureCard = fixture.nativeElement.querySelector('.border-l-blue-500');
      expect(epicCard).toBeFalsy();
      expect(featureCard).toBeFalsy();
    });
  });

  describe('Card Hierarchy', () => {
    beforeEach(() => {
      const artifact = createMockArtifact(mockEpicContent);
      (component as any).artifact.set(artifact);
      (component as any).loading.set(false);
      fixture.detectChanges();
    });

    it('should have separate cards for epic, features, and stories', () => {
      const allCards = fixture.nativeElement.querySelectorAll('.rounded-lg.border.bg-card');
      // 1 epic + 2 features + 3 stories = 6 cards
      expect(allCards.length).toBeGreaterThanOrEqual(6);
    });

    it('should have features indented from epic', () => {
      const epicContainer = fixture.nativeElement.querySelector('.border-l-primary')?.closest('.rounded-lg');
      const nestedFeatures = epicContainer?.querySelector('.ml-6');
      expect(nestedFeatures).toBeTruthy();
    });

    it('should have stories indented from features', () => {
      const featureContainers = fixture.nativeElement.querySelectorAll('.border-l-blue-500');
      featureContainers.forEach((container: Element) => {
        const featureCard = container.closest('.rounded-lg');
        const nestedStories = featureCard?.querySelector('.ml-6');
        // At least the first feature should have nested stories
        if (featureCard?.textContent?.includes('Login Feature')) {
          expect(nestedStories).toBeTruthy();
        }
      });
    });
  });

  describe('Expand/Collapse Functionality', () => {
    beforeEach(() => {
      const artifact = createMockArtifact(mockEpicContent);
      (component as any).artifact.set(artifact);
      (component as any).loading.set(false);
      fixture.detectChanges();
    });

    it('should toggle expanded state when clicking item', () => {
      expect((component as any).isExpanded('epic')).toBe(false);
      (component as any).toggleItem('epic');
      expect((component as any).isExpanded('epic')).toBe(true);
      (component as any).toggleItem('epic');
      expect((component as any).isExpanded('epic')).toBe(false);
    });

    it('should show chevron icons when collapsed', () => {
      // Check for any icon elements that indicate expand/collapse
      const icons = fixture.nativeElement.querySelectorAll('ng-icon, lucide-icon, svg');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('JSON Content Parsing', () => {
    it('should parse valid JSON content', () => {
      const artifact = createMockArtifact(mockEpicContent);
      (component as any).artifact.set(artifact);

      const structured = (component as any).structured();
      expect(structured).toBeTruthy();
      expect(structured.type).toBe('epic');
      expect(structured.epic.title).toBe('User Authentication System');
    });

    it('should return null for non-JSON content (legacy)', () => {
      const artifact = createMockArtifact(mockEpicContent);
      artifact.content = '# This is markdown content\n\nNot JSON';
      (component as any).artifact.set(artifact);

      const structured = (component as any).structured();
      expect(structured).toBeNull();
    });
  });

  describe('Copy Functionality', () => {
    beforeEach(() => {
      const artifact = createMockArtifact(mockEpicContent);
      (component as any).artifact.set(artifact);
      (component as any).loading.set(false);
      fixture.detectChanges();
    });

    it('should have copy buttons', () => {
      const copyButtons = fixture.nativeElement.querySelectorAll('button');
      const copyButton = Array.from(copyButtons).find((btn: any) =>
        btn.textContent.includes('Copy')
      );
      expect(copyButton).toBeTruthy();
    });
  });

  describe('Export Functionality', () => {
    beforeEach(() => {
      const artifact = createMockArtifact(mockEpicContent);
      (component as any).artifact.set(artifact);
      (component as any).loading.set(false);
      fixture.detectChanges();
    });

    it('should have export button', () => {
      const exportButton = fixture.nativeElement.querySelector('button[hlmBtn]');
      const buttons = fixture.nativeElement.querySelectorAll('button');
      const exportBtn = Array.from(buttons).find((btn: any) =>
        btn.textContent.includes('Export')
      );
      expect(exportBtn).toBeTruthy();
    });

    it('should toggle export menu', () => {
      expect((component as any).showExportMenu()).toBe(false);
      (component as any).toggleExportMenu();
      expect((component as any).showExportMenu()).toBe(true);
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no artifact', () => {
      (component as any).artifact.set(null);
      (component as any).loading.set(false);
      fixture.detectChanges();

      const emptyState = fixture.nativeElement.textContent;
      expect(emptyState).toContain('No artifact found');
    });
  });

  describe('Loading State', () => {
    it('should have loading signal available', () => {
      // Verify the loading signal exists and is readable
      const loadingSignal = (component as any).loading;
      expect(loadingSignal).toBeDefined();
      expect(typeof loadingSignal).toBe('function');
    });
  });
});
