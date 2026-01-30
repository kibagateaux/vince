/**
 * @module @bangui/agent
 * Vince and Kincho agent package for Bangui DAF platform
 */

// Vince exports
export { vinceCharacter } from './character.js';
export {
  questionnaire,
  allQuestions,
  questionById,
  totalQuestions,
  getNextQuestion,
  isQuestionnaireComplete,
} from './questionnaire.js';
export {
  analyzeResponses,
  calculateMoralVector,
  inferArchetype,
  inferCauseAffinities,
} from './subagents/psycho-analyzer.js';
export {
  buildDepositTx,
  simulateTx,
  getChainId,
  formatAmount,
  parseAmount,
} from './subagents/tx-generator.js';
export {
  createVinceRuntime,
  type VinceRuntime,
  type VinceRuntimeConfig,
  type ConversationMessage,
  type ResponseContext,
} from './vince-runtime.js';

// Kincho exports
export { kinchoCharacter } from './kincho-character.js';
export {
  createKinchoRuntime,
  type KinchoRuntime,
  type KinchoRuntimeConfig,
  type KinchoResponseContext,
  type AgentConversationMessage,
} from './kincho-runtime.js';
export {
  analyzeFinancials,
  type FinancialAnalysisResult,
} from './subagents/financial-analyzer.js';
export {
  assessRisk,
  type RiskAssessmentResult,
} from './subagents/risk-engine.js';
export {
  evaluateMetaCognition,
  type MetaCognitionResult,
} from './subagents/meta-cognition.js';
