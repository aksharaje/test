import { AgentTool, ToolCall } from '../db/schema.js';

export type Message = {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: OpenRouterToolCall[];
  tool_call_id?: string;
};

type OpenRouterToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

type OpenRouterTool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

type OpenRouterResponse = {
  id: string;
  choices: {
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: OpenRouterToolCall[];
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export class OpenRouterService {
  private apiKey: string | null = null;
  private baseUrl = 'https://openrouter.ai/api/v1';
  private defaultModel: string | null = null;

  private getApiKey(): string {
    if (!this.apiKey) {
      this.apiKey = process.env.OPENROUTER_API_KEY || '';
      if (!this.apiKey) {
        throw new Error('OPENROUTER_API_KEY is not set');
      }
    }
    return this.apiKey;
  }

  private getDefaultModel(): string {
    if (!this.defaultModel) {
      this.defaultModel = process.env.OPENROUTER_MODEL || 'openai/gpt-oss-120b';
    }
    return this.defaultModel;
  }

  async chat(
    messages: Message[],
    options: {
      model?: string;
      tools?: AgentTool[];
      toolChoice?: 'auto' | 'required' | 'none';
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<{
    content: string;
    toolCalls?: ToolCall[];
    finishReason: string;
    usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  }> {
    const { model = this.getDefaultModel(), tools, toolChoice = 'auto', temperature = 0.7, maxTokens = 4096 } = options;

    const requestBody: Record<string, unknown> = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    };

    if (tools && tools.length > 0) {
      requestBody.tools = tools.map(
        (tool): OpenRouterTool => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        })
      );
      requestBody.tool_choice = toolChoice;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.getApiKey()}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'PS Prototype',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as OpenRouterResponse;
    const choice = data.choices[0];

    const result: {
      content: string;
      toolCalls?: ToolCall[];
      finishReason: string;
      usage: { promptTokens: number; completionTokens: number; totalTokens: number };
    } = {
      content: choice.message.content || '',
      finishReason: choice.finish_reason,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
    };

    if (choice.message.tool_calls) {
      result.toolCalls = choice.message.tool_calls.map((tc) => {
        let args: Record<string, unknown> = {};
        if (tc.function.arguments) {
          try {
            args = JSON.parse(tc.function.arguments);
          } catch {
            console.warn(`Failed to parse tool arguments: ${tc.function.arguments}`);
            args = {};
          }
        }
        return {
          id: tc.id,
          name: tc.function.name,
          arguments: args,
        };
      });
    }

    return result;
  }
}

export const openrouter = new OpenRouterService();
