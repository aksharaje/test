import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { flows, flowExecutions, FlowState, FlowTransition, ExecutionHistoryEntry } from '../db/schema.js';
import { agentService } from './agent.js';

export class FlowService {
  // Create a new flow definition
  async createFlow(data: {
    name: string;
    description?: string;
    initialState: string;
    states: FlowState[];
  }) {
    // Validate that initial state exists
    const initialStateExists = data.states.some(s => s.name === data.initialState);
    if (!initialStateExists) {
      throw new Error(`Initial state "${data.initialState}" not found in states`);
    }

    // Validate all transitions point to valid states
    for (const state of data.states) {
      for (const transition of state.transitions) {
        const targetExists = data.states.some(s => s.name === transition.target);
        if (!targetExists) {
          throw new Error(`Transition target "${transition.target}" not found in states`);
        }
      }
    }

    const [flow] = await db
      .insert(flows)
      .values({
        name: data.name,
        description: data.description,
        initialState: data.initialState,
        states: data.states,
      })
      .returning();

    return flow;
  }

  // Get a flow by ID
  async getFlow(id: number) {
    const [flow] = await db.select().from(flows).where(eq(flows.id, id));
    return flow;
  }

  // List all flows
  async listFlows() {
    return db.select().from(flows);
  }

  // Start a new flow execution
  async startExecution(flowId: number, initialContext: Record<string, unknown> = {}) {
    const flow = await this.getFlow(flowId);
    if (!flow) {
      throw new Error(`Flow ${flowId} not found`);
    }

    const [execution] = await db
      .insert(flowExecutions)
      .values({
        flowId,
        currentState: flow.initialState,
        status: 'running',
        context: initialContext,
        history: [{
          state: flow.initialState,
          timestamp: new Date().toISOString(),
          input: initialContext,
        }],
      })
      .returning();

    // Start processing the flow
    return this.processExecution(execution.id);
  }

  // Get execution by ID
  async getExecution(id: number) {
    const [execution] = await db
      .select()
      .from(flowExecutions)
      .where(eq(flowExecutions.id, id));
    return execution;
  }

  // Process the execution - run the state machine
  async processExecution(executionId: number): Promise<typeof flowExecutions.$inferSelect> {
    const execution = await this.getExecution(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    if (execution.status !== 'running') {
      return execution;
    }

    const flow = await this.getFlow(execution.flowId);
    if (!flow) {
      throw new Error(`Flow ${execution.flowId} not found`);
    }

    const currentState = flow.states.find(s => s.name === execution.currentState);
    if (!currentState) {
      throw new Error(`State "${execution.currentState}" not found in flow`);
    }

    try {
      const result = await this.executeState(currentState, execution.context, flow.states);

      // Update context with result
      const newContext = { ...execution.context, ...result.output };

      // Find next transition
      const nextTransition = this.findNextTransition(currentState, result.event, newContext);

      // Add to history
      const historyEntry: ExecutionHistoryEntry = {
        state: currentState.name,
        timestamp: new Date().toISOString(),
        input: execution.context,
        output: result.output,
      };
      const newHistory = [...(execution.history || []), historyEntry];

      if (!nextTransition) {
        // No transition found - stay in current state or complete if end state
        if (currentState.type === 'end') {
          await db
            .update(flowExecutions)
            .set({
              status: 'completed',
              context: newContext,
              history: newHistory,
              updatedAt: new Date(),
            })
            .where(eq(flowExecutions.id, executionId));
        }
        return this.getExecution(executionId) as Promise<typeof flowExecutions.$inferSelect>;
      }

      // Move to next state
      const nextState = flow.states.find(s => s.name === nextTransition.target);

      await db
        .update(flowExecutions)
        .set({
          currentState: nextTransition.target,
          context: newContext,
          history: newHistory,
          status: nextState?.type === 'end' ? 'completed' : 'running',
          updatedAt: new Date(),
        })
        .where(eq(flowExecutions.id, executionId));

      // Continue processing if not at end state
      if (nextState?.type !== 'end') {
        return this.processExecution(executionId);
      }

      return this.getExecution(executionId) as Promise<typeof flowExecutions.$inferSelect>;
    } catch (error) {
      // Handle error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await db
        .update(flowExecutions)
        .set({
          status: 'failed',
          error: errorMessage,
          history: [
            ...(execution.history || []),
            {
              state: currentState.name,
              timestamp: new Date().toISOString(),
              error: errorMessage,
            },
          ],
          updatedAt: new Date(),
        })
        .where(eq(flowExecutions.id, executionId));

      return this.getExecution(executionId) as Promise<typeof flowExecutions.$inferSelect>;
    }
  }

  // Execute a single state
  private async executeState(
    state: FlowState,
    context: Record<string, unknown>,
    _allStates: FlowState[]
  ): Promise<{ output: Record<string, unknown>; event: string }> {
    switch (state.type) {
      case 'agent':
        return this.executeAgentState(state, context);

      case 'condition':
        return this.executeConditionState(state, context);

      case 'action':
        return this.executeActionState(state, context);

      case 'end':
        return { output: {}, event: 'complete' };

      default:
        throw new Error(`Unknown state type: ${state.type}`);
    }
  }

  // Execute an agent state
  private async executeAgentState(
    state: FlowState,
    context: Record<string, unknown>
  ): Promise<{ output: Record<string, unknown>; event: string }> {
    if (!state.agentId) {
      throw new Error(`Agent state "${state.name}" missing agentId`);
    }

    // Interpolate the prompt template with context
    const prompt = this.interpolate(state.prompt || '', context);

    // Start a conversation with the agent
    const conversation = await agentService.startConversation(state.agentId);

    // Send the message
    const result = await agentService.sendMessage(conversation.id, prompt);

    return {
      output: {
        [`${state.name}_response`]: result.response,
        [`${state.name}_tools_used`]: result.toolsUsed,
        lastAgentResponse: result.response,
      },
      event: 'success',
    };
  }

  // Execute a condition state
  private async executeConditionState(
    state: FlowState,
    context: Record<string, unknown>
  ): Promise<{ output: Record<string, unknown>; event: string }> {
    if (!state.condition) {
      throw new Error(`Condition state "${state.name}" missing condition`);
    }

    const result = this.evaluateCondition(state.condition, context);

    return {
      output: { [`${state.name}_result`]: result },
      event: result ? 'true' : 'false',
    };
  }

  // Execute an action state (for custom logic)
  private async executeActionState(
    state: FlowState,
    context: Record<string, unknown>
  ): Promise<{ output: Record<string, unknown>; event: string }> {
    // Actions can be extended for custom logic
    // For now, just pass through
    return {
      output: {},
      event: 'success',
    };
  }

  // Find the next transition based on event and conditions
  private findNextTransition(
    state: FlowState,
    event: string,
    context: Record<string, unknown>
  ): FlowTransition | undefined {
    // First try to find a transition matching the event
    for (const transition of state.transitions) {
      if (transition.event === event) {
        // Check condition if present
        if (transition.condition) {
          if (this.evaluateCondition(transition.condition, context)) {
            return transition;
          }
        } else {
          return transition;
        }
      }
    }

    // Fall back to default transition (no event specified)
    for (const transition of state.transitions) {
      if (!transition.event || transition.event === 'default') {
        if (transition.condition) {
          if (this.evaluateCondition(transition.condition, context)) {
            return transition;
          }
        } else {
          return transition;
        }
      }
    }

    return undefined;
  }

  // Interpolate template strings with context values
  private interpolate(template: string, context: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return String(context[key] ?? '');
    });
  }

  // Evaluate a condition expression against context
  private evaluateCondition(condition: string, context: Record<string, unknown>): boolean {
    try {
      // Create a function that evaluates the condition with context variables
      const keys = Object.keys(context);
      const values = Object.values(context);
      const fn = new Function(...keys, `return ${condition}`);
      return Boolean(fn(...values));
    } catch {
      console.error(`Failed to evaluate condition: ${condition}`);
      return false;
    }
  }

  // Send an event to a paused execution
  async sendEvent(executionId: number, event: string, data: Record<string, unknown> = {}) {
    const execution = await this.getExecution(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    // Update context with event data
    const newContext = { ...execution.context, ...data, lastEvent: event };

    await db
      .update(flowExecutions)
      .set({
        context: newContext,
        status: 'running',
        updatedAt: new Date(),
      })
      .where(eq(flowExecutions.id, executionId));

    // Continue processing
    return this.processExecution(executionId);
  }
}

export const flowService = new FlowService();
