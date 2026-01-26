/**
 * GET /api/v1/admin/conversations
 * Lists all conversations with health status
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/db';
import {
  getAllConversations,
  getConversationsCount,
} from '@bangui/db';
import { computeConversationHealth } from '../../../../../lib/admin-helpers';
import type {
  UUID,
  ConversationSummary,
  ConversationState,
} from '@bangui/types';

export async function GET(request: NextRequest) {
  const db = getDb();
  const limit = Number(request.nextUrl.searchParams.get('limit')) || 50;
  const offset = Number(request.nextUrl.searchParams.get('offset')) || 0;

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
      userWallet: null,
    };
  });

  return NextResponse.json({
    conversations: summaries,
    total,
    limit,
    offset,
  });
}
