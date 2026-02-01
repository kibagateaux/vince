/**
 * @module @bangui/agent/vince-runtime
 * Dynamic AI response generation using Anthropic or OpenRouter API
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { vinceCharacter } from './character.js';
import type { Question } from '@bangui/types';

/** LLM provider type */
export type LLMProvider = 'openrouter' | 'anthropic';

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
  /** API key (OpenRouter or Anthropic) */
  apiKey: string;
  /** LLM provider to use */
  provider?: LLMProvider;
  /** Model to use (optional) */
  model?: string;
  /** Max tokens for response */
  maxTokens?: number;
}

/**
 * Structured analysis of user intent from LLM
 */
export interface UserIntentAnalysis {
  /** Summary of what the user wants to do */
  intentSummary: string;
  /** Primary intent category */
  intentType: 'deposit' | 'question' | 'hesitation' | 'exploration' | 'greeting' | 'other';
  /** User's emotional tone */
  emotion: 'excited' | 'neutral' | 'hesitant' | 'confused' | 'frustrated' | 'curious';
  /** Confidence level (0-1) */
  confidence: number;
  /** Requested asset/token if mentioned */
  asset?: string;
  /** Requested amount if mentioned */
  amount?: string;
  /** Investment strategy preference if expressed */
  strategyPreference?: 'conservative' | 'balanced' | 'aggressive' | 'impact-focused';
  /** Cause categories the user seems interested in */
  causeInterests?: string[];
  /** Any concerns or objections expressed */
  concerns?: string[];
  /** Whether the user seems ready to take action */
  readyToAct: boolean;
  /** Raw keywords that triggered the analysis */
  triggerKeywords: string[];
}

/**
 * Creates a Vince runtime instance for generating dynamic responses
 */
export function createVinceRuntime(config: VinceRuntimeConfig) {
  const provider = config.provider ?? 'openrouter';
  const maxTokens = config.maxTokens ?? 1024;

  // Create appropriate client based on provider
  let openaiClient: OpenAI | null = null;
  let anthropicClient: Anthropic | null = null;
  let model: string;

  if (provider === 'anthropic') {
    anthropicClient = new Anthropic({ apiKey: config.apiKey });
    model = config.model ?? 'claude-sonnet-4-20250514';
  } else {
    openaiClient = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: config.apiKey,
    });
    model = config.model ?? 'openrouter/auto';
  }

  /**
   * Complete a chat request using the configured provider
   */
  async function completeChat(
    systemPrompt: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    if (provider === 'anthropic' && anthropicClient) {
      const response = await anthropicClient.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: 0.7,
      });

      const textBlock = response.content.find((block) => block.type === 'text');
      return textBlock?.type === 'text' ? textBlock.text : '';
    } else if (openaiClient) {
      const apiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ];

      const response = await openaiClient.chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages: apiMessages,
        temperature: 0.7,
      });

      return response.choices[0]?.message?.content ?? '';
    }

    throw new Error('No LLM client configured');
  }

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

    const userMessages = context.messages.length > 0
      ? context.messages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))
      : [{ role: 'user' as const, content: 'Hello, I just connected.' }];

    const result = await completeChat(systemPrompt, userMessages);
    return result || "I'm here to help. What would you like to explore?";
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

    const userMessages = messages.length > 0
      ? messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      : [{ role: 'user' as const, content: 'Hello, I just connected.' }];

    const result = await completeChat(systemPrompt, userMessages);
    return result || currentQuestion.text;
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

  /**
   * Analyzes user intent and returns structured data for tracking
   * Uses a fast/cheap model for efficiency
   * Can analyze across conversation history to piece together deposit details from multiple messages
   */
  async function analyzeUserIntent(
    userMessage: string,
    triggerKeywords: string[],
    conversationHistory?: ConversationMessage[]
  ): Promise<UserIntentAnalysis | null> {
    const systemPrompt = `You are analyzing a user message from a charitable giving platform. The user is interacting with Vince, an AI assistant helping them donate to causes through a donor-advised fund (DAF).

IMPORTANT: Look at BOTH the current message AND the conversation history to extract deposit details. Users often provide information across multiple messages:
- Token/asset in one message (e.g., "I want to use ETH", "WBTC please")
- Amount in another message (e.g., "100", "0.5")
- Cause preferences mentioned earlier

Aggregate all relevant information from the conversation to build a complete picture.

Analyze and return a JSON object with the following structure:
{
  "intentSummary": "Brief 1-2 sentence summary of what the user wants",
  "intentType": "deposit" | "question" | "hesitation" | "exploration" | "greeting" | "other",
  "emotion": "excited" | "neutral" | "hesitant" | "confused" | "frustrated" | "curious",
  "confidence": 0.0-1.0,
  "asset": "token symbol if mentioned in current OR previous messages (e.g., USDC, ETH, WBTC) or null",
  "amount": "numeric amount as string if mentioned in current OR previous messages or null",
  "strategyPreference": "conservative" | "balanced" | "aggressive" | "impact-focused" | null,
  "causeInterests": ["array of cause categories mentioned anywhere in conversation"],
  "concerns": ["array of any concerns or objections expressed"],
  "readyToAct": true if user has provided enough info for a deposit (asset + amount) or is confirming
}

Be accurate. Extract asset and amount from ANY message in the conversation, not just the current one.
Return ONLY a valid JSON object. No other text.`;

    // Build conversation context for analysis
    let conversationContext = '';
    if (conversationHistory && conversationHistory.length > 0) {
      const recentMessages = conversationHistory.slice(-10); // Last 10 messages for context
      conversationContext = `\n\nConversation history (oldest to newest):\n${recentMessages.map(m => `${m.role}: ${m.content}`).join('\n')}\n\n`;
    }

    const analysisPrompt = `${conversationContext}Current user message: "${userMessage}"

Keywords that triggered this analysis: ${triggerKeywords.join(', ')}

Extract ALL deposit-related details (asset, amount, causes) from the ENTIRE conversation, not just the current message.`;

    try {
      if (provider === 'anthropic' && anthropicClient) {
        const response = await anthropicClient.messages.create({
          model: 'claude-haiku-3-5-20241022', // Use fast/cheap model for analysis
          max_tokens: 512,
          system: systemPrompt,
          messages: [{ role: 'user', content: analysisPrompt }],
          temperature: 0.3,
        });

        const textBlock = response.content.find((block) => block.type === 'text');
        const text = textBlock?.type === 'text' ? textBlock.text : '';

        // Parse JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0]) as Omit<UserIntentAnalysis, 'triggerKeywords'>;
          return { ...analysis, triggerKeywords };
        }
      } else if (openaiClient) {
        const response = await openaiClient.chat.completions.create({
          model: 'anthropic/claude-3-haiku', // Use fast/cheap model via OpenRouter
          max_tokens: 512,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: analysisPrompt },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        });

        const text = response.choices[0]?.message?.content ?? '';
        if (text) {
          const analysis = JSON.parse(text) as Omit<UserIntentAnalysis, 'triggerKeywords'>;
          return { ...analysis, triggerKeywords };
        }
      }
    } catch (err) {
      console.error('[Intent Analysis] Failed to analyze user intent:', err);
      return null;
    }

    return null;
  }

  return {
    generateResponse,
    generateWelcome,
    generateQuestionnaireResponse,
    generateAnalysisPresentation,
    analyzeUserIntent,
  };
}

export type VinceRuntime = ReturnType<typeof createVinceRuntime>;
