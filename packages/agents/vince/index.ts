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
  type UserIntentAnalysis,
} from './runtime.js';

export {
  analyzeResponses,
  calculateMoralVector,
  inferArchetype,
  inferCauseAffinities,
} from './subagents/psycho-analyzer.js';

export {
  buildDepositTx,
  buildApproveTx,
  buildAllocateTx,
  encodeAllocateData,
  prepareDepositTransactions,
  checkAllowance,
  simulateTx,
  getChainId,
  formatAmount,
  parseAmount,
  validateAmountConversion,
  type BuildAllocateTxInput,
} from './subagents/tx-generator.js';
