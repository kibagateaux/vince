/**
 * @module @bangui/api/routes/admin
 * Admin dashboard routes for conversation monitoring
 */

import { Hono } from 'hono';
import type { Db } from '@bangui/db';
import {
  getAllConversations,
  getConversationWithMessages,
  getConversationsCount,
  createMessage,
} from '@bangui/db';
import type {
  UUID,
  ConversationHealth,
  ConversationSummary,
  ConversationDetail,
  TimelineBlob,
  DashboardStats,
  AdminMessageRequest,
  ConversationState,
  Sender,
  Address,
} from '@bangui/types';

/** Admin route context with database */
export interface AdminContext {
  Variables: { db: Db };
}

/** Sentiment keywords for frustration detection */
const FRUSTRATION_KEYWORDS = [
  'frustrated',
  'annoying',
  'annoyed',
  'confused',
  'don\'t understand',
  'not working',
  'broken',
  'help',
  'stuck',
  'wrong',
  'error',
  'problem',
  'issue',
  'hate',
  'terrible',
  'awful',
  'useless',
  'waste',
  '???',
  '!!!!',
];

/**
 * Computes conversation health based on state, messages, and timing
 */
function computeConversationHealth(
  state: ConversationState,
  messages: { sender: string; content: string; sentAt: Date }[],
  hasDeposit: boolean
): ConversationHealth {
  // Success: deposit confirmed
  if (state === 'deposit_confirmed' || hasDeposit) {
    return 'success';
  }

  // Check for frustration in user messages
  const userMessages = messages.filter((m) => m.sender === 'user');
  const hasFrustration = userMessages.some((m) =>
    FRUSTRATION_KEYWORDS.some((keyword) =>
      m.content.toLowerCase().includes(keyword.toLowerCase())
    )
  );
  if (hasFrustration) {
    return 'frustrated';
  }

  // Check for stalled conversation (no activity in last 30 minutes but not complete)
  const lastMessage = messages[messages.length - 1];
  if (lastMessage) {
    const lastMessageTime = new Date(lastMessage.sentAt).getTime();
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;

    const completedStates = ['deposit_confirmed', 'questionnaire_complete'];
    const isCompleted = completedStates.includes(state);

    // Abandoned: no activity in 2+ hours and not completed
    if (lastMessageTime < twoHoursAgo && !isCompleted) {
      return 'abandoned';
    }

    // Stalled: no activity in 30+ minutes but less than 2 hours
    if (lastMessageTime < thirtyMinutesAgo && !isCompleted) {
      return 'stalled';
    }
  }

  // Active: conversation is ongoing
  return 'active';
}

/**
 * Gets health-specific color class for message blobs
 */
function getMessageHealth(
  sender: string,
  content: string,
  conversationHealth: ConversationHealth
): ConversationHealth {
  if (sender === 'user') {
    const hasFrustration = FRUSTRATION_KEYWORDS.some((keyword) =>
      content.toLowerCase().includes(keyword.toLowerCase())
    );
    if (hasFrustration) return 'frustrated';
  }
  return conversationHealth;
}

/**
 * Creates admin routes
 * @returns Hono router with admin endpoints
 */
export const createAdminRoutes = () => {
  const router = new Hono<AdminContext>();

  /**
   * GET /api/v1/admin/conversations
   * Lists all conversations with health status
   */
  router.get('/conversations', async (c) => {
    const db = c.get('db');
    const limit = Number(c.req.query('limit')) || 50;
    const offset = Number(c.req.query('offset')) || 0;

    const [conversations, total] = await Promise.all([
      getAllConversations(db, { limit, offset }),
      getConversationsCount(db),
    ]);

    const summaries: ConversationSummary[] = conversations.map((conv) => {
      const messages = conv.messages ?? [];
      const userMessages = messages.filter((m) => m.sender === 'user');
      const vinceMessages = messages.filter((m) => m.sender === 'vince');
      const hasDeposit = false; // TODO: Join with deposits table
      const health = computeConversationHealth(
        conv.state as ConversationState,
        messages.map((m) => ({
          sender: m.sender,
          content: m.content,
          sentAt: m.sentAt,
        })),
        hasDeposit
      );

      const startTime = new Date(conv.startedAt).getTime();
      const lastTime = new Date(conv.lastMessageAt).getTime();
      const durationMinutes = Math.round((lastTime - startTime) / 60000);

      return {
        id: conv.id as UUID,
        userId: conv.userId as UUID,
        platform: conv.platform,
        state: conv.state as ConversationState,
        health,
        messageCount: messages.length,
        userMessageCount: userMessages.length,
        vinceMessageCount: vinceMessages.length,
        startedAt: new Date(conv.startedAt).getTime() as any,
        lastMessageAt: new Date(conv.lastMessageAt).getTime() as any,
        durationMinutes,
        hasDeposit,
        latestMessage: messages[messages.length - 1]?.content ?? null,
        userWallet: null, // TODO: Get from user wallets
      };
    });

    return c.json({
      conversations: summaries,
      total,
      limit,
      offset,
    });
  });

  /**
   * GET /api/v1/admin/conversations/:id
   * Gets detailed conversation with timeline
   */
  router.get('/conversations/:id', async (c) => {
    const db = c.get('db');
    const conversationId = c.req.param('id') as UUID;

    const conversation = await getConversationWithMessages(db, conversationId);
    if (!conversation) {
      return c.json({ error: 'Conversation not found' }, 404);
    }

    const messages = conversation.messages ?? [];
    const hasDeposit =
      (conversation.user as any)?.deposits?.some(
        (d: any) => d.status === 'confirmed'
      ) ?? false;
    const confirmedDeposit = (conversation.user as any)?.deposits?.find(
      (d: any) => d.status === 'confirmed'
    );

    const health = computeConversationHealth(
      conversation.state as ConversationState,
      messages.map((m) => ({
        sender: m.sender,
        content: m.content,
        sentAt: m.sentAt,
      })),
      hasDeposit
    );

    const timeline: TimelineBlob[] = messages.map((msg) => ({
      id: msg.id as UUID,
      sender: msg.sender as Sender,
      sentAt: new Date(msg.sentAt).getTime() as any,
      contentPreview:
        msg.content.length > 50
          ? msg.content.substring(0, 50) + '...'
          : msg.content,
      health: getMessageHealth(msg.sender, msg.content, health),
    }));

    const detail: ConversationDetail = {
      id: conversation.id as UUID,
      userId: conversation.userId as UUID,
      userWallet: null, // TODO: Get from user wallets
      platform: conversation.platform,
      state: conversation.state as ConversationState,
      health,
      startedAt: new Date(conversation.startedAt).getTime() as any,
      lastMessageAt: new Date(conversation.lastMessageAt).getTime() as any,
      messages: messages.map((m) => ({
        id: m.id as UUID,
        conversationId: m.conversationId as UUID,
        sender: m.sender as Sender,
        content: m.content,
        metadata: m.metadata as any,
        sentAt: new Date(m.sentAt).getTime() as any,
      })),
      timeline,
      hasDeposit,
      depositAmount: confirmedDeposit?.amount ?? null,
    };

    return c.json(detail);
  });

  /**
   * GET /api/v1/admin/stats
   * Gets dashboard statistics
   */
  router.get('/stats', async (c) => {
    const db = c.get('db');

    const conversations = await getAllConversations(db);
    const total = conversations.length;

    let successCount = 0;
    let frustratedCount = 0;
    let stalledCount = 0;
    let activeCount = 0;
    let totalDuration = 0;

    for (const conv of conversations) {
      const messages = conv.messages ?? [];
      const health = computeConversationHealth(
        conv.state as ConversationState,
        messages.map((m) => ({
          sender: m.sender,
          content: m.content,
          sentAt: m.sentAt,
        })),
        false
      );

      switch (health) {
        case 'success':
          successCount++;
          break;
        case 'frustrated':
          frustratedCount++;
          break;
        case 'stalled':
          stalledCount++;
          break;
        case 'active':
          activeCount++;
          break;
      }

      const startTime = new Date(conv.startedAt).getTime();
      const lastTime = new Date(conv.lastMessageAt).getTime();
      totalDuration += (lastTime - startTime) / 60000;
    }

    const stats: DashboardStats = {
      totalConversations: total,
      activeConversations: activeCount,
      successfulDeposits: successCount,
      frustratedConversations: frustratedCount,
      stalledConversations: stalledCount,
      averageDurationMinutes: total > 0 ? Math.round(totalDuration / total) : 0,
    };

    return c.json(stats);
  });

  /**
   * POST /api/v1/admin/conversations/:id/message
   * Injects an admin message into a conversation
   */
  router.post('/conversations/:id/message', async (c) => {
    const db = c.get('db');
    const conversationId = c.req.param('id') as UUID;
    const body = await c.req.json<AdminMessageRequest>();

    const message = await createMessage(db, {
      conversationId,
      sender: body.sender,
      content: body.content,
      metadata: { adminInjected: true },
    });

    return c.json({ success: true, message });
  });

  return router;
};
