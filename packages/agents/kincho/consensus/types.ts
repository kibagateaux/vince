/**
 * @module @bangui/agents/kincho/consensus/types
 * Type definitions for multi-round negotiation consensus
 */

import type { AllocationRequest, FundState, Address } from '@bangui/types';

/** Subagent identifiers */
export type SubagentId = 'financial_analyzer' | 'risk_engine' | 'meta_cognition';

/** Possible votes from subagents */
export type SubagentVote = 'approve' | 'reject' | 'modify';

/** Allocation modification proposal */
export interface AllocationModification {
  /** Original cause ID being modified */
  causeId: string;
  /** Modification type */
  modificationType: 'adjust_amount' | 'reject_cause' | 'add_condition';
  /** Original amount */
  originalAmount?: number;
  /** Proposed new amount */
  proposedAmount?: number;
  /** Condition to add (if applicable) */
  condition?: string;
  /** Reasoning for modification */
  reasoning: string;
}

/** A single subagent's proposal for a negotiation round */
export interface SubagentProposal {
  /** Which subagent made this proposal */
  subagentId: SubagentId;
  /** The vote: approve, reject, or modify */
  vote: SubagentVote;
  /** Confidence in this decision (0-1) */
  confidence: number;
  /** Proposed modifications (if vote is 'modify') */
  proposedModifications?: AllocationModification[];
  /** Reasoning for the decision */
  reasoning: string;
  /** Specific concerns raised */
  concerns: string[];
  /** Key metrics that influenced the decision */
  metrics?: Record<string, number>;
}

/** Status of a negotiation round */
export type NegotiationStatus =
  | 'active'
  | 'consensus_reached'
  | 'deadlock'
  | 'escalated';

/** A single round of negotiation */
export interface NegotiationRound {
  /** Round number (1-indexed) */
  roundNumber: number;
  /** Proposals from each subagent */
  proposals: SubagentProposal[];
  /** Current status of this round */
  status: NegotiationStatus;
  /** Merged modifications from this round (if any) */
  mergedModifications?: AllocationModification[];
  /** Summary of round outcome */
  summary?: string;
  /** Timestamp */
  timestamp: number;
}

/** Configuration for consensus process */
export interface ConsensusConfig {
  /** Maximum number of negotiation rounds (default: 3) */
  maxRounds: number;
  /** Approval threshold for consensus (default: 0.67 = 2/3) */
  approvalThreshold: number;
  /** Whether to escalate to human on deadlock (default: true) */
  escalateOnDeadlock: boolean;
  /** Minimum confidence required for auto-approval (default: 0.7) */
  minConfidence: number;
  /** Vault address for validation */
  vaultAddress: Address;
}

/** Default consensus configuration */
export const DEFAULT_CONSENSUS_CONFIG: ConsensusConfig = {
  maxRounds: 3,
  approvalThreshold: 0.67,
  escalateOnDeadlock: true,
  minConfidence: 0.7,
  vaultAddress: '0x0000000000000000000000000000000000000000' as Address,
};

/** Final decision from consensus process */
export type ConsensusDecision = 'approved' | 'modified' | 'rejected' | 'escalated';

/** Entry in the audit trail */
export interface AuditEntry {
  /** Timestamp of the entry */
  timestamp: number;
  /** Type of audit event */
  eventType: 'round_start' | 'proposal_received' | 'modification_merged' | 'consensus_reached' | 'escalation';
  /** Description of the event */
  description: string;
  /** Additional data */
  data?: Record<string, unknown>;
}

/** Result of the consensus process */
export interface ConsensusResult {
  /** Whether consensus was achieved */
  achieved: boolean;
  /** Final decision */
  decision: ConsensusDecision;
  /** All negotiation rounds */
  rounds: NegotiationRound[];
  /** Final merged modifications (if any) */
  finalModifications?: AllocationModification[];
  /** Audit trail for transparency */
  auditTrail: AuditEntry[];
  /** Overall confidence in the decision */
  confidence: number;
  /** Whether human review is recommended */
  humanReviewRecommended: boolean;
  /** Summary of the consensus process */
  summary: string;
}

/** Context passed to each negotiation round */
export interface NegotiationContext {
  /** Original allocation request */
  request: AllocationRequest;
  /** Current fund state */
  fundState: FundState;
  /** Previous round (if not first round) */
  previousRound?: NegotiationRound;
  /** Accumulated modifications from previous rounds */
  accumulatedModifications: AllocationModification[];
  /** Configuration */
  config: ConsensusConfig;
}
