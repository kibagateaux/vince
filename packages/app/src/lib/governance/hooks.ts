/**
 * @module governance/hooks
 * React Query hooks for governance dashboard
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import {
  fetchTreasuryMetrics,
  fetchTreasuryHoldings,
  fetchStrategies,
  fetchBlendedYields,
  fetchProposals,
  fetchProposalMessages,
  fetchCommunityMetrics,
  fetchDepositVolume,
  fetchCommunityComposition,
} from './api';

// ============================================================================
// Query Keys
// ============================================================================

export const governanceKeys = {
  all: ['governance'] as const,

  treasury: () => [...governanceKeys.all, 'treasury'] as const,
  treasuryMetrics: () => [...governanceKeys.treasury(), 'metrics'] as const,
  treasuryHoldings: (days: number) => [...governanceKeys.treasury(), 'holdings', days] as const,
  strategies: () => [...governanceKeys.treasury(), 'strategies'] as const,
  blendedYields: () => [...governanceKeys.treasury(), 'yields'] as const,

  proposals: () => [...governanceKeys.all, 'proposals'] as const,
  proposalsList: (status?: string) => [...governanceKeys.proposals(), 'list', status] as const,
  proposalMessages: (id: string) => [...governanceKeys.proposals(), id, 'messages'] as const,

  community: () => [...governanceKeys.all, 'community'] as const,
  communityMetrics: () => [...governanceKeys.community(), 'metrics'] as const,
  depositVolume: (days: number) => [...governanceKeys.community(), 'deposits', days] as const,
  composition: () => [...governanceKeys.community(), 'composition'] as const,
};

// ============================================================================
// Treasury Hooks
// ============================================================================

export function useTreasuryMetrics() {
  return useQuery({
    queryKey: governanceKeys.treasuryMetrics(),
    queryFn: fetchTreasuryMetrics,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 60 * 1000,
  });
}

export function useTreasuryHoldings(days: number = 90) {
  return useQuery({
    queryKey: governanceKeys.treasuryHoldings(days),
    queryFn: () => fetchTreasuryHoldings(days),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useStrategies() {
  return useQuery({
    queryKey: governanceKeys.strategies(),
    queryFn: fetchStrategies,
    staleTime: 60 * 1000,
  });
}

export function useBlendedYields() {
  return useQuery({
    queryKey: governanceKeys.blendedYields(),
    queryFn: fetchBlendedYields,
    staleTime: 60 * 1000,
  });
}

// ============================================================================
// Proposals Hooks
// ============================================================================

export function useProposals(status?: string) {
  return useQuery({
    queryKey: governanceKeys.proposalsList(status),
    queryFn: () => fetchProposals(status),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000,
  });
}

export function useProposalMessages(proposalId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: governanceKeys.proposalMessages(proposalId),
    queryFn: () => fetchProposalMessages(proposalId),
    staleTime: 3 * 1000, // 3 seconds
    refetchInterval: enabled ? 3 * 1000 : false,
    enabled,
  });
}

// ============================================================================
// Community Hooks
// ============================================================================

export function useCommunityMetrics() {
  return useQuery({
    queryKey: governanceKeys.communityMetrics(),
    queryFn: fetchCommunityMetrics,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useDepositVolume(days: number = 30) {
  return useQuery({
    queryKey: governanceKeys.depositVolume(days),
    queryFn: () => fetchDepositVolume(days),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCommunityComposition() {
  return useQuery({
    queryKey: governanceKeys.composition(),
    queryFn: fetchCommunityComposition,
    staleTime: 5 * 60 * 1000,
  });
}
