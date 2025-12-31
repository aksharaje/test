export interface MeasurementFrameworkSession {
  id: number;
  name: string;
  objectivesDescription: string;
  okrSessionId?: number;
  existingDataSources?: string;
  reportingRequirements?: string;
  stakeholderAudience?: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  progressMessage?: string;
  errorMessage?: string;
  executiveSummary?: string;
  frameworkOverview?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface FrameworkMetric {
  id: number;
  sessionId: number;
  name: string;
  description: string;
  category: string;
  metricType: string;
  dataType: string;
  formula?: string;
  unit?: string;
  baseline?: string;
  target?: string;
  thresholdGood?: string;
  thresholdWarning?: string;
  thresholdCritical?: string;
  collectionMethod: string;
  collectionFrequency: string;
  dataOwner?: string;
  dataSource?: string;
  visualizationType?: string;
  dashboardPlacement?: string;
  displayOrder: number;
}

export interface FrameworkDataSource {
  id: number;
  sessionId: number;
  name: string;
  sourceType: string;
  description: string;
  connectionDetails?: string;
  refreshFrequency: string;
  reliabilityScore?: string;
  dataQualityNotes?: string;
  displayOrder: number;
}

export interface FrameworkDashboard {
  id: number;
  sessionId: number;
  name: string;
  description: string;
  audience: string;
  purpose: string;
  keyMetrics?: string[];
  layoutDescription?: string;
  refreshFrequency: string;
  recommendedTool?: string;
  implementationNotes?: string;
  displayOrder: number;
}

export interface MeasurementFrameworkSessionCreate {
  name: string;
  objectivesDescription: string;
  okrSessionId?: number;
  existingDataSources?: string;
  reportingRequirements?: string;
  stakeholderAudience?: string;
  knowledgeBaseIds?: number[];
}

export interface MeasurementFrameworkFullResponse {
  session: MeasurementFrameworkSession;
  metrics: FrameworkMetric[];
  data_sources: FrameworkDataSource[];
  dashboards: FrameworkDashboard[];
}
