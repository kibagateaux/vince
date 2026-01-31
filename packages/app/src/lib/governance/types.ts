/**
 * @module governance/types
 * Governance dashboard type definitions
 */

import type { UUID, Address, RiskTolerance, Archetype, BigIntString } from '@bangui/types';

// ============================================================================
// Treasury Types
// ============================================================================

export interface TreasuryMetrics {
  totalValue: {
    current: number;
    change30d: number;
    change7d: number;
  };
  currentAPY: {
    blended: number;
    change7d: number;
  };
  lifetimeYield: {
    total: number;
    inceptionDate: Date;
  };
  activeStrategies: {
    count: number;
    uniqueAssets: number;
  };
}

export type TokenSymbol = 'ETH' | 'USDC' | 'DAI' | 'WBTC' | 'USDT';

export interface TreasurySnapshot {
  timestamp: Date;
  holdings: AssetHolding[];
  totalValueUSD: number;
}

export interface AssetHolding {
  asset: TokenSymbol;
  strategy: string;
  amount: number;
  valueUSD: number;
}

export interface StrategyPerformance {
  id: string;
  name: string;
  protocol: string;
  asset: TokenSymbol;
  allocation: {
    amount: number;
    percentage: number;
  };
  yield: {
    trailing30d: number;
    trailing90d: number;
    currentAPY: number;
    trend: 'up' | 'down' | 'stable';
  };
}

export interface BlendedYieldMetrics {
  asset: TokenSymbol;
  totalAllocated: number;
  strategies: string[];
  blendedAPY: number;
  yield30d: number;
  yield90d: number;
  lifetimeYield: number;
}

// ============================================================================
// Proposal Types
// ============================================================================

export type ProposalStatus = 'pending' | 'discussing' | 'approved' | 'modified' | 'rejected';

export interface Proposal {
  id: UUID;
  status: ProposalStatus;
  amount: number;
  targetStrategy: {
    id: string;
    name: string;
    protocol: string;
    asset: TokenSymbol;
  };
  user: {
    id: UUID;
    walletAddress: Address;
    riskTolerance: RiskTolerance;
    archetype?: Archetype;
  };
  kinchoAnalysis: {
    confidence: number;
    riskAssessment: string;
    reasoning: string;
    humanOverrideRequired: boolean;
  };
  agentConversation: {
    id: UUID;
    messages: ProposalMessage[];
    lastUpdated: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ProposalMessage {
  id: UUID;
  sender: 'vince' | 'kincho';
  content: string;
  timestamp: Date;
  metadata?: {
    analysisType?: string;
    dataPoints?: Record<string, unknown>;
  };
}

// ============================================================================
// Community Types
// ============================================================================

export interface CommunityMetrics {
  totalDepositors: {
    allTime: number;
    trend: number;
  };
  currentActive: {
    count: number;
    changeThisWeek: number;
  };
  newDepositors: {
    last24h: number;
    last7d: number;
    last30d: number;
    percentChange7d: number;
    percentChange30d: number;
  };
}

export interface DepositVolumeData {
  date: Date;
  volume: number;
  count: number;
  uniqueDepositors: number;
  movingAvg7d: number;
}

export interface ArchetypeDistribution {
  archetype: Archetype;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export interface RiskDistribution {
  riskTolerance: RiskTolerance;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

// ============================================================================
// Time Range Types
// ============================================================================

export type TimeRange = '1W' | '1M' | '3M' | '1Y' | 'ALL';
export type GroupBy = 'asset' | 'strategy';
