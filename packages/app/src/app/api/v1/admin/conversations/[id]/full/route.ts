/**
 * GET /api/v1/admin/conversations/:id/full
 * Returns full observability data for admin debugging:
 * - User conversation (what user sees)
 * - Agent conversation (Vince ↔ Kincho)
 * - Consensus deliberation (if allocation occurred)
 * - Relevant agent memories
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getSupabase,
  getConversationWithMessages,
  getAgentConversationByRequest,
  getAgentMessages,
  getAllocationRequest,
  getAllocationDecision,
} from '../../../../../../../lib/db';
import type { UUID } from '@bangui/types';

// Stub for getMemoriesByAllocationRequest until vector memory is implemented
const getMemoriesByAllocationRequest = async (_requestId: string): Promise<Array<{
  id: string;
  agentId: string;
  memoryType: string;
  content: string;
  importance: number;
  createdAt: Date;
}>> => {
  return [];
};

interface FullConversationResponse {
  /** User conversation - what the user sees */
  userConversation: {
    id: string;
    state: string;
    startedAt: string;
    messages: Array<{
      id: string;
      sender: string;
      content: string;
      sentAt: string;
      metadata?: unknown;
    }>;
  };

  /** Agent conversation - Vince ↔ Kincho negotiation */
  agentConversation?: {
    id: string;
    allocationRequestId: string;
    startedAt: string;
    messages: Array<{
      id: string;
      sender: 'vince' | 'kincho';
      content: string;
      sentAt: string;
      metadata?: unknown;
      parsed?: unknown; // Parsed content if JSON
    }>;
  };

  /** Consensus deliberation details */
  consensusDeliberation?: {
    requestId: string;
    status: string;
    amount: string;
    decision?: {
      decision: string;
      confidence: string;
      reasoning: string;
      humanOverrideRequired: boolean;
      decidedAt: string;
    };
    kinchoAnalysis?: unknown;
  };

  /** Relevant agent memories */
  memories: Array<{
    id: string;
    agentId: string;
    memoryType: string;
    content: string;
    importance: number;
    createdAt: string;
  }>;

  /** Summary for quick overview */
  summary: {
    hasAllocationRequest: boolean;
    hasAgentConversation: boolean;
    hasDecision: boolean;
    memoryCount: number;
    conversationMessageCount: number;
    agentMessageCount: number;
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<FullConversationResponse | { error: string }>> {
  const db = getSupabase();
  const { id: conversationId } = await params;

  // Get user conversation with messages
  const conversation = await getConversationWithMessages(db, conversationId as UUID);
  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  const response: FullConversationResponse = {
    userConversation: {
      id: conversation.id,
      state: conversation.state,
      startedAt: new Date(conversation.started_at).toISOString(),
      messages: ((conversation.messages ?? []) as Array<{ id: string; sender: string; content: string; sent_at: string; metadata?: unknown }>).map((m) => ({
        id: m.id,
        sender: m.sender,
        content: m.content,
        sentAt: new Date(m.sent_at).toISOString(),
        metadata: m.metadata,
      })),
    },
    memories: [],
    summary: {
      hasAllocationRequest: false,
      hasAgentConversation: false,
      hasDecision: false,
      memoryCount: 0,
      conversationMessageCount: conversation.messages?.length ?? 0,
      agentMessageCount: 0,
    },
  };

  // Try to find associated allocation request
  // Check if there's a deposit with allocation
  const user = conversation.user as unknown as { deposits?: Array<{ id: string }> };
  const deposits = user?.deposits ?? [];

  for (const deposit of deposits) {
    // Get allocation request for this deposit
    const allocationRequest = await getAllocationRequest(db, deposit.id as UUID);
    if (!allocationRequest) continue;

    response.summary.hasAllocationRequest = true;

    // Get consensus deliberation
    const decision = await getAllocationDecision(db, allocationRequest.id as UUID);
    response.consensusDeliberation = {
      requestId: allocationRequest.id,
      status: allocationRequest.status,
      amount: String(allocationRequest.amount),
      decision: decision
        ? {
            decision: decision.decision,
            confidence: String(decision.confidence),
            reasoning: decision.reasoning,
            humanOverrideRequired: decision.human_override_required,
            decidedAt: new Date(decision.decided_at).toISOString(),
          }
        : undefined,
      kinchoAnalysis: decision?.kincho_analysis,
    };

    if (decision) {
      response.summary.hasDecision = true;
    }

    // Get agent conversation
    const agentConversation = await getAgentConversationByRequest(
      db,
      allocationRequest.id as UUID
    );
    if (agentConversation) {
      response.summary.hasAgentConversation = true;

      const agentMessages = await getAgentMessages(db, agentConversation.id as UUID);
      response.agentConversation = {
        id: agentConversation.id,
        allocationRequestId: agentConversation.allocation_request_id,
        startedAt: new Date(agentConversation.started_at).toISOString(),
        messages: agentMessages.map((m) => {
          let parsed: unknown = undefined;
          try {
            parsed = JSON.parse(m.content);
          } catch {
            // Not JSON, that's fine
          }

          return {
            id: m.id,
            sender: m.sender as 'vince' | 'kincho',
            content: m.content,
            sentAt: new Date(m.sent_at).toISOString(),
            metadata: m.metadata,
            parsed,
          };
        }),
      };

      response.summary.agentMessageCount = agentMessages.length;
    }

    // Get relevant memories
    try {
      const memories = await getMemoriesByAllocationRequest(allocationRequest.id);
      response.memories = memories.map((m) => ({
        id: m.id,
        agentId: m.agentId,
        memoryType: m.memoryType,
        content: m.content,
        importance: m.importance,
        createdAt: m.createdAt.toISOString(),
      }));
      response.summary.memoryCount = memories.length;
    } catch {
      // Memory retrieval may fail if Supabase isn't configured
      console.warn('Failed to retrieve memories');
    }

    // Only process first matching allocation request
    break;
  }

  return NextResponse.json(response);
}
