/**
 * GET /api/v1/governance/proposals/:id/messages
 * Gets messages for a specific proposal's agent conversation
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabase } from '../../../../../../../lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getSupabase();

    // Get the allocation request
    const { data: allocationRequest, error: requestError } = await db
      .from('allocation_requests')
      .select('id, status')
      .eq('id', id)
      .single();

    if (requestError || !allocationRequest) {
      return NextResponse.json(
        { error: 'Proposal not found' },
        { status: 404 }
      );
    }

    // Get agent conversation for this request
    const { data: conversation } = await db
      .from('agent_conversations')
      .select('id')
      .eq('allocation_request_id', id)
      .limit(1)
      .single();

    let messages: Array<{
      id: string;
      sender: 'vince' | 'kincho';
      content: string;
      timestamp: string;
      metadata: Record<string, unknown> | undefined;
    }> = [];

    if (conversation) {
      // Get messages for the conversation
      const { data: rawMessages } = await db
        .from('agent_messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('sent_at', { ascending: true });

      messages = (rawMessages || []).map((msg) => ({
        id: msg.id,
        sender: msg.sender as 'vince' | 'kincho',
        content: msg.content,
        timestamp: new Date(msg.sent_at).toISOString(),
        metadata: msg.metadata as Record<string, unknown> | undefined,
      }));
    }

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
