/**
 * Admin helpers for conversation health computation
 */

import type { ConversationHealth, ConversationState } from '@bangui/types';

/** Sentiment keywords for frustration detection */
export const FRUSTRATION_KEYWORDS = [
  'frustrated',
  'annoying',
  'annoyed',
  'confused',
  'don\'t understand',
  'not working',
  'broken',
  'help',
  'stuck',
  'wrong',
  'error',
  'problem',
  'issue',
  'hate',
  'terrible',
  'awful',
  'useless',
  'waste',
  '???',
  '!!!!',
];

/**
 * Computes conversation health based on state, messages, and timing
 */
export function computeConversationHealth(
  state: ConversationState,
  messages: { sender: string; content: string; sentAt: Date }[],
  hasDeposit: boolean
): ConversationHealth {
  // Success: deposit confirmed
  if (state === 'deposit_confirmed' || hasDeposit) {
    return 'success';
  }

  // Check for frustration in user messages
  const userMessages = messages.filter((m) => m.sender === 'user');
  const hasFrustration = userMessages.some((m) =>
    FRUSTRATION_KEYWORDS.some((keyword) =>
      m.content.toLowerCase().includes(keyword.toLowerCase())
    )
  );
  if (hasFrustration) {
    return 'frustrated';
  }

  // Check for stalled conversation (no activity in last 30 minutes but not complete)
  const lastMessage = messages[messages.length - 1];
  if (lastMessage) {
    const lastMessageTime = new Date(lastMessage.sentAt).getTime();
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;

    const completedStates = ['deposit_confirmed', 'questionnaire_complete'];
    const isCompleted = completedStates.includes(state);

    // Abandoned: no activity in 2+ hours and not completed
    if (lastMessageTime < twoHoursAgo && !isCompleted) {
      return 'abandoned';
    }

    // Stalled: no activity in 30+ minutes but less than 2 hours
    if (lastMessageTime < thirtyMinutesAgo && !isCompleted) {
      return 'stalled';
    }
  }

  // Active: conversation is ongoing
  return 'active';
}

/**
 * Gets health-specific color class for message blobs
 */
export function getMessageHealth(
  sender: string,
  content: string,
  conversationHealth: ConversationHealth
): ConversationHealth {
  if (sender === 'user') {
    const hasFrustration = FRUSTRATION_KEYWORDS.some((keyword) =>
      content.toLowerCase().includes(keyword.toLowerCase())
    );
    if (hasFrustration) return 'frustrated';
  }
  return conversationHealth;
}
