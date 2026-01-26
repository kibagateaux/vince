/**
 * @module @bangui/web/lib/types
 * Client-side type definitions
 */

import type { UUID, AgentResponse, ActionPrompt } from '@bangui/types';

/** Chat message for display */
export interface DisplayMessage {
  readonly id: string;
  readonly sender: 'user' | 'vince';
  readonly content: string;
  readonly timestamp: number;
  readonly actions?: readonly ActionPrompt[];
}

/** Connection state */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/** Session data */
export interface Session {
  readonly userId: UUID;
  readonly conversationId: UUID;
  readonly sessionId: string;
}
