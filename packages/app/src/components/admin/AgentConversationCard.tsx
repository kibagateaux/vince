/**
 * @module @bangui/app/components/admin/AgentConversationCard
 * Summary card for agent conversation list view
 */

'use client';

import { FC } from 'react';
import Link from 'next/link';
import type { AgentConversationSummary } from '../../lib/api';

/** Status badge colors */
const statusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  processing: { bg: 'bg-blue-100', text: 'text-blue-800' },
  approved: { bg: 'bg-green-100', text: 'text-green-800' },
  modified: { bg: 'bg-purple-100', text: 'text-purple-800' },
  rejected: { bg: 'bg-red-100', text: 'text-red-800' },
  unknown: { bg: 'bg-gray-100', text: 'text-gray-800' },
};

interface AgentConversationCardProps {
  conversation: AgentConversationSummary;
}

/**
 * Renders a summary card for an agent conversation
 */
export const AgentConversationCard: FC<AgentConversationCardProps> = ({
  conversation,
}) => {
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

  const formatAmount = (amt: string | null) => {
    if (!amt) return '-';
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

  const colors = statusColors[conversation.status] ?? statusColors.unknown;

  return (
    <Link
      href={`/admin/agent-conversations/${conversation.id}`}
      className="block rounded-xl bg-white p-4 shadow-sm border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${colors.bg} ${colors.text}`}
          >
            {conversation.status.charAt(0).toUpperCase() + conversation.status.slice(1)}
          </span>
          <span className="text-sm font-medium text-gray-700">
            {formatAmount(conversation.amount)}
          </span>
        </div>
        <span className="text-xs text-gray-400">
          {formatTime(conversation.lastMessageAt)}
        </span>
      </div>

      {/* Message stats */}
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-xs text-gray-600">
            Vince: {conversation.vinceMessageCount}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-xs text-gray-600">
            Kincho: {conversation.kinchoMessageCount}
          </span>
        </div>
        <span className="text-xs text-gray-400">
          {conversation.messageCount} total
        </span>
      </div>

      {/* Latest message preview */}
      {conversation.latestMessage && (
        <p className="text-sm text-gray-500 truncate">
          {conversation.latestMessage}
        </p>
      )}

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-400 font-mono">
          {conversation.id.slice(0, 8)}...
        </span>
        {conversation.userConversationId && (
          <Link
            href={`/admin/conversations/${conversation.userConversationId}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-blue-600 hover:underline"
          >
            View user conversation
          </Link>
        )}
      </div>
    </Link>
  );
};

export default AgentConversationCard;
