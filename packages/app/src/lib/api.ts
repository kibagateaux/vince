/**
 * @module @bangui/app/lib/api
 * API client functions
 */

import type {
  AuthConnectResponse,
  Platform,
  Address,
  UUID,
  QuestionnaireResponseInput,
  DepositPrepareResponse,
  Chain,
  BigIntString,
  Story,
  ConversationSummary,
  ConversationDetail,
  DashboardStats,
} from '@bangui/types';

const API_BASE = '/api/v1';

/**
 * Connects user session
 */
export const connectSession = async (
  platform: Platform,
  walletAddress?: Address
): Promise<AuthConnectResponse> => {
  const res = await fetch(`${API_BASE}/auth/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform, walletAddress }),
  });
  return res.json();
};

/**
 * Submits questionnaire responses
 */
export const submitQuestionnaire = async (
  userId: UUID,
  responses: readonly QuestionnaireResponseInput[]
): Promise<{ complete: boolean; progress?: number; total?: number }> => {
  const res = await fetch(`${API_BASE}/questionnaire/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, responses }),
  });
  return res.json();
};

/**
 * Prepares deposit transaction
 */
export const prepareDeposit = async (params: {
  userId: UUID;
  walletAddress: Address;
  amount: BigIntString;
  token: string;
  chain: Chain;
}): Promise<DepositPrepareResponse> => {
  const res = await fetch(`${API_BASE}/deposits/prepare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Deposit preparation failed: ${res.status}`);
  }
  return res.json();
};

/**
 * Confirms deposit after transaction
 */
export const confirmDeposit = async (
  depositId: UUID,
  txHash: string
): Promise<{ success: boolean }> => {
  const res = await fetch(`${API_BASE}/deposits/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ depositId, txHash }),
  });
  return res.json();
};

/**
 * Gets recommended stories for user
 */
export const getRecommendedStories = async (
  userId: UUID
): Promise<{ stories: readonly Story[]; personalized: boolean }> => {
  const res = await fetch(`${API_BASE}/stories/recommended/${userId}`);
  return res.json();
};

// ============================================================================
// Admin Dashboard API
// ============================================================================

/**
 * Gets all conversations with health status
 */
export const getConversations = async (params?: {
  limit?: number;
  offset?: number;
}): Promise<{
  conversations: ConversationSummary[];
  total: number;
  limit: number;
  offset: number;
}> => {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));
  const res = await fetch(`${API_BASE}/admin/conversations?${query}`);
  return res.json();
};

/**
 * Gets detailed conversation with messages and timeline
 */
export const getConversationDetail = async (
  conversationId: UUID
): Promise<ConversationDetail> => {
  const res = await fetch(`${API_BASE}/admin/conversations/${conversationId}`);
  return res.json();
};

/**
 * Gets dashboard statistics
 */
export const getDashboardStats = async (): Promise<DashboardStats> => {
  const res = await fetch(`${API_BASE}/admin/stats`);
  return res.json();
};

/**
 * Injects an admin message into a conversation
 */
export const injectAdminMessage = async (
  conversationId: UUID,
  content: string,
  sender: 'vince' | 'system'
): Promise<{ success: boolean }> => {
  const res = await fetch(`${API_BASE}/admin/conversations/${conversationId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, content, sender }),
  });
  return res.json();
};
