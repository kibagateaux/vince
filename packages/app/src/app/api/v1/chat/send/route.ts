/**
 * POST /api/v1/chat/send
 * Send a chat message (replaces WebSocket send)
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getSupabase,
  getConversation,
  getConversationMessages,
} from '../../../../../lib/db';
import {
  getVinceRuntime,
  processMessage,
  formatMessagesForClient,
} from '../../../../../lib/chat-helpers';
import type { UUID } from '@bangui/types';

export async function POST(request: NextRequest) {
  const db = getSupabase();
  const { conversationId, userId, content, metadata } = await request.json() as {
    conversationId: UUID;
    userId: UUID;
    content: string;
    metadata?: { questionId?: string; chainId?: number };
  };

  if (!conversationId || !userId || !content) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const conversation = await getConversation(db, conversationId);
  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
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
    metadata?.questionId,
    metadata?.chainId
  );

  // Get updated messages
  const messages = await getConversationMessages(db, conversationId);
  const updatedConversation = await getConversation(db, conversationId);

  return NextResponse.json({
    messages: formatMessagesForClient(messages),
    state: updatedConversation?.state ?? conversation.state,
    response, // The latest response for immediate display
  });
}
