/**
 * @module @bangui/web/hooks/useChat
 * WebSocket chat connection hook
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { UUID, ChatMessage, AgentResponse } from '@bangui/types';
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

/**
 * Hook for managing WebSocket chat connection
 * @returns Chat state and methods
 */
export const useChat = (): UseChatReturn => {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const currentQuestionIdRef = useRef<string | undefined>(undefined);

  const connect = useCallback((session: Session) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    sessionRef.current = session;
    setConnectionState('connecting');

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

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    sessionRef.current = null;
    setConnectionState('disconnected');
  }, []);

  const sendMessage = useCallback((content: string) => {
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
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
