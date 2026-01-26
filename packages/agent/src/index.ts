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
export {
  createVinceRuntime,
  type VinceRuntime,
  type VinceRuntimeConfig,
  type ConversationMessage,
  type ResponseContext,
} from './vince-runtime.js';
export {
  configureLogger,
  resetLoggerConfig,
  logSystem,
  logAI,
  logWS,
  logDB,
  logAgent,
  logUser,
  logTX,
  logAuth,
  logDeposit,
  logAnalysis,
  logError,
  logTimed,
  logAPICall,
  logDBOperation,
  logStateTransition,
  type LogCategory,
  type LogLevel,
  type LoggerConfig,
} from './logger.js';
