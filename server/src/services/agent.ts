import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { agents, conversations, messages, AgentTool, ToolCall } from '../db/schema.js';
import { openrouter, Message } from './openrouter.js';

// Tool handler type - implement these for your custom tools
export type ToolHandler = (args: Record<string, unknown>) => Promise<string>;

export class AgentService {
  private toolHandlers: Map<string, ToolHandler> = new Map();

  // Register a tool handler
  registerTool(name: string, handler: ToolHandler) {
    this.toolHandlers.set(name, handler);
  }

  // Create a new agent
  async createAgent(data: {
    name: string;
    description?: string;
    systemPrompt: string;
    model?: string;
    tools?: AgentTool[];
  }) {
    const [agent] = await db
      .insert(agents)
      .values({
        name: data.name,
        description: data.description,
        systemPrompt: data.systemPrompt,
        model: data.model || process.env.OPENROUTER_MODEL || 'openai/gpt-oss-120b',
        tools: data.tools || [],
      })
      .returning();

    return agent;
  }

  // Get an agent by ID
  async getAgent(id: number) {
    const [agent] = await db.select().from(agents).where(eq(agents.id, id));
    return agent;
  }

  // List all agents
  async listAgents() {
    return db.select().from(agents);
  }

  // Start a new conversation with an agent
  async startConversation(agentId: number, title?: string) {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent with id ${agentId} not found`);
    }

    const [conversation] = await db
      .insert(conversations)
      .values({
        agentId,
        title: title || `Conversation with ${agent.name}`,
      })
      .returning();

    return conversation;
  }

  // Get conversation with all messages
  async getConversation(conversationId: number) {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId));

    if (!conversation) {
      return null;
    }

    const conversationMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    return { ...conversation, messages: conversationMessages };
  }

  // Send a message and get agent response (with agentic loop for tool calls)
  async sendMessage(
    conversationId: number,
    userMessage: string,
    maxIterations = 10
  ): Promise<{
    response: string;
    toolsUsed: { name: string; result: string }[];
  }> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const agent = await this.getAgent(conversation.agentId);
    if (!agent) {
      throw new Error(`Agent ${conversation.agentId} not found`);
    }

    // Save user message
    await db.insert(messages).values({
      conversationId,
      role: 'user',
      content: userMessage,
    });

    // Build message history for the LLM
    const messageHistory: Message[] = [
      { role: 'system', content: agent.systemPrompt },
      ...conversation.messages.map((m) => ({
        role: m.role as Message['role'],
        content: m.content,
        tool_calls: m.toolCalls?.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        })),
        tool_call_id: m.toolCallId || undefined,
      })),
      { role: 'user', content: userMessage },
    ];

    const toolsUsed: { name: string; result: string }[] = [];
    let iterations = 0;

    // Agentic loop - keep running until no more tool calls or max iterations
    while (iterations < maxIterations) {
      iterations++;

      const response = await openrouter.chat(messageHistory, {
        model: agent.model,
        tools: agent.tools || [],
      });

      // If no tool calls, we're done
      if (!response.toolCalls || response.toolCalls.length === 0) {
        // Save assistant response
        await db.insert(messages).values({
          conversationId,
          role: 'assistant',
          content: response.content,
        });

        return { response: response.content, toolsUsed };
      }

      // Process tool calls
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.content || '',
        tool_calls: response.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        })),
      };
      messageHistory.push(assistantMessage);

      // Save assistant message with tool calls
      await db.insert(messages).values({
        conversationId,
        role: 'assistant',
        content: response.content || '',
        toolCalls: response.toolCalls,
      });

      // Execute each tool and add results
      for (const toolCall of response.toolCalls) {
        const handler = this.toolHandlers.get(toolCall.name);
        let result: string;

        if (handler) {
          try {
            result = await handler(toolCall.arguments);
          } catch (error) {
            result = `Error executing tool: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        } else {
          result = `Tool "${toolCall.name}" is not implemented`;
        }

        toolsUsed.push({ name: toolCall.name, result });

        // Add tool result to message history
        messageHistory.push({
          role: 'tool',
          content: result,
          tool_call_id: toolCall.id,
        });

        // Save tool result message
        await db.insert(messages).values({
          conversationId,
          role: 'tool',
          content: result,
          toolCallId: toolCall.id,
        });
      }
    }

    throw new Error(`Agent exceeded maximum iterations (${maxIterations})`);
  }
}

export const agentService = new AgentService();
