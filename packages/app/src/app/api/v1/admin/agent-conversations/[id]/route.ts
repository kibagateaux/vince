/**
 * GET /api/v1/admin/agent-conversations/:id
 * Gets detailed agent conversation with all messages
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getSupabase,
  getAgentConversationById,
} from '../../../../../../lib/db';
import type { Sender } from '../../../../../../lib/db/types';

/** Agent message for detail view */
interface AgentMessageDetail {
  readonly id: string;
  readonly sender: Sender;
  readonly content: string;
  readonly metadata: unknown;
  readonly sentAt: number;
}

/** Agent conversation detail */
interface AgentConversationDetail {
  readonly id: string;
  readonly allocationRequestId: string;
  readonly startedAt: number;
  readonly lastMessageAt: number;
  readonly messages: AgentMessageDetail[];
  readonly allocationRequest: {
    readonly id: string;
    readonly userId: string;
    readonly conversationId: string | null;
    readonly amount: string;
    readonly status: string;
    readonly createdAt: number;
    readonly userEmail: string | null;
  } | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getSupabase();
  const { id } = await params;

  const conversation = await getAgentConversationById(db, id);
  if (!conversation) {
    return NextResponse.json(
      { error: 'Agent conversation not found' },
      { status: 404 }
    );
  }

  const detail: AgentConversationDetail = {
    id: conversation.id,
    allocationRequestId: conversation.allocation_request_id,
    startedAt: new Date(conversation.started_at).getTime(),
    lastMessageAt: new Date(conversation.last_message_at).getTime(),
    messages: conversation.messages.map((m) => ({
      id: m.id,
      sender: m.sender,
      content: m.content,
      metadata: m.metadata,
      sentAt: new Date(m.sent_at).getTime(),
    })),
    allocationRequest: conversation.allocation_request
      ? {
          id: conversation.allocation_request.id,
          userId: conversation.allocation_request.user_id,
          conversationId: conversation.allocation_request.conversation_id,
          amount: conversation.allocation_request.amount,
          status: conversation.allocation_request.status,
          createdAt: new Date(conversation.allocation_request.created_at).getTime(),
          userEmail: conversation.allocation_request.user?.email ?? null,
        }
      : null,
  };

  return NextResponse.json(detail);
}
