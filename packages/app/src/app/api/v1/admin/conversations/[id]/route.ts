/**
 * GET /api/v1/admin/conversations/:id
 * Gets detailed conversation with timeline
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getSupabase,
  getConversationWithMessages,
  type ConversationState,
} from '../../../../../../lib/db';
import { computeConversationHealth, getMessageHealth } from '../../../../../../lib/admin-helpers';
import type {
  UUID,
  ConversationDetail,
  TimelineBlob,
  Sender,
} from '@bangui/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getSupabase();
  const { id: conversationId } = await params;

  const conversation = await getConversationWithMessages(db, conversationId);
  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  const messages = (conversation.messages ?? []) as Array<{
    id: string;
    conversation_id: string;
    sender: string;
    content: string;
    metadata: unknown;
    sent_at: string;
  }>;
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
      sentAt: new Date(m.sent_at),
    })),
    hasDeposit
  );

  const timeline: TimelineBlob[] = messages.map((msg) => ({
    id: msg.id as UUID,
    sender: msg.sender as Sender,
    sentAt: new Date(msg.sent_at).getTime() as any,
    contentPreview:
      msg.content.length > 50
        ? msg.content.substring(0, 50) + '...'
        : msg.content,
    health: getMessageHealth(msg.sender, msg.content, health),
  }));

  const detail: ConversationDetail = {
    id: conversation.id as UUID,
    userId: conversation.user_id as UUID,
    userWallet: null,
    platform: conversation.platform,
    state: conversation.state as ConversationState,
    health,
    startedAt: new Date(conversation.started_at).getTime() as any,
    lastMessageAt: new Date(conversation.last_message_at).getTime() as any,
    messages: messages.map((m) => ({
      id: m.id as UUID,
      conversationId: m.conversation_id as UUID,
      sender: m.sender as Sender,
      content: m.content,
      metadata: m.metadata as any,
      sentAt: new Date(m.sent_at).getTime() as any,
    })),
    timeline,
    hasDeposit,
    depositAmount: confirmedDeposit?.amount ?? null,
  };

  return NextResponse.json(detail);
}
