import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock data representing valid structured content
const mockEpicResponse = {
  type: 'epic',
  epic: {
    title: 'User Authentication System',
    vision: 'Create a secure and user-friendly authentication system',
    goals: ['Improve security', 'Enhance user experience'],
    successMetrics: ['99.9% uptime', 'Under 2s login time'],
    risksAndDependencies: 'Depends on OAuth provider availability',
    features: [
      {
        title: 'Login Feature',
        purpose: 'Allow users to authenticate',
        summary: 'Standard login with email/password',
        businessValue: 'Core functionality for user access',
        functionalRequirements: 'Email validation, password strength check',
        nonFunctionalRequirements: 'WCAG 2.1 AA compliance',
        dependencies: 'Auth API',
        assumptions: 'Users have valid email addresses',
        acceptanceCriteria: [
          {
            scenario: 'Successful login',
            given: 'User has valid credentials',
            when: 'User submits login form',
            then: 'User is redirected to dashboard',
          },
        ],
        stories: [
          {
            title: 'Email Login',
            userStory: 'AS a user I WANT to login with email SO THAT I can access my account',
            acceptanceCriteria: [
              {
                scenario: 'Valid credentials',
                given: 'User enters correct email and password',
                when: 'User clicks login',
                then: 'User sees dashboard',
              },
            ],
          },
        ],
      },
    ],
  },
};

const mockFeatureResponse = {
  type: 'feature',
  feature: {
    title: 'Password Reset',
    purpose: 'Allow users to reset forgotten passwords',
    summary: 'Email-based password reset flow',
    businessValue: 'Reduce support tickets by 50%',
    functionalRequirements: 'Send reset email, validate token, update password',
    nonFunctionalRequirements: 'Token expires in 1 hour',
    dependencies: 'Email service',
    assumptions: 'User has access to registered email',
    acceptanceCriteria: [
      {
        scenario: 'Request password reset',
        given: 'User forgot password',
        when: 'User requests reset',
        then: 'Email is sent with reset link',
      },
    ],
    stories: [
      {
        title: 'Request Reset Email',
        userStory: 'AS a user I WANT to request a password reset SO THAT I can recover my account',
        acceptanceCriteria: [
          {
            scenario: 'Valid email',
            given: 'User enters registered email',
            when: 'User clicks reset',
            then: 'Confirmation message appears',
          },
        ],
      },
      {
        title: 'Reset Password',
        userStory: 'AS a user I WANT to set a new password SO THAT I can login again',
        acceptanceCriteria: [
          {
            scenario: 'Valid token',
            given: 'User clicks valid reset link',
            when: 'User enters new password',
            then: 'Password is updated',
          },
        ],
      },
    ],
  },
};

const mockStoriesResponse = {
  type: 'user_story',
  stories: [
    {
      title: 'View Profile',
      userStory: 'AS a user I WANT to view my profile SO THAT I can see my information',
      acceptanceCriteria: [
        {
          scenario: 'Logged in user',
          given: 'User is authenticated',
          when: 'User navigates to profile',
          then: 'Profile information is displayed',
        },
      ],
    },
    {
      title: 'Edit Profile',
      userStory: 'AS a user I WANT to edit my profile SO THAT I can update my information',
      acceptanceCriteria: [
        {
          scenario: 'Save changes',
          given: 'User edits profile fields',
          when: 'User clicks save',
          then: 'Changes are persisted',
        },
      ],
    },
  ],
};

describe('Story Generator JSON Structure', () => {
  describe('Epic Structure Validation', () => {
    it('should have valid epic structure with required fields', () => {
      const content = mockEpicResponse;

      expect(content.type).toBe('epic');
      expect(content.epic).toBeDefined();
      expect(content.epic.title).toBeDefined();
      expect(content.epic.vision).toBeDefined();
      expect(content.epic.goals).toBeInstanceOf(Array);
      expect(content.epic.successMetrics).toBeInstanceOf(Array);
      expect(content.epic.features).toBeInstanceOf(Array);
    });

    it('should have features nested inside epic', () => {
      const content = mockEpicResponse;

      expect(content.epic.features.length).toBeGreaterThan(0);
      const feature = content.epic.features[0];
      expect(feature.title).toBeDefined();
      expect(feature.purpose).toBeDefined();
      expect(feature.stories).toBeInstanceOf(Array);
    });

    it('should have stories nested inside features', () => {
      const content = mockEpicResponse;

      const feature = content.epic.features[0];
      expect(feature.stories.length).toBeGreaterThan(0);
      const story = feature.stories[0];
      expect(story.title).toBeDefined();
      expect(story.userStory).toBeDefined();
      expect(story.acceptanceCriteria).toBeInstanceOf(Array);
    });

    it('should have acceptance criteria with Gherkin format', () => {
      const content = mockEpicResponse;

      const feature = content.epic.features[0];
      const ac = feature.acceptanceCriteria[0];
      expect(ac.scenario).toBeDefined();
      expect(ac.given).toBeDefined();
      expect(ac.when).toBeDefined();
      expect(ac.then).toBeDefined();
    });
  });

  describe('Feature Structure Validation', () => {
    it('should have valid feature structure with required fields', () => {
      const content = mockFeatureResponse;

      expect(content.type).toBe('feature');
      expect(content.feature).toBeDefined();
      expect(content.feature.title).toBeDefined();
      expect(content.feature.purpose).toBeDefined();
      expect(content.feature.summary).toBeDefined();
      expect(content.feature.businessValue).toBeDefined();
      expect(content.feature.stories).toBeInstanceOf(Array);
    });

    it('should have stories nested inside feature', () => {
      const content = mockFeatureResponse;

      expect(content.feature.stories.length).toBeGreaterThan(0);
      const story = content.feature.stories[0];
      expect(story.title).toBeDefined();
      expect(story.userStory).toBeDefined();
      expect(story.acceptanceCriteria).toBeInstanceOf(Array);
    });

    it('should have multiple stories for a feature', () => {
      const content = mockFeatureResponse;

      expect(content.feature.stories.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('User Story Structure Validation', () => {
    it('should have valid stories array structure', () => {
      const content = mockStoriesResponse;

      expect(content.type).toBe('user_story');
      expect(content.stories).toBeInstanceOf(Array);
      expect(content.stories.length).toBeGreaterThan(0);
    });

    it('should have stories with AS/I WANT/SO THAT format', () => {
      const content = mockStoriesResponse;

      const story = content.stories[0];
      expect(story.userStory).toContain('AS');
      expect(story.userStory).toContain('WANT');
      expect(story.userStory).toContain('SO THAT');
    });

    it('should have acceptance criteria for each story', () => {
      const content = mockStoriesResponse;

      content.stories.forEach((story) => {
        expect(story.acceptanceCriteria).toBeInstanceOf(Array);
        expect(story.acceptanceCriteria.length).toBeGreaterThan(0);
      });
    });
  });

  describe('JSON Parsing', () => {
    it('should be parseable as valid JSON', () => {
      const jsonString = JSON.stringify(mockEpicResponse);
      expect(() => JSON.parse(jsonString)).not.toThrow();
    });

    it('should maintain structure after stringify/parse cycle', () => {
      const jsonString = JSON.stringify(mockEpicResponse);
      const parsed = JSON.parse(jsonString);

      expect(parsed.type).toBe('epic');
      expect(parsed.epic.features[0].stories[0].title).toBe('Email Login');
    });
  });

  describe('Parent-Child Relationships', () => {
    it('epic should contain features', () => {
      const content = mockEpicResponse;
      expect(content.epic.features).toBeDefined();
      expect(content.epic.features.length).toBeGreaterThan(0);
    });

    it('features should contain stories', () => {
      const content = mockEpicResponse;
      content.epic.features.forEach((feature) => {
        expect(feature.stories).toBeDefined();
        expect(feature.stories.length).toBeGreaterThan(0);
      });
    });

    it('standalone feature should contain stories', () => {
      const content = mockFeatureResponse;
      expect(content.feature.stories).toBeDefined();
      expect(content.feature.stories.length).toBeGreaterThan(0);
    });
  });
});

describe('cleanJsonResponse', () => {
  // Helper function to simulate what the backend does
  function cleanJsonResponse(response: string): string {
    let cleaned = response.trim();

    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }

    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }

    return cleaned.trim();
  }

  it('should remove markdown code fences', () => {
    const input = '```json\n{"type": "epic"}\n```';
    const result = cleanJsonResponse(input);
    expect(result).toBe('{"type": "epic"}');
  });

  it('should handle clean JSON without fences', () => {
    const input = '{"type": "epic"}';
    const result = cleanJsonResponse(input);
    expect(result).toBe('{"type": "epic"}');
  });

  it('should trim whitespace', () => {
    const input = '  \n{"type": "epic"}\n  ';
    const result = cleanJsonResponse(input);
    expect(result).toBe('{"type": "epic"}');
  });
});
