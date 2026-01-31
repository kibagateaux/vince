/**
 * POST /api/v1/agents/kincho/message
 * Send a message/request to Kincho agent
 * This endpoint receives allocation requests from Vince
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../../../../../lib/db';
import {
  submitAllocationRequest,
  processAllocationRequest,
  formatDecisionForUser,
  getKinchoRuntime,
} from '../../../../../../lib/kincho-helpers';
import type { UUID, UserPreferences, VinceRecommendation } from '@bangui/types';

interface AllocationRequestPayload {
  depositId?: UUID;
  userId: UUID;
  conversationId?: UUID;
  amount: string;
  userPreferences: UserPreferences;
  vinceRecommendation: VinceRecommendation;
}

export async function POST(request: NextRequest) {
  const runtime = getKinchoRuntime();
  if (!runtime) {
    return NextResponse.json(
      { error: 'Kincho agent not available - check configuration' },
      { status: 503 }
    );
  }

  const db = getSupabase();
  const payload = (await request.json()) as AllocationRequestPayload;

  // Validate required fields
  if (!payload.userId || !payload.amount || !payload.userPreferences || !payload.vinceRecommendation) {
    return NextResponse.json(
      { error: 'Missing required fields: userId, amount, userPreferences, vinceRecommendation' },
      { status: 400 }
    );
  }

  try {
    // Submit the allocation request
    const allocationRequest = await submitAllocationRequest(db, {
      depositId: payload.depositId,
      userId: payload.userId,
      conversationId: payload.conversationId,
      amount: payload.amount,
      userPreferences: payload.userPreferences,
      vinceRecommendation: payload.vinceRecommendation,
    });

    // Process the request with Kincho
    const decision = await processAllocationRequest(db, allocationRequest.id);

    if (!decision) {
      return NextResponse.json(
        { error: 'Failed to process allocation request' },
        { status: 500 }
      );
    }

    // Format decision for user
    const userMessage = formatDecisionForUser(decision);

    return NextResponse.json({
      success: true,
      requestId: allocationRequest.id,
      decision: decision.decision,
      allocations: decision.allocations,
      kinchoAnalysis: decision.kinchoAnalysis,
      userMessage, // Pre-formatted message for Vince to relay
    });
  } catch (error) {
    console.error('[Kincho] Error processing allocation request:', error);
    return NextResponse.json(
      { error: 'Internal server error processing allocation request' },
      { status: 500 }
    );
  }
}
