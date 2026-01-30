/**
 * POST /api/v1/deposits/confirm
 * Confirms deposit after transaction is mined
 * Triggers Kincho allocation decision automatically
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getSupabase,
  updateDepositStatus,
  getDeposit,
  findOrCreateConversation,
  createMessage,
  getUserProfile,
} from '../../../../../lib/db';
import {
  submitAllocationRequest,
  processAllocationRequest,
  formatDecisionForUser,
  getKinchoRuntime,
} from '../../../../../lib/kincho-helpers';
import type { UUID, UserPreferences, VinceRecommendation, SuggestedAllocation } from '@bangui/types';

export async function POST(request: NextRequest) {
  const db = getSupabase();
  const { depositId, txHash, conversationId } = await request.json() as {
    depositId: string;
    txHash: string;
    conversationId?: string;
  };

  // Update deposit status
  await updateDepositStatus(db, depositId, 'confirmed', txHash);
  const deposit = await getDeposit(db, depositId);

  if (!deposit) {
    return NextResponse.json({ error: 'Deposit not found' }, { status: 404 });
  }

  // Check if Kincho is available
  const kinchoRuntime = getKinchoRuntime();
  if (!kinchoRuntime) {
    // Kincho not configured - return simple confirmation
    return NextResponse.json({
      success: true,
      deposit,
      kinchoDecision: null,
      message: 'Deposit confirmed. Kincho allocation will be processed when available.',
    });
  }

  // Build user preferences from profile
  const profile = await getUserProfile(db, deposit.user_id);
  const userPreferences: UserPreferences = {
    causes: profile?.causeAffinities?.map((a) => a.cause_category) ?? ['general'],
    riskTolerance: profile?.risk_tolerance ?? 'moderate',
    archetypeProfile: profile?.archetypeScores?.[0]
      ? {
          primaryArchetype: profile.archetypeScores[0].archetype,
          secondaryTraits: profile.archetypeScores.slice(1).map((s) => s.archetype),
          confidence: Number(profile.archetypeScores[0].confidence ?? 0.7),
          causeAlignment: Object.fromEntries(
            (profile.causeAffinities ?? []).map((a) => [
              a.cause_category,
              Number(a.affinity_score),
            ])
          ),
        }
      : undefined,
  };

  // Build suggested allocations
  const depositAmount = Number(deposit.amount);
  const suggestedAllocations: SuggestedAllocation[] = [];
  const topCauses = (profile?.causeAffinities ?? [])
    .sort((a, b) => Number(b.affinity_score) - Number(a.affinity_score))
    .slice(0, 3);

  if (topCauses.length > 0) {
    const causePortion = depositAmount * 0.7;
    const perCause = causePortion / topCauses.length;

    for (const cause of topCauses) {
      suggestedAllocations.push({
        causeId: `cause-${cause.cause_category}-001`,
        causeName: cause.cause_category.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        amount: perCause,
        percentage: (perCause / depositAmount) * 100,
        reasoning: `Aligned with user's ${cause.cause_category} affinity`,
      });
    }
    suggestedAllocations.push({
      causeId: 'yield-reserve-001',
      causeName: 'DAF Yield Reserve',
      amount: depositAmount * 0.3,
      percentage: 30,
      reasoning: 'Maintain liquidity reserve per fund policy',
    });
  } else {
    suggestedAllocations.push({
      causeId: 'cause-general-001',
      causeName: 'General Impact Fund',
      amount: depositAmount * 0.7,
      percentage: 70,
      reasoning: 'Diversified impact allocation',
    });
    suggestedAllocations.push({
      causeId: 'yield-reserve-001',
      causeName: 'DAF Yield Reserve',
      amount: depositAmount * 0.3,
      percentage: 30,
      reasoning: 'Maintain liquidity reserve',
    });
  }

  const vinceRecommendation: VinceRecommendation = {
    suggestedAllocations,
    psychProfile: null,
    reasoning: `Based on deposit of ${deposit.amount} ${deposit.token}`,
  };

  try {
    // Submit to Kincho
    const allocationRequest = await submitAllocationRequest(db, {
      depositId: depositId,
      userId: deposit.user_id,
      conversationId: conversationId,
      amount: deposit.amount,
      userPreferences,
      vinceRecommendation,
    });

    // Process allocation decision
    const decision = await processAllocationRequest(db, allocationRequest.id);

    if (decision && conversationId) {
      // Save Kincho's decision to user conversation
      const userMessage = formatDecisionForUser(decision);
      await createMessage(db, {
        conversationId,
        sender: 'vince',
        content: userMessage,
        metadata: {
          type: 'kincho_decision',
          requestId: allocationRequest.id,
          decision: decision.decision,
          allocations: decision.allocations,
        },
      });
    }

    return NextResponse.json({
      success: true,
      deposit,
      kinchoDecision: decision
        ? {
            requestId: allocationRequest.id,
            decision: decision.decision,
            allocations: decision.allocations,
            confidence: decision.kinchoAnalysis.metaCognition.confidenceScore,
          }
        : null,
      message: decision
        ? formatDecisionForUser(decision)
        : 'Deposit confirmed but Kincho processing failed.',
    });
  } catch (error) {
    console.error('[Deposit Confirm] Kincho processing error:', error);
    // Still return success for the deposit, just note Kincho failure
    return NextResponse.json({
      success: true,
      deposit,
      kinchoDecision: null,
      message: 'Deposit confirmed. Allocation decision pending.',
    });
  }
}
