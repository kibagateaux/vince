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
  logWS,
  logAgent,
  logUser,
  logAI,
  logDB,
  logDeposit,
  logAnalysis,
  logStateTransition,
  logTimed,
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
  /** Anthropic API key for dynamic AI responses */
  anthropicApiKey?: string;
}

/**
 * Creates WebSocket chat server
 * @param config - Server configuration
 * @returns WebSocket server instance
 */
export const createChatServer = (config: ChatServerConfig): WebSocketServer => {
  const { db, anthropicApiKey } = config;
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Map<string, ClientState>();

  logWS.info('Creating WebSocket chat server', {
    hasAnthropicApiKey: !!anthropicApiKey,
  });

  // Create AI runtime if API key is available
  const vinceRuntime = anthropicApiKey
    ? createVinceRuntime({ apiKey: anthropicApiKey })
    : null;

  if (!vinceRuntime) {
    logWS.warn('VinceRuntime not initialized - AI responses will use fallbacks');
  }

  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url ?? '', 'http://localhost');
    const conversationId = url.searchParams.get('conversationId') as UUID;
    const userId = url.searchParams.get('userId') as UUID;

    logWS.info('New WebSocket connection attempt', {
      conversationId,
      userId,
      url: req.url,
    });

    if (!conversationId || !userId) {
      logWS.warn('Connection rejected - missing params', { conversationId, userId });
      ws.close(4000, 'Missing conversationId or userId');
      return;
    }

    const clientId = crypto.randomUUID();
    clients.set(clientId, { ws, conversationId, userId });

    logWS.info('Client connected', {
      clientId,
      conversationId,
      userId,
      totalClients: clients.size,
    });

    // Handle connection based on conversation state
    logDB.debug('Fetching conversation for connection', { conversationId });
    const conversation = await getConversation(db, conversationId);

    if (conversation?.state === 'idle') {
      logAgent.info('New conversation - generating welcome', {
        conversationId,
        userId,
        state: conversation.state,
      });

      // New conversation - send welcome message
      const welcome = await generateWelcome(db, userId, vinceRuntime);

      logDB.debug('Saving welcome message', { conversationId });
      // Save welcome message to conversation history (include actions for restore)
      await createMessage(db, {
        conversationId,
        sender: 'vince',
        content: welcome.content,
        metadata: { type: 'welcome', actions: welcome.actions },
      });

      logWS.debug('Sending welcome response', {
        conversationId,
        contentLength: welcome.content.length,
        hasActions: !!welcome.actions,
      });
      sendResponse(ws, conversationId, welcome.content, welcome.actions);

      logStateTransition('conversation', conversationId, 'idle', 'questionnaire_in_progress');
      await updateConversationState(db, conversationId, 'questionnaire_in_progress');
    } else if (conversation) {
      logAgent.info('Existing conversation - restoring history', {
        conversationId,
        state: conversation.state,
      });

      // Existing conversation - send conversation history
      const messages = await getConversationMessages(db, conversationId);
      logDB.debug('Fetched conversation history', {
        conversationId,
        messageCount: messages.length,
      });

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
      logWS.debug('History restoration complete', {
        conversationId,
        messagesRestored: messages.length,
      });
    }

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString()) as ChatMessage;
        logWS.debug('Received message from client', {
          conversationId,
          userId,
          contentPreview: message.content.substring(0, 50) + '...',
        });
        await handleMessage(db, ws, userId, conversationId, message, vinceRuntime);
      } catch (err) {
        logWS.error('Message handling error', {
          error: err instanceof Error ? err.message : String(err),
          conversationId,
          userId,
        });
      }
    });

    ws.on('close', () => {
      clients.delete(clientId);
      logWS.info('Client disconnected', {
        clientId,
        conversationId,
        userId,
        remainingClients: clients.size,
      });
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
  logWS.debug('Sending response to client', {
    conversationId,
    contentLength: content.length,
    contentPreview: content.substring(0, 100) + '...',
    actions: actions?.map(a => a.type),
  });

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
  const done = logTimed('AGENT', 'generateWelcome');

  logAgent.info('Generating welcome message', { userId, hasRuntime: !!vinceRuntime });

  logDB.debug('Fetching questionnaire responses for welcome', { userId });
  const responses = await getQuestionnaireResponses(db, userId);
  const answeredIds = new Set(responses.map((r) => r.questionId));

  logAgent.debug('User questionnaire progress', {
    userId,
    answeredCount: answeredIds.size,
    answeredIds: Array.from(answeredIds),
  });

  const nextQ = getNextQuestion(answeredIds);
  logAgent.debug('Next question determined', {
    questionId: nextQ?.id,
    questionText: nextQ?.text?.substring(0, 50),
  });

  // Use AI-generated welcome if runtime available
  let welcome: string;
  if (vinceRuntime && nextQ) {
    try {
      logAI.info('Generating AI welcome message', { questionId: nextQ.id });
      welcome = await vinceRuntime.generateQuestionnaireResponse(
        [],
        nextQ,
        false
      );
      logAI.info('AI welcome generated successfully', {
        responseLength: welcome.length,
      });
    } catch (err) {
      logAI.error('Welcome generation failed, using fallback', {
        error: err instanceof Error ? err.message : String(err),
      });
      welcome = `Hi! I'm Vince, and I'm here to help you discover how your values can drive meaningful impact.

Before we dive in, I'd love to learn a bit about what matters to you. I have a few quick questions - there are no wrong answers, just your honest thoughts.

Let's start: ${nextQ.text}`;
    }
  } else {
    logAgent.debug('Using static welcome message', { hasRuntime: !!vinceRuntime, hasNextQ: !!nextQ });
    welcome = `Hi! I'm Vince, and I'm here to help you discover how your values can drive meaningful impact.

Before we dive in, I'd love to learn a bit about what matters to you. I have a few quick questions - there are no wrong answers, just your honest thoughts.`;
    if (nextQ) {
      welcome += `\n\nLet's start: ${nextQ.text}`;
    }
  }

  done();

  if (nextQ) {
    logAgent.debug('Returning welcome with questionnaire action', {
      questionId: nextQ.id,
      hasOptions: !!nextQ.options,
    });
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
  const done = logTimed('AGENT', 'handleMessage');
  const messageTimestamp = Date.now();

  logUser.info('Processing user message', {
    userId,
    conversationId,
    contentPreview: message.content.substring(0, 50) + '...',
    contentLength: message.content.length,
  });

  logDB.debug('Fetching conversation state', { conversationId });
  const conversation = await getConversation(db, conversationId);
  if (!conversation) {
    logAgent.warn('Conversation not found, ignoring message', { conversationId });
    return;
  }

  logAgent.info('Message received in state', {
    conversationId,
    state: conversation.state,
    userId,
    contentPreview: message.content.substring(0, 30),
  });

  // Determine which question is being answered for metadata tracking
  let questionBeingAnswered: string | undefined;
  if (conversation.state === 'questionnaire_in_progress') {
    const existingResponses = await getQuestionnaireResponses(db, userId);
    const answeredIds = new Set(existingResponses.map((r) => r.questionId));
    const currentQ = getNextQuestion(answeredIds);
    questionBeingAnswered = currentQ?.id;
    logAgent.debug('Question being answered', {
      questionId: questionBeingAnswered,
      answeredCount: answeredIds.size,
    });
  }

  // Save user message with conversation path metadata
  logDB.debug('Saving user message', {
    conversationId,
    questionId: questionBeingAnswered,
    state: conversation.state,
  });
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
  logAgent.debug('Routing message based on state', { state: conversation.state });

  if (conversation.state === 'questionnaire_in_progress') {
    logAgent.info('Handling as questionnaire response', { conversationId, userId });
    await handleQuestionnaireResponse(db, ws, userId, conversationId, message.content, messageTimestamp, vinceRuntime);
  } else if (conversation.state === 'investment_suggestions') {
    logAgent.info('Handling as investment query', { conversationId, userId });
    await handleInvestmentQuery(db, ws, userId, conversationId, message.content, vinceRuntime);
  } else {
    logAgent.info('Handling with default response', { conversationId, state: conversation.state });
    // Default response - use AI if available
    let defaultResponse = "I'm here to help! Would you like to continue exploring investment opportunities?";
    if (vinceRuntime) {
      try {
        logDB.debug('Fetching message history for AI response', { conversationId });
        const messages = await getConversationMessages(db, conversationId);
        const history: ConversationMessage[] = messages.map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.content,
        }));
        logAI.info('Generating default AI response', {
          historyLength: history.length,
          state: conversation.state,
        });
        defaultResponse = await vinceRuntime.generateResponse({
          messages: history,
          state: conversation.state as 'idle' | 'questionnaire_in_progress' | 'questionnaire_complete' | 'investing',
        });
      } catch (err) {
        logAI.error('AI response failed, using fallback', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    sendResponse(ws, conversationId, defaultResponse);
  }

  done();
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
  const done = logTimed('AGENT', 'handleQuestionnaireResponse');

  logAgent.info('Processing questionnaire response', {
    userId,
    conversationId,
    responsePreview: content.substring(0, 50),
  });

  // Get current progress BEFORE saving the new response
  logDB.debug('Fetching existing questionnaire responses', { userId });
  const existingResponses = await getQuestionnaireResponses(db, userId);
  const answeredIds = new Set(existingResponses.map((r) => r.questionId));

  logAgent.debug('Current questionnaire progress', {
    userId,
    answeredCount: answeredIds.size,
    answeredQuestions: Array.from(answeredIds),
  });

  // Determine which question is being answered (the first unanswered one)
  const currentQuestion = getNextQuestion(answeredIds);

  // Save the user's response to the questionnaire_responses table
  if (currentQuestion) {
    logUser.info('Saving questionnaire response', {
      userId,
      questionId: currentQuestion.id,
      responsePreview: content.substring(0, 50),
    });

    const responseTimeMs = messageTimestamp ? Date.now() - messageTimestamp : undefined;
    await saveQuestionnaireResponse(db, {
      userId,
      questionId: currentQuestion.id,
      response: { text: content, raw: content },
      responseTimeMs,
    });

    logDB.debug('Response saved', {
      questionId: currentQuestion.id,
      responseTimeMs,
    });

    // Add the current question to answered set for next check
    answeredIds.add(currentQuestion.id);
  }

  // Get next question after saving this response
  const nextQ = getNextQuestion(answeredIds);

  logAgent.debug('Checking questionnaire completion', {
    nextQuestionId: nextQ?.id,
    answeredCount: answeredIds.size,
    answeredIds: Array.from(answeredIds),
    isComplete: !nextQ || isQuestionnaireComplete(answeredIds),
  });

  // If questionnaire complete, analyze and move to suggestions
  if (!nextQ || isQuestionnaireComplete(answeredIds)) {
    logAnalysis.info('Questionnaire complete, starting analysis', {
      userId,
      conversationId,
      totalAnswered: answeredIds.size,
    });

    // Re-fetch all responses including the one we just saved
    const allResponses = await getQuestionnaireResponses(db, userId);

    logAnalysis.debug('Running psychopolitical analysis', {
      userId,
      responseCount: allResponses.length,
    });

    const analysis = analyzeResponses(
      userId,
      allResponses.map((r) => ({ questionId: r.questionId, response: r.response }))
    );

    logAnalysis.info('Analysis complete', {
      userId,
      primaryArchetype: analysis.archetypeProfile.primaryArchetype,
      confidence: analysis.archetypeProfile.confidence,
      secondaryTraits: analysis.archetypeProfile.secondaryTraits,
      topCauseAffinities: analysis.causeAffinities.slice(0, 3).map(a => ({
        causeId: a.causeId,
        score: a.affinityScore,
      })),
      moralVector: analysis.moralVector,
    });

    logDB.debug('Fetching user profile', { userId });
    const profile = await getUserProfile(db, userId);
    const topCauses = analysis.causeAffinities.slice(0, 3).map((a) => a.causeId);

    logDB.debug('Fetching stories by cause categories', { topCauses });
    const stories = await getStoriesByCauseCategories(db, topCauses, 3);
    logDB.debug('Stories fetched', {
      count: stories.length,
      titles: stories.map(s => s.title),
    });

    logStateTransition('conversation', conversationId, 'questionnaire_in_progress', 'investment_suggestions');
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
        logAI.info('Generating analysis presentation', {
          archetype: analysis.archetypeProfile.primaryArchetype,
          storiesCount: stories.length,
        });
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
        logAI.info('Analysis presentation generated', {
          responseLength: responseContent.length,
        });
      } catch (err) {
        logAI.error('AI analysis presentation failed, using fallback', {
          error: err instanceof Error ? err.message : String(err),
        });
        responseContent = `Thanks for sharing! Based on your responses, I'd say you're ${archetypeDesc}.

Here are some investment opportunities that align with your values:

${storyList}

Would you like to learn more about any of these, or explore other options?`;
      }
    } else {
      logAgent.debug('Using static analysis presentation (no AI runtime)');
      responseContent = `Thanks for sharing! Based on your responses, I'd say you're ${archetypeDesc}.

Here are some investment opportunities that align with your values:

${storyList}

Would you like to learn more about any of these, or explore other options?`;
    }

    const completionActions: ActionPrompt[] = [
      { type: 'suggestion', data: { stories: stories.map((s) => s.id) } },
    ];

    logDB.debug('Saving completion response', {
      conversationId,
      archetype: analysis.archetypeProfile.primaryArchetype,
    });

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

    logAgent.info('Questionnaire flow complete, sending suggestions', {
      userId,
      conversationId,
      archetype: analysis.archetypeProfile.primaryArchetype,
      storiesRecommended: stories.length,
    });

    sendResponse(ws, conversationId, responseContent, completionActions);
    done();
    return;
  }

  // Send next question with AI-enhanced response if available
  logAgent.debug('Preparing next question', {
    nextQuestionId: nextQ.id,
    questionText: nextQ.text.substring(0, 50),
    hasOptions: !!nextQ.options,
  });

  let nextQuestionResponse: string;
  if (vinceRuntime) {
    try {
      logAI.info('Generating questionnaire response', {
        questionId: nextQ.id,
        answeredCount: answeredIds.size,
      });
      const messages = await getConversationMessages(db, conversationId);
      // Messages from DB already include the just-saved user message
      const history: ConversationMessage[] = messages.map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));
      logAI.debug('Calling AI with conversation history', {
        historyLength: history.length,
      });
      nextQuestionResponse = await vinceRuntime.generateQuestionnaireResponse(
        history,
        nextQ,
        true // user just answered a question
      );
      logAI.info('Questionnaire response generated successfully', {
        responseLength: nextQuestionResponse.length,
      });
    } catch (err) {
      logAI.error('Questionnaire response failed, using fallback', {
        error: err instanceof Error ? err.message : String(err),
        questionId: nextQ.id,
      });
      nextQuestionResponse = `Great, thanks for sharing that.\n\n${nextQ.text}`;
    }
  } else {
    logAgent.debug('Using static next question response (no AI runtime)');
    nextQuestionResponse = `Great, thanks for sharing that.\n\n${nextQ.text}`;
  }

  const nextQActions: ActionPrompt[] | undefined = nextQ.options
    ? [{ type: 'questionnaire', data: { questionId: nextQ.id, options: nextQ.options } }]
    : undefined;

  logDB.debug('Saving next question response', {
    conversationId,
    questionId: nextQ.id,
    questionsAnswered: answeredIds.size,
  });

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

  logAgent.info('Sent next question', {
    conversationId,
    questionId: nextQ.id,
    progress: `${answeredIds.size}/6`,
  });

  sendResponse(ws, conversationId, nextQuestionResponse, nextQActions);
  done();
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
  content: string,
  vinceRuntime: VinceRuntime | null
): Promise<void> => {
  const done = logTimed('AGENT', 'handleInvestmentQuery');

  logAgent.info('Processing investment query', {
    userId,
    conversationId,
    contentPreview: content.substring(0, 50),
  });

  const lowerContent = content.toLowerCase();

  // Check if message contains deposit/invest intent
  const hasDepositKeyword = lowerContent.includes('deposit') || lowerContent.includes('invest') ||
      lowerContent.includes('donate') || lowerContent.includes('give') ||
      lowerContent.includes('contribute');

  logDeposit.debug('Checking for deposit intent', {
    hasDepositKeyword,
    keywords: ['deposit', 'invest', 'donate', 'give', 'contribute'].filter(k => lowerContent.includes(k)),
  });

  if (hasDepositKeyword) {
    // Try to parse amount and token from the message
    const depositIntent = parseDepositIntent(content);

    logDeposit.debug('Parsed deposit intent', {
      parsed: !!depositIntent,
      amount: depositIntent?.amount,
      token: depositIntent?.token,
    });

    if (depositIntent) {
      logDeposit.info('Deposit intent detected', {
        userId,
        conversationId,
        amount: depositIntent.amount,
        token: depositIntent.token,
      });

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

      logDB.debug('Saving deposit prompt response', { conversationId });
      await createMessage(db, {
        conversationId,
        sender: 'vince',
        content: responseContent,
        metadata: { actions: depositActions },
      });

      logDeposit.info('Sending deposit prompt to user', {
        userId,
        amount: depositIntent.amount,
        token: depositIntent.token,
      });

      sendResponse(ws, conversationId, responseContent, depositActions);
      done();
      return;
    }

    // No amount specified - ask for details
    logDeposit.debug('No amount specified, asking for details', { userId });

    const responseContent = `I'd be happy to help you make a deposit!

Just tell me how much you'd like to donate and which token. For example:
- "Donate 10 USDC"
- "Invest 0.5 ETH"

What amount would you like to contribute?`;

    await createMessage(db, { conversationId, sender: 'vince', content: responseContent });
    sendResponse(ws, conversationId, responseContent);
    done();
    return;
  }

  // Use AI for general investment queries
  logAgent.debug('Processing as general investment query (no deposit intent)');
  let responseContent: string;

  if (vinceRuntime) {
    try {
      logDB.debug('Fetching message history for AI response', { conversationId });
      // Build conversation history
      const dbMessages = await getConversationMessages(db, conversationId);
      const history: ConversationMessage[] = dbMessages.map(m => ({
        role: m.sender === 'user' ? 'user' as const : 'assistant' as const,
        content: m.content,
      }));

      logDB.debug('Fetching stories for AI context', {
        categories: ['climate', 'education', 'health', 'social'],
      });
      // Fetch available stories for context
      const stories = await getStoriesByCauseCategories(db, ['climate', 'education', 'health', 'social']);
      const storiesContext = stories.map(s => ({
        title: s.title,
        description: s.description ?? '',
        causeCategory: s.causeCategory,
        minInvestment: String(s.minInvestment),
      }));

      logAI.info('Generating investment response', {
        historyLength: history.length,
        storiesCount: storiesContext.length,
      });

      responseContent = await vinceRuntime.generateResponse({
        messages: history,
        state: 'investing',
        stories: storiesContext,
      });

      logAI.info('Investment response generated', {
        responseLength: responseContent.length,
      });
    } catch (err) {
      logAI.error('Failed to generate AI response for investment query', {
        error: err instanceof Error ? err.message : String(err),
      });
      // Fallback to static response
      responseContent = `I'm here to help you find the right investment opportunities. You can:
- Ask about specific causes or initiatives
- Learn more about impact metrics
- Make a deposit when you're ready

What would you like to explore?`;
    }
  } else {
    logAgent.debug('Using static investment response (no AI runtime)');
    // No AI runtime available - use static response
    responseContent = `I'm here to help you find the right investment opportunities. You can:
- Ask about specific causes or initiatives
- Learn more about impact metrics
- Make a deposit when you're ready

What would you like to explore?`;
  }

  logDB.debug('Saving investment response', { conversationId });
  await createMessage(db, { conversationId, sender: 'vince', content: responseContent });
  sendResponse(ws, conversationId, responseContent);
  done();
};
