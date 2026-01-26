/**
 * @module @bangui/web/lib/api
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
} from '@bangui/types';

const API_BASE = '/api/v1';

/**
 * Connects user session
 * @param platform - Platform identifier
 * @param walletAddress - Optional wallet address
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
 * @param userId - User UUID
 * @param responses - Array of responses
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
 * @param params - Deposit parameters
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
  return res.json();
};

/**
 * Confirms deposit after transaction
 * @param depositId - Deposit UUID
 * @param txHash - Transaction hash
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
 * @param userId - User UUID
 */
export const getRecommendedStories = async (
  userId: UUID
): Promise<{ stories: readonly Story[]; personalized: boolean }> => {
  const res = await fetch(`${API_BASE}/stories/recommended/${userId}`);
  return res.json();
};
