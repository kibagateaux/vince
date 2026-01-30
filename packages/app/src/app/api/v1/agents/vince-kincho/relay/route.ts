/**
 * POST /api/v1/agents/vince-kincho/relay
 * Relay endpoint for Vince → Kincho communication
 * Used when a deposit is confirmed and allocation decision is needed
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../../../lib/db';
import {
  getConversation,
  createMessage,
  getDeposit,
  getUserProfile,
  updateConversationState,
} from '@bangui/db';
import {
  submitAllocationRequest,
  processAllocationRequest,
  formatDecisionForUser,
  getKinchoRuntime,
} from '../../../../../../lib/kincho-helpers';
import { analyzeResponses } from '@bangui/agent';
import type { UUID, UserPreferences, VinceRecommendation, SuggestedAllocation } from '@bangui/types';

interface RelayPayload {
  depositId: UUID;
  conversationId: UUID;
  userId: UUID;
}

export async function POST(request: NextRequest) {
  const runtime = getKinchoRuntime();
  if (!runtime) {
    return NextResponse.json(
      { error: 'Kincho agent not available' },
      { status: 503 }
    );
  }

  const db = getDb();
  const payload = (await request.json()) as RelayPayload;

  if (!payload.depositId || !payload.conversationId || !payload.userId) {
    return NextResponse.json(
      { error: 'Missing required fields: depositId, conversationId, userId' },
      { status: 400 }
    );
  }

  try {
    // Verify deposit exists and is confirmed
    const deposit = await getDeposit(db, payload.depositId);
    if (!deposit) {
      return NextResponse.json({ error: 'Deposit not found' }, { status: 404 });
    }
    if (deposit.status !== 'confirmed') {
      return NextResponse.json(
        { error: 'Deposit not confirmed yet' },
        { status: 400 }
      );
    }

    // Get user profile for preferences
    const profile = await getUserProfile(db, payload.userId);

    // Build user preferences from profile
    const userPreferences: UserPreferences = {
      causes: profile?.causeAffinities?.map((a) => a.causeCategory) ?? ['general'],
      riskTolerance: profile?.riskTolerance ?? 'moderate',
      archetypeProfile: profile?.archetypeScores?.[0]
        ? {
            primaryArchetype: profile.archetypeScores[0].archetype,
            secondaryTraits: profile.archetypeScores.slice(1).map((s) => s.archetype),
            confidence: Number(profile.archetypeScores[0].confidence ?? 0.7),
            causeAlignment: Object.fromEntries(
              (profile.causeAffinities ?? []).map((a) => [
                a.causeCategory,
                Number(a.affinityScore),
              ])
            ),
          }
        : undefined,
    };

    // Build Vince recommendation based on user profile
    const suggestedAllocations: SuggestedAllocation[] = [];
    const depositAmount = Number(deposit.amount);

    // Suggest allocations based on cause affinities
    const topCauses = (profile?.causeAffinities ?? [])
      .sort((a, b) => Number(b.affinityScore) - Number(a.affinityScore))
      .slice(0, 3);

    if (topCauses.length > 0) {
      // Allocate 70% to top causes
      const causePortion = depositAmount * 0.7;
      const perCause = causePortion / topCauses.length;

      for (const cause of topCauses) {
        suggestedAllocations.push({
          causeId: `cause-${cause.causeCategory}-001`,
          causeName: cause.causeCategory.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
          amount: perCause,
          percentage: (perCause / depositAmount) * 100,
          reasoning: `Aligned with user's ${cause.causeCategory} affinity (score: ${Number(cause.affinityScore).toFixed(2)})`,
        });
      }

      // Reserve 30% for yield/liquidity
      suggestedAllocations.push({
        causeId: 'yield-reserve-001',
        causeName: 'DAF Yield Reserve',
        amount: depositAmount * 0.3,
        percentage: 30,
        reasoning: 'Maintain liquidity reserve per fund policy',
      });
    } else {
      // Default allocation if no profile
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
      psychProfile: profile?.archetypeScores?.[0]
        ? ({
            userId: payload.userId,
            archetypeProfile: {
              primaryArchetype: profile.archetypeScores[0].archetype,
              secondaryTraits: [],
              confidence: Number(profile.archetypeScores[0].confidence ?? 0.7),
              causeAlignment: {},
            },
            moralVector: {
              care: 0.5,
              fairness: 0.5,
              loyalty: 0.5,
              authority: 0.5,
              sanctity: 0.5,
              liberty: 0.5,
            },
            causeAffinities: [],
            analyzedAt: Date.now() as number & { readonly __brand: 'Timestamp' },
          } as const)
        : null,
      reasoning: `Based on user's profile analysis and deposit of ${deposit.amount} ${deposit.token}`,
    };

    // Submit allocation request to Kincho
    const allocationRequest = await submitAllocationRequest(db, {
      depositId: payload.depositId,
      userId: payload.userId,
      conversationId: payload.conversationId,
      amount: deposit.amount,
      userPreferences,
      vinceRecommendation,
    });

    // Process with Kincho
    const decision = await processAllocationRequest(db, allocationRequest.id);

    if (!decision) {
      return NextResponse.json(
        { error: 'Kincho failed to process allocation' },
        { status: 500 }
      );
    }

    // Format decision message for user
    const userMessage = formatDecisionForUser(decision);

    // Save Vince's relay message to the user conversation
    // Note: This goes to the USER conversation, not the agent conversation
    await createMessage(db, {
      conversationId: payload.conversationId,
      sender: 'vince',
      content: userMessage,
      metadata: {
        type: 'kincho_decision',
        requestId: allocationRequest.id,
        decision: decision.decision,
        allocations: decision.allocations,
      },
    });

    // Update conversation state based on decision
    if (decision.decision === 'approved' || decision.decision === 'modified') {
      await updateConversationState(db, payload.conversationId, 'deposit_confirmed');
    }

    return NextResponse.json({
      success: true,
      requestId: allocationRequest.id,
      decision: decision.decision,
      allocations: decision.allocations,
      kinchoAnalysis: decision.kinchoAnalysis,
      userMessage,
      messageId: 'relayed', // Indicates message was saved to conversation
    });
  } catch (error) {
    console.error('[Vince-Kincho Relay] Error:', error);
    return NextResponse.json(
      { error: 'Failed to relay to Kincho' },
      { status: 500 }
    );
  }
}
