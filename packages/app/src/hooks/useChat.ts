/**
 * @module @bangui/app/hooks/useChat
 * Chat connection hook - uses REST polling for Vercel/production
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { UUID, ChatMessage, AgentResponse, ActionPrompt } from '@bangui/types';
import type { DisplayMessage, ConnectionState, Session } from '../lib/types';

/** Chat hook return type */
export interface UseChatReturn {
  readonly messages: readonly DisplayMessage[];
  readonly connectionState: ConnectionState;
  readonly isWaitingForResponse: boolean;
  readonly sendMessage: (content: string) => void;
  readonly connect: (session: Session) => void;
  readonly disconnect: () => void;
}

/** Response from REST chat API */
interface ChatApiResponse {
  messages: Array<{
    id: string;
    sender: string;
    content: string;
    actions?: ActionPrompt[];
    timestamp: number;
  }>;
  state: string;
  response?: AgentResponse;
}

/**
 * Hook for managing chat connection via REST polling
 * @returns Chat state and methods
 */
export const useChat = (): UseChatReturn => {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const sessionRef = useRef<Session | null>(null);
  const currentQuestionIdRef = useRef<string | undefined>(undefined);
  const lastMessageIdRef = useRef<string | null>(null);

  const connect = useCallback(async (session: Session) => {
    sessionRef.current = session;
    setConnectionState('connecting');
    setMessages([]); // Clear messages on new connection

    try {
      const res = await fetch('/api/v1/chat/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: session.conversationId,
          userId: session.userId,
        }),
      });

      if (!res.ok) {
        throw new Error(`Chat connect failed: ${res.status}`);
      }

      const data: ChatApiResponse = await res.json();

      // Convert API messages to display format
      const displayMessages: DisplayMessage[] = data.messages.map((m) => ({
        id: m.id,
        sender: m.sender as 'user' | 'vince',
        content: m.content,
        actions: m.actions,
        timestamp: m.timestamp,
      }));

      setMessages(displayMessages);
      setConnectionState('connected');

      // Track last message ID for polling
      if (displayMessages.length > 0) {
        lastMessageIdRef.current = displayMessages[displayMessages.length - 1]!.id;
      }

      // Track current question from last Vince message
      const lastVinceMessage = [...displayMessages].reverse().find((m) => m.sender === 'vince');
      if (lastVinceMessage?.actions) {
        const questionnaireAction = lastVinceMessage.actions.find(
          (a) => a.type === 'questionnaire'
        );
        if (questionnaireAction?.data?.questionId) {
          currentQuestionIdRef.current = questionnaireAction.data.questionId as string;
        }
      }
    } catch (err) {
      console.error('Chat connect error:', err);
      setConnectionState('error');
    }
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!sessionRef.current) {
      console.error('No session');
      return;
    }

    // Optimistic update - add user message immediately
    const userMessage: DisplayMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      content,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsWaitingForResponse(true);

    try {
      const res = await fetch('/api/v1/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: sessionRef.current.conversationId,
          userId: sessionRef.current.userId,
          content,
          metadata: {
            questionId: currentQuestionIdRef.current,
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`Chat send failed: ${res.status}`);
      }

      const data: ChatApiResponse = await res.json();

      // Replace messages with server response (includes all messages)
      const displayMessages: DisplayMessage[] = data.messages.map((m) => ({
        id: m.id,
        sender: m.sender as 'user' | 'vince',
        content: m.content,
        actions: m.actions,
        timestamp: m.timestamp,
      }));

      setMessages(displayMessages);

      // Track last message ID
      if (displayMessages.length > 0) {
        lastMessageIdRef.current = displayMessages[displayMessages.length - 1]!.id;
      }

      // Update current question tracking
      if (data.response?.actions) {
        const questionnaireAction = data.response.actions.find((a) => a.type === 'questionnaire');
        if (questionnaireAction?.data?.questionId) {
          currentQuestionIdRef.current = questionnaireAction.data.questionId as string;
        } else if (data.response.actions.some((a) => a.type === 'suggestion')) {
          currentQuestionIdRef.current = undefined;
        }
      } else {
        currentQuestionIdRef.current = undefined;
      }
    } catch (err) {
      console.error('Chat send error:', err);
    } finally {
      setIsWaitingForResponse(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    sessionRef.current = null;
    lastMessageIdRef.current = null;
    setConnectionState('disconnected');
  }, []);

  return {
    messages,
    connectionState,
    isWaitingForResponse,
    sendMessage,
    connect,
    disconnect,
  };
};
