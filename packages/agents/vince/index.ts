/**
 * @module @bangui/agents/vince
 * Vince - Donor engagement specialist agent
 */

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
  createVinceRuntime,
  type LLMProvider,
  type VinceRuntime,
  type VinceRuntimeConfig,
  type ConversationMessage,
  type ResponseContext,
} from './runtime.js';

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
