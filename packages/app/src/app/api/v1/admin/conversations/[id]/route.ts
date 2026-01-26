/**
 * GET /api/v1/admin/conversations/:id
 * Gets detailed conversation with timeline
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../../../lib/db';
import { getConversationWithMessages } from '@bangui/db';
import { computeConversationHealth, getMessageHealth } from '../../../../../../lib/admin-helpers';
import type {
  UUID,
  ConversationDetail,
  TimelineBlob,
  ConversationState,
  Sender,
} from '@bangui/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDb();
  const { id: conversationId } = await params;

  const conversation = await getConversationWithMessages(db, conversationId as UUID);
  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
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
    userWallet: null,
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

  return NextResponse.json(detail);
}
