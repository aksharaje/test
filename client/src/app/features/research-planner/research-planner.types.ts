/**
 * Research Planner Types
 *
 * TypeScript interfaces for the CX Research Planner feature.
 */

export interface Constraints {
  budget?: 'limited' | 'moderate' | 'flexible';
  timeline?: 'urgent' | 'normal' | 'flexible';
  userAccess?: boolean;
  remoteOnly?: boolean;
}

export interface ResearchPlanSession {
  id: number;
  userId?: number;
  objective: string;
  constraints?: Constraints;
  status: 'pending' | 'recommending' | 'selecting' | 'generating_instruments' | 'completed' | 'failed';
  progressStep: number;
  progressMessage?: string;
  errorMessage?: string;
  selectedMethods?: string[];
  suggestedSequence?: string[];
  generationMetadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface RecommendedMethod {
  id: number;
  sessionId: number;
  methodName: string;
  methodLabel: string;
  rationale: string;
  effort: 'low' | 'medium' | 'high';
  costEstimate: string;
  timeline: string;
  participantCount: string;
  confidenceScore: number;
  isSelected: boolean;
  displayOrder: number;
  createdAt: string;
}

export interface InterviewGuideSection {
  introduction: string;
  warmup: string[];
  behavioral: Array<{
    question: string;
    probes: string[];
  }>;
  attitudinal: string[];
  closing: string;
}

export interface InterviewGuide {
  id: number;
  sessionId: number;
  participantType: string;
  durationMinutes: number;
  focusAreas?: string[];
  contentMarkdown: string;
  sections?: {
    sections: InterviewGuideSection;
    interviewerNotes?: string[];
    timingGuide?: Record<string, number>;
  };
  userEditedContent?: string;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyQuestion {
  questionId: string;
  text: string;
  type: 'multiple_choice' | 'rating' | 'open_ended' | 'screening';
  options?: string[];
  required: boolean;
  conditionalLogic?: Record<string, unknown>;
  analysisNote?: string;
}

export interface Survey {
  id: number;
  sessionId: number;
  targetAudience: string;
  surveyLength: 'short' | 'medium' | 'long';
  questionTypes?: string[];
  questions?: SurveyQuestion[];
  analysisPlan?: string;
  estimatedCompletionTime?: string;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScreenerQuestion {
  question: string;
  type: 'multiple_choice' | 'yes_no' | 'open_ended';
  options?: string[];
  qualifyingAnswer: string;
}

export interface EmailTemplate {
  type: string;
  subject: string;
  body: string;
}

export interface RecruitingPlan {
  id: number;
  sessionId: number;
  participantCriteria?: Record<string, unknown>;
  participantCount: number;
  segmentation?: Record<string, unknown>;
  detailedCriteria?: {
    mustHave: string[];
    niceToHave: string[];
    exclusions: string[];
  };
  screenerQuestions?: ScreenerQuestion[];
  recruitingSources?: string[];
  emailTemplates?: EmailTemplate[];
  incentiveRecommendation?: string;
  expectedResponseRate: number;
  contactsNeeded: number;
  timelineEstimate?: string;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SessionDetail {
  session: ResearchPlanSession;
  recommendedMethods: RecommendedMethod[];
  interviewGuides: InterviewGuide[];
  surveys: Survey[];
  recruitingPlans: RecruitingPlan[];
}

export interface SessionStatusResponse {
  id: number;
  status: string;
  progressStep: number;
  progressMessage?: string;
  errorMessage?: string;
}

// Request types

export interface CreateSessionRequest {
  objective: string;
  constraints?: Constraints;
  userId?: number;
}

export interface SelectMethodsRequest {
  methodNames: string[];
}

export interface InterviewGuideConfig {
  participantType: string;
  durationMinutes: number;
  focusAreas?: string[];
}

export interface SurveyConfig {
  targetAudience: string;
  surveyLength: 'short' | 'medium' | 'long';
  questionTypes?: string[];
}

export interface ParticipantCriteria {
  role?: string;
  companySize?: string;
  experience?: string;
  other?: Record<string, unknown>;
}

export interface RecruitingConfig {
  participantCriteria?: ParticipantCriteria;
  participantCount: number;
  segmentation?: Record<string, unknown>;
}

export interface GenerateInstrumentsRequest {
  interviewGuideConfig?: InterviewGuideConfig;
  surveyConfig?: SurveyConfig;
  recruitingConfig?: RecruitingConfig;
}

// Progress step descriptions for display
export const PROGRESS_STEPS: Record<string, string> = {
  pending: 'Initializing...',
  recommending: 'Analyzing research objective and recommending methods...',
  selecting: 'Methods recommended. Please select methods to proceed.',
  generating_instruments: 'Generating research instruments...',
  completed: 'Research plan complete!',
  failed: 'An error occurred. Please retry.',
};
