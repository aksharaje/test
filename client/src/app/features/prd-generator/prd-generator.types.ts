// PRD Generator Types

export interface PrdSection {
  key: string;
  title: string;
  content: string;
  citations?: number[];
}

export interface StructuredPrdContent {
  title: string;
  sections: PrdSection[];
}

export interface PrdCitation {
  id: number;
  type: 'knowledge_base' | 'file' | 'inferred';
  source: string;
  documentId?: number;
  documentName?: string;
  filePath?: string;
  lineStart?: number;
  lineEnd?: number;
  content: string;
  similarity?: number;
}

export interface PrdRefineEntry {
  prompt: string;
  timestamp: string;
}

export interface PrdGenerationMetadata {
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  generationTimeMs?: number;
  refineHistory?: PrdRefineEntry[];
}

export interface GeneratedArtifactFile {
  name: string;
  mimeType: string;
  size: number;
  content?: string;
  url?: string;
}

export interface GeneratedPrd {
  id: number;
  userId: number | null;
  title: string;
  content: string; // JSON string of StructuredPrdContent
  concept: string;
  targetProject: string | null;
  targetPersona: string | null;
  industryContext: string | null;
  primaryMetric: string | null;
  userStoryRole: string | null;
  userStoryGoal: string | null;
  userStoryBenefit: string | null;
  knowledgeBaseIds: number[];
  inputFiles: GeneratedArtifactFile[];
  templateId: number | null;
  status: 'pending' | 'processing' | 'draft' | 'final' | 'failed';
  progressStep: number;
  progressMessage: string | null;
  errorMessage: string | null;
  generationMetadata: PrdGenerationMetadata | null;
  citations: PrdCitation[];
  createdAt: string;
  updatedAt: string;
}

export interface PrdTemplate {
  id: number;
  name: string;
  description: string | null;
  isDefault: number;
  isCustom: number;
}

export interface KnowledgeBase {
  id: number;
  name: string;
  description: string | null;
  status: string;
  documentCount: number;
  totalChunks: number;
}

export interface PrdGenerateRequest {
  concept: string;
  targetProject?: string;
  targetPersona?: string;
  industryContext?: string;
  primaryMetric?: string;
  userStoryRole?: string;
  userStoryGoal?: string;
  userStoryBenefit?: string;
  knowledgeBaseIds?: number[];
  files?: File[];
  templateId?: number;
}

// Wizard step enum
export type WizardStep = 'input' | 'template' | 'generating' | 'output';

// Context panel data
export interface PrdContext {
  concept: string;
  targetProject?: string;
  targetPersona?: string;
  industryContext?: string;
  primaryMetric?: string;
  userStory?: {
    role: string;
    goal: string;
    benefit: string;
  };
  knowledgeBases: KnowledgeBase[];
  template?: PrdTemplate;
  files?: GeneratedArtifactFile[];
}
