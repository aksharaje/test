/**
 * Test Script Writer Types
 */

export interface SourceTypeOption {
  value: string;
  label: string;
}

export interface NfrOption {
  value: string;
  label: string;
  description: string;
}

export interface StoryInput {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria?: string[];
}

export interface TestCase {
  id: string;
  title: string;
  description: string;
  preconditions: string[];
  steps: string[];
  expectedResult: string;
  testType: 'functional' | 'edge_case' | 'negative' | 'nfr';
  nfrCategory?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface StoryTestScript {
  storyId: string;
  storyTitle: string;
  storyDescription: string;
  acceptanceCriteria: string[];
  testCases: TestCase[];
}

export interface TestScriptWriterSession {
  id: number;
  sourceType: string;
  sourceId?: number;
  sourceTitle?: string;
  stories: StoryInput[];
  selectedNfrs: string[];
  status: 'pending' | 'generating' | 'completed' | 'failed';
  errorMessage?: string;
  storyTestScripts: StoryTestScript[];
  summary?: string;
  totalTestCases: number;
  testBreakdown: {
    functional?: number;
    edge_case?: number;
    negative?: number;
    nfr?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateTestScriptWriterRequest {
  sourceType: string;
  sourceId?: number;
  sourceTitle?: string;
  stories: StoryInput[];
  selectedNfrs: string[];
}

export interface SessionStatus {
  status: string;
  errorMessage?: string;
}

export interface ArtifactSummary {
  id: number;
  title: string;
  description: string;
  type: 'epic' | 'feature' | 'user_story';
}

export interface ArtifactDetails {
  id: number;
  title: string;
  type: string;
  stories: StoryInput[];
}
