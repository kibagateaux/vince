/**
 * @module @bangui/agent/vince-runtime
 * Dynamic AI response generation using Anthropic SDK
 */

import Anthropic from '@anthropic-ai/sdk';
import { vinceCharacter } from './character.js';
import type { Question } from '@bangui/types';

/** Message in conversation history */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Context for generating a response */
export interface ResponseContext {
  /** Conversation history */
  messages: ConversationMessage[];
  /** Current conversation state */
  state: 'idle' | 'questionnaire_in_progress' | 'questionnaire_complete' | 'investing';
  /** Current question being asked (if in questionnaire) */
  currentQuestion?: Question;
  /** User's archetype after questionnaire */
  archetype?: string;
  /** Available stories/opportunities to recommend */
  stories?: Array<{ title: string; description: string; causeCategory: string; minInvestment: string }>;
}

/** Vince runtime configuration */
export interface VinceRuntimeConfig {
  /** Anthropic API key */
  apiKey: string;
  /** Model to use (defaults to claude-sonnet-4-20250514) */
  model?: string;
  /** Max tokens for response */
  maxTokens?: number;
}

/**
 * Creates a Vince runtime instance for generating dynamic responses
 */
export function createVinceRuntime(config: VinceRuntimeConfig) {
  const client = new Anthropic({ apiKey: config.apiKey });
  const model = config.model ?? (vinceCharacter.settings?.model as string) ?? 'claude-sonnet-4-20250514';
  const maxTokens = config.maxTokens ?? 1024;

  /**
   * Builds the system prompt based on current context
   */
  function buildSystemPrompt(context: ResponseContext): string {
    let prompt = vinceCharacter.system ?? '';

    // Add state-specific instructions
    if (context.state === 'questionnaire_in_progress' && context.currentQuestion) {
      prompt += `\n\nYou are currently asking the user a questionnaire question. The current question is:
Question ID: ${context.currentQuestion.id}
Question: ${context.currentQuestion.text}
Options: ${context.currentQuestion.options?.join(', ') || 'Open-ended'}

Guide the conversation naturally toward getting their answer to this question. Don't be robotic - have a conversation, but gently steer toward the topic.`;
    }

    if (context.state === 'questionnaire_complete' && context.archetype) {
      prompt += `\n\nThe user has completed the questionnaire. Their primary archetype is: ${context.archetype}

Present their results warmly and recommend relevant investment opportunities from the available stories.`;
    }

    if (context.stories && context.stories.length > 0) {
      prompt += `\n\nAvailable investment opportunities to recommend:
${context.stories.map(s => `- ${s.title} (${s.causeCategory}): ${s.description} - Min: $${s.minInvestment}`).join('\n')}`;
    }

    // Add style guidelines
    prompt += `\n\nStyle guidelines:
${vinceCharacter.style?.all?.join('\n') || ''}
${vinceCharacter.style?.chat?.join('\n') || ''}

Keep responses concise (2-4 sentences typically). Be warm and conversational, not robotic.`;

    return prompt;
  }

  /**
   * Generates a dynamic response based on context
   */
  async function generateResponse(context: ResponseContext): Promise<string> {
    const systemPrompt = buildSystemPrompt(context);

    // Convert our messages to Anthropic format
    // Anthropic API requires at least one message
    const messages = context.messages.length > 0
      ? context.messages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))
      : [{ role: 'user' as const, content: 'Hello, I just connected.' }];

    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    });

    // Extract text from response
    const textBlock = response.content.find(block => block.type === 'text');
    return textBlock?.text ?? "I'm here to help. What would you like to explore?";
  }

  /**
   * Generates a welcome message for a new user
   */
  async function generateWelcome(): Promise<string> {
    return generateResponse({
      messages: [],
      state: 'idle',
    });
  }

  /**
   * Generates a response to a user message during questionnaire
   */
  async function generateQuestionnaireResponse(
    messages: ConversationMessage[],
    currentQuestion: Question,
    userJustAnswered: boolean
  ): Promise<string> {
    let systemAddition = '';
    if (userJustAnswered) {
      systemAddition = '\n\nThe user just answered the previous question. Acknowledge their response briefly and naturally transition to the current question.';
    }

    const context: ResponseContext = {
      messages,
      state: 'questionnaire_in_progress',
      currentQuestion,
    };

    const systemPrompt = buildSystemPrompt(context) + systemAddition;

    // Anthropic API requires at least one message
    const apiMessages = messages.length > 0
      ? messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      : [{ role: 'user' as const, content: 'Hello, I just connected.' }];

    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: apiMessages,
    });

    const textBlock = response.content.find(block => block.type === 'text');
    return textBlock?.text ?? currentQuestion.text;
  }

  /**
   * Generates analysis results presentation
   */
  async function generateAnalysisPresentation(
    messages: ConversationMessage[],
    archetype: string,
    stories: ResponseContext['stories']
  ): Promise<string> {
    return generateResponse({
      messages,
      state: 'questionnaire_complete',
      archetype,
      stories,
    });
  }

  return {
    generateResponse,
    generateWelcome,
    generateQuestionnaireResponse,
    generateAnalysisPresentation,
  };
}

export type VinceRuntime = ReturnType<typeof createVinceRuntime>;
