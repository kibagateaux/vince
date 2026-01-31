/**
 * POST /api/v1/chat/connect
 * Initialize chat session (replaces WebSocket connection)
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getSupabase,
  getConversation,
  createMessage,
  getConversationMessages,
  updateConversationState,
  type ConversationState,
} from '../../../../../lib/db';
import {
  getVinceRuntime,
  generateWelcome,
  formatMessagesForClient,
} from '../../../../../lib/chat-helpers';
import type { UUID } from '@bangui/types';

export async function POST(request: NextRequest) {
  const db = getSupabase();
  const { conversationId, userId } = await request.json() as {
    conversationId: UUID;
    userId: UUID;
  };

  if (!conversationId || !userId) {
    return NextResponse.json({ error: 'Missing conversationId or userId' }, { status: 400 });
  }

  const conversation = await getConversation(db, conversationId);
  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
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

    await updateConversationState(db, conversationId, 'questionnaire_in_progress' as ConversationState);

    // Re-fetch messages including welcome
    const updatedMessages = await getConversationMessages(db, conversationId);
    return NextResponse.json({
      messages: formatMessagesForClient(updatedMessages),
      state: 'questionnaire_in_progress',
    });
  }

  return NextResponse.json({
    messages: formatMessagesForClient(messages),
    state: conversation.state,
  });
}
