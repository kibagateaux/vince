/**
 * @module @bangui/agents/shared/llm/openrouter-client
 * OpenRouter LLM client for agent communication
 */

import OpenAI from 'openai';

export interface OpenRouterConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  jsonMode?: boolean;
  temperature?: number;
}

/**
 * Creates an OpenRouter client for LLM interactions
 */
export function createOpenRouterClient(config: OpenRouterConfig) {
  const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: config.apiKey,
  });
  const model = config.model ?? 'openrouter/auto';
  const maxTokens = config.maxTokens ?? 2048;

  /**
   * Generate a chat completion
   */
  async function complete(options: ChatCompletionOptions): Promise<string> {
    const { messages, jsonMode = false, temperature = 0.7 } = options;

    const response = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages,
      temperature,
      ...(jsonMode && { response_format: { type: 'json_object' } }),
    });

    return response.choices[0]?.message?.content ?? '';
  }

  /**
   * Generate a JSON response
   */
  async function completeJSON<T>(options: ChatCompletionOptions): Promise<T> {
    const content = await complete({ ...options, jsonMode: true });
    return JSON.parse(content) as T;
  }

  return {
    complete,
    completeJSON,
    model,
    maxTokens,
  };
}

export type OpenRouterClient = ReturnType<typeof createOpenRouterClient>;
