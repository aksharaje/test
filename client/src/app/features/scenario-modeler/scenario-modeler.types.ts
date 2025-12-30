export interface ScenarioSession {
  id: number;
  userId?: number;
  roadmapSessionId: number;
  name: string;
  description?: string;
  baselineSnapshot: Record<string, any>;
  status: 'draft' | 'generating' | 'comparing' | 'completed' | 'failed';
  progressStep: number;
  progressTotal: number;
  progressMessage?: string;
  errorMessage?: string;
  totalVariants: number;
  viableVariants: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface VariableChange {
  changeType: 'capacity' | 'priority' | 'timeline' | 'scope';
  target: string;
  targetId?: number;
  value: string | number;
  description?: string;
}

export interface ScenarioVariant {
  id: number;
  sessionId: number;
  name: string;
  description?: string;
  isBaseline: boolean;
  variableChanges: VariableChange[];
  generatedRoadmap: Record<string, any>;
  impactSummary: ImpactSummary;
  riskScore: number;
  riskFactors: RiskFactor[];
  tradeOffs: TradeOff[];
  isViable: boolean;
  nonViableReason?: string;
  status: 'pending' | 'generating' | 'analyzing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface ImpactSummary {
  itemsAccelerated: Array<{ id: number; title: string; sprintsEarlier: number }>;
  itemsAcceleratedCount: number;
  itemsDeferred: Array<{ id: number; title: string; sprintsLater: number }>;
  itemsDeferredCount: number;
  itemsExcluded: Array<{ id: number; title: string; reason: string }>;
  itemsExcludedCount: number;
  timelineDelta: number;
  baselineSprints: number;
  modifiedSprints: number;
  capacityChange: {
    baselineVelocity: number;
    modifiedVelocity: number;
    velocityDelta: number;
    velocityDeltaPercentage: number;
  };
  variableChangesApplied: number;
}

export interface RiskFactor {
  type: 'capacity' | 'timeline' | 'dependency' | 'theme';
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedSprints?: number[];
}

export interface TradeOff {
  gain: string;
  cost: string;
  description: string;
}

export interface ScenarioComparisonReport {
  sessionId: number;
  baselineVariantId: number;
  variants: ScenarioVariant[];
  timelineComparison: Record<number, { totalSprints: number; deltaFromBaseline: number }>;
  capacityComparison: Record<number, { teamVelocity: number; deltaFromBaseline: number }>;
  riskComparison: Record<number, { riskScore: number; topRisks: RiskFactor[] }>;
  themeComparison: Record<number, Record<string, any>>;
  tradeOffMatrix: Array<{
    variantId: number;
    variantName: string;
    gains: string[];
    costs: string[];
    isViable: boolean;
    riskScore: number;
  }>;
  recommendations: string[];
}

export interface ScenarioSessionResponse {
  session: ScenarioSession;
  variants: ScenarioVariant[];
  comparison?: ScenarioComparisonReport;
}

export interface ScenarioSessionCreate {
  roadmapSessionId: number;
  name?: string;
  description?: string;
}

export interface ScenarioVariantCreate {
  name?: string;
  description?: string;
  variableChanges: VariableChange[];
}

export interface ScenarioTemplate {
  id: string;
  name: string;
  description: string;
  variableChanges: Array<{
    changeType: string;
    target: string;
    value: string | number;
  }>;
}
