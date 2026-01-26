/**
 * GET /api/v1/admin/stats
 * Gets dashboard statistics
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/db';
import { getAllConversations } from '@bangui/db';
import { computeConversationHealth } from '../../../../../lib/admin-helpers';
import type { DashboardStats, ConversationState } from '@bangui/types';

export async function GET() {
  const db = getDb();

  const conversations = await getAllConversations(db);
  const total = conversations.length;

  let successCount = 0;
  let frustratedCount = 0;
  let stalledCount = 0;
  let activeCount = 0;
  let totalDuration = 0;

  for (const conv of conversations) {
    const messages = conv.messages ?? [];
    const health = computeConversationHealth(
      conv.state as ConversationState,
      messages.map((m) => ({
        sender: m.sender,
        content: m.content,
        sentAt: m.sentAt,
      })),
      false
    );

    switch (health) {
      case 'success':
        successCount++;
        break;
      case 'frustrated':
        frustratedCount++;
        break;
      case 'stalled':
        stalledCount++;
        break;
      case 'active':
        activeCount++;
        break;
    }

    const startTime = new Date(conv.startedAt).getTime();
    const lastTime = new Date(conv.lastMessageAt).getTime();
    totalDuration += (lastTime - startTime) / 60000;
  }

  const stats: DashboardStats = {
    totalConversations: total,
    activeConversations: activeCount,
    successfulDeposits: successCount,
    frustratedConversations: frustratedCount,
    stalledConversations: stalledCount,
    averageDurationMinutes: total > 0 ? Math.round(totalDuration / total) : 0,
  };

  return NextResponse.json(stats);
}
