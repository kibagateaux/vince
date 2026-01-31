/**
 * @module @bangui/agents
 * Agent package for Bangui DAF platform
 * Contains Vince (donor engagement) and Kincho (fund management) agents
 */

// Vince exports
export {
  vinceCharacter,
  questionnaire,
  allQuestions,
  questionById,
  totalQuestions,
  getNextQuestion,
  isQuestionnaireComplete,
  createVinceRuntime,
  analyzeResponses,
  calculateMoralVector,
  inferArchetype,
  inferCauseAffinities,
  buildDepositTx,
  simulateTx,
  getChainId,
  formatAmount,
  parseAmount,
  type VinceRuntime,
  type VinceRuntimeConfig,
  type ConversationMessage,
  type ResponseContext,
} from './vince/index.js';

// Kincho exports
export {
  kinchoCharacter,
  createKinchoRuntime,
  analyzeFinancials,
  assessRisk,
  evaluateMetaCognition,
  runConsensusProcess,
  runNegotiationRound,
  mergeModifications,
  resolveVoting,
  checkConvergence,
  DEFAULT_CONSENSUS_CONFIG,
  type KinchoRuntime,
  type KinchoRuntimeConfig,
  type KinchoResponseContext,
  type AgentConversationMessage,
  type FinancialAnalysisResult,
  type RiskAssessmentResult,
  type MetaCognitionResult,
  type ConsensusConfig,
  type ConsensusResult,
  type ConsensusDecision,
  type NegotiationRound,
  type SubagentProposal,
  type AllocationModification,
  type AuditEntry,
} from './kincho/index.js';

// Shared utilities
export * from './shared/index.js';
