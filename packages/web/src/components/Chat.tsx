/**
 * @module @bangui/web/components/Chat
 * Main chat interface component
 */

import { FC, useState, useRef, useEffect, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useChat } from '../hooks/useChat.js';
import { connectSession, submitQuestionnaire } from '../lib/api.js';
import { Message } from './Message.js';
import type { ActionPrompt, UUID } from '@bangui/types';
import type { Session } from '../lib/types.js';

/**
 * Chat interface with message list and input
 */
export const Chat: FC = () => {
  const { authenticated, user, login } = usePrivy();
  const { messages, connectionState, sendMessage, connect } = useChat();
  const [input, setInput] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
  const [session, setSession] = useState<Session | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Connect when authenticated
  useEffect(() => {
    const initSession = async () => {
      if (!authenticated || session) return;

      const walletAddress = user?.wallet?.address as `0x${string}` | undefined;
      const sessionData = await connectSession('web', walletAddress);
      setSession(sessionData);
      connect(sessionData);
    };

    initSession();
  }, [authenticated, user, session, connect]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim()) return;
      sendMessage(input.trim());
      setInput('');
      setSelectedOptions(new Set());
    },
    [input, sendMessage]
  );

  const handleToggleOption = useCallback(
    (option: string) => {
      setSelectedOptions((prev) => {
        const next = new Set(prev);
        if (next.has(option)) {
          next.delete(option);
        } else {
          next.add(option);
        }
        // Update input field with selected options
        setInput(Array.from(next).join(', '));
        return next;
      });
    },
    []
  );

  const handleAction = useCallback(
    async (action: ActionPrompt) => {
      if (action.type === 'questionnaire' && action.data.options && session) {
        // For questionnaire actions, submit the selected option
        const questionId = action.data.questionId as string;
        const options = action.data.options as string[];
        // User needs to select - we'll send the message which will be processed
      }
      // Other action types handled by sending message
    },
    [session]
  );

  // Show login if not authenticated
  if (!authenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="mb-4 text-3xl font-bold text-gray-900">Meet Vince</h1>
          <p className="mb-8 text-gray-600">
            Your personal guide to impactful giving
          </p>
          <button
            onClick={login}
            className="rounded-xl bg-blue-600 px-8 py-3 text-lg font-semibold text-white shadow-lg hover:bg-blue-700 transition-colors"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
              <span className="text-lg font-bold text-white">V</span>
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">Vince</h1>
              <span
                className={`text-xs ${
                  connectionState === 'connected'
                    ? 'text-green-600'
                    : 'text-gray-400'
                }`}
              >
                {connectionState === 'connected' ? 'Online' : 'Connecting...'}
              </span>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {user?.wallet?.address?.slice(0, 6)}...
            {user?.wallet?.address?.slice(-4)}
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && connectionState === 'connecting' && (
          <div className="flex h-full items-center justify-center">
            <div className="text-gray-400">Connecting to Vince...</div>
          </div>
        )}
        {messages.map((msg) => (
          <Message
            key={msg.id}
            message={msg}
            onAction={handleAction}
            selectedOptions={selectedOptions}
            onToggleOption={handleToggleOption}
          />
        ))}
        <div ref={messagesEndRef} />
      </main>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-gray-200 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={connectionState !== 'connected'}
          />
          <button
            type="submit"
            disabled={connectionState !== 'connected' || !input.trim()}
            className="rounded-xl bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
};
