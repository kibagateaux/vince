/**
 * @module @bangui/web/hooks/useChat
 * Chat connection hook - supports WebSocket (local) and REST polling (Vercel/production)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { UUID, ChatMessage, AgentResponse, ActionPrompt } from '@bangui/types';
import type { DisplayMessage, ConnectionState, Session } from '../lib/types.js';

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
 * Detect if we should use REST polling instead of WebSocket
 * Use polling on Vercel/production, WebSocket for local development
 */
const usePollingMode = (): boolean => {
  // Check explicit environment variable first
  if (import.meta.env.VITE_USE_POLLING === 'true') {
    return true;
  }
  // Use polling for non-localhost hostnames (production)
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return true;
  }
  return false;
};

/**
 * Hook for managing chat connection
 * Automatically uses WebSocket for local dev or REST polling for production
 * @returns Chat state and methods
 */
export const useChat = (): UseChatReturn => {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const currentQuestionIdRef = useRef<string | undefined>(undefined);
  const pollingIntervalRef = useRef<number | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const isPollingMode = usePollingMode();

  // ============================================================================
  // REST Polling Implementation (for Vercel/production)
  // ============================================================================

  const connectPolling = useCallback(async (session: Session) => {
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

  const sendMessagePolling = useCallback(async (content: string) => {
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

  const disconnectPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    sessionRef.current = null;
    lastMessageIdRef.current = null;
    setConnectionState('disconnected');
  }, []);

  // ============================================================================
  // WebSocket Implementation (for local development)
  // ============================================================================

  const connectWebSocket = useCallback((session: Session) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    sessionRef.current = session;
    setConnectionState('connecting');
    setMessages([]); // Clear messages on new connection

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/chat?conversationId=${session.conversationId}&userId=${session.userId}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setConnectionState('connected');
      // Waiting for initial welcome message
      setIsWaitingForResponse(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle different message types
        if (data.type === 'history') {
          // User message from conversation history
          const message: DisplayMessage = {
            id: crypto.randomUUID(),
            sender: 'user',
            content: data.content,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, message]);
        } else {
          // Vince response (type === 'response')
          const response = data as AgentResponse;
          const message: DisplayMessage = {
            id: crypto.randomUUID(),
            sender: 'vince',
            content: response.content,
            timestamp: Date.now(),
            actions: response.actions,
          };
          setMessages((prev) => [...prev, message]);
          // Response received, stop showing typing indicator
          setIsWaitingForResponse(false);

          // Track current question for next user response
          const questionnaireAction = response.actions?.find((a) => a.type === 'questionnaire');
          if (questionnaireAction?.data?.questionId) {
            currentQuestionIdRef.current = questionnaireAction.data.questionId as string;
          } else if (response.actions?.some((a) => a.type === 'suggestion')) {
            // Clear question tracking when questionnaire is complete
            currentQuestionIdRef.current = undefined;
          }
        }
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    };

    ws.onerror = () => {
      setConnectionState('error');
    };

    ws.onclose = () => {
      setConnectionState('disconnected');
      wsRef.current = null;
    };

    wsRef.current = ws;
  }, []);

  const disconnectWebSocket = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    sessionRef.current = null;
    setConnectionState('disconnected');
  }, []);

  const sendMessageWebSocket = useCallback((content: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return;
    }

    if (!sessionRef.current) {
      console.error('No session');
      return;
    }

    // Add user message to display
    const userMessage: DisplayMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      content,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Show typing indicator while waiting for response
    setIsWaitingForResponse(true);

    // Send via WebSocket with question tracking metadata
    const chatMessage: ChatMessage = {
      type: 'message',
      conversationId: sessionRef.current.conversationId,
      content,
      metadata: {
        platform: 'web',
        questionId: currentQuestionIdRef.current,
      },
    };
    wsRef.current.send(JSON.stringify(chatMessage));

    // Clear current question after sending response
    currentQuestionIdRef.current = undefined;
  }, []);

  // ============================================================================
  // Select implementation based on mode
  // ============================================================================

  const connect = useCallback(
    (session: Session) => {
      if (isPollingMode) {
        connectPolling(session);
      } else {
        connectWebSocket(session);
      }
    },
    [isPollingMode, connectPolling, connectWebSocket]
  );

  const disconnect = useCallback(() => {
    if (isPollingMode) {
      disconnectPolling();
    } else {
      disconnectWebSocket();
    }
  }, [isPollingMode, disconnectPolling, disconnectWebSocket]);

  const sendMessage = useCallback(
    (content: string) => {
      if (isPollingMode) {
        sendMessagePolling(content);
      } else {
        sendMessageWebSocket(content);
      }
    },
    [isPollingMode, sendMessagePolling, sendMessageWebSocket]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
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
