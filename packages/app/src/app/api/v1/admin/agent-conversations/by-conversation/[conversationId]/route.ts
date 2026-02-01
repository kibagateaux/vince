/**
 * GET /api/v1/admin/agent-conversations/by-conversation/:conversationId
 * Gets agent conversations for a specific user conversation
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getSupabase,
  getAgentConversationsByUserConversation,
} from '../../../../../../../lib/db';
import type { Sender } from '../../../../../../../lib/db/types';

/** Agent message for detail view */
interface AgentMessageDetail {
  readonly id: string;
  readonly sender: Sender;
  readonly content: string;
  readonly metadata: unknown;
  readonly sentAt: number;
}

/** Agent conversation summary for user conversation tab */
interface AgentConversationForUser {
  readonly id: string;
  readonly allocationRequestId: string;
  readonly startedAt: number;
  readonly lastMessageAt: number;
  readonly messageCount: number;
  readonly status: string;
  readonly amount: string;
  readonly messages: AgentMessageDetail[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const db = getSupabase();
  const { conversationId } = await params;

  const conversations = await getAgentConversationsByUserConversation(db, conversationId);

  const result: AgentConversationForUser[] = conversations.map((conv) => ({
    id: conv.id,
    allocationRequestId: conv.allocation_request_id,
    startedAt: new Date(conv.started_at).getTime(),
    lastMessageAt: new Date(conv.last_message_at).getTime(),
    messageCount: conv.messages.length,
    status: conv.allocation_request?.status ?? 'unknown',
    amount: conv.allocation_request?.amount ?? '0',
    messages: conv.messages.map((m) => ({
      id: m.id,
      sender: m.sender,
      content: m.content,
      metadata: m.metadata,
      sentAt: new Date(m.sent_at).getTime(),
    })),
  }));

  return NextResponse.json({ conversations: result });
}
