/**
 * GET /api/v1/governance/proposals
 * Gets active allocation proposals with Kincho analysis and agent conversations
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabase } from '../../../../../lib/db';

export async function GET(request: Request) {
  console.log('[API] GET /api/v1/governance/proposals');
  try {
    const db = getSupabase();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20');
    console.log('[API] Proposals query params:', { status, limit });

    // Get allocation requests
    let query = db
      .from('allocation_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    } else {
      query = query.in('status', ['pending', 'processing', 'approved', 'modified']);
    }

    const { data: requests, error: requestsError } = await query;

    if (requestsError) {
      console.error('[API] Error querying allocation requests:', requestsError);
      throw requestsError;
    }

    if (!requests || requests.length === 0) {
      console.log('[API] No proposals found');
      return NextResponse.json({
        proposals: [],
        total: 0,
        hasMore: false,
      });
    }

    // Get related data in parallel
    const userIds = [...new Set(requests.map((r) => r.user_id).filter(Boolean))];
    const requestIds = requests.map((r) => r.id);

    const [
      { data: users },
      { data: wallets },
      { data: profiles },
      { data: archetypeScores },
      { data: decisions },
      { data: agentConversations },
    ] = await Promise.all([
      db.from('users').select('*').in('id', userIds),
      db.from('wallets').select('*').in('user_id', userIds).eq('is_primary', true),
      db.from('user_profiles').select('*').in('user_id', userIds),
      db.from('archetype_scores').select('*').in('profile_id',
        (await db.from('user_profiles').select('id').in('user_id', userIds)).data?.map((p) => p.id) || []
      ),
      db.from('allocation_decisions').select('*').in('request_id', requestIds),
      db.from('agent_conversations').select('*').in('allocation_request_id', requestIds),
    ]);

    // Get messages for agent conversations
    const conversationIds = (agentConversations || []).map((c) => c.id);
    const { data: messages } = conversationIds.length > 0
      ? await db.from('agent_messages').select('*').in('conversation_id', conversationIds).order('sent_at', { ascending: false })
      : { data: [] };

    // Create lookup maps
    const userMap = new Map((users || []).map((u) => [u.id, u]));
    const walletMap = new Map((wallets || []).map((w) => [w.user_id, w]));
    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
    const archetypeMap = new Map<string, any[]>();
    (archetypeScores || []).forEach((a) => {
      const existing = archetypeMap.get(a.profile_id) || [];
      existing.push(a);
      archetypeMap.set(a.profile_id, existing);
    });
    const decisionMap = new Map((decisions || []).map((d) => [d.request_id, d]));
    const convMap = new Map((agentConversations || []).map((c) => [c.allocation_request_id, c]));
    const messageMap = new Map<string, any[]>();
    (messages || []).forEach((m) => {
      const existing = messageMap.get(m.conversation_id) || [];
      existing.push(m);
      messageMap.set(m.conversation_id, existing);
    });

    // Transform to API response format
    const proposals = requests.map((req) => {
      const profile = profileMap.get(req.user_id);
      const wallet = walletMap.get(req.user_id);
      const scores = profile ? archetypeMap.get(profile.id) || [] : [];
      const primaryArchetype = scores.sort((a, b) => parseFloat(b.score || '0') - parseFloat(a.score || '0'))[0]?.archetype;
      const decision = decisionMap.get(req.id);
      const agentConv = convMap.get(req.id);
      const convMessages = agentConv ? (messageMap.get(agentConv.id) || []).slice(0, 5) : [];
      const vinceRec = req.vince_recommendation as any;

      // Parse Kincho analysis from decision
      const kinchoAnalysis = decision?.kincho_analysis as any || {};

      return {
        id: req.id,
        status: req.status,
        amount: parseFloat(req.amount || '0'),
        targetStrategy: {
          id: vinceRec?.suggestedAllocations?.[0]?.causeId || 'default',
          name: vinceRec?.suggestedAllocations?.[0]?.causeName || 'Treasury Vault',
          protocol: 'AiETH',
          asset: 'ETH',
        },
        user: {
          id: req.user_id,
          walletAddress: wallet?.address || '0x0000000000000000000000000000000000000000',
          riskTolerance: profile?.risk_tolerance || 'moderate',
          archetype: primaryArchetype || undefined,
        },
        kinchoAnalysis: {
          confidence: decision ? parseFloat(decision.confidence || '0.5') * 100 : 50,
          riskAssessment: kinchoAnalysis?.riskAssessment?.aggregateRisk
            ? `Aggregate risk score: ${kinchoAnalysis.riskAssessment.aggregateRisk}`
            : 'Risk assessment pending',
          reasoning: decision?.reasoning || 'Analysis in progress',
          humanOverrideRequired: decision?.human_override_required || false,
        },
        agentConversation: {
          id: agentConv?.id || req.id,
          messages: convMessages.reverse().map((msg) => ({
            id: msg.id,
            sender: msg.sender as 'vince' | 'kincho',
            content: msg.content,
            timestamp: new Date(msg.sent_at).toISOString(),
            metadata: msg.metadata as Record<string, unknown> | undefined,
          })),
          lastUpdated: agentConv?.last_message_at
            ? new Date(agentConv.last_message_at).toISOString()
            : new Date(req.created_at).toISOString(),
        },
        createdAt: new Date(req.created_at).toISOString(),
        updatedAt: decision?.decided_at
          ? new Date(decision.decided_at).toISOString()
          : new Date(req.created_at).toISOString(),
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
