/**
 * @module @bangui/app/lib/db/queries/allocations
 * Allocation-related database queries using Supabase (Kincho integration)
 */

import type { Db } from '../client';
import type {
  AllocationRequestRow,
  AllocationRequestInsert,
  AllocationDecisionRow,
  AllocationDecisionInsert,
  AllocationStatus,
  AllocationDecisionType,
  Json,
} from '../types';

/**
 * Input for creating an allocation request
 */
export interface CreateAllocationRequestInput {
  readonly depositId?: string;
  readonly userId: string;
  readonly conversationId?: string;
  readonly amount: string;
  readonly userPreferences: Record<string, unknown>;
  readonly vinceRecommendation: Record<string, unknown>;
}

/**
 * Creates an allocation request from Vince to Kincho
 */
export const createAllocationRequest = async (
  db: Db,
  input: CreateAllocationRequestInput
): Promise<AllocationRequestRow> => {
  const insert: AllocationRequestInsert = {
    deposit_id: input.depositId ?? null,
    user_id: input.userId,
    conversation_id: input.conversationId ?? null,
    amount: input.amount,
    user_preferences: input.userPreferences as Json,
    vince_recommendation: input.vinceRecommendation as Json,
    status: 'pending',
  };

  const { data, error } = await db
    .from('allocation_requests')
    .insert(insert)
    .select()
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to create allocation request');
  }

  return data;
};

/**
 * Gets allocation request by ID with related data
 */
export const getAllocationRequest = async (
  db: Db,
  id: string
): Promise<(AllocationRequestRow & {
  user: unknown;
  deposit: unknown | null;
  decision: AllocationDecisionRow | null;
}) | null> => {
  const { data, error } = await db
    .from('allocation_requests')
    .select(`
      *,
      user:users(*),
      deposit:deposits(*),
      decision:allocation_decisions(*)
    `)
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  if (!data) return null;

  // decision is returned as an array due to the join, take the first one
  const decision = Array.isArray(data.decision) ? data.decision[0] ?? null : data.decision;

  return {
    ...data,
    decision,
  } as AllocationRequestRow & {
    user: unknown;
    deposit: unknown | null;
    decision: AllocationDecisionRow | null;
  };
};

/**
 * Gets pending allocation requests for Kincho to process
 */
export const getPendingAllocationRequests = async (
  db: Db,
  limit = 10
): Promise<Array<AllocationRequestRow & { user: unknown; deposit: unknown | null }>> => {
  const { data, error } = await db
    .from('allocation_requests')
    .select(`
      *,
      user:users(*),
      deposit:deposits(*)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as Array<AllocationRequestRow & { user: unknown; deposit: unknown | null }>;
};

/**
 * Updates allocation request status
 */
export const updateAllocationRequestStatus = async (
  db: Db,
  id: string,
  status: AllocationStatus
): Promise<void> => {
  const { error } = await db
    .from('allocation_requests')
    .update({ status })
    .eq('id', id);

  if (error) {
    throw error;
  }
};

/**
 * Input for creating an allocation decision
 */
export interface CreateAllocationDecisionInput {
  readonly requestId: string;
  readonly decision: AllocationDecisionType;
  readonly allocations?: Record<string, unknown>[];
  readonly kinchoAnalysis: Record<string, unknown>;
  readonly confidence: string;
  readonly reasoning: string;
  readonly humanOverrideRequired?: boolean;
}

/**
 * Creates an allocation decision from Kincho
 */
export const createAllocationDecision = async (
  db: Db,
  input: CreateAllocationDecisionInput
): Promise<AllocationDecisionRow> => {
  const insert: AllocationDecisionInsert = {
    request_id: input.requestId,
    decision: input.decision,
    allocations: (input.allocations ?? null) as Json,
    kincho_analysis: input.kinchoAnalysis as Json,
    confidence: input.confidence,
    reasoning: input.reasoning,
    human_override_required: input.humanOverrideRequired ?? false,
  };

  const { data, error } = await db
    .from('allocation_decisions')
    .insert(insert)
    .select()
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to create allocation decision');
  }

  // Update request status to match decision
  await updateAllocationRequestStatus(db, input.requestId, input.decision);

  return data;
};

/**
 * Gets allocation decision by request ID
 */
export const getAllocationDecision = async (
  db: Db,
  requestId: string
): Promise<AllocationDecisionRow | null> => {
  const { data, error } = await db
    .from('allocation_decisions')
    .select('*')
    .eq('request_id', requestId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data;
};
