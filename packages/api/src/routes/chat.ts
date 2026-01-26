/**
 * @module @bangui/api/routes/chat
 * REST-based chat routes (WebSocket alternative for serverless/Vercel)
 */

import { Hono } from 'hono';
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
import type { UUID, ActionPrompt, AgentResponse } from '@bangui/types';

interface ChatContext {
  Variables: {
    db: Db;
  };
}

/** Lazily initialized Vince runtime */
let vinceRuntime: VinceRuntime | null = null;

const getVinceRuntime = (): VinceRuntime | null => {
  if (!vinceRuntime && process.env.ANTHROPIC_API_KEY) {
    vinceRuntime = createVinceRuntime({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return vinceRuntime;
};

/**
 * Creates REST chat routes (WebSocket replacement for serverless)
 */
export const createChatRoutes = () => {
  const router = new Hono<ChatContext>();

  /**
   * POST /api/v1/chat/connect
   * Initialize chat session (replaces WebSocket connection)
   */
  router.post('/connect', async (c) => {
    const db = c.get('db');
    const { conversationId, userId } = await c.req.json<{
      conversationId: UUID;
      userId: UUID;
    }>();

    if (!conversationId || !userId) {
      return c.json({ error: 'Missing conversationId or userId' }, 400);
    }

    const conversation = await getConversation(db, conversationId);
    if (!conversation) {
      return c.json({ error: 'Conversation not found' }, 404);
    }

    // Get existing messages
    const messages = await getConversationMessages(db, conversationId);

    // If idle state, generate welcome and update state
    if (conversation.state === 'idle') {
      const runtime = getVinceRuntime();
      const welcome = await generateWelcome(db, userId, runtime);

      // Save welcome message
      await createMessage(db, {
        conversationId,
        sender: 'vince',
        content: welcome.content,
        metadata: { type: 'welcome', actions: welcome.actions },
      });

      await updateConversationState(db, conversationId, 'questionnaire_in_progress');

      // Re-fetch messages including welcome
      const updatedMessages = await getConversationMessages(db, conversationId);
      return c.json({
        messages: formatMessagesForClient(updatedMessages),
        state: 'questionnaire_in_progress',
      });
    }

    return c.json({
      messages: formatMessagesForClient(messages),
      state: conversation.state,
    });
  });

  /**
   * POST /api/v1/chat/send
   * Send a chat message (replaces WebSocket send)
   */
  router.post('/send', async (c) => {
    const db = c.get('db');
    const { conversationId, userId, content, metadata } = await c.req.json<{
      conversationId: UUID;
      userId: UUID;
      content: string;
      metadata?: { questionId?: string };
    }>();

    if (!conversationId || !userId || !content) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const conversation = await getConversation(db, conversationId);
    if (!conversation) {
      return c.json({ error: 'Conversation not found' }, 404);
    }

    const runtime = getVinceRuntime();

    // Process message based on conversation state
    const response = await processMessage(
      db,
      userId,
      conversationId,
      content,
      conversation.state,
      runtime,
      metadata?.questionId
    );

    // Get updated messages
    const messages = await getConversationMessages(db, conversationId);
    const updatedConversation = await getConversation(db, conversationId);

    return c.json({
      messages: formatMessagesForClient(messages),
      state: updatedConversation?.state ?? conversation.state,
      response, // The latest response for immediate display
    });
  });

  /**
   * GET /api/v1/chat/poll/:conversationId
   * Poll for new messages
   */
  router.get('/poll/:conversationId', async (c) => {
    const db = c.get('db');
    const conversationId = c.req.param('conversationId') as UUID;
    const lastMessageId = c.req.query('lastMessageId');

    const messages = await getConversationMessages(db, conversationId);
    const conversation = await getConversation(db, conversationId);

    // Filter messages after lastMessageId if provided
    let filteredMessages = messages;
    if (lastMessageId) {
      const lastIndex = messages.findIndex((m) => m.id === lastMessageId);
      if (lastIndex !== -1) {
        filteredMessages = messages.slice(lastIndex + 1);
      }
    }

    return c.json({
      messages: formatMessagesForClient(filteredMessages),
      state: conversation?.state,
    });
  });

  return router;
};

/**
 * Format database messages for client consumption
 */
const formatMessagesForClient = (
  messages: Array<{
    id: string;
    sender: string;
    content: string;
    metadata: unknown;
    sentAt: Date;
  }>
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
      timestamp: m.sentAt.getTime(),
    };
  });
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
const processMessage = async (
  db: Db,
  userId: UUID,
  conversationId: UUID,
  content: string,
  state: string,
  vinceRuntime: VinceRuntime | null,
  questionId?: string
): Promise<AgentResponse> => {
  const messageTimestamp = Date.now();

  // Determine which question is being answered
  let questionBeingAnswered = questionId;
  if (!questionBeingAnswered && state === 'questionnaire_in_progress') {
    const existingResponses = await getQuestionnaireResponses(db, userId);
    const answeredIds = new Set(existingResponses.map((r) => r.questionId));
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

  // Handle based on conversation state
  if (state === 'questionnaire_in_progress') {
    return handleQuestionnaireResponse(
      db,
      userId,
      conversationId,
      content,
      messageTimestamp,
      vinceRuntime
    );
  } else if (state === 'investment_suggestions') {
    return handleInvestmentQuery(db, userId, conversationId, content, vinceRuntime);
  }

  // Default response
  const defaultContent = "I'm here to help! Would you like to continue exploring investment opportunities?";
  await createMessage(db, { conversationId, sender: 'vince', content: defaultContent });

  return {
    type: 'response',
    conversationId,
    agent: 'vince',
    content: defaultContent,
  };
};

/**
 * Handle questionnaire responses
 */
const handleQuestionnaireResponse = async (
  db: Db,
  userId: UUID,
  conversationId: UUID,
  content: string,
  messageTimestamp: number,
  vinceRuntime: VinceRuntime | null
): Promise<AgentResponse> => {
  const existingResponses = await getQuestionnaireResponses(db, userId);
  const answeredIds = new Set(existingResponses.map((r) => r.questionId));
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
      userId,
      allResponses.map((r) => ({ questionId: r.questionId, response: r.response }))
    );

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
      } catch (err) {
        console.error('AI analysis failed:', err);
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
      conversationId,
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
    conversationId,
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
 * Handle investment queries
 */
const handleInvestmentQuery = async (
  db: Db,
  userId: UUID,
  conversationId: UUID,
  content: string,
  vinceRuntime: VinceRuntime | null
): Promise<AgentResponse> => {
  const depositIntent = parseDepositIntent(content);

  if (depositIntent) {
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
      conversationId,
      agent: 'vince',
      content: responseContent,
      actions: depositActions,
    };
  }

  // Generate AI response for other queries
  let responseContent: string;
  if (vinceRuntime) {
    try {
      const dbMessages = await getConversationMessages(db, conversationId);
      const history: ConversationMessage[] = dbMessages.map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));

      const stories = await getStoriesByCauseCategories(db, ['climate', 'education', 'health', 'social']);
      const storiesContext = stories.map((s) => ({
        title: s.title,
        description: s.description ?? '',
        causeCategory: s.causeCategory,
        minInvestment: String(s.minInvestment),
      }));

      responseContent = await vinceRuntime.generateResponse({
        messages: history,
        state: 'investing',
        stories: storiesContext,
      });
    } catch (err) {
      console.error('AI response failed:', err);
      responseContent = `I'm here to help you find the right investment opportunities. You can:
- Ask about specific causes or initiatives
- Learn more about impact metrics
- Make a deposit when you're ready

What would you like to explore?`;
    }
  } else {
    responseContent = `I'm here to help you find the right investment opportunities. You can:
- Ask about specific causes or initiatives
- Learn more about impact metrics
- Make a deposit when you're ready

What would you like to explore?`;
  }

  await createMessage(db, { conversationId, sender: 'vince', content: responseContent });

  return {
    type: 'response',
    conversationId,
    agent: 'vince',
    content: responseContent,
  };
};
