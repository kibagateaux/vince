/**
 * @module @bangui/app/admin/conversations/[id]/page
 * Detailed view of a single conversation with admin controls
 */

'use client';

import { FC, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getConversationDetail,
  injectAdminMessage,
  getAgentConversationsForUserConversation,
} from '../../../../lib/api';
import { ConversationTimeline } from '../../../../components/admin/ConversationTimeline';
import { AgentConversationTimeline } from '../../../../components/admin/AgentConversationTimeline';
import type { ConversationHealth, Message, UUID } from '@bangui/types';

/** Health status to color mapping */
const healthColors: Record<ConversationHealth, { bg: string; text: string; border: string }> = {
  success: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
  frustrated: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
  stalled: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  active: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  abandoned: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' },
};

/** Health status labels */
const healthLabels: Record<ConversationHealth, string> = {
  success: 'Success',
  frustrated: 'Frustrated',
  stalled: 'Stalled',
  active: 'Active',
  abandoned: 'Abandoned',
};

/** Tab options */
type TabId = 'messages' | 'agent-handoffs';

export default function ConversationDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [highlightedMessage, setHighlightedMessage] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>('messages');

  // Admin message state
  const [showInjectForm, setShowInjectForm] = useState(false);
  const [injectContent, setInjectContent] = useState('');
  const [injectSender, setInjectSender] = useState<'vince' | 'system'>('vince');

  // Fetch conversation details
  const { data: conversation, isLoading, error } = useQuery({
    queryKey: ['admin', 'conversation', id],
    queryFn: () => getConversationDetail(id as UUID),
    enabled: !!id,
    refetchInterval: 10000,
  });

  // Fetch agent conversations for this user conversation
  const { data: agentConversationsData } = useQuery({
    queryKey: ['admin', 'agent-conversations-for-user', id],
    queryFn: () => getAgentConversationsForUserConversation(id),
    enabled: !!id,
    refetchInterval: 30000,
  });

  const agentConversations = agentConversationsData?.conversations ?? [];

  // Inject message mutation
  const injectMutation = useMutation({
    mutationFn: () => injectAdminMessage(id as UUID, injectContent, injectSender),
    onSuccess: () => {
      setInjectContent('');
      setShowInjectForm(false);
      queryClient.invalidateQueries({ queryKey: ['admin', 'conversation', id] });
    },
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages]);

  // Scroll to highlighted message
  useEffect(() => {
    if (highlightedMessage) {
      const element = document.getElementById(`message-${highlightedMessage}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedMessage]);

  const handleBlobClick = (blobId: string) => {
    setHighlightedMessage(blobId);
    setTimeout(() => setHighlightedMessage(null), 2000);
  };

  const handleInjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!injectContent.trim()) return;
    injectMutation.mutate();
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading conversation...</div>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">Failed to load conversation</div>
          <Link href="/admin" className="text-blue-600 hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const colors = healthColors[conversation.health];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">Conversation</h1>
                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${colors.bg} ${colors.text}`}>
                  {healthLabels[conversation.health]}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                {conversation.platform.toUpperCase()} - {conversation.state.replace(/_/g, ' ')}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {conversation.hasDeposit && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Deposit: {conversation.depositAmount}
              </span>
            )}
            <button
              onClick={() => setShowInjectForm(!showInjectForm)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Inject Message
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Messages panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab navigation */}
          <div className="bg-white border-b border-gray-200 px-4">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab('messages')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'messages'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Messages ({conversation.messages.length})
              </button>
              <button
                onClick={() => setActiveTab('agent-handoffs')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'agent-handoffs'
                    ? 'border-amber-600 text-amber-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Agent Handoffs ({agentConversations.length})
              </button>
            </div>
          </div>

          {/* Messages tab content */}
          {activeTab === 'messages' && (
            <>
              {/* Timeline visualization */}
              <div className="bg-white border-b border-gray-200 p-4">
                <ConversationTimeline
                  conversationId={conversation.id}
                  messageCount={conversation.messages.length}
                  userMessageCount={conversation.messages.filter(m => m.sender === 'user').length}
                  vinceMessageCount={conversation.messages.filter(m => m.sender === 'vince').length}
                  health={conversation.health}
                  timeline={conversation.timeline}
                  onBlobClick={handleBlobClick}
                />
              </div>

              {/* Messages list */}
              <div className="flex-1 overflow-y-auto p-4">
                {conversation.messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    No messages in this conversation
                  </div>
                ) : (
                  <div className="space-y-4">
                    {conversation.messages.map((message) => (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        isHighlighted={highlightedMessage === message.id}
                        formatTime={formatTime}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
          </div>

          {/* Inject message form */}
          {showInjectForm && (
            <div className="border-t border-gray-200 bg-white p-4">
              <form onSubmit={handleInjectSubmit}>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Send as:
                  </label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="sender"
                        value="vince"
                        checked={injectSender === 'vince'}
                        onChange={() => setInjectSender('vince')}
                        className="text-blue-600"
                      />
                      <span className="text-sm">Vince (Bot)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="sender"
                        value="system"
                        checked={injectSender === 'system'}
                        onChange={() => setInjectSender('system')}
                        className="text-blue-600"
                      />
                      <span className="text-sm">System</span>
                    </label>
                  </div>
                </div>

                <div className="flex gap-2">
                  <textarea
                    value={injectContent}
                    onChange={(e) => setInjectContent(e.target.value)}
                    placeholder="Type your message to inject..."
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                    rows={2}
                  />
                  <div className="flex flex-col gap-2">
                    <button
                      type="submit"
                      disabled={!injectContent.trim() || injectMutation.isPending}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {injectMutation.isPending ? 'Sending...' : 'Send'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowInjectForm(false)}
                      className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                {injectMutation.isError && (
                  <div className="mt-2 text-sm text-red-500">
                    Failed to send message. Please try again.
                  </div>
                )}
              </form>
            </div>
          )}
            </>
          )}

          {/* Agent Handoffs tab content */}
          {activeTab === 'agent-handoffs' && (
            <div className="flex-1 overflow-y-auto p-4">
              {agentConversations.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  No agent handoffs for this conversation
                </div>
              ) : (
                <div className="space-y-6">
                  {agentConversations.map((agentConv) => (
                    <div
                      key={agentConv.id}
                      className="bg-white rounded-lg border border-gray-200 p-4"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700">
                            Allocation Request
                          </span>
                          <span className="text-xs text-gray-400 font-mono">
                            {agentConv.allocationRequestId.slice(0, 8)}...
                          </span>
                        </div>
                        <Link
                          href={`/admin/agent-conversations/${agentConv.id}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          View full conversation
                        </Link>
                      </div>
                      <AgentConversationTimeline
                        messages={agentConv.messages}
                        status={agentConv.status}
                        amount={agentConv.amount}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar - Conversation Info */}
        <div className="w-72 border-l border-gray-200 bg-white overflow-y-auto">
          <div className="p-4 space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Conversation Info</h3>
              <dl className="space-y-2">
                <div>
                  <dt className="text-xs text-gray-400">ID</dt>
                  <dd className="text-sm text-gray-900 font-mono truncate" title={conversation.id}>
                    {conversation.id.slice(0, 8)}...
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">User ID</dt>
                  <dd className="text-sm text-gray-900 font-mono truncate" title={conversation.userId}>
                    {conversation.userId.slice(0, 8)}...
                  </dd>
                </div>
                {conversation.userWallet && (
                  <div>
                    <dt className="text-xs text-gray-400">Wallet</dt>
                    <dd className="text-sm text-gray-900 font-mono truncate">
                      {conversation.userWallet.slice(0, 6)}...{conversation.userWallet.slice(-4)}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-gray-400">Platform</dt>
                  <dd className="text-sm text-gray-900">{conversation.platform}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">State</dt>
                  <dd className="text-sm text-gray-900">{conversation.state.replace(/_/g, ' ')}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">Started</dt>
                  <dd className="text-sm text-gray-900">
                    {formatTime(conversation.startedAt as unknown as number)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">Last Activity</dt>
                  <dd className="text-sm text-gray-900">
                    {formatTime(conversation.lastMessageAt as unknown as number)}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Statistics</h3>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Total Messages</dt>
                  <dd className="text-sm font-medium text-gray-900">{conversation.messages.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">User Messages</dt>
                  <dd className="text-sm font-medium text-blue-600">
                    {conversation.messages.filter(m => m.sender === 'user').length}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Vince Messages</dt>
                  <dd className="text-sm font-medium text-gray-600">
                    {conversation.messages.filter(m => m.sender === 'vince').length}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Individual message bubble */
const MessageBubble: FC<{
  message: Message;
  isHighlighted: boolean;
  formatTime: (ts: number) => string;
}> = ({ message, isHighlighted, formatTime }) => {
  const isUser = message.sender === 'user';
  const isSystem = message.sender === 'system';
  const isAdminInjected = (message.metadata as any)?.adminInjected;

  return (
    <div
      id={`message-${message.id}`}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} ${
        isHighlighted ? 'animate-pulse' : ''
      }`}
    >
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-md'
            : isSystem
            ? 'bg-purple-100 text-purple-900 rounded-bl-md border border-purple-200'
            : 'bg-gray-100 text-gray-900 rounded-bl-md'
        } ${isHighlighted ? 'ring-2 ring-yellow-400' : ''} ${
          isAdminInjected ? 'ring-1 ring-orange-300' : ''
        }`}
      >
        {/* Sender label for non-user messages */}
        {!isUser && (
          <div className={`text-xs font-medium mb-1 ${
            isSystem ? 'text-purple-600' : 'text-gray-500'
          }`}>
            {isSystem ? 'System' : 'Vince'}
            {isAdminInjected && (
              <span className="ml-1 text-orange-500">(Admin)</span>
            )}
          </div>
        )}

        <p className="whitespace-pre-wrap text-sm">{message.content}</p>

        <span className={`mt-1 block text-xs ${
          isUser ? 'text-blue-200' : isSystem ? 'text-purple-400' : 'text-gray-400'
        }`}>
          {formatTime(message.sentAt as unknown as number)}
        </span>
      </div>
    </div>
  );
};
