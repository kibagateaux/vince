/**
 * @module @bangui/app/admin/agent-conversations/[id]/page
 * Detail view for a single Vince-Kincho agent conversation
 */

'use client';

import { FC } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getAgentConversationDetail } from '../../../../lib/api';
import { AgentConversationTimeline } from '../../../../components/admin/AgentConversationTimeline';
import { getAddressExplorerUrl, getChainDisplayName } from '../../../../lib/chains';

/** Status badge colors */
const statusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  processing: { bg: 'bg-blue-100', text: 'text-blue-800' },
  approved: { bg: 'bg-green-100', text: 'text-green-800' },
  modified: { bg: 'bg-purple-100', text: 'text-purple-800' },
  rejected: { bg: 'bg-red-100', text: 'text-red-800' },
  unknown: { bg: 'bg-gray-100', text: 'text-gray-800' },
};

export default function AgentConversationDetailPage() {
  const params = useParams();
  const id = params.id as string;

  // Fetch agent conversation details
  const { data: conversation, isLoading, error } = useQuery({
    queryKey: ['admin', 'agent-conversation', id],
    queryFn: () => getAgentConversationDetail(id),
    enabled: !!id,
    refetchInterval: 10000,
  });

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatAmount = (amt: string) => {
    try {
      const num = parseFloat(amt);
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
      }).format(num);
    } catch {
      return amt;
    }
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
          <div className="text-red-500 mb-4">Failed to load agent conversation</div>
          <Link href="/admin/agent-conversations" className="text-blue-600 hover:underline">
            Back to Agent Conversations
          </Link>
        </div>
      </div>
    );
  }

  const status = conversation.allocationRequest?.status ?? 'unknown';
  const colors = statusColors[status] ?? statusColors.unknown;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/agent-conversations"
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">
                  Agent Conversation
                </h1>
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${colors.bg} ${colors.text}`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                Vince ↔ Kincho handoff
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {conversation.allocationRequest?.amount && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                {formatAmount(conversation.allocationRequest.amount)}
              </span>
            )}
            {conversation.allocationRequest?.conversationId && (
              <Link
                href={`/admin/conversations/${conversation.allocationRequest.conversationId}`}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                View User Conversation
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Messages panel */}
        <div className="flex-1 overflow-y-auto p-6">
          <AgentConversationTimeline
            messages={conversation.messages}
            status={status}
            amount={conversation.allocationRequest?.amount}
          />
        </div>

        {/* Sidebar - Conversation Info */}
        <div className="w-72 border-l border-gray-200 bg-white overflow-y-auto">
          <div className="p-4 space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Conversation Info
              </h3>
              <dl className="space-y-2">
                <div>
                  <dt className="text-xs text-gray-400">ID</dt>
                  <dd
                    className="text-sm text-gray-900 font-mono truncate"
                    title={conversation.id}
                  >
                    {conversation.id.slice(0, 8)}...
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">Started</dt>
                  <dd className="text-sm text-gray-900">
                    {formatTime(conversation.startedAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">Last Activity</dt>
                  <dd className="text-sm text-gray-900">
                    {formatTime(conversation.lastMessageAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">Messages</dt>
                  <dd className="text-sm text-gray-900">
                    {conversation.messages.length}
                  </dd>
                </div>
              </dl>
            </div>

            {conversation.allocationRequest && (
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-500 mb-2">
                  Allocation Request
                </h3>
                <dl className="space-y-2">
                  <div>
                    <dt className="text-xs text-gray-400">Request ID</dt>
                    <dd
                      className="text-sm text-gray-900 font-mono truncate"
                      title={conversation.allocationRequest.id}
                    >
                      {conversation.allocationRequest.id.slice(0, 8)}...
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-400">Amount</dt>
                    <dd className="text-sm text-gray-900 font-medium">
                      {formatAmount(conversation.allocationRequest.amount)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-400">Vault</dt>
                    <dd className="text-sm text-gray-900 font-mono">
                      {conversation.allocationRequest.vaultAddress ? (
                        <>
                          {(() => {
                            const explorerUrl = conversation.allocationRequest.chainId
                              ? getAddressExplorerUrl(conversation.allocationRequest.chainId, conversation.allocationRequest.vaultAddress!)
                              : null;
                            const shortAddr = `${conversation.allocationRequest.vaultAddress!.slice(0, 6)}...${conversation.allocationRequest.vaultAddress!.slice(-4)}`;
                            return explorerUrl ? (
                              <a
                                href={explorerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                                title={conversation.allocationRequest.vaultAddress!}
                              >
                                {shortAddr}
                              </a>
                            ) : (
                              <span title={conversation.allocationRequest.vaultAddress!}>{shortAddr}</span>
                            );
                          })()}
                          {conversation.allocationRequest.chainId && (
                            <span className="ml-1 text-xs text-gray-400">
                              ({getChainDisplayName(conversation.allocationRequest.chainId)})
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-400 italic">Not set</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-400">Status</dt>
                    <dd className="text-sm">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-400">Created</dt>
                    <dd className="text-sm text-gray-900">
                      {formatTime(conversation.allocationRequest.createdAt)}
                    </dd>
                  </div>
                  {conversation.allocationRequest.userEmail && (
                    <div>
                      <dt className="text-xs text-gray-400">User</dt>
                      <dd className="text-sm text-gray-900">
                        {conversation.allocationRequest.userEmail}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Message breakdown */}
            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                Message Breakdown
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-sm text-gray-600">Vince</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {conversation.messages.filter((m) => m.sender === 'vince').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="text-sm text-gray-600">Kincho</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {conversation.messages.filter((m) => m.sender === 'kincho').length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
