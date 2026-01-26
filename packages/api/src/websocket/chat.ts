/**
 * @module @bangui/api/websocket/chat
 * WebSocket chat handler for real-time Vince conversations
 * @see {@link @bangui/types#ChatMessage}
 */

import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import type { Db } from '@bangui/db';
import {
  getConversation,
  createMessage,
  getConversationMessages,
  updateConversationState,
  getQuestionnaireResponses,
  saveQuestionnaireResponse,
  getUserProfile,
  getStoriesByCauseCategories,
} from '@bangui/db';
import {
  getNextQuestion,
  isQuestionnaireComplete,
  questionById,
  analyzeResponses,
  createVinceRuntime,
  type VinceRuntime,
  type ConversationMessage,
} from '@bangui/agent';
import type {
  ChatMessage,
  AgentResponse,
  UUID,
  ConversationState,
  ActionPrompt,
} from '@bangui/types';

/** Connected client state */
interface ClientState {
  ws: WebSocket;
  conversationId: UUID;
  userId: UUID;
}

/** Chat server configuration */
export interface ChatServerConfig {
  db: Db;
  /** OpenRouter API key for dynamic AI responses */
  openRouterApiKey?: string;
  /** Optional model override (e.g., anthropic/claude-sonnet-4) */
  openRouterModel?: string;
}

/**
 * Creates WebSocket chat server
 * @param config - Server configuration
 * @returns WebSocket server instance
 */
export const createChatServer = (config: ChatServerConfig): WebSocketServer => {
  const { db, openRouterApiKey, openRouterModel } = config;
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Map<string, ClientState>();

  // Create AI runtime if API key is available
  const vinceRuntime = openRouterApiKey
    ? createVinceRuntime({ apiKey: openRouterApiKey, model: openRouterModel })
    : null;

  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url ?? '', 'http://localhost');
    const conversationId = url.searchParams.get('conversationId') as UUID;
    const userId = url.searchParams.get('userId') as UUID;

    if (!conversationId || !userId) {
      ws.close(4000, 'Missing conversationId or userId');
      return;
    }

    const clientId = crypto.randomUUID();
    clients.set(clientId, { ws, conversationId, userId });

    // Handle connection based on conversation state
    const conversation = await getConversation(db, conversationId);
    if (conversation?.state === 'idle') {
      // New conversation - send welcome message
      const welcome = await generateWelcome(db, userId, vinceRuntime);
      // Save welcome message to conversation history (include actions for restore)
      await createMessage(db, {
        conversationId,
        sender: 'vince',
        content: welcome.content,
        metadata: { type: 'welcome', actions: welcome.actions },
      });
      sendResponse(ws, conversationId, welcome.content, welcome.actions);
      await updateConversationState(db, conversationId, 'questionnaire_in_progress');
    } else if (conversation) {
      // Existing conversation - send conversation history
      const messages = await getConversationMessages(db, conversationId);
      for (const msg of messages) {
        if (msg.sender === 'vince') {
          // Re-send Vince's messages (actions are stored in metadata)
          const metadata = msg.metadata as { actions?: ActionPrompt[] } | undefined;
          const actions = metadata?.actions;
          sendResponse(ws, conversationId, msg.content, actions);
        } else {
          // Send user messages as a different type so frontend can distinguish
          ws.send(JSON.stringify({
            type: 'history',
            conversationId,
            sender: 'user',
            content: msg.content,
          }));
        }
      }
    }

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString()) as ChatMessage;
        await handleMessage(db, ws, userId, conversationId, message, vinceRuntime);
      } catch (err) {
        console.error('Message handling error:', err);
      }
    });

    ws.on('close', () => {
      clients.delete(clientId);
    });
  });

  return wss;
};

/**
 * Sends agent response to client
 */
const sendResponse = (
  ws: WebSocket,
  conversationId: UUID,
  content: string,
  actions?: readonly ActionPrompt[]
): void => {
  const response: AgentResponse = {
    type: 'response',
    conversationId,
    agent: 'vince',
    content,
    actions: actions as ActionPrompt[],
  };
  ws.send(JSON.stringify(response));
};

/**
 * Generates welcome message with first question
 */
const generateWelcome = async (
  db: Db,
  userId: UUID,
  vinceRuntime: VinceRuntime | null
): Promise<{ content: string; actions?: readonly ActionPrompt[] }> => {
  const responses = await getQuestionnaireResponses(db, userId);
  const answeredIds = new Set(responses.map((r) => r.questionId));
  const nextQ = getNextQuestion(answeredIds);

  // Use AI-generated welcome if runtime available
  let welcome: string;
  if (vinceRuntime && nextQ) {
    try {
      console.log('[AI] Generating welcome message...');
      welcome = await vinceRuntime.generateQuestionnaireResponse(
        [],
        nextQ,
        false
      );
      console.log('[AI] Welcome generated successfully');
    } catch (err) {
      console.error('[AI] Welcome generation failed, using fallback:', err);
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
 * Generates an AI response using VinceRuntime, with appropriate fallbacks
 * @param state - The conversation state: 'investing' for general queries, 'persuading' for hesitant users
 */
const generateAIResponse = async (
  db: Db,
  ws: WebSocket,
  conversationId: UUID,
  userMessage: string,
  vinceRuntime: VinceRuntime | null,
  state: 'investing' | 'persuading'
): Promise<void> => {
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
      const stories = await getStoriesByCauseCategories(db, ['climate', 'education', 'health', 'social']);
      const storiesContext = stories.map(s => ({
        title: s.title,
        description: s.description ?? '',
        causeCategory: s.causeCategory,
        minInvestment: String(s.minInvestment),
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
  // In investment context, any mention of a specific amount with token should show the deposit button
  const depositInfo = parseDepositFromAIResponse(responseContent);

  console.log('[DEBUG] Deposit detection:', {
    depositInfo,
    state,
    responsePreview: responseContent.substring(0, 150)
  });

  if (depositInfo) {
    console.log('[DEBUG] Attaching deposit action for', depositInfo.amount, depositInfo.token);
    const depositActions: ActionPrompt[] = [
      {
        type: 'deposit',
        data: {
          action: 'sign',
          amount: depositInfo.amount,
          token: depositInfo.token,
          chain: 'ethereum',
        }
      },
    ];
    await createMessage(db, { conversationId, sender: 'vince', content: responseContent, metadata: { actions: depositActions } });
    sendResponse(ws, conversationId, responseContent, depositActions);
  } else {
    await createMessage(db, { conversationId, sender: 'vince', content: responseContent });
    sendResponse(ws, conversationId, responseContent);
  }
};

/**
 * Handles incoming chat message
 */
const handleMessage = async (
  db: Db,
  ws: WebSocket,
  userId: UUID,
  conversationId: UUID,
  message: ChatMessage,
  vinceRuntime: VinceRuntime | null
): Promise<void> => {
  const messageTimestamp = Date.now();

  const conversation = await getConversation(db, conversationId);
  if (!conversation) return;

  console.log('[DEBUG] handleMessage: state=', conversation.state, 'content=', message.content.substring(0, 30));

  // Determine which question is being answered for metadata tracking
  let questionBeingAnswered: string | undefined;
  if (conversation.state === 'questionnaire_in_progress') {
    const existingResponses = await getQuestionnaireResponses(db, userId);
    const answeredIds = new Set(existingResponses.map((r) => r.questionId));
    const currentQ = getNextQuestion(answeredIds);
    questionBeingAnswered = currentQ?.id;
  }

  // Save user message with conversation path metadata
  await createMessage(db, {
    conversationId,
    sender: 'user',
    content: message.content,
    metadata: {
      ...message.metadata,
      questionId: questionBeingAnswered,
      conversationState: conversation.state,
      timestamp: messageTimestamp,
    },
  });

  // Handle based on conversation state - AI determines intent intelligently
  if (conversation.state === 'questionnaire_in_progress') {
    await handleQuestionnaireResponse(db, ws, userId, conversationId, message.content, messageTimestamp, vinceRuntime);
  } else if (conversation.state === 'investment_suggestions') {
    await handleInvestmentQuery(db, ws, userId, conversationId, message.content, vinceRuntime);
  } else {
    // Default response - use AI if available
    let defaultResponse = "I'm here to help! Would you like to continue exploring investment opportunities?";
    if (vinceRuntime) {
      try {
        const messages = await getConversationMessages(db, conversationId);
        const history: ConversationMessage[] = messages.map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.content,
        }));
        defaultResponse = await vinceRuntime.generateResponse({
          messages: history,
          state: conversation.state as 'idle' | 'questionnaire_in_progress' | 'questionnaire_complete' | 'investing' | 'persuading',
        });
      } catch (err) {
        console.error('AI response failed, using fallback:', err);
      }
    }
    sendResponse(ws, conversationId, defaultResponse);
  }
};

/**
 * Handles questionnaire responses
 */
const handleQuestionnaireResponse = async (
  db: Db,
  ws: WebSocket,
  userId: UUID,
  conversationId: UUID,
  content: string,
  messageTimestamp: number | undefined,
  vinceRuntime: VinceRuntime | null
): Promise<void> => {
  // Get current progress BEFORE saving the new response
  const existingResponses = await getQuestionnaireResponses(db, userId);
  const answeredIds = new Set(existingResponses.map((r) => r.questionId));

  // Determine which question is being answered (the first unanswered one)
  const currentQuestion = getNextQuestion(answeredIds);

  // Save the user's response to the questionnaire_responses table
  if (currentQuestion) {
    await saveQuestionnaireResponse(db, {
      userId,
      questionId: currentQuestion.id,
      response: { text: content, raw: content },
      responseTimeMs: messageTimestamp ? Date.now() - messageTimestamp : undefined,
    });

    // Add the current question to answered set for next check
    answeredIds.add(currentQuestion.id);
  }

  // Get next question after saving this response
  const nextQ = getNextQuestion(answeredIds);

  // If questionnaire complete, analyze and move to suggestions
  console.log('[DEBUG] Checking completion: nextQ=', nextQ?.id, 'answeredIds=', Array.from(answeredIds));
  if (!nextQ || isQuestionnaireComplete(answeredIds)) {
    console.log('[AI] Questionnaire complete, generating analysis...');
    // Re-fetch all responses including the one we just saved
    const allResponses = await getQuestionnaireResponses(db, userId);

    const analysis = analyzeResponses(
      userId,
      allResponses.map((r) => ({ questionId: r.questionId, response: r.response }))
    );

    const profile = await getUserProfile(db, userId);
    const topCauses = analysis.causeAffinities.slice(0, 3).map((a) => a.causeId);
    const stories = await getStoriesByCauseCategories(db, topCauses, 3);

    await updateConversationState(db, conversationId, 'investment_suggestions');

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

    // Use AI for completion response if available
    let responseContent: string;
    if (vinceRuntime) {
      try {
        console.log('[AI] Generating analysis presentation...');
        const messages = await getConversationMessages(db, conversationId);
        const history: ConversationMessage[] = messages.map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.content,
        }));
        responseContent = await vinceRuntime.generateAnalysisPresentation(
          history,
          analysis.archetypeProfile.primaryArchetype,
          stories.map(s => ({
            title: s.title,
            description: s.description ?? '',
            causeCategory: s.causeCategory,
            minInvestment: s.minInvestment ?? '0',
          }))
        );
      } catch (err) {
        console.error('AI analysis presentation failed, using fallback:', err);
        responseContent = `Thanks for sharing! Based on your responses, I'd say you're ${archetypeDesc}.

Here are some investment opportunities that align with your values:

${storyList}

Would you like to learn more about any of these, or explore other options?`;
      }
    } else {
      responseContent = `Thanks for sharing! Based on your responses, I'd say you're ${archetypeDesc}.

Here are some investment opportunities that align with your values:

${storyList}

Would you like to learn more about any of these, or explore other options?`;
    }

    const completionActions: ActionPrompt[] = [
      { type: 'suggestion', data: { stories: stories.map((s) => s.id) } },
    ];

    // Save Vince's response with analysis metadata for tracking
    await createMessage(db, {
      conversationId,
      sender: 'vince',
      content: responseContent,
      metadata: {
        actionType: 'questionnaire_complete',
        analysis: {
          archetype: analysis.archetypeProfile.primaryArchetype,
          confidence: analysis.archetypeProfile.confidence,
          topCauses: topCauses,
        },
        conversationPath: {
          questionsAnswered: allResponses.length,
          completedAt: new Date().toISOString(),
        },
        actions: completionActions,
      },
    });

    sendResponse(ws, conversationId, responseContent, completionActions);
    return;
  }

  // Send next question with AI-enhanced response if available
  let nextQuestionResponse: string;
  if (vinceRuntime) {
    try {
      console.log('[AI] Generating questionnaire response...');
      const messages = await getConversationMessages(db, conversationId);
      // Messages from DB already include the just-saved user message
      const history: ConversationMessage[] = messages.map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));
      console.log('[AI] History length:', history.length);
      nextQuestionResponse = await vinceRuntime.generateQuestionnaireResponse(
        history,
        nextQ,
        true // user just answered a question
      );
      console.log('[AI] Questionnaire response generated successfully');
    } catch (err) {
      console.error('[AI] Questionnaire response failed, using fallback:', err);
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
      conversationPath: {
        questionsAnswered: answeredIds.size,
        currentQuestionIndex: answeredIds.size + 1,
        totalQuestions: 6,
      },
      actions: nextQActions,
    },
  });

  sendResponse(ws, conversationId, nextQuestionResponse, nextQActions);
};

/**
 * Parses deposit intent from user message
 * Extracts amount and token from natural language like:
 * - "donate 10 USDC"
 * - "I want to give 10 usdc"
 * - "10 USDC please"
 * - "let me deposit 10 eth"
 */
const parseDepositIntent = (
  content: string
): { amount: string; token: string } | null => {
  const knownTokens = ['USDC', 'ETH', 'USDT', 'DAI', 'WETH'];
  const tokenPattern = knownTokens.join('|');

  // Try multiple patterns from most specific to most general
  const patterns = [
    // "donate 10 USDC", "give 10 eth", "deposit 10 dai"
    new RegExp(`(?:donate|deposit|invest|give|contribute|send|put)\\s+(\\d+(?:\\.\\d+)?)\\s*(${tokenPattern})`, 'i'),
    // "10 USDC please", "10 eth"
    new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${tokenPattern})(?:\\s|$|\\.|,|!)`, 'i'),
    // "USDC 10", "eth 10"
    new RegExp(`(${tokenPattern})\\s+(\\d+(?:\\.\\d+)?)`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1] && match[2]) {
      // Handle both "amount token" and "token amount" patterns
      let amount: string;
      let token: string;

      if (/^\d/.test(match[1])) {
        // First capture group is the amount
        amount = match[1];
        token = match[2].toUpperCase();
      } else {
        // First capture group is the token
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
 * Handles investment-related queries
 * Only parses explicit deposit amounts - AI handles all conversational responses
 */
const handleInvestmentQuery = async (
  db: Db,
  ws: WebSocket,
  userId: UUID,
  conversationId: UUID,
  content: string,
  vinceRuntime: VinceRuntime | null
): Promise<void> => {
  console.log('[DEBUG] handleInvestmentQuery called with:', content.substring(0, 50));

  // Try to parse explicit deposit intent (e.g., "donate 10 USDC")
  // Only triggers if user specifies both amount AND token
  const depositIntent = parseDepositIntent(content);

  if (depositIntent) {
    // User specified amount and token - prompt to confirm and sign
    const responseContent = `Great! You'd like to donate ${depositIntent.amount} ${depositIntent.token}.

Click the button below to review and sign the transaction. Your funds will be allocated according to your preferences once confirmed.`;

    const depositActions: ActionPrompt[] = [
      {
        type: 'deposit',
        data: {
          action: 'sign',
          amount: depositIntent.amount,
          token: depositIntent.token,
          chain: 'ethereum',
        }
      },
    ];

    await createMessage(db, {
      conversationId,
      sender: 'vince',
      content: responseContent,
      metadata: { actions: depositActions },
    });
    sendResponse(ws, conversationId, responseContent, depositActions);
    return;
  }

  // For all other messages, let AI determine intent and respond appropriately
  // AI will intelligently handle: questions, hesitation, general conversation, etc.
  await generateAIResponse(db, ws, conversationId, content, vinceRuntime, 'investing');
};
