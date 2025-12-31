export interface ScopeDefinitionSession {
  id: number;
  projectName: string;
  productVision: string;
  initialRequirements?: string;
  knownConstraints?: string;
  stakeholderNeeds?: string;
  targetUsers?: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  progressMessage?: string;
  errorMessage?: string;
  scopeStatement?: string;
  executiveSummary?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface ScopeItem {
  id: number;
  sessionId: number;
  title: string;
  description: string;
  category: string;
  scopeType: 'in_scope' | 'out_of_scope' | 'deferred';
  priority?: string;
  rationale?: string;
  estimatedComplexity?: string;
  dependencies?: string[];
  displayOrder: number;
}

export interface ScopeAssumption {
  id: number;
  sessionId: number;
  assumption: string;
  category: string;
  riskIfWrong: string;
  validationMethod?: string;
  status: string;
  confidence: string;
  displayOrder: number;
}

export interface ScopeConstraint {
  id: number;
  sessionId: number;
  constraint: string;
  category: string;
  impact: string;
  flexibility: string;
  mitigationStrategy?: string;
  displayOrder: number;
}

export interface ScopeDeliverable {
  id: number;
  sessionId: number;
  name: string;
  description: string;
  type: string;
  acceptanceCriteria?: string[];
  targetMilestone?: string;
  estimatedCompletion?: string;
  dependencies?: string[];
  displayOrder: number;
}

export interface ScopeDefinitionSessionCreate {
  projectName: string;
  productVision: string;
  initialRequirements?: string;
  knownConstraints?: string;
  stakeholderNeeds?: string;
  targetUsers?: string;
  ideationSessionId?: number;
  okrSessionId?: number;
  knowledgeBaseIds?: number[];
}

export interface ScopeDefinitionFullResponse {
  session: ScopeDefinitionSession;
  in_scope_items: ScopeItem[];
  out_of_scope_items: ScopeItem[];
  deferred_items: ScopeItem[];
  assumptions: ScopeAssumption[];
  constraints: ScopeConstraint[];
  deliverables: ScopeDeliverable[];
}
