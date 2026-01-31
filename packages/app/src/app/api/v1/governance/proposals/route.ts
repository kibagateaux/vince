/**
 * GET /api/v1/governance/proposals
 * Gets active allocation proposals with Kincho analysis and agent conversations
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/db';
import { desc, eq, sql, and, or } from 'drizzle-orm';
import { schema } from '@bangui/db';

export async function GET(request: Request) {
  console.log('[API] GET /api/v1/governance/proposals');
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20');
    console.log('[API] Proposals query params:', { status, limit });

    // Build where clause
    const statusFilter = status && status !== 'all'
      ? eq(schema.allocationRequests.status, status as any)
      : or(
          eq(schema.allocationRequests.status, 'pending'),
          eq(schema.allocationRequests.status, 'processing'),
          eq(schema.allocationRequests.status, 'approved'),
          eq(schema.allocationRequests.status, 'modified')
        );

    // Get allocation requests with related data
    const requests = await db.query.allocationRequests.findMany({
      where: statusFilter,
      orderBy: desc(schema.allocationRequests.createdAt),
      limit,
      with: {
        user: {
          with: {
            wallets: {
              limit: 1,
              where: eq(schema.wallets.isPrimary, true),
            },
            profile: {
              with: {
                archetypeScores: {
                  orderBy: desc(schema.archetypeScores.score),
                  limit: 1,
                },
              },
            },
          },
        },
        decision: true,
        agentConversations: {
          with: {
            messages: {
              orderBy: desc(schema.agentMessages.sentAt),
              limit: 5,
            },
          },
          limit: 1,
        },
      },
    });

    // Transform to API response format
    const proposals = requests.map((req) => {
      const wallet = req.user?.wallets?.[0];
      const profile = req.user?.profile;
      const primaryArchetype = profile?.archetypeScores?.[0]?.archetype;
      const decision = req.decision;
      const agentConv = req.agentConversations?.[0];
      const vinceRec = req.vinceRecommendation as any;

      // Parse Kincho analysis from decision
      const kinchoAnalysis = decision?.kinchoAnalysis as any || {};

      return {
        id: req.id,
        status: req.status,
        amount: parseFloat(req.amount),
        targetStrategy: {
          id: vinceRec?.suggestedAllocations?.[0]?.causeId || 'default',
          name: vinceRec?.suggestedAllocations?.[0]?.causeName || 'Treasury Vault',
          protocol: 'AiETH',
          asset: 'ETH',
        },
        user: {
          id: req.userId,
          walletAddress: wallet?.address || '0x0000000000000000000000000000000000000000',
          riskTolerance: profile?.riskTolerance || 'moderate',
          archetype: primaryArchetype || undefined,
        },
        kinchoAnalysis: {
          confidence: decision ? parseFloat(decision.confidence) * 100 : 50,
          riskAssessment: kinchoAnalysis?.riskAssessment?.aggregateRisk
            ? `Aggregate risk score: ${kinchoAnalysis.riskAssessment.aggregateRisk}`
            : 'Risk assessment pending',
          reasoning: decision?.reasoning || 'Analysis in progress',
          humanOverrideRequired: decision?.humanOverrideRequired || false,
        },
        agentConversation: {
          id: agentConv?.id || req.id,
          messages: (agentConv?.messages || []).reverse().map((msg) => ({
            id: msg.id,
            sender: msg.sender as 'vince' | 'kincho',
            content: msg.content,
            timestamp: new Date(msg.sentAt).toISOString(),
            metadata: msg.metadata as Record<string, unknown> | undefined,
          })),
          lastUpdated: agentConv?.lastMessageAt
            ? new Date(agentConv.lastMessageAt).toISOString()
            : new Date(req.createdAt).toISOString(),
        },
        createdAt: new Date(req.createdAt).toISOString(),
        updatedAt: decision?.decidedAt
          ? new Date(decision.decidedAt).toISOString()
          : new Date(req.createdAt).toISOString(),
      };
    });

    console.log('[API] Proposals response:', { total: proposals.length, hasMore: proposals.length === limit });
    console.log('[API] Proposals data:', JSON.stringify(proposals, null, 2));
    return NextResponse.json({
      proposals,
      total: proposals.length,
      hasMore: proposals.length === limit,
    });
  } catch (error) {
    console.error('[API] Error fetching proposals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch proposals' },
      { status: 500 }
    );
  }
}
