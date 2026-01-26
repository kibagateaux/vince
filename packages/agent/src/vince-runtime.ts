/**
 * @module @bangui/agent/vince-runtime
 * Dynamic AI response generation using Anthropic SDK
 */

import Anthropic from '@anthropic-ai/sdk';
import { vinceCharacter } from './character.js';
import { logAI, logSystem, logTimed } from './logger.js';
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

  logSystem.info('VinceRuntime initialized', {
    model,
    maxTokens,
    hasApiKey: !!config.apiKey,
  });

  /**
   * Builds the system prompt based on current context
   */
  function buildSystemPrompt(context: ResponseContext): string {
    logAI.debug('Building system prompt', {
      state: context.state,
      hasCurrentQuestion: !!context.currentQuestion,
      hasArchetype: !!context.archetype,
      storiesCount: context.stories?.length ?? 0,
    });

    let prompt = vinceCharacter.system ?? '';

    // Add state-specific instructions
    if (context.state === 'questionnaire_in_progress' && context.currentQuestion) {
      logAI.debug('Adding questionnaire instructions', {
        questionId: context.currentQuestion.id,
        questionText: context.currentQuestion.text.substring(0, 50) + '...',
      });
      prompt += `\n\nYou are currently asking the user a questionnaire question. The current question is:
Question ID: ${context.currentQuestion.id}
Question: ${context.currentQuestion.text}
Options: ${context.currentQuestion.options?.join(', ') || 'Open-ended'}

Guide the conversation naturally toward getting their answer to this question. Don't be robotic - have a conversation, but gently steer toward the topic.`;
    }

    if (context.state === 'questionnaire_complete' && context.archetype) {
      logAI.debug('Adding completion instructions', { archetype: context.archetype });
      prompt += `\n\nThe user has completed the questionnaire. Their primary archetype is: ${context.archetype}

Present their results warmly and recommend relevant investment opportunities from the available stories.`;
    }

    if (context.stories && context.stories.length > 0) {
      logAI.debug('Adding story recommendations', {
        stories: context.stories.map(s => s.title),
      });
      prompt += `\n\nAvailable investment opportunities to recommend:
${context.stories.map(s => `- ${s.title} (${s.causeCategory}): ${s.description} - Min: $${s.minInvestment}`).join('\n')}`;
    }

    // Add style guidelines
    prompt += `\n\nStyle guidelines:
${vinceCharacter.style?.all?.join('\n') || ''}
${vinceCharacter.style?.chat?.join('\n') || ''}

Keep responses concise (2-4 sentences typically). Be warm and conversational, not robotic.`;

    logAI.debug('System prompt built', { promptLength: prompt.length });
    return prompt;
  }

  /**
   * Generates a dynamic response based on context
   */
  async function generateResponse(context: ResponseContext): Promise<string> {
    const done = logTimed('AI', 'generateResponse');

    logAI.info('Generating response', {
      state: context.state,
      messageCount: context.messages.length,
      lastUserMessage: context.messages.length > 0
        ? context.messages[context.messages.length - 1]?.content.substring(0, 100) + '...'
        : 'none',
    });

    const systemPrompt = buildSystemPrompt(context);

    // Convert our messages to Anthropic format
    // Anthropic API requires at least one message
    const messages = context.messages.length > 0
      ? context.messages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))
      : [{ role: 'user' as const, content: 'Hello, I just connected.' }];

    logAI.debug('Calling Claude API', {
      model,
      maxTokens,
      messageCount: messages.length,
      systemPromptLength: systemPrompt.length,
    });

    try {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
      });

      logAI.info('Claude API response received', {
        stopReason: response.stop_reason,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        contentBlocks: response.content.length,
      });

      // Extract text from response
      const textBlock = response.content.find(block => block.type === 'text');
      const responseText = textBlock?.text ?? "I'm here to help. What would you like to explore?";

      logAI.debug('Response extracted', {
        responseLength: responseText.length,
        responsePreview: responseText.substring(0, 100) + '...',
      });

      done();
      return responseText;
    } catch (error) {
      logAI.error('Claude API call failed', {
        error: error instanceof Error ? error.message : String(error),
        model,
      });
      throw error;
    }
  }

  /**
   * Generates a welcome message for a new user
   */
  async function generateWelcome(): Promise<string> {
    logAI.info('Generating welcome message for new user');
    const response = await generateResponse({
      messages: [],
      state: 'idle',
    });
    logAI.info('Welcome message generated', {
      responseLength: response.length,
    });
    return response;
  }

  /**
   * Generates a response to a user message during questionnaire
   */
  async function generateQuestionnaireResponse(
    messages: ConversationMessage[],
    currentQuestion: Question,
    userJustAnswered: boolean
  ): Promise<string> {
    const done = logTimed('AI', 'generateQuestionnaireResponse');

    logAI.info('Generating questionnaire response', {
      questionId: currentQuestion.id,
      questionText: currentQuestion.text.substring(0, 50) + '...',
      userJustAnswered,
      messageCount: messages.length,
    });

    let systemAddition = '';
    if (userJustAnswered) {
      systemAddition = '\n\nThe user just answered the previous question. Acknowledge their response briefly and naturally transition to the current question.';
      logAI.debug('Adding user-just-answered instruction');
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

    logAI.debug('Calling Claude API for questionnaire', {
      model,
      maxTokens,
      messageCount: apiMessages.length,
      systemPromptLength: systemPrompt.length,
    });

    try {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: apiMessages,
      });

      logAI.info('Questionnaire response received', {
        stopReason: response.stop_reason,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      });

      const textBlock = response.content.find(block => block.type === 'text');
      const responseText = textBlock?.text ?? currentQuestion.text;

      logAI.debug('Questionnaire response extracted', {
        responseLength: responseText.length,
        responsePreview: responseText.substring(0, 100) + '...',
      });

      done();
      return responseText;
    } catch (error) {
      logAI.error('Questionnaire response generation failed', {
        error: error instanceof Error ? error.message : String(error),
        questionId: currentQuestion.id,
      });
      throw error;
    }
  }

  /**
   * Generates analysis results presentation
   */
  async function generateAnalysisPresentation(
    messages: ConversationMessage[],
    archetype: string,
    stories: ResponseContext['stories']
  ): Promise<string> {
    logAI.info('Generating analysis presentation', {
      archetype,
      storiesCount: stories?.length ?? 0,
      messageCount: messages.length,
    });

    const response = await generateResponse({
      messages,
      state: 'questionnaire_complete',
      archetype,
      stories,
    });

    logAI.info('Analysis presentation generated', {
      responseLength: response.length,
      archetype,
    });

    return response;
  }

  return {
    generateResponse,
    generateWelcome,
    generateQuestionnaireResponse,
    generateAnalysisPresentation,
  };
}

export type VinceRuntime = ReturnType<typeof createVinceRuntime>;
