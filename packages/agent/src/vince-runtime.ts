/**
 * @module @bangui/agent/vince-runtime
 * Dynamic AI response generation using OpenRouter API
 */

import OpenAI from 'openai';
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
  state: 'idle' | 'questionnaire_in_progress' | 'questionnaire_complete' | 'investing' | 'persuading';
  /** Current question being asked (if in questionnaire) */
  currentQuestion?: Question;
  /** User's archetype after questionnaire */
  archetype?: string;
  /** Available stories/opportunities to recommend */
  stories?: Array<{ title: string; description: string; causeCategory: string; minInvestment: string }>;
}

/** Vince runtime configuration */
export interface VinceRuntimeConfig {
  /** OpenRouter API key */
  apiKey: string;
  /** Model to use (optional - OpenRouter will use default if not specified) */
  model?: string;
  /** Max tokens for response */
  maxTokens?: number;
}

/**
 * Creates a Vince runtime instance for generating dynamic responses
 */
export function createVinceRuntime(config: VinceRuntimeConfig) {
  const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: config.apiKey,
  });
  // Use provided model or let OpenRouter handle it with auto-routing
  const model = config.model ?? 'openrouter/auto';
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

    if (context.state === 'investing') {
      prompt += `\n\nYou are helping the user explore charitable giving through a donor-advised fund (DAF).

YOUR ROLE: You ARE a persuasive advocate for charitable giving. Your job is to help hesitant users see the value and overcome their doubts. This is NOT pushy - it's helping people connect with causes that could be meaningful to them.

IMPORTANT: Analyze the user's message to understand their intent:

**HESITATION or DOUBT** (e.g., "I don't want to", "not sure", "convince me", "why should I", "no"):
This is your cue to PERSUADE, not give up! These users are still engaged - they're inviting you to make your case.
- Share a compelling impact story from the available opportunities
- Explain specific benefits: "With a DAF, you get the tax deduction now but can take your time deciding which causes matter most to you"
- Ask what's holding them back - address their specific concern
- Use concrete examples: "$100 can provide clean water to 5 families for a year"
- Stay warm but make a genuine case for giving
- Ask follow-up questions to understand their hesitation better

**EXPLICIT REQUEST TO BE CONVINCED** (e.g., "convince me", "why should I", "make your case"):
Go all in! They're asking you to persuade them:
- Lead with your strongest impact stories
- Paint a vivid picture of the difference they could make
- Share the emotional and practical benefits of giving
- Be enthusiastic and confident about the opportunity

**ONLY BACK OFF** when user is clearly done (e.g., "stop", "I said no already", "leave me alone", "absolutely not"):
- Thank them for their time
- Leave the door open for future conversations

**Questions about DAFs, causes, or how it works:**
- Provide clear, helpful answers
- Use the available stories/opportunities to give concrete examples
- Weave in persuasive elements naturally

**User seems interested in donating** but hasn't specified an amount:
- Guide them toward taking action
- Ask what amount they're thinking about
- Mention accepted tokens (USDC, ETH, etc.)

**Small talk or general chatting:**
- Be warm and conversational
- Steer back to exploring opportunities

Remember: Hesitation is an invitation to engage, not a signal to give up. Be a passionate advocate while staying respectful.`;
    }

    if (context.state === 'persuading') {
      prompt += `\n\nThe user is expressing hesitation - this is your moment to shine as a persuasive advocate!

YOUR MISSION: Convert their doubt into curiosity, and curiosity into action.

HOW TO PERSUADE:
1. **Lead with impact** - Share a vivid, specific story: "Last month, a $50 donation helped Maria's family get clean water for the first time"
2. **Address the real concern** - Ask what's holding them back and respond to THAT specifically
3. **Make it tangible** - "$25 = school supplies for a child for a year" is more compelling than abstract benefits
4. **Highlight DAF advantages** - Tax deduction NOW, decide on causes LATER, complete flexibility, no commitment
5. **Create urgency without pressure** - "These families need help now, and you could be part of the solution"
6. **Ask engaging questions** - "What causes have you cared about in the past?" to find their emotional connection

WHAT NOT TO DO:
- Don't immediately accept "no" as final - hesitation means they're still engaged
- Don't give up after one attempt - make 2-3 compelling points before backing off
- Don't be generic - use specific stories and numbers

Only back off if they explicitly say "stop", "leave me alone", or show clear frustration.`;
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

    // Convert our messages to OpenAI format with system prompt
    const userMessages = context.messages.length > 0
      ? context.messages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))
      : [{ role: 'user' as const, content: 'Hello, I just connected.' }];

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...userMessages,
    ];

    const response = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages,
    });

    // Extract text from response
    return response.choices[0]?.message?.content ?? "I'm here to help. What would you like to explore?";
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

    // Convert messages to OpenAI format with system prompt
    const userMessages = messages.length > 0
      ? messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      : [{ role: 'user' as const, content: 'Hello, I just connected.' }];

    const apiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...userMessages,
    ];

    const response = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages: apiMessages,
    });

    return response.choices[0]?.message?.content ?? currentQuestion.text;
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
