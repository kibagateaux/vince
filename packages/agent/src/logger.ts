/**
 * @module @bangui/agent/logger
 * Centralized debug logging utility for monitoring system behavior
 */

/** Log categories for filtering and organization */
export type LogCategory =
  | 'SYSTEM'   // System startup, config, lifecycle
  | 'AI'       // Claude API calls, prompts, responses
  | 'WS'       // WebSocket connections, events
  | 'DB'       // Database queries, updates
  | 'AGENT'    // Agent logic, state machines
  | 'USER'     // User data flows, actions
  | 'TX'       // Transaction generation, simulation
  | 'AUTH'     // Authentication flows
  | 'DEPOSIT'  // Deposit handling
  | 'ANALYSIS' // Psychopolitical analysis
  | 'ERROR';   // Error conditions

/** Log levels */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Configuration for the logger */
export interface LoggerConfig {
  /** Enable or disable logging (default: true) */
  enabled: boolean;
  /** Minimum log level to display */
  minLevel: LogLevel;
  /** Categories to include (empty = all) */
  includeCategories: LogCategory[];
  /** Categories to exclude */
  excludeCategories: LogCategory[];
  /** Include timestamps in output */
  timestamps: boolean;
  /** Pretty print objects */
  prettyPrint: boolean;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** Default configuration */
const defaultConfig: LoggerConfig = {
  enabled: true,
  minLevel: 'debug',
  includeCategories: [],
  excludeCategories: [],
  timestamps: true,
  prettyPrint: true,
};

let config: LoggerConfig = { ...defaultConfig };

/**
 * Configure the logger
 * @param newConfig - Partial configuration to merge
 */
export const configureLogger = (newConfig: Partial<LoggerConfig>): void => {
  config = { ...config, ...newConfig };
};

/**
 * Reset logger to default configuration
 */
export const resetLoggerConfig = (): void => {
  config = { ...defaultConfig };
};

/**
 * Format timestamp for log output
 */
const formatTimestamp = (): string => {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const mins = now.getMinutes().toString().padStart(2, '0');
  const secs = now.getSeconds().toString().padStart(2, '0');
  const ms = now.getMilliseconds().toString().padStart(3, '0');
  return `${hours}:${mins}:${secs}.${ms}`;
};

/**
 * Format data for output
 */
const formatData = (data: unknown): string => {
  if (data === undefined) return '';
  if (data === null) return 'null';
  if (typeof data === 'string') return data;
  if (typeof data === 'number' || typeof data === 'boolean') return String(data);

  try {
    if (config.prettyPrint) {
      return JSON.stringify(data, null, 2);
    }
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
};

/**
 * Check if a category should be logged
 */
const shouldLogCategory = (category: LogCategory): boolean => {
  if (config.excludeCategories.includes(category)) return false;
  if (config.includeCategories.length === 0) return true;
  return config.includeCategories.includes(category);
};

/**
 * Check if a level should be logged
 */
const shouldLogLevel = (level: LogLevel): boolean => {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[config.minLevel];
};

/**
 * Core logging function
 */
const log = (
  level: LogLevel,
  category: LogCategory,
  message: string,
  data?: unknown
): void => {
  if (!config.enabled) return;
  if (!shouldLogCategory(category)) return;
  if (!shouldLogLevel(level)) return;

  const timestamp = config.timestamps ? `[${formatTimestamp()}]` : '';
  const prefix = `${timestamp}[${category}]`;
  const formattedData = data !== undefined ? `\n${formatData(data)}` : '';

  const output = `${prefix} ${message}${formattedData}`;

  switch (level) {
    case 'debug':
      console.debug(output);
      break;
    case 'info':
      console.info(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    case 'error':
      console.error(output);
      break;
  }
};

// ============================================================================
// Category-specific logging functions
// ============================================================================

/** System logging */
export const logSystem = {
  debug: (message: string, data?: unknown) => log('debug', 'SYSTEM', message, data),
  info: (message: string, data?: unknown) => log('info', 'SYSTEM', message, data),
  warn: (message: string, data?: unknown) => log('warn', 'SYSTEM', message, data),
  error: (message: string, data?: unknown) => log('error', 'SYSTEM', message, data),
};

/** AI/Claude API logging */
export const logAI = {
  debug: (message: string, data?: unknown) => log('debug', 'AI', message, data),
  info: (message: string, data?: unknown) => log('info', 'AI', message, data),
  warn: (message: string, data?: unknown) => log('warn', 'AI', message, data),
  error: (message: string, data?: unknown) => log('error', 'AI', message, data),
};

/** WebSocket logging */
export const logWS = {
  debug: (message: string, data?: unknown) => log('debug', 'WS', message, data),
  info: (message: string, data?: unknown) => log('info', 'WS', message, data),
  warn: (message: string, data?: unknown) => log('warn', 'WS', message, data),
  error: (message: string, data?: unknown) => log('error', 'WS', message, data),
};

/** Database logging */
export const logDB = {
  debug: (message: string, data?: unknown) => log('debug', 'DB', message, data),
  info: (message: string, data?: unknown) => log('info', 'DB', message, data),
  warn: (message: string, data?: unknown) => log('warn', 'DB', message, data),
  error: (message: string, data?: unknown) => log('error', 'DB', message, data),
};

/** Agent logic logging */
export const logAgent = {
  debug: (message: string, data?: unknown) => log('debug', 'AGENT', message, data),
  info: (message: string, data?: unknown) => log('info', 'AGENT', message, data),
  warn: (message: string, data?: unknown) => log('warn', 'AGENT', message, data),
  error: (message: string, data?: unknown) => log('error', 'AGENT', message, data),
};

/** User data flow logging */
export const logUser = {
  debug: (message: string, data?: unknown) => log('debug', 'USER', message, data),
  info: (message: string, data?: unknown) => log('info', 'USER', message, data),
  warn: (message: string, data?: unknown) => log('warn', 'USER', message, data),
  error: (message: string, data?: unknown) => log('error', 'USER', message, data),
};

/** Transaction logging */
export const logTX = {
  debug: (message: string, data?: unknown) => log('debug', 'TX', message, data),
  info: (message: string, data?: unknown) => log('info', 'TX', message, data),
  warn: (message: string, data?: unknown) => log('warn', 'TX', message, data),
  error: (message: string, data?: unknown) => log('error', 'TX', message, data),
};

/** Authentication logging */
export const logAuth = {
  debug: (message: string, data?: unknown) => log('debug', 'AUTH', message, data),
  info: (message: string, data?: unknown) => log('info', 'AUTH', message, data),
  warn: (message: string, data?: unknown) => log('warn', 'AUTH', message, data),
  error: (message: string, data?: unknown) => log('error', 'AUTH', message, data),
};

/** Deposit logging */
export const logDeposit = {
  debug: (message: string, data?: unknown) => log('debug', 'DEPOSIT', message, data),
  info: (message: string, data?: unknown) => log('info', 'DEPOSIT', message, data),
  warn: (message: string, data?: unknown) => log('warn', 'DEPOSIT', message, data),
  error: (message: string, data?: unknown) => log('error', 'DEPOSIT', message, data),
};

/** Analysis logging */
export const logAnalysis = {
  debug: (message: string, data?: unknown) => log('debug', 'ANALYSIS', message, data),
  info: (message: string, data?: unknown) => log('info', 'ANALYSIS', message, data),
  warn: (message: string, data?: unknown) => log('warn', 'ANALYSIS', message, data),
  error: (message: string, data?: unknown) => log('error', 'ANALYSIS', message, data),
};

/** Error logging */
export const logError = {
  debug: (message: string, data?: unknown) => log('debug', 'ERROR', message, data),
  info: (message: string, data?: unknown) => log('info', 'ERROR', message, data),
  warn: (message: string, data?: unknown) => log('warn', 'ERROR', message, data),
  error: (message: string, data?: unknown) => log('error', 'ERROR', message, data),
};

// ============================================================================
// Convenience functions for common patterns
// ============================================================================

/**
 * Log the start of an operation with timing
 * Returns a function to call when the operation completes
 */
export const logTimed = (
  category: LogCategory,
  operation: string,
  data?: unknown
): (() => void) => {
  const startTime = performance.now();
  log('debug', category, `Starting: ${operation}`, data);

  return () => {
    const duration = (performance.now() - startTime).toFixed(2);
    log('debug', category, `Completed: ${operation} (${duration}ms)`);
  };
};

/**
 * Log an API call (request and response)
 */
export const logAPICall = (
  endpoint: string,
  request: unknown,
  response?: unknown,
  error?: Error
): void => {
  logAI.info(`API Call: ${endpoint}`, {
    request: request,
    ...(response !== undefined && { response }),
    ...(error && { error: error.message }),
  });
};

/**
 * Log a database operation
 */
export const logDBOperation = (
  operation: string,
  table: string,
  params?: unknown,
  result?: unknown
): void => {
  logDB.debug(`${operation} on ${table}`, {
    params,
    ...(result !== undefined && { resultCount: Array.isArray(result) ? result.length : 1 }),
  });
};

/**
 * Log a state transition
 */
export const logStateTransition = (
  entity: string,
  entityId: string,
  fromState: string,
  toState: string
): void => {
  logAgent.info(`State transition: ${entity}`, {
    entityId,
    from: fromState,
    to: toState,
  });
};
