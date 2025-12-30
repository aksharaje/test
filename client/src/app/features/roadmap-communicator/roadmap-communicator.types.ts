export interface CommunicatorSession {
  id: number;
  userId?: number;
  roadmapSessionId: number;
  scenarioVariantId?: number;
  name: string;
  description?: string;
  sourceSnapshot: Record<string, any>;
  status: 'draft' | 'generating' | 'completed' | 'failed';
  progressStep: number;
  progressTotal: number;
  progressMessage?: string;
  errorMessage?: string;
  totalPresentations: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface AudienceProfile {
  interests: string[];
  detailLevel: 'high_level' | 'moderate' | 'detailed';
  concerns: string[];
  priorContext: 'familiar' | 'first_time_viewer';
  customNotes?: string;
}

export interface GeneratedPresentation {
  id: number;
  sessionId: number;
  audienceType: string;
  audienceName: string;
  audienceProfile: AudienceProfile;
  presentationStrategy: {
    focusAreas: string[];
    visualizationStyle: string;
    narrativeStructure: string;
    detailLevel: string;
    keyMessages: string[];
    itemsToHighlight: string[];
    itemsToHide: string[];
    recommendedSlideCount: number;
    recommendedDurationMinutes: number;
  };
  visualizationData: {
    visualizationStyle: string;
    groupedItems: Record<string, any>;
    themes: Array<{ id: number; name: string; color: string }>;
    milestones: Array<{ name: string; sprint: number }>;
    totalSprints: number;
    itemCount: number;
    highlightedItems: any[];
  };
  narrative: {
    opening: string;
    sections: Array<{
      title: string;
      content: string;
      keyPoints: string[];
    }>;
    tradeOffExplanations: Array<{
      decision: string;
      rationale: string;
      alternativeConsidered: string;
    }>;
    closing: string;
  };
  talkingPoints: {
    keyMessages: Array<{
      message: string;
      supportingPoints: string[];
      dataPoint: string;
    }>;
    anticipatedQa: Array<{
      question: string;
      suggestedResponse: string;
      backupData: string;
    }>;
    metricsToReference: Array<{
      metric: string;
      value: string;
      context: string;
    }>;
    transitionPhrases: string[];
  };
  format: 'markdown' | 'html' | 'json';
  formattedContent: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PresentationConfig {
  audienceType: string;
  audienceName?: string;
  audienceProfile?: Partial<AudienceProfile>;
  tone?: 'professional' | 'collaborative' | 'inspirational';
  emphasisAreas?: string[];
  format?: 'markdown' | 'html' | 'json';
}

export interface CommunicatorSessionCreate {
  roadmapSessionId: number;
  scenarioVariantId?: number;
  name?: string;
  description?: string;
}

export interface CommunicatorSessionResponse {
  session: CommunicatorSession;
  presentations: GeneratedPresentation[];
}

export interface AudienceType {
  id: string;
  name: string;
  description: string;
  defaultProfile: AudienceProfile;
  visualizationStyle: string;
  focus: string;
}
