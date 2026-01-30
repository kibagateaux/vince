/**
 * @module @bangui/agents/shared/llm/anthropic-client
 * Anthropic LLM client for agent communication
 */

import Anthropic from '@anthropic-ai/sdk';

export interface AnthropicConfig {
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
 * Creates an Anthropic client for LLM interactions
 */
export function createAnthropicClient(config: AnthropicConfig) {
  const client = new Anthropic({
    apiKey: config.apiKey,
  });
  const model = config.model ?? 'claude-sonnet-4-20250514';
  const maxTokens = config.maxTokens ?? 2048;

  /**
   * Generate a chat completion
   */
  async function complete(options: ChatCompletionOptions): Promise<string> {
    const { messages, jsonMode = false, temperature = 0.7 } = options;

    // Extract system message if present
    const systemMessage = messages.find((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    // Convert to Anthropic format
    const anthropicMessages = nonSystemMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Add JSON mode instruction to system prompt if needed
    let systemPrompt = systemMessage?.content ?? '';
    if (jsonMode) {
      systemPrompt += '\n\nIMPORTANT: You must respond with valid JSON only. No other text.';
    }

    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      messages: anthropicMessages,
      system: systemPrompt || undefined,
      temperature,
    });

    // Extract text from response
    const textBlock = response.content.find((block) => block.type === 'text');
    return textBlock?.type === 'text' ? textBlock.text : '';
  }

  /**
   * Generate a JSON response
   */
  async function completeJSON<T>(options: ChatCompletionOptions): Promise<T> {
    const content = await complete({ ...options, jsonMode: true });
    // Try to extract JSON from the response (handle potential markdown wrapping)
    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
    return JSON.parse(jsonStr) as T;
  }

  return {
    complete,
    completeJSON,
    model,
    maxTokens,
  };
}

export type AnthropicClient = ReturnType<typeof createAnthropicClient>;
