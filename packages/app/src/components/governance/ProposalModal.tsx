/**
 * @module ProposalModal
 * Detailed proposal modal with live chat stream
 */

'use client';

import { FC, useEffect, useRef } from 'react';
import type { Proposal } from '../../lib/governance/types';
import { getAddressExplorerUrl, getChainDisplayName } from '../../lib/chains';

interface ProposalModalProps {
  proposal: Proposal;
  isOpen: boolean;
  onClose: () => void;
}

const riskColors: Record<string, { bg: string; text: string }> = {
  conservative: { bg: 'bg-green-100', text: 'text-green-800' },
  moderate: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  aggressive: { bg: 'bg-red-100', text: 'text-red-800' },
};

export const ProposalModal: FC<ProposalModalProps> = ({ proposal, isOpen, onClose }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [proposal.agentConversation.messages]);

  if (!isOpen) return null;

  const formatCurrency = (value: number) => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min ago`;
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {formatCurrency(proposal.amount)} → {proposal.targetStrategy.name}
            </h2>
            <p className="text-sm text-gray-500">{proposal.targetStrategy.protocol}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="grid md:grid-cols-[1fr_1fr] divide-y md:divide-y-0 md:divide-x divide-gray-200 max-h-[calc(90vh-140px)] overflow-hidden">
          {/* Left Panel - Details */}
          <div className="p-6 overflow-y-auto space-y-6">
            {/* Proposal Details */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Proposal Details
              </h3>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Amount</dt>
                  <dd className="font-medium text-gray-900">{formatCurrency(proposal.amount)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Asset</dt>
                  <dd className="font-medium text-gray-900">{proposal.targetStrategy.asset}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Strategy</dt>
                  <dd className="font-medium text-gray-900">{proposal.targetStrategy.name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Protocol</dt>
                  <dd className="font-medium text-gray-900">{proposal.targetStrategy.protocol}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-gray-500">Vault</dt>
                  <dd className="font-mono text-sm">
                    {proposal.vaultAddress ? (
                      <>
                        {proposal.chainId ? (
                          <a
                            href={getAddressExplorerUrl(proposal.chainId, proposal.vaultAddress) ?? '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {`${proposal.vaultAddress.slice(0, 6)}...${proposal.vaultAddress.slice(-4)}`}
                          </a>
                        ) : (
                          <span className="text-gray-900">
                            {`${proposal.vaultAddress.slice(0, 6)}...${proposal.vaultAddress.slice(-4)}`}
                          </span>
                        )}
                        {proposal.chainId && (
                          <span className="ml-1 text-xs text-gray-400">
                            ({getChainDisplayName(proposal.chainId)})
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-400 italic">Not set</span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            {/* User Profile */}
            <div className="border-t border-gray-100 pt-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                User Profile
              </h3>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Wallet</dt>
                  <dd className="font-mono text-sm text-gray-900">{proposal.user.walletAddress}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-gray-500">Risk Tolerance</dt>
                  <dd>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${riskStyle.bg} ${riskStyle.text}`}>
                      {proposal.user.riskTolerance}
                    </span>
                  </dd>
                </div>
                {proposal.user.archetype && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Archetype</dt>
                    <dd className="font-medium text-gray-900">
                      {proposal.user.archetype.replace(/_/g, ' ')}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Kincho Analysis */}
            <div className="border-t border-gray-100 pt-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Kincho Analysis
              </h3>

              {/* Confidence Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Confidence</span>
                  <span className="font-bold text-gray-900">{proposal.kinchoAnalysis.confidence}%</span>
                </div>
                <div className="h-3 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${getConfidenceColor(proposal.kinchoAnalysis.confidence)}`}
                    style={{ width: `${proposal.kinchoAnalysis.confidence}%` }}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="text-sm text-gray-500 mb-1">Risk Assessment</div>
                  <p className="text-sm text-gray-700">{proposal.kinchoAnalysis.riskAssessment}</p>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-1">Reasoning</div>
                  <p className="text-sm text-gray-700">{proposal.kinchoAnalysis.reasoning}</p>
                </div>
              </div>

              {proposal.kinchoAnalysis.humanOverrideRequired && (
                <div className="mt-4 rounded-lg bg-yellow-50 border border-yellow-200 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-600">⚠️</span>
                    <span className="text-sm font-medium text-yellow-800">Human Override Required</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Chat */}
          <div className="flex flex-col h-full">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                  Vince ↔ Kincho Conversation
                </h3>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs text-gray-500">Live</span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {proposal.agentConversation.messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-lg p-4 ${
                    message.sender === 'vince'
                      ? 'bg-blue-50 border-l-4 border-blue-400'
                      : 'bg-purple-50 border-l-4 border-purple-400'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-2xl ${message.sender === 'vince' ? '' : ''}`}>
                      {message.sender === 'vince' ? '🤵' : '🦊'}
                    </span>
                    <span className={`font-medium ${message.sender === 'vince' ? 'text-blue-700' : 'text-purple-700'}`}>
                      {message.sender === 'vince' ? 'Vince' : 'Kincho'}
                    </span>
                    <span className="text-xs text-gray-400">{formatRelativeTime(message.timestamp)}</span>
                  </div>
                  <p className="text-sm text-gray-700">{message.content}</p>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
          <button className="rounded-lg px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-colors">
            Approve
          </button>
          <button className="rounded-lg px-4 py-2 text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 transition-colors">
            Request Changes
          </button>
          <button className="rounded-lg px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors">
            Reject
          </button>
        </div>
      </div>
    </div>
  );
};
