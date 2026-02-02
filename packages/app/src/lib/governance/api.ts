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
  TokenSymbol,
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

  const res = await fetch(`${API_BASE}/treasury/holdings?days=${days}`);
  if (!res.ok) throw new Error('Failed to fetch treasury holdings');

  const data = await res.json();

  // Transform dates from ISO strings to Date objects
  const snapshots: TreasurySnapshot[] = data.snapshots.map((s: any) => ({
    ...s,
    timestamp: new Date(s.timestamp),
  }));

  console.log('[Governance API] Treasury holdings:', { snapshotCount: snapshots.length, firstSnapshot: snapshots[0], lastSnapshot: snapshots[snapshots.length - 1] });
  return { snapshots };
}

export async function fetchStrategies(): Promise<StrategyPerformance[]> {
  console.log('[Governance API] Fetching strategies...');

  const res = await fetch(`${API_BASE}/treasury/strategies`);
  if (!res.ok) throw new Error('Failed to fetch strategies');

  const data = await res.json();
  console.log('[Governance API] Strategies:', data);
  return data.strategies;
}

export async function fetchBlendedYields(): Promise<BlendedYieldMetrics[]> {
  console.log('[Governance API] Fetching blended yields...');

  // Fetch both metrics and strategies to get actual asset data
  const [metrics, strategies] = await Promise.all([
    fetchTreasuryMetrics(),
    fetchStrategies(),
  ]);

  // Group strategies by asset to calculate blended yields
  const assetMap = new Map<string, {
    totalAllocated: number;
    strategies: string[];
    totalAPY: number;
    strategyCount: number;
  }>();

  for (const strategy of strategies) {
    const asset = strategy.asset;
    const existing = assetMap.get(asset) ?? {
      totalAllocated: 0,
      strategies: [],
      totalAPY: 0,
      strategyCount: 0,
    };

    existing.totalAllocated += strategy.totalDepositedUsd ?? 0;
    existing.strategies.push(strategy.name);
    existing.totalAPY += strategy.yield.currentAPY;
    existing.strategyCount += 1;

    assetMap.set(asset, existing);
  }

  // Convert to BlendedYieldMetrics array
  const yields: BlendedYieldMetrics[] = Array.from(assetMap.entries()).map(([asset, data]) => ({
    asset: asset as TokenSymbol,
    totalAllocated: data.totalAllocated,
    strategies: data.strategies,
    blendedAPY: data.strategyCount > 0 ? data.totalAPY / data.strategyCount : 0,
    yield30d: (data.totalAllocated * (data.totalAPY / 100)) / 12,
    yield90d: (data.totalAllocated * (data.totalAPY / 100)) / 4,
    lifetimeYield: metrics.lifetimeYield.total,
  }));

  // If no strategies found, use metrics with primary vault asset
  if (yields.length === 0) {
    yields.push({
      asset: 'WBTC' as const,
      totalAllocated: metrics.totalValue.current,
      strategies: ['aiWBTC Vault'],
      blendedAPY: metrics.currentAPY.blended,
      yield30d: metrics.lifetimeYield.total / 12,
      yield90d: metrics.lifetimeYield.total / 4,
      lifetimeYield: metrics.lifetimeYield.total,
    });
  }

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
