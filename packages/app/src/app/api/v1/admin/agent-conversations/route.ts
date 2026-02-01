/**
 * GET /api/v1/admin/agent-conversations
 * Lists all agent conversations with allocation request context
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getSupabase,
  getAllAgentConversations,
  getAgentConversationsCount,
} from '../../../../../lib/db';
import { getVaultByAddress } from '../../../../../lib/vaults';
import type { Address } from '@bangui/types';

/** Agent conversation summary for list view */
interface AgentConversationSummary {
  readonly id: string;
  readonly allocationRequestId: string;
  readonly startedAt: number;
  readonly lastMessageAt: number;
  readonly messageCount: number;
  readonly vinceMessageCount: number;
  readonly kinchoMessageCount: number;
  readonly status: string;
  readonly amount: string | null;
  readonly vaultAddress: string | null;
  readonly chainId: number | null;
  readonly userId: string | null;
  readonly userConversationId: string | null;
  readonly latestMessage: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const db = getSupabase();
    const limit = Number(request.nextUrl.searchParams.get('limit')) || 50;
    const offset = Number(request.nextUrl.searchParams.get('offset')) || 0;

    const [conversations, total] = await Promise.all([
      getAllAgentConversations(db, { limit, offset }),
      getAgentConversationsCount(db),
    ]);

    const summaries: AgentConversationSummary[] = conversations.map((conv) => {
      const messages = conv.messages ?? [];
      const vinceMessages = messages.filter((m) => m.sender === 'vince');
      const kinchoMessages = messages.filter((m) => m.sender === 'kincho');
      const latestMessage = messages[messages.length - 1];

      // Look up chain ID from vault address
      const vaultAddress = conv.allocation_request?.vault_address ?? null;
      const vault = vaultAddress ? getVaultByAddress(vaultAddress as Address) : null;
      const chainId = vault?.chainId ?? null;

      return {
        id: conv.id,
        allocationRequestId: conv.allocation_request_id,
        startedAt: new Date(conv.started_at).getTime(),
        lastMessageAt: new Date(conv.last_message_at).getTime(),
        messageCount: messages.length,
        vinceMessageCount: vinceMessages.length,
        kinchoMessageCount: kinchoMessages.length,
        status: conv.allocation_request?.status ?? 'unknown',
        amount: conv.allocation_request?.amount ?? null,
        vaultAddress,
        chainId,
        userId: conv.allocation_request?.user_id ?? null,
        userConversationId: conv.allocation_request?.conversation_id ?? null,
        latestMessage: latestMessage?.content?.slice(0, 100) ?? null,
      };
    });

    return NextResponse.json({
      conversations: summaries,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[Admin Agent Conversations] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent conversations' },
      { status: 500 }
    );
  }
}
