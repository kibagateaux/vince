/**
 * GET /api/v1/chat/poll/:conversationId
 * Poll for new messages
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getSupabase,
  getConversation,
  getConversationMessages,
} from '../../../../../../lib/db';
import { formatMessagesForClient } from '../../../../../../lib/chat-helpers';
import type { UUID } from '@bangui/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const db = getSupabase();
  const { conversationId } = await params;
  const lastMessageId = request.nextUrl.searchParams.get('lastMessageId');

  const messages = await getConversationMessages(db, conversationId as UUID);
  const conversation = await getConversation(db, conversationId as UUID);

  // Filter messages after lastMessageId if provided
  let filteredMessages = messages;
  if (lastMessageId) {
    const lastIndex = messages.findIndex((m) => m.id === lastMessageId);
    if (lastIndex !== -1) {
      filteredMessages = messages.slice(lastIndex + 1);
    }
  }

  return NextResponse.json({
    messages: formatMessagesForClient(filteredMessages),
    state: conversation?.state,
  });
}
