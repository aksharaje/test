export type ArtifactType = 'epic' | 'feature' | 'user_story';

export interface GeneratedArtifactFile {
  name: string;
  mimeType: string;
  size: number;
  content?: string;
  url?: string;
}

export interface GenerationMetadata {
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  generationTimeMs?: number;
  regeneratePrompt?: string;
}

// Structured content types
export interface AcceptanceCriterion {
  scenario: string;
  given: string;
  when: string;
  then: string;
}

export interface StoryNode {
  title: string;
  userStory: string;
  acceptanceCriteria: AcceptanceCriterion[];
}

export interface FeatureNode {
  title: string;
  purpose: string;
  summary: string;
  businessValue: string;
  functionalRequirements: string;
  nonFunctionalRequirements: string;
  dependencies: string;
  assumptions: string;
  acceptanceCriteria: AcceptanceCriterion[];
  stories: StoryNode[];
}

export interface EpicNode {
  title: string;
  vision: string;
  goals: string[];
  successMetrics: string[];
  risksAndDependencies: string;
  features: FeatureNode[];
}

export interface StructuredContent {
  type: 'epic' | 'feature' | 'user_story';
  epic?: EpicNode;
  feature?: FeatureNode;
  stories?: StoryNode[];
}

export interface GeneratedArtifact {
  id: number;
  userId: number | null;
  type: ArtifactType;
  title: string;
  content: string; // JSON string of StructuredContent
  parentId: number | null;
  inputDescription: string;
  inputFiles: GeneratedArtifactFile[];
  knowledgeBaseIds: number[];
  status: 'draft' | 'final';
  generationMetadata: GenerationMetadata | null;
  createdAt: string;
  updatedAt: string;
}

export interface InputConfig {
  label: string;
  placeholder: string;
}

export interface GenerateRequest {
  type: ArtifactType;
  description: string;
  files?: File[];
  knowledgeBaseIds?: number[];
}

export interface RegenerateRequest {
  prompt: string;
}

export interface KnowledgeBase {
  id: number;
  name: string;
  description: string | null;
  status: string;
  documentCount: number;
  totalChunks: number;
}

// ==================
// FEEDBACK TYPES
// ==================

export type FeedbackSentiment = 'positive' | 'negative';
export type ExtractedFactStatus = 'pending' | 'approved' | 'rejected';

export interface ExtractedFact {
  id: number;
  content: string;
  status: ExtractedFactStatus;
  knowledgeBaseId: number | null;
}

export interface ArtifactFeedback {
  id: number;
  artifactId: number;
  userId: number | null;
  sentiment: FeedbackSentiment;
  text: string | null;
  createdAt: string;
  extractedFacts: ExtractedFact[];
}

export interface ArtifactFeedbackStats {
  artifactId: number;
  positive: number;
  negative: number;
  total: number;
  positiveRate: number;
}
