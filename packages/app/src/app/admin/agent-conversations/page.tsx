/**
 * @module @bangui/app/admin/agent-conversations/page
 * Admin page for viewing all Vince-Kincho agent conversations
 */

'use client';

import { FC, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getAgentConversations } from '../../../lib/api';
import { AgentConversationCard } from '../../../components/admin/AgentConversationCard';

/** Status filter options */
const statusFilters = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'approved', label: 'Approved' },
  { value: 'modified', label: 'Modified' },
  { value: 'rejected', label: 'Rejected' },
];

export default function AgentConversationsPage() {
  const [filter, setFilter] = useState<string>('all');

  // Fetch agent conversations
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'agent-conversations'],
    queryFn: () => getAgentConversations({ limit: 100 }),
    refetchInterval: 30000,
  });

  const conversations = data?.conversations ?? [];
  const filteredConversations =
    filter === 'all'
      ? conversations
      : conversations.filter((c) => c.status === filter);

  // Count by status
  const counts = conversations.reduce(
    (acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
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
              <h1 className="text-2xl font-bold text-gray-900">
                Agent Conversations
              </h1>
              <p className="text-sm text-gray-500">
                Vince ↔ Kincho allocation handoffs
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500">
              {data?.total ?? 0} total conversations
            </div>
          </div>
        </div>
      </header>

      <main className="p-6">
        {/* Stats Grid */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total" value={conversations.length} />
          <StatCard
            label="Pending"
            value={counts.pending ?? 0}
            color="text-yellow-600"
          />
          <StatCard
            label="Processing"
            value={counts.processing ?? 0}
            color="text-blue-600"
          />
          <StatCard
            label="Approved"
            value={counts.approved ?? 0}
            color="text-green-600"
          />
          <StatCard
            label="Modified"
            value={counts.modified ?? 0}
            color="text-purple-600"
          />
          <StatCard
            label="Rejected"
            value={counts.rejected ?? 0}
            color="text-red-600"
          />
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-2">
          {statusFilters.map(({ value, label }) => {
            const count = value === 'all' ? conversations.length : counts[value] ?? 0;
            return (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  filter === value
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12 text-gray-400">
            Loading agent conversations...
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12 text-red-500">
            Failed to load agent conversations
          </div>
        )}

        {/* Conversations Grid */}
        {!isLoading && !error && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredConversations.length === 0 ? (
              <div className="col-span-full text-center py-12 text-gray-400">
                No agent conversations found
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <AgentConversationCard key={conv.id} conversation={conv} />
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}

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
