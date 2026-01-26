/**
 * POST /api/v1/admin/conversations/:id/message
 * Injects an admin message into a conversation
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../../../../lib/db';
import { createMessage } from '@bangui/db';
import type { AdminMessageRequest, UUID } from '@bangui/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDb();
  const { id: conversationId } = await params;
  const body: AdminMessageRequest = await request.json();

  const message = await createMessage(db, {
    conversationId: conversationId as UUID,
    sender: body.sender,
    content: body.content,
    metadata: { adminInjected: true },
  });

  return NextResponse.json({ success: true, message });
}
