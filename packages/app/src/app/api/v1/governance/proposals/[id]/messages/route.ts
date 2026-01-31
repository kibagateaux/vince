/**
 * GET /api/v1/governance/proposals/:id/messages
 * Gets messages for a specific proposal's agent conversation
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '../../../../../../../lib/db';
import { desc, eq } from 'drizzle-orm';
import { schema } from '@bangui/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    // Get the allocation request to find the agent conversation
    const allocationRequest = await db.query.allocationRequests.findFirst({
      where: eq(schema.allocationRequests.id, id),
      with: {
        agentConversations: {
          with: {
            messages: {
              orderBy: desc(schema.agentMessages.sentAt),
            },
          },
          limit: 1,
        },
      },
    });

    if (!allocationRequest) {
      return NextResponse.json(
        { error: 'Proposal not found' },
        { status: 404 }
      );
    }

    const conversation = allocationRequest.agentConversations?.[0];
    const messages = (conversation?.messages || []).reverse().map((msg) => ({
      id: msg.id,
      sender: msg.sender as 'vince' | 'kincho',
      content: msg.content,
      timestamp: new Date(msg.sentAt).toISOString(),
      metadata: msg.metadata as Record<string, unknown> | undefined,
    }));

    // Check if conversation is still active (proposal is in processing state)
    const isActive = allocationRequest.status === 'processing' || allocationRequest.status === 'pending';

    return NextResponse.json({
      messages,
      isActive,
    });
  } catch (error) {
    console.error('Error fetching proposal messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch proposal messages' },
      { status: 500 }
    );
  }
}
