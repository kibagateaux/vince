/**
 * Chat helpers shared across chat API routes
 */

import type { Db } from './db';
import {
  getConversation,
  createMessage,
  getConversationMessages,
  updateConversationState,
  getQuestionnaireResponses,
  saveQuestionnaireResponse,
  getUserProfile,
  getStoriesByCauseCategories,
  type ConversationState,
  type MessageRow,
} from './db';
import {
  getNextQuestion,
  isQuestionnaireComplete,
  questionById,
  analyzeResponses,
  createVinceRuntime,
  type VinceRuntime,
  type ConversationMessage,
} from '@bangui/agents';
import { Chain, CHAIN_ID_TO_NAME, CHAIN_DISPLAY_NAMES } from '@bangui/types';
import type { UUID, ActionPrompt, AgentResponse } from '@bangui/types';
import {
  separateVaultsByCurrentChain,
  getPrimaryVaultByChainId,
  getVaultChainDisplayName,
  type VaultMetadata,
} from './vaults';
import { DEFAULT_CHAIN_ID } from './chains';

/** Lazily initialized Vince runtime */
let vinceRuntime: VinceRuntime | null = null;

/**
 * Gets or creates the Vince runtime
 * Prefers Anthropic over OpenRouter if API key is available
 */
export const getVinceRuntime = (): VinceRuntime | null => {
  if (!vinceRuntime) {
    // Prefer Anthropic if available, fall back to OpenRouter
    if (process.env.ANTHROPIC_API_KEY) {
      console.log('[Vince] Using Anthropic provider');
      vinceRuntime = createVinceRuntime({
        apiKey: process.env.ANTHROPIC_API_KEY,
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
      });
    } else if (process.env.OPENROUTER_API_KEY) {
      console.log('[Vince] Using OpenRouter provider');
      vinceRuntime = createVinceRuntime({
        apiKey: process.env.OPENROUTER_API_KEY,
        provider: 'openrouter',
        model: process.env.OPENROUTER_MODEL,
      });
    }
  }
  return vinceRuntime;
};

/**
 * Returns appropriate fallback response when AI is unavailable
 */
const getFallbackResponse = (state: 'investing' | 'persuading'): string => {
  if (state === 'persuading') {
    return `I understand you might have some hesitation - that's completely natural when it comes to charitable giving.

What makes donor-advised funds special is the flexibility: you get the tax benefit now, but you decide when and where to give later. There's no pressure to commit to specific charities right away.

Would you like to learn more about how DAFs work, or perhaps explore some of the causes that other donors have found meaningful?`;
  }

  return `I'm here to help you find the right investment opportunities. You can:
- Ask about specific causes or initiatives
- Learn more about impact metrics
- Make a deposit when you're ready

What would you like to explore?`;
};

/**
 * Parses deposit info from AI-generated response
 * Looks for patterns like "$500 USDC", "500 USDC", etc. in the AI's response
 */
const parseDepositFromAIResponse = (
  content: string
): { amount: string; token: string } | null => {
  const knownTokens = ['USDC', 'ETH', 'USDT', 'DAI', 'WETH'];
  const tokenPattern = knownTokens.join('|');

  // Patterns to find deposit amounts in AI responses
  const patterns = [
    // "$500 USDC", "$100 ETH"
    new RegExp(`\\$(\\d+(?:,\\d{3})*(?:\\.\\d+)?)\\s*(${tokenPattern})`, 'i'),
    // "500 USDC", "100 ETH"
    new RegExp(`(\\d+(?:,\\d{3})*(?:\\.\\d+)?)\\s*(${tokenPattern})`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1] && match[2]) {
      const amount = match[1].replace(/,/g, ''); // Remove commas from numbers
      const token = match[2].toUpperCase();
      if (knownTokens.includes(token)) {
        return { amount, token };
      }
    }
  }
  return null;
};

/**
 * Format database messages for client consumption
 */
export const formatMessagesForClient = (
  messages: MessageRow[]
): Array<{
  id: string;
  sender: string;
  content: string;
  actions?: ActionPrompt[];
  timestamp: number;
}> => {
  return messages.map((m) => {
    const metadata = m.metadata as { actions?: ActionPrompt[] } | null;
    return {
      id: m.id,
      sender: m.sender,
      content: m.content,
      actions: metadata?.actions,
      timestamp: new Date(m.sent_at).getTime(),
    };
  });
};

/**
 * Generates welcome message with first question
 */
export const generateWelcome = async (
  db: Db,
  userId: string,
  vinceRuntime: VinceRuntime | null
): Promise<{ content: string; actions?: readonly ActionPrompt[] }> => {
  const responses = await getQuestionnaireResponses(db, userId);
  const answeredIds = new Set(responses.map((r) => r.question_id));
  const nextQ = getNextQuestion(answeredIds);

  let welcome: string;
  if (vinceRuntime && nextQ) {
    try {
      welcome = await vinceRuntime.generateQuestionnaireResponse([], nextQ, false);
    } catch (err) {
      console.error('[AI] Welcome generation failed:', err);
      welcome = `Hi! I'm Vince, and I'm here to help you discover how your values can drive meaningful impact.

Before we dive in, I'd love to learn a bit about what matters to you. I have a few quick questions - there are no wrong answers, just your honest thoughts.

Let's start: ${nextQ.text}`;
    }
  } else {
    welcome = `Hi! I'm Vince, and I'm here to help you discover how your values can drive meaningful impact.

Before we dive in, I'd love to learn a bit about what matters to you. I have a few quick questions - there are no wrong answers, just your honest thoughts.`;
    if (nextQ) {
      welcome += `\n\nLet's start: ${nextQ.text}`;
    }
  }

  if (nextQ) {
    return {
      content: welcome,
      actions: nextQ.options
        ? [{ type: 'questionnaire', data: { questionId: nextQ.id, options: nextQ.options } }]
        : undefined,
    };
  }

  return { content: welcome };
};

/**
 * Process a user message and generate response
 */
export const processMessage = async (
  db: Db,
  userId: string,
  conversationId: string,
  content: string,
  state: string,
  vinceRuntime: VinceRuntime | null,
  questionId?: string,
  chainId?: number
): Promise<AgentResponse> => {
  // Use provided chainId or fall back to default
  const userChainId = chainId ?? DEFAULT_CHAIN_ID;
  const messageTimestamp = Date.now();

  // Determine which question is being answered
  let questionBeingAnswered = questionId;
  if (!questionBeingAnswered && state === 'questionnaire_in_progress') {
    const existingResponses = await getQuestionnaireResponses(db, userId);
    const answeredIds = new Set(existingResponses.map((r) => r.question_id));
    const currentQ = getNextQuestion(answeredIds);
    questionBeingAnswered = currentQ?.id;
  }

  // Save user message
  await createMessage(db, {
    conversationId,
    sender: 'user',
    content,
    metadata: {
      questionId: questionBeingAnswered,
      conversationState: state,
      timestamp: messageTimestamp,
    },
  });

  // Handle based on conversation state - AI determines intent intelligently
  if (state === 'questionnaire_in_progress') {
    return handleQuestionnaireResponse(
      db,
      userId,
      conversationId,
      content,
      messageTimestamp,
      vinceRuntime,
      userChainId
    );
  } else if (state === 'investment_suggestions') {
    return handleInvestmentQuery(db, userId, conversationId, content, vinceRuntime, userChainId);
  }

  // Default response - use AI if available
  let defaultContent = "I'm here to help! Would you like to continue exploring investment opportunities?";
  if (vinceRuntime) {
    try {
      const messages = await getConversationMessages(db, conversationId);
      const history: ConversationMessage[] = messages.map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));
      defaultContent = await vinceRuntime.generateResponse({
        messages: history,
        state: state as 'idle' | 'questionnaire_in_progress' | 'questionnaire_complete' | 'investing' | 'persuading',
      });
    } catch (err) {
      console.error('AI response failed, using fallback:', err);
    }
  }

  await createMessage(db, { conversationId, sender: 'vince', content: defaultContent });

  return {
    type: 'response',
    conversationId: conversationId as UUID,
    agent: 'vince',
    content: defaultContent,
  };
};

/**
 * Handle questionnaire responses
 */
const handleQuestionnaireResponse = async (
  db: Db,
  userId: string,
  conversationId: string,
  content: string,
  messageTimestamp: number,
  vinceRuntime: VinceRuntime | null,
  userChainId: number
): Promise<AgentResponse> => {
  const existingResponses = await getQuestionnaireResponses(db, userId);
  const answeredIds = new Set(existingResponses.map((r) => r.question_id));
  const currentQuestion = getNextQuestion(answeredIds);

  // Save questionnaire response
  if (currentQuestion) {
    await saveQuestionnaireResponse(db, {
      userId,
      questionId: currentQuestion.id,
      response: { text: content, raw: content },
      responseTimeMs: Date.now() - messageTimestamp,
    });
    answeredIds.add(currentQuestion.id);
  }

  // Get next question
  const nextQ = getNextQuestion(answeredIds);

  // If questionnaire complete, analyze and move to suggestions
  if (!nextQ || isQuestionnaireComplete(answeredIds)) {
    const allResponses = await getQuestionnaireResponses(db, userId);
    const analysis = analyzeResponses(
      userId as UUID,
      allResponses.map((r) => ({ questionId: r.question_id, response: r.response }))
    );

    const topCauses = analysis.causeAffinities.slice(0, 3).map((a) => a.causeId);
    const storiesRaw = await getStoriesByCauseCategories(db, topCauses, 3);
    // Map to camelCase for compatibility with existing code
    const stories = storiesRaw.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      causeCategory: s.cause_category,
      impactMetrics: s.impact_metrics,
      minInvestment: s.min_investment,
      riskLevel: s.risk_level,
      createdAt: s.created_at,
      active: s.active,
    }));

    await updateConversationState(db, conversationId, 'investment_suggestions' as ConversationState);

    const archetypeDescriptions: Record<string, string> = {
      impact_maximizer: 'an Impact Maximizer - you value measurable outcomes and data-driven giving',
      community_builder: 'a Community Builder - you value local, relational impact',
      system_changer: 'a System Changer - you focus on root causes and systemic reform',
      values_expresser: 'a Values Expresser - your giving reflects your core identity',
      legacy_creator: 'a Legacy Creator - you think long-term and generationally',
      opportunistic_giver: 'an Opportunistic Giver - you respond to immediate needs',
    };

    const archetypeDesc =
      archetypeDescriptions[analysis.archetypeProfile.primaryArchetype] ??
      'aligned with thoughtful philanthropy';

    const storyList = stories
      .map((s, i) => `${i + 1}. **${s.title}** - ${s.description?.slice(0, 100)}...`)
      .join('\n');

    // Get vaults separated by current chain vs other chains
    const { currentChain: currentChainVaults, otherChains: otherChainVaults } =
      separateVaultsByCurrentChain(userChainId, topCauses);

    const currentChainName = CHAIN_ID_TO_NAME[userChainId];
    const currentChainDisplayName = currentChainName ? CHAIN_DISPLAY_NAMES[currentChainName] : 'your network';

    // Build vault context for AI - prioritize current chain vaults
    const vaultContext = currentChainVaults.length > 0
      ? `Available vaults on ${currentChainDisplayName}: ${currentChainVaults.map(v => v.name).join(', ')}. ` +
        (otherChainVaults.length > 0 ? `Other options on different chains: ${otherChainVaults.map(v => `${v.name} (${getVaultChainDisplayName(v)})`).join(', ')}.` : '')
      : otherChainVaults.length > 0
        ? `We have vaults available on other chains: ${otherChainVaults.map(v => `${v.name} (${getVaultChainDisplayName(v)})`).join(', ')}.`
        : '';

    let responseContent: string;
    if (vinceRuntime) {
      try {
        const messages = await getConversationMessages(db, conversationId);
        const history: ConversationMessage[] = messages.map((m) => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.content,
        }));
        responseContent = await vinceRuntime.generateAnalysisPresentation(
          history,
          analysis.archetypeProfile.primaryArchetype,
          stories.map((s) => ({
            title: s.title,
            description: s.description ?? '',
            causeCategory: s.causeCategory,
            minInvestment: s.minInvestment ?? '0',
          }))
        );
        // Append vault context if not already mentioned
        if (vaultContext && !responseContent.includes('vault')) {
          responseContent += `\n\n${vaultContext}`;
        }
      } catch (err) {
        console.error('AI analysis failed:', err);
        responseContent = `Thanks for sharing! Based on your responses, I'd say you're ${archetypeDesc}.

Here are some investment opportunities that align with your values:

${storyList}

${vaultContext}

Would you like to learn more about any of these, or explore other options?`;
      }
    } else {
      responseContent = `Thanks for sharing! Based on your responses, I'd say you're ${archetypeDesc}.

Here are some investment opportunities that align with your values:

${storyList}

${vaultContext}

Would you like to learn more about any of these, or explore other options?`;
    }

    const completionActions: ActionPrompt[] = [
      { type: 'suggestion', data: { stories: stories.map((s) => s.id) } },
    ];

    await createMessage(db, {
      conversationId,
      sender: 'vince',
      content: responseContent,
      metadata: {
        actionType: 'questionnaire_complete',
        analysis: {
          archetype: analysis.archetypeProfile.primaryArchetype,
          confidence: analysis.archetypeProfile.confidence,
          topCauses,
        },
        actions: completionActions,
      },
    });

    return {
      type: 'response',
      conversationId: conversationId as UUID,
      agent: 'vince',
      content: responseContent,
      actions: completionActions,
    };
  }

  // Send next question
  let nextQuestionResponse: string;
  if (vinceRuntime) {
    try {
      const messages = await getConversationMessages(db, conversationId);
      const history: ConversationMessage[] = messages.map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));
      nextQuestionResponse = await vinceRuntime.generateQuestionnaireResponse(history, nextQ, true);
    } catch (err) {
      console.error('AI questionnaire response failed:', err);
      nextQuestionResponse = `Great, thanks for sharing that.\n\n${nextQ.text}`;
    }
  } else {
    nextQuestionResponse = `Great, thanks for sharing that.\n\n${nextQ.text}`;
  }

  const nextQActions: ActionPrompt[] | undefined = nextQ.options
    ? [{ type: 'questionnaire', data: { questionId: nextQ.id, options: nextQ.options } }]
    : undefined;

  await createMessage(db, {
    conversationId,
    sender: 'vince',
    content: nextQuestionResponse,
    metadata: {
      questionId: nextQ.id,
      questionSection: questionById.get(nextQ.id)?.sectionId,
      actions: nextQActions,
    },
  });

  return {
    type: 'response',
    conversationId: conversationId as UUID,
    agent: 'vince',
    content: nextQuestionResponse,
    actions: nextQActions,
  };
};

/**
 * Parse deposit intent from user message
 */
const parseDepositIntent = (content: string): { amount: string; token: string } | null => {
  const knownTokens = ['USDC', 'ETH', 'USDT', 'DAI', 'WETH'];
  const tokenPattern = knownTokens.join('|');

  const patterns = [
    new RegExp(
      `(?:donate|deposit|invest|give|contribute|send|put)\\s+(\\d+(?:\\.\\d+)?)\\s*(${tokenPattern})`,
      'i'
    ),
    new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${tokenPattern})(?:\\s|$|\\.|,|!)`, 'i'),
    new RegExp(`(${tokenPattern})\\s+(\\d+(?:\\.\\d+)?)`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1] && match[2]) {
      let amount: string;
      let token: string;

      if (/^\d/.test(match[1])) {
        amount = match[1];
        token = match[2].toUpperCase();
      } else {
        token = match[1].toUpperCase();
        amount = match[2];
      }

      if (knownTokens.includes(token)) {
        return { amount, token };
      }
    }
  }
  return null;
};

/**
 * Generates an AI response using VinceRuntime, with appropriate fallbacks
 * @param state - The conversation state: 'investing' for general queries, 'persuading' for hesitant users
 * @param userChainId - The user's current chain ID for vault targeting
 */
const generateAIResponse = async (
  db: Db,
  conversationId: string,
  userMessage: string,
  vinceRuntime: VinceRuntime | null,
  state: 'investing' | 'persuading',
  userChainId?: number
): Promise<{ content: string; actions?: ActionPrompt[] }> => {
  const chainId = userChainId ?? DEFAULT_CHAIN_ID;
  const primaryVault = getPrimaryVaultByChainId(chainId);
  const targetChain = primaryVault?.chain ?? CHAIN_ID_TO_NAME[chainId] ?? Chain.SEPOLIA;
  let responseContent: string;

  if (vinceRuntime) {
    try {
      // Build conversation history
      const dbMessages = await getConversationMessages(db, conversationId);
      const history: ConversationMessage[] = dbMessages.map(m => ({
        role: m.sender === 'user' ? 'user' as const : 'assistant' as const,
        content: m.content,
      }));

      // Fetch available stories for context
      const storiesRaw = await getStoriesByCauseCategories(db, ['climate', 'education', 'health', 'social']);
      const storiesContext = storiesRaw.map(s => ({
        title: s.title,
        description: s.description ?? '',
        causeCategory: s.cause_category,
        minInvestment: String(s.min_investment),
      }));

      responseContent = await vinceRuntime.generateResponse({
        messages: history,
        state,
        stories: storiesContext,
      });
      console.log(`[DEBUG] AI generated ${state} response`);
    } catch (err) {
      console.error(`[ERROR] Failed to generate AI ${state} response:`, err);
      responseContent = getFallbackResponse(state);
    }
  } else {
    // No AI runtime available - use fallback
    console.log('[DEBUG] No AI runtime, using fallback response');
    responseContent = getFallbackResponse(state);
  }

  // Check if AI response mentions a specific deposit amount - if so, attach the action button
  const depositInfo = parseDepositFromAIResponse(responseContent);

  console.log('[DEBUG] Deposit detection:', {
    depositInfo,
    state,
    responsePreview: responseContent.substring(0, 150)
  });

  if (depositInfo) {
    console.log('[DEBUG] Attaching deposit action for', depositInfo.amount, depositInfo.token, 'on', targetChain);
    const depositActions: ActionPrompt[] = [
      {
        type: 'deposit',
        data: {
          action: 'sign',
          amount: depositInfo.amount,
          token: depositInfo.token,
          chain: targetChain,
          chainId,
          vaultId: primaryVault?.id,
        }
      },
    ];
    return { content: responseContent, actions: depositActions };
  }

  return { content: responseContent };
};

/**
 * Handle investment queries
 * Only parses explicit deposit amounts - AI handles all conversational responses
 */
const handleInvestmentQuery = async (
  db: Db,
  userId: string,
  conversationId: string,
  content: string,
  vinceRuntime: VinceRuntime | null,
  userChainId: number
): Promise<AgentResponse> => {
  console.log('[DEBUG] handleInvestmentQuery called with:', content.substring(0, 50));

  // Get the primary vault for user's current chain
  const primaryVault = getPrimaryVaultByChainId(userChainId);
  const targetChain = primaryVault?.chain ?? CHAIN_ID_TO_NAME[userChainId] ?? Chain.SEPOLIA;
  const targetChainId = primaryVault?.chainId ?? userChainId;

  // Try to parse explicit deposit intent (e.g., "donate 10 USDC")
  // Only triggers if user specifies both amount AND token
  const depositIntent = parseDepositIntent(content);

  if (depositIntent) {
    const chainDisplayName = CHAIN_DISPLAY_NAMES[targetChain];
    // User specified amount and token - prompt to confirm and sign
    const responseContent = `Great! You'd like to donate ${depositIntent.amount} ${depositIntent.token} on ${chainDisplayName}.

Click the button below to review and sign the transaction. Your funds will be allocated according to your preferences once confirmed.`;

    const depositActions: ActionPrompt[] = [
      {
        type: 'deposit',
        data: {
          action: 'sign',
          amount: depositIntent.amount,
          token: depositIntent.token,
          chain: targetChain,
          chainId: targetChainId,
          vaultId: primaryVault?.id,
        },
      },
    ];

    await createMessage(db, {
      conversationId,
      sender: 'vince',
      content: responseContent,
      metadata: { actions: depositActions },
    });

    return {
      type: 'response',
      conversationId: conversationId as UUID,
      agent: 'vince',
      content: responseContent,
      actions: depositActions,
    };
  }

  // For all other messages, let AI determine intent and respond appropriately
  // AI will intelligently handle: questions, hesitation, general conversation, etc.
  const aiResponse = await generateAIResponse(db, conversationId, content, vinceRuntime, 'investing', userChainId);

  await createMessage(db, {
    conversationId,
    sender: 'vince',
    content: aiResponse.content,
    metadata: aiResponse.actions ? { actions: aiResponse.actions } : undefined,
  });

  return {
    type: 'response',
    conversationId: conversationId as UUID,
    agent: 'vince',
    content: aiResponse.content,
    actions: aiResponse.actions,
  };
};
