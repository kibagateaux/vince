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
  // Save user message
  await createMessage(db, {
    conversationId,
    sender: 'user',
    content: message.content,
    metadata: message.metadata,
  });

  const conversation = await getConversation(db, conversationId);
  if (!conversation) return;

  // Handle based on conversation state
  if (conversation.state === 'questionnaire_in_progress') {
    await handleQuestionnaireResponse(db, ws, userId, conversationId, message.content);
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
  content: string
): Promise<void> => {
  const responses = await getQuestionnaireResponses(db, userId);
  const answeredIds = new Set(responses.map((r) => r.questionId));
  const nextQ = getNextQuestion(answeredIds);

  // If questionnaire complete, analyze and move to suggestions
  if (!nextQ || isQuestionnaireComplete(answeredIds)) {
    const analysis = analyzeResponses(
      userId,
      responses.map((r) => ({ questionId: r.questionId, response: r.response }))
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

    // Save Vince's response
    await createMessage(db, {
      conversationId,
      sender: 'vince',
      content: responseContent,
    });

    sendResponse(ws, conversationId, responseContent, [
      { type: 'suggestion', data: { stories: stories.map((s) => s.id) } },
    ]);
    return;
  }

  // Send next question
  const responseContent = `Great, thanks for sharing that.\n\n${nextQ.text}`;

  await createMessage(db, {
    conversationId,
    sender: 'vince',
    content: responseContent,
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

  if (lowerContent.includes('deposit') || lowerContent.includes('invest')) {
    const responseContent = `I'd be happy to help you make a deposit. Here's how it works:

1. Connect your wallet using the button above
2. Choose an amount to deposit
3. Review and sign the transaction

Once confirmed, your funds will be allocated according to your preferences. Would you like to proceed?`;

    await createMessage(db, { conversationId, sender: 'vince', content: responseContent });
    sendResponse(ws, conversationId, responseContent, [
      { type: 'deposit', data: { action: 'prepare' } },
    ]);
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
