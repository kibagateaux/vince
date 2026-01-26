/**
 * @module @bangui/agent
 * Vince agent package for Bangui DAF platform
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
