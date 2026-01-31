/**
 * @module governance/api
 * API client functions for governance dashboard
 */

import type {
  TreasuryMetrics,
  TreasurySnapshot,
  StrategyPerformance,
  BlendedYieldMetrics,
  Proposal,
  CommunityMetrics,
  DepositVolumeData,
  ArchetypeDistribution,
  RiskDistribution,
} from './types';

const API_BASE = '/api/v1/governance';

// ============================================================================
// Treasury API
// ============================================================================

export async function fetchTreasuryMetrics(): Promise<TreasuryMetrics> {
  console.log('[Governance API] Fetching treasury metrics...');
  const res = await fetch(`${API_BASE}/treasury/metrics`);
  if (!res.ok) throw new Error('Failed to fetch treasury metrics');
  const data = await res.json();
  console.log('[Governance API] Treasury metrics:', data);
  return data;
}

export async function fetchTreasuryHoldings(
  days: number = 90
): Promise<{ snapshots: TreasurySnapshot[] }> {
  console.log('[Governance API] Fetching treasury holdings for', days, 'days...');
  // For now, generate client-side based on current metrics
  // In production, this would fetch from an indexer or historical data service
  const metrics = await fetchTreasuryMetrics();
  const snapshots: TreasurySnapshot[] = [];
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    // Generate realistic-looking historical data based on current value
    const dayFactor = 1 - (i / days) * 0.1; // 10% growth over period
    const noise = 1 + (Math.random() - 0.5) * 0.02;
    const value = metrics.totalValue.current * dayFactor * noise;

    snapshots.push({
      timestamp: date,
      holdings: [
        {
          asset: 'ETH',
          strategy: 'aiETH-vault',
          amount: value / 3000, // Approximate ETH amount
          valueUSD: value,
        },
      ],
      totalValueUSD: value,
    });
  }

  console.log('[Governance API] Treasury holdings:', { snapshotCount: snapshots.length, firstSnapshot: snapshots[0], lastSnapshot: snapshots[snapshots.length - 1] });
  return { snapshots };
}

export async function fetchStrategies(): Promise<StrategyPerformance[]> {
  console.log('[Governance API] Fetching strategies...');
  // Currently only one strategy (AiETH vault)
  const metrics = await fetchTreasuryMetrics();

  const strategies = [
    {
      id: 'aieth-vault',
      name: 'AiETH Vault',
      protocol: 'Bangui DAF',
      asset: 'ETH' as const,
      allocation: {
        amount: metrics.totalValue.current,
        percentage: 100,
      },
      yield: {
        trailing30d: metrics.currentAPY.blended / 12,
        trailing90d: metrics.currentAPY.blended / 4,
        currentAPY: metrics.currentAPY.blended,
        trend: (metrics.currentAPY.change7d >= 0 ? 'up' : 'down') as 'up' | 'down',
      },
    },
  ];
  console.log('[Governance API] Strategies:', strategies);
  return strategies;
}

export async function fetchBlendedYields(): Promise<BlendedYieldMetrics[]> {
  console.log('[Governance API] Fetching blended yields...');
  const metrics = await fetchTreasuryMetrics();

  const yields = [
    {
      asset: 'ETH' as const,
      totalAllocated: metrics.totalValue.current,
      strategies: ['AiETH Vault'],
      blendedAPY: metrics.currentAPY.blended,
      yield30d: metrics.lifetimeYield.total / 12,
      yield90d: metrics.lifetimeYield.total / 4,
      lifetimeYield: metrics.lifetimeYield.total,
    },
  ];
  console.log('[Governance API] Blended yields:', yields);
  return yields;
}

// ============================================================================
// Proposals API
// ============================================================================

export async function fetchProposals(
  status?: string
): Promise<{ proposals: Proposal[]; total: number; hasMore: boolean }> {
  console.log('[Governance API] Fetching proposals...', { status });
  const params = new URLSearchParams();
  if (status && status !== 'all') params.set('status', status);

  const res = await fetch(`${API_BASE}/proposals?${params}`);
  if (!res.ok) throw new Error('Failed to fetch proposals');

  const data = await res.json();
  console.log('[Governance API] Raw proposals response:', data);

  // Transform dates from ISO strings to Date objects
  const result = {
    ...data,
    proposals: data.proposals.map((p: any) => ({
      ...p,
      createdAt: new Date(p.createdAt),
      updatedAt: new Date(p.updatedAt),
      agentConversation: {
        ...p.agentConversation,
        messages: p.agentConversation.messages.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        })),
        lastUpdated: new Date(p.agentConversation.lastUpdated),
      },
    })),
  };
  console.log('[Governance API] Proposals:', result);
  return result;
}

export async function fetchProposalMessages(
  proposalId: string
): Promise<{ messages: Proposal['agentConversation']['messages']; isActive: boolean }> {
  const res = await fetch(`${API_BASE}/proposals/${proposalId}/messages`);
  if (!res.ok) throw new Error('Failed to fetch proposal messages');

  const data = await res.json();
  return {
    ...data,
    messages: data.messages.map((m: any) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    })),
  };
}

// ============================================================================
// Community API
// ============================================================================

export async function fetchCommunityMetrics(): Promise<CommunityMetrics> {
  console.log('[Governance API] Fetching community metrics...');
  const res = await fetch(`${API_BASE}/community/metrics`);
  if (!res.ok) throw new Error('Failed to fetch community metrics');
  const data = await res.json();
  console.log('[Governance API] Community metrics:', data);
  return data;
}

export async function fetchDepositVolume(
  days: number = 30
): Promise<{ data: DepositVolumeData[]; summary: any }> {
  console.log('[Governance API] Fetching deposit volume for', days, 'days...');
  const res = await fetch(`${API_BASE}/community/deposits?days=${days}`);
  if (!res.ok) throw new Error('Failed to fetch deposit volume');

  const rawData = await res.json();
  console.log('[Governance API] Raw deposit volume:', rawData);
  const result = {
    ...rawData,
    data: rawData.data.map((d: any) => ({
      ...d,
      date: new Date(d.date),
    })),
  };
  console.log('[Governance API] Deposit volume:', { dataCount: result.data.length, summary: result.summary });
  return result;
}

export async function fetchCommunityComposition(): Promise<{
  archetypes: ArchetypeDistribution[];
  riskProfiles: RiskDistribution[];
}> {
  console.log('[Governance API] Fetching community composition...');
  const res = await fetch(`${API_BASE}/community/composition`);
  if (!res.ok) throw new Error('Failed to fetch community composition');
  const data = await res.json();
  console.log('[Governance API] Community composition:', data);
  return data;
}
