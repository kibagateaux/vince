/**
 * @module @bangui/agents/kincho
 * Kincho (金長) - DAF fund manager agent
 */

export { kinchoCharacter } from './character.js';

export {
  createKinchoRuntime,
  type KinchoRuntime,
  type KinchoRuntimeConfig,
  type KinchoResponseContext,
  type AgentConversationMessage,
  type LLMProvider,
} from './runtime.js';

// Subagents
export {
  analyzeFinancials,
  type FinancialAnalysisResult,
  assessRisk,
  type RiskAssessmentResult,
  evaluateMetaCognition,
  type MetaCognitionResult,
} from './subagents/index.js';

// Consensus system
export {
  runConsensusProcess,
  runNegotiationRound,
  mergeModifications,
  resolveVoting,
  checkConvergence,
  DEFAULT_CONSENSUS_CONFIG,
  type ConsensusConfig,
  type ConsensusResult,
  type ConsensusDecision,
  type NegotiationRound,
  type NegotiationContext,
  type SubagentProposal,
  type SubagentVote,
  type SubagentId,
  type AllocationModification,
  type AuditEntry,
} from './consensus/index.js';
