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
}

/**
 * Creates WebSocket chat server
 * @param config - Server configuration
 * @returns WebSocket server instance
 */
export const createChatServer = (config: ChatServerConfig): WebSocketServer => {
  const { db } = config;
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Map<string, ClientState>();

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

    // Send welcome message
    const conversation = await getConversation(db, conversationId);
    if (conversation?.state === 'idle') {
      const welcome = await generateWelcome(db, userId);
      sendResponse(ws, conversationId, welcome.content, welcome.actions);
      await updateConversationState(db, conversationId, 'questionnaire_in_progress');
    }

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString()) as ChatMessage;
        await handleMessage(db, ws, userId, conversationId, message);
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
  userId: UUID
): Promise<{ content: string; actions?: readonly ActionPrompt[] }> => {
  const responses = await getQuestionnaireResponses(db, userId);
  const answeredIds = new Set(responses.map((r) => r.questionId));
  const nextQ = getNextQuestion(answeredIds);

  const welcome = `Hi! I'm Vince, and I'm here to help you discover how your values can drive meaningful impact.

Before we dive in, I'd love to learn a bit about what matters to you. I have a few quick questions - there are no wrong answers, just your honest thoughts.`;

  if (nextQ) {
    return {
      content: `${welcome}\n\nLet's start: ${nextQ.text}`,
      actions: nextQ.options
        ? [{ type: 'questionnaire', data: { questionId: nextQ.id, options: nextQ.options } }]
        : undefined,
    };
  }

  return { content: welcome };
};

/**
 * Handles incoming chat message
 */
const handleMessage = async (
  db: Db,
  ws: WebSocket,
  userId: UUID,
  conversationId: UUID,
  message: ChatMessage
): Promise<void> => {
  const messageTimestamp = Date.now();

  const conversation = await getConversation(db, conversationId);
  if (!conversation) return;

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

  // Handle based on conversation state
  if (conversation.state === 'questionnaire_in_progress') {
    await handleQuestionnaireResponse(db, ws, userId, conversationId, message.content, messageTimestamp);
  } else if (conversation.state === 'investment_suggestions') {
    await handleInvestmentQuery(db, ws, userId, conversationId, message.content);
  } else {
    // Default response
    sendResponse(
      ws,
      conversationId,
      "I'm here to help! Would you like to continue exploring investment opportunities?"
    );
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
  messageTimestamp?: number
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
  if (!nextQ || isQuestionnaireComplete(answeredIds)) {
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

    const responseContent = `Thanks for sharing! Based on your responses, I'd say you're ${archetypeDesc}.

Here are some investment opportunities that align with your values:

${storyList}

Would you like to learn more about any of these, or explore other options?`;

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
      },
    });

    sendResponse(ws, conversationId, responseContent, [
      { type: 'suggestion', data: { stories: stories.map((s) => s.id) } },
    ]);
    return;
  }

  // Send next question with tracking metadata
  const responseContent = `Great, thanks for sharing that.\n\n${nextQ.text}`;

  await createMessage(db, {
    conversationId,
    sender: 'vince',
    content: responseContent,
    metadata: {
      questionId: nextQ.id,
      questionSection: questionById.get(nextQ.id)?.sectionId,
      conversationPath: {
        questionsAnswered: answeredIds.size,
        currentQuestionIndex: answeredIds.size + 1,
        totalQuestions: 6,
      },
    },
  });

  sendResponse(
    ws,
    conversationId,
    responseContent,
    nextQ.options
      ? [{ type: 'questionnaire', data: { questionId: nextQ.id, options: nextQ.options } }]
      : undefined
  );
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
 */
const handleInvestmentQuery = async (
  db: Db,
  ws: WebSocket,
  userId: UUID,
  conversationId: UUID,
  content: string
): Promise<void> => {
  const lowerContent = content.toLowerCase();

  // Check if message contains deposit/invest intent
  if (lowerContent.includes('deposit') || lowerContent.includes('invest') ||
      lowerContent.includes('donate') || lowerContent.includes('give') ||
      lowerContent.includes('contribute')) {

    // Try to parse amount and token from the message
    const depositIntent = parseDepositIntent(content);

    if (depositIntent) {
      // User specified amount and token - prompt to confirm and sign
      const responseContent = `Great! You'd like to donate ${depositIntent.amount} ${depositIntent.token}.

Click the button below to review and sign the transaction. Your funds will be allocated according to your preferences once confirmed.`;

      await createMessage(db, { conversationId, sender: 'vince', content: responseContent });
      sendResponse(ws, conversationId, responseContent, [
        {
          type: 'deposit',
          data: {
            action: 'sign',
            amount: depositIntent.amount,
            token: depositIntent.token,
            chain: 'ethereum', // Default to ethereum, could be made configurable
          }
        },
      ]);
      return;
    }

    // No amount specified - ask for details
    const responseContent = `I'd be happy to help you make a deposit!

Just tell me how much you'd like to donate and which token. For example:
- "Donate 10 USDC"
- "Invest 0.5 ETH"

What amount would you like to contribute?`;

    await createMessage(db, { conversationId, sender: 'vince', content: responseContent });
    sendResponse(ws, conversationId, responseContent);
    return;
  }

  // Default helpful response
  const responseContent = `I'm here to help you find the right investment opportunities. You can:
- Ask about specific causes or initiatives
- Learn more about impact metrics
- Make a deposit when you're ready

What would you like to explore?`;

  await createMessage(db, { conversationId, sender: 'vince', content: responseContent });
  sendResponse(ws, conversationId, responseContent);
};
