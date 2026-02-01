/**
 * @module @bangui/app/admin/page
 * Admin dashboard for monitoring all conversations
 */

'use client';

import { FC, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getConversations, getDashboardStats, getAgentConversations } from '../../lib/api';
import { ConversationTimeline } from '../../components/admin/ConversationTimeline';
import type { ConversationSummary, ConversationHealth, DashboardStats } from '@bangui/types';

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

/** Stats card component */
const StatCard: FC<{ label: string; value: number | string; color?: string }> = ({
  label,
  value,
  color = 'text-gray-900',
}) => (
  <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-200">
    <div className="text-sm text-gray-500">{label}</div>
    <div className={`text-2xl font-bold ${color}`}>{value}</div>
  </div>
);

export default function AdminDashboard() {
  const router = useRouter();
  const [filter, setFilter] = useState<ConversationHealth | 'all'>('all');

  // Fetch conversations
  const { data: conversationsData, isLoading: loadingConversations } = useQuery({
    queryKey: ['admin', 'conversations'],
    queryFn: () => getConversations({ limit: 100 }),
    refetchInterval: 30000,
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: getDashboardStats,
    refetchInterval: 30000,
  });

  // Fetch agent conversations count
  const { data: agentConversationsData } = useQuery({
    queryKey: ['admin', 'agent-conversations'],
    queryFn: () => getAgentConversations({ limit: 100 }),
    refetchInterval: 30000,
  });

  const conversations = conversationsData?.conversations ?? [];
  const agentConversations = agentConversationsData?.conversations ?? [];
  const filteredConversations = filter === 'all'
    ? conversations
    : conversations.filter((c) => c.health === filter);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Conversations Dashboard</h1>
            <p className="text-sm text-gray-500">Monitor and manage bot conversations</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/agent-conversations"
              className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-200 transition-colors"
            >
              Agent Handoffs ({agentConversations.length})
            </Link>
            <Link
              href="/"
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Back to Chat
            </Link>
          </div>
        </div>
      </header>

      <main className="p-6">
        {/* Stats Grid */}
        {stats && (
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
            <StatCard label="Total Conversations" value={stats.totalConversations} />
            <StatCard label="Active" value={stats.activeConversations} color="text-blue-600" />
            <StatCard label="Successful Deposits" value={stats.successfulDeposits} color="text-green-600" />
            <StatCard label="Frustrated" value={stats.frustratedConversations} color="text-red-600" />
            <StatCard label="Stalled" value={stats.stalledConversations} color="text-yellow-600" />
            <StatCard label="Avg Duration" value={formatDuration(stats.averageDurationMinutes)} />
            <StatCard label="Agent Handoffs" value={agentConversations.length} color="text-amber-600" />
          </div>
        )}

        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            All ({conversations.length})
          </button>
          {(['active', 'success', 'frustrated', 'stalled', 'abandoned'] as ConversationHealth[]).map((health) => {
            const count = conversations.filter((c) => c.health === health).length;
            const colors = healthColors[health];
            return (
              <button
                key={health}
                onClick={() => setFilter(health)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  filter === health
                    ? `${colors.bg} ${colors.text} border ${colors.border}`
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {healthLabels[health]} ({count})
              </button>
            );
          })}
        </div>

        {/* Conversations List */}
        {loadingConversations ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-400">Loading conversations...</div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-400">No conversations found</div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredConversations.map((conversation) => (
              <ConversationCard
                key={conversation.id}
                conversation={conversation}
                onClick={() => router.push(`/admin/conversations/${conversation.id}`)}
                formatTime={formatTime}
                formatDuration={formatDuration}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/** Individual conversation card */
const ConversationCard: FC<{
  conversation: ConversationSummary;
  onClick: () => void;
  formatTime: (ts: number) => string;
  formatDuration: (mins: number) => string;
}> = ({ conversation, onClick, formatTime, formatDuration }) => {
  const colors = healthColors[conversation.health];

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-xl bg-white p-4 shadow-sm border-l-4 ${colors.border} hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${colors.bg} ${colors.text}`}>
              {healthLabels[conversation.health]}
            </span>
            <span className="text-xs text-gray-500">
              {conversation.platform.toUpperCase()}
            </span>
            <span className="text-xs text-gray-400">
              {conversation.state.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="text-sm text-gray-600 truncate mb-2">
            {conversation.latestMessage || 'No messages yet'}
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>{conversation.messageCount} messages</span>
            <span>{formatDuration(conversation.durationMinutes)} duration</span>
            <span>Last active: {formatTime(conversation.lastMessageAt as unknown as number)}</span>
            {conversation.hasDeposit && (
              <span className="text-green-600 font-medium">Has Deposit</span>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 w-48">
          <ConversationTimeline
            conversationId={conversation.id}
            messageCount={conversation.messageCount}
            userMessageCount={conversation.userMessageCount}
            vinceMessageCount={conversation.vinceMessageCount}
            health={conversation.health}
            compact
          />
        </div>
      </div>
    </div>
  );
};
