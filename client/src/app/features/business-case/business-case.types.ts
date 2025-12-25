/**
 * TypeScript types for Business Case Builder feature
 */

export type SessionStatus = 'pending' | 'analyzing' | 'completed' | 'failed';
export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type Recommendation = 'invest' | 'conditional' | 'defer' | 'reject';

export type CostCategory = 'development' | 'infrastructure' | 'licensing' | 'maintenance' | 'support' | 'training';
export type CostType = 'one_time' | 'recurring_monthly' | 'recurring_annual';

export type BenefitCategory = 'revenue_increase' | 'cost_reduction' | 'efficiency_gain' | 'risk_reduction' | 'strategic';
export type BenefitType = 'quantifiable' | 'semi_quantifiable' | 'qualitative';
export type Recurrence = 'monthly' | 'annual' | 'one_time';

export type DataSource = 'user_input' | 'feasibility_import' | 'web_research' | 'benchmark' | 'ai_estimate';

export type ScenarioType = 'conservative' | 'base' | 'optimistic';
export type AssumptionCategory = 'market' | 'technical' | 'resource' | 'timeline' | 'financial';
export type ImpactLevel = 'low' | 'medium' | 'high';
export type ValidationStatus = 'unvalidated' | 'validated' | 'invalidated';

export interface BusinessCaseSession {
  id: number;
  userId: number | null;
  feasibilitySessionId: number | null;
  featureName: string;
  featureDescription: string;
  businessContext: string | null;
  targetMarket: string | null;
  status: SessionStatus;
  progressStep: number;
  progressMessage: string | null;
  errorMessage: string | null;
  executiveSummary: string | null;
  recommendation: Recommendation | null;
  confidenceLevel: ConfidenceLevel;
  totalInvestment: number | null;
  netPresentValue: number | null;
  internalRateOfReturn: number | null;
  paybackMonths: number | null;
  roiPercentage: number | null;
  generationMetadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface CostItem {
  id: number;
  sessionId: number;
  costCategory: CostCategory;
  costType: CostType;
  itemName: string;
  itemDescription: string;
  optimisticAmount: number;
  realisticAmount: number;
  pessimisticAmount: number;
  dataSource: DataSource;
  confidenceLevel: ConfidenceLevel;
  sourceReference: string | null;
  isUserOverride: boolean;
  originalEstimate: number | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface BenefitItem {
  id: number;
  sessionId: number;
  benefitCategory: BenefitCategory;
  benefitType: BenefitType;
  itemName: string;
  itemDescription: string;
  optimisticAmount: number | null;
  realisticAmount: number | null;
  pessimisticAmount: number | null;
  recurrence: Recurrence | null;
  timeToRealizeMonths: number;
  dataSource: DataSource;
  confidenceLevel: ConfidenceLevel;
  sourceReference: string | null;
  isUserOverride: boolean;
  originalEstimate: number | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface YearlyCashFlow {
  year: number;
  benefits: number;
  costs: number;
  netCashFlow: number;
  discountedCashFlow: number;
  cumulativeNpv: number;
}

export interface FinancialScenario {
  id: number;
  sessionId: number;
  scenarioType: ScenarioType;
  totalOneTimeCosts: number;
  totalRecurringAnnualCosts: number;
  totalInvestmentYear1: number;
  totalInvestment5Year: number;
  totalAnnualBenefitsYear1: number;
  totalAnnualBenefitsYear3: number;
  totalBenefits5Year: number;
  netPresentValue: number;
  internalRateOfReturn: number | null;
  paybackPeriodMonths: number | null;
  roiPercentage: number;
  discountRate: number;
  projectionYears: number;
  benefitGrowthRate: number;
  rationale: string;
  confidenceLevel: ConfidenceLevel;
  yearlyCashFlows: YearlyCashFlow[] | null;
  createdAt: string;
}

export interface Assumption {
  id: number;
  sessionId: number;
  assumptionCategory: AssumptionCategory;
  assumptionText: string;
  impactIfWrong: ImpactLevel;
  validationStatus: ValidationStatus;
  validationNotes: string | null;
  dataSource: DataSource;
  sourceReference: string | null;
  displayOrder: number;
  createdAt: string;
}

export interface SensitivityAnalysis {
  id: number;
  sessionId: number;
  variableName: string;
  variableType: 'cost' | 'benefit' | 'timeline';
  baseValue: number;
  lowValue: number;
  highValue: number;
  npvAtLow: number;
  npvAtHigh: number;
  npvSensitivity: number;
  isCritical: boolean;
  displayOrder: number;
  createdAt: string;
}

export type RateType = 'hourly_rate' | 'discount_rate' | 'benefit_growth_rate' | 'overhead_multiplier';
export type RateUnit = 'per_hour' | 'percentage' | 'multiplier';

export interface RateAssumption {
  id: number;
  sessionId: number;
  rateType: RateType;
  rateName: string;
  rateValue: number;
  rateUnit: RateUnit;
  companySize: string | null;
  rateDescription: string | null;
  dataSource: DataSource;
  isUserOverride: boolean;
  displayOrder: number;
  createdAt: string;
}

export interface FeasibilityData {
  session: {
    id: number;
    featureDescription: string;
    goNoGoRecommendation: string;
    executiveSummary: string;
  };
  components: Array<{
    componentName: string;
    realisticHours: number;
  }>;
  totalHours: number;
}

export interface SessionDetail {
  session: BusinessCaseSession;
  costs: CostItem[];
  benefits: BenefitItem[];
  scenarios: FinancialScenario[];
  assumptions: Assumption[];
  sensitivity: SensitivityAnalysis[];
  rates: RateAssumption[];
  feasibility: FeasibilityData | null;
}

export interface SessionStatusResponse {
  id: number;
  status: SessionStatus;
  progressStep: number;
  progressMessage: string | null;
  errorMessage: string | null;
}

export interface CreateSessionRequest {
  // Optional when feasibilitySessionId is provided
  featureName?: string;
  featureDescription?: string;
  businessContext?: string;
  targetMarket?: string;
  feasibilitySessionId?: number;
  userId?: number;
}

export interface UpdateCostRequest {
  optimisticAmount?: number;
  realisticAmount?: number;
  pessimisticAmount?: number;
}

export interface UpdateBenefitRequest {
  optimisticAmount?: number;
  realisticAmount?: number;
  pessimisticAmount?: number;
}

export interface SaveLearningRequest {
  learningType: string;
  category: string;
  originalValue: number;
  correctedValue: number;
  context: string;
  userId?: number;
}

export interface UpdateRateRequest {
  rateValue: number;
}
