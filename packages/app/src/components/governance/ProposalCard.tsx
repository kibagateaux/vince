/**
 * @module ProposalCard
 * Proposal card component for governance dashboard
 */

'use client';

import { FC } from 'react';
import type { Proposal } from '../../lib/governance/types';
import { getAddressExplorerUrl, getChainDisplayName } from '../../lib/chains';

interface ProposalCardProps {
  proposal: Proposal;
  onClick: () => void;
}

const riskColors: Record<string, { bg: string; text: string }> = {
  conservative: { bg: 'bg-green-100', text: 'text-green-800' },
  moderate: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  aggressive: { bg: 'bg-red-100', text: 'text-red-800' },
};

const statusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-gray-100', text: 'text-gray-800' },
  discussing: { bg: 'bg-blue-100', text: 'text-blue-800' },
  approved: { bg: 'bg-green-100', text: 'text-green-800' },
  modified: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  rejected: { bg: 'bg-red-100', text: 'text-red-800' },
};

export const ProposalCard: FC<ProposalCardProps> = ({ proposal, onClick }) => {
  const formatCurrency = (value: number) => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffMs / 86400000)}d ago`;
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 90) return 'bg-green-500';
    if (score >= 70) return 'bg-blue-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const riskStyle = riskColors[proposal.user.riskTolerance] || riskColors.moderate;
  const statusStyle = statusColors[proposal.status] || statusColors.pending;
  const lastMessages = proposal.agentConversation.messages.slice(-3);

  return (
    <div
      onClick={onClick}
      className="rounded-xl bg-white p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-bold text-gray-900">
              {formatCurrency(proposal.amount)}
            </span>
            <span className="text-gray-400">→</span>
            <span className="font-medium text-gray-700">{proposal.targetStrategy.name}</span>
          </div>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
            {proposal.status}
          </span>
        </div>
      </div>

      {/* Confidence Meter */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-500">Confidence</span>
          <span className="font-medium text-gray-900">{proposal.kinchoAnalysis.confidence}%</span>
        </div>
        <div className="flex gap-0.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-sm ${
                i < Math.floor(proposal.kinchoAnalysis.confidence / 10)
                  ? getConfidenceColor(proposal.kinchoAnalysis.confidence)
                  : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* User Info */}
      <div className="flex items-center gap-4 mb-4 text-sm">
        <div className="flex items-center gap-1">
          <span className="text-gray-500">User:</span>
          <span className="font-mono text-gray-700">{formatAddress(proposal.user.walletAddress)}</span>
        </div>
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${riskStyle.bg} ${riskStyle.text}`}>
          {proposal.user.riskTolerance}
        </span>
      </div>

      {/* Vault Info */}
      {proposal.vaultAddress && (
        <div className="flex items-center gap-2 mb-4 text-sm">
          <span className="text-gray-500">Vault:</span>
          {proposal.chainId ? (
            <a
              href={getAddressExplorerUrl(proposal.chainId, proposal.vaultAddress) ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-blue-600 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {formatAddress(proposal.vaultAddress)}
            </a>
          ) : (
            <span className="font-mono text-gray-700">{formatAddress(proposal.vaultAddress)}</span>
          )}
          {proposal.chainId && (
            <span className="text-xs text-gray-400">({getChainDisplayName(proposal.chainId)})</span>
          )}
        </div>
      )}

      {/* Warning Banner */}
      {proposal.kinchoAnalysis.humanOverrideRequired && (
        <div className="mb-4 rounded-lg bg-yellow-50 border-l-4 border-yellow-400 p-3">
          <div className="flex items-center gap-2">
            <span className="text-yellow-600">⚠️</span>
            <span className="text-sm font-medium text-yellow-800">Requires Human Review</span>
          </div>
        </div>
      )}

      {/* Chat Preview */}
      <div className="rounded-lg bg-gray-50 p-3 space-y-2">
        {lastMessages.map((message) => (
          <div key={message.id} className="text-sm">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`font-medium ${message.sender === 'vince' ? 'text-blue-700' : 'text-purple-700'}`}>
                {message.sender === 'vince' ? 'Vince' : 'Kincho'}
              </span>
              <span className="text-gray-400 text-xs">{formatRelativeTime(message.timestamp)}</span>
            </div>
            <p className="text-gray-600 line-clamp-2">{message.content}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-gray-400">
          Created {formatRelativeTime(proposal.createdAt)}
        </div>
        <button className="text-sm font-medium text-blue-600 hover:text-blue-700">
          View Details →
        </button>
      </div>
    </div>
  );
};
