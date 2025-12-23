/**
 * Opportunity Linker Types
 *
 * TypeScript interfaces for opportunity mapping and prioritization workflow.
 */

export interface PrioritizationSession {
  id: number;
  userId: number | null;
  ideationSessionId: number;
  status: SessionStatus;
  progressStep: number;
  progressMessage: string | null;
  errorMessage: string | null;
  portfolioSummary: PortfolioSummary | null;
  processingTimeMs: number | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export type SessionStatus =
  | 'pending'
  | 'mapping'
  | 'scoring'
  | 'sizing'
  | 'prioritizing'
  | 'completed'
  | 'failed';

export interface PortfolioSummary {
  byTier: {
    p0: number;
    p1: number;
    p2: number;
    p3: number;
  };
  byCategory: {
    quick_wins: number;
    strategic_bets: number;
    incremental: number;
    moonshots: number;
  };
  byEffort: {
    S: number;
    M: number;
    L: number;
    XL: number;
  };
  topP0Recommendations: number[]; // Idea IDs
}

export interface PrioritizedIdea {
  id: number;
  prioritizationSessionId: number;
  generatedIdeaId: number;

  // Synthetic Opportunities
  marketOpportunity: MarketOpportunity | null;
  strategicOpportunity: StrategicOpportunity | null;
  customerOpportunity: CustomerOpportunity | null;

  // Strategic Fit
  strategicFitScore: number | null; // 0-10
  strategicFitRationale: string | null;

  // Size Estimation
  tshirtSize: TShirtSize | null;
  sizeRationale: string | null;
  sizeConfidence: ConfidenceLevel | null;
  potentialRevenue: string | null;

  // Prioritization
  priorityScore: number | null;
  priorityTier: PriorityTier | null;
  displayOrder: number;

  createdAt: string;
  updatedAt: string;
}

export interface MarketOpportunity {
  estimatedMarketSize: string;
  confidenceLevel: ConfidenceLevel;
  rationale: string;
}

export interface StrategicOpportunity {
  connectionStrength: 'Low' | 'Medium' | 'High';
  alignmentRationale: string;
}

export interface CustomerOpportunity {
  valueDelivered: string;
  customerSegment: string;
  painPointAddressed: string;
}

export type TShirtSize = 'S' | 'M' | 'L' | 'XL';

export type ConfidenceLevel = 'Very Low' | 'Low' | 'Medium' | 'High';

export type PriorityTier = 'P0' | 'P1' | 'P2' | 'P3';

export interface SessionDetail {
  session: PrioritizationSession;
  ideas: PrioritizedIdeaWithOriginal[];
}

export interface PrioritizedIdeaWithOriginal extends PrioritizedIdea {
  // Joined data from GeneratedIdea
  title: string;
  description: string;
  category: string;
  impactScore: number | null;
  feasibilityScore: number | null;
  effortScore: number | null;
  riskScore: number | null;
}

export interface CreateSessionRequest {
  ideationSessionId: number;
}
