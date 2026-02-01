/**
 * @module @bangui/app/components/admin/AgentConversationTimeline
 * Human-readable chat-style timeline for Vince-Kincho agent conversations
 */

'use client';

import { FC } from 'react';
import type { AgentMessageDetail } from '../../lib/api';

/** Sender colors */
const senderColors: Record<string, { bg: string; text: string; border: string; label: string }> = {
  vince: {
    bg: 'bg-blue-50',
    text: 'text-blue-900',
    border: 'border-blue-200',
    label: 'Vince',
  },
  kincho: {
    bg: 'bg-amber-50',
    text: 'text-amber-900',
    border: 'border-amber-200',
    label: 'Kincho',
  },
};

/** Status badge colors */
const statusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  processing: { bg: 'bg-blue-100', text: 'text-blue-800' },
  approved: { bg: 'bg-green-100', text: 'text-green-800' },
  modified: { bg: 'bg-purple-100', text: 'text-purple-800' },
  rejected: { bg: 'bg-red-100', text: 'text-red-800' },
  unknown: { bg: 'bg-gray-100', text: 'text-gray-800' },
};

/** Decision colors */
const decisionColors: Record<string, { bg: string; text: string }> = {
  approved: { bg: 'bg-green-100', text: 'text-green-800' },
  modified: { bg: 'bg-purple-100', text: 'text-purple-800' },
  rejected: { bg: 'bg-red-100', text: 'text-red-800' },
};

interface AgentConversationTimelineProps {
  messages: AgentMessageDetail[];
  status?: string;
  amount?: string | null;
  compact?: boolean;
}

/** Format currency amount */
const formatCurrency = (amount: number | string): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

/** Parse message content JSON */
const parseContent = (content: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
};

/** Get human-readable summary for compact view */
const getCompactSummary = (msg: AgentMessageDetail): string => {
  const parsed = parseContent(msg.content);
  if (!parsed) return msg.content.slice(0, 100);

  const type = parsed.type as string;

  if (type === 'ALLOCATION_REQUEST') {
    const amount = parsed.amount as number;
    return `Requesting allocation of ${formatCurrency(amount)}`;
  }

  if (type === 'ALLOCATION_RESPONSE') {
    const decision = parsed.decision as string;
    return `Decision: ${decision.toUpperCase()}`;
  }

  if (type === 'CLARIFICATION_REQUEST') {
    return `Asking: ${(parsed.question as string)?.slice(0, 50)}...`;
  }

  return msg.content.slice(0, 100);
};

/**
 * Renders a human-readable chat-style timeline for agent conversations
 */
export const AgentConversationTimeline: FC<AgentConversationTimelineProps> = ({
  messages,
  status,
  amount,
  compact = false,
}) => {
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  if (messages.length === 0) {
    return (
      <div className="text-center text-gray-400 py-8">
        No messages in this conversation
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {messages.slice(-3).map((msg) => {
          const colors = senderColors[msg.sender] ?? senderColors.vince;
          return (
            <div key={msg.id} className="flex items-start gap-2">
              <span className={`text-xs font-medium ${colors.text} w-12 flex-shrink-0`}>
                {colors.label}
              </span>
              <p className="text-sm text-gray-600 truncate flex-1">
                {getCompactSummary(msg)}
              </p>
            </div>
          );
        })}
        {messages.length > 3 && (
          <p className="text-xs text-gray-400">+{messages.length - 3} more messages</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with status and amount */}
      {(status || amount) && (
        <div className="flex items-center gap-3 pb-3 border-b border-gray-200">
          {status && (
            <span
              className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                statusColors[status]?.bg ?? statusColors.unknown.bg
              } ${statusColors[status]?.text ?? statusColors.unknown.text}`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          )}
          {amount && (
            <span className="text-sm font-medium text-gray-700">
              Amount: {formatCurrency(amount)}
            </span>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="space-y-4">
        {messages.map((msg) => {
          const colors = senderColors[msg.sender] ?? senderColors.vince;
          const isVince = msg.sender === 'vince';
          const parsed = parseContent(msg.content);

          return (
            <div
              key={msg.id}
              className={`flex ${isVince ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg border ${colors.border} ${colors.bg} p-4`}
              >
                {/* Header */}
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-sm font-semibold ${colors.text}`}>
                    {colors.label}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatTime(msg.sentAt)}
                  </span>
                </div>

                {/* Human-readable content */}
                {parsed ? (
                  <MessageContent content={parsed} sender={msg.sender} />
                ) : (
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">
                    {msg.content}
                  </div>
                )}

                {/* Raw data toggle */}
                {parsed && (
                  <details className="mt-3 pt-2 border-t border-gray-200/50">
                    <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                      Show raw data
                    </summary>
                    <pre className="mt-2 text-xs bg-white/50 rounded p-2 overflow-x-auto text-gray-600">
                      {JSON.stringify(parsed, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** Render human-readable message content based on type */
const MessageContent: FC<{ content: Record<string, unknown>; sender: string }> = ({
  content,
  sender,
}) => {
  const type = content.type as string;

  if (type === 'ALLOCATION_REQUEST') {
    return <AllocationRequestContent content={content} />;
  }

  if (type === 'ALLOCATION_RESPONSE') {
    return <AllocationResponseContent content={content} />;
  }

  if (type === 'CLARIFICATION_REQUEST') {
    return <ClarificationRequestContent content={content} />;
  }

  if (type === 'CLARIFICATION_RESPONSE') {
    return <ClarificationResponseContent content={content} />;
  }

  // Fallback for unknown types
  return (
    <div className="text-sm text-gray-700">
      <span className="font-medium">Message type:</span> {type || 'Unknown'}
    </div>
  );
};

/** Vince's allocation request */
const AllocationRequestContent: FC<{ content: Record<string, unknown> }> = ({ content }) => {
  const amount = content.amount as number;
  const prefs = content.userPreferences as Record<string, unknown> | undefined;
  const rec = content.vinceRecommendation as Record<string, unknown> | undefined;
  const allocations = rec?.suggestedAllocations as Array<{
    causeName: string;
    amount: number;
    percentage: number;
    reasoning: string;
  }> | undefined;

  return (
    <div className="space-y-3">
      <p className="text-sm text-blue-800">
        I'm requesting an allocation decision for a <strong>{formatCurrency(amount)}</strong> deposit.
      </p>

      {prefs?.riskTolerance && (
        <p className="text-sm text-blue-700">
          User's risk tolerance: <span className="font-medium">{String(prefs.riskTolerance)}</span>
        </p>
      )}

      {rec?.reasoning && (
        <p className="text-sm text-blue-700 italic">
          "{String(rec.reasoning)}"
        </p>
      )}

      {allocations && allocations.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-blue-600 mb-2">My suggested allocation:</p>
          <div className="space-y-2">
            {allocations.map((alloc, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <div
                  className="w-2 h-2 rounded-full bg-blue-400"
                  style={{ opacity: 0.5 + (alloc.percentage / 200) }}
                />
                <span className="font-medium">{alloc.causeName}</span>
                <span className="text-blue-600">{formatCurrency(alloc.amount)}</span>
                <span className="text-blue-400">({alloc.percentage}%)</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/** Kincho's allocation response */
const AllocationResponseContent: FC<{ content: Record<string, unknown> }> = ({ content }) => {
  const decision = content.decision as string;
  const confidence = content.confidence as number | undefined;
  const explanation = content.userFriendlyExplanation as string | undefined;
  const reasoning = content.detailedReasoning as string | undefined;
  const allocations = content.allocations as Array<{
    causeName: string;
    amount: number;
    allocationType: string;
    reasoning: string;
  }> | undefined;
  const modifications = content.modifications as Array<{
    original: { causeId: string; amount: number };
    modified: { causeId: string; amount: number };
    reason: string;
  }> | undefined;

  const decisionColor = decisionColors[decision] ?? decisionColors.modified;

  return (
    <div className="space-y-3">
      {/* Decision badge */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${decisionColor.bg} ${decisionColor.text}`}
        >
          {decision.toUpperCase()}
        </span>
        {confidence !== undefined && (
          <span className="text-xs text-amber-600">
            {Math.round(confidence * 100)}% confidence
          </span>
        )}
      </div>

      {/* User-friendly explanation */}
      {explanation && (
        <p className="text-sm text-amber-800">
          {explanation}
        </p>
      )}

      {/* Final allocations */}
      {allocations && allocations.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-amber-600 mb-2">Final allocation:</p>
          <div className="space-y-2">
            {allocations.map((alloc, i) => (
              <div key={i} className="bg-white/40 rounded p-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-amber-900">{alloc.causeName}</span>
                  <span className="font-semibold text-amber-700">{formatCurrency(alloc.amount)}</span>
                </div>
                <p className="text-xs text-amber-600 mt-1">{alloc.reasoning}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modifications */}
      {modifications && modifications.length > 0 && (
        <div className="mt-3 pt-2 border-t border-amber-200/50">
          <p className="text-xs font-medium text-amber-600 mb-2">Changes made:</p>
          {modifications.map((mod, i) => (
            <div key={i} className="text-xs text-amber-700 bg-white/30 rounded p-2 mb-1">
              <p>
                Changed from <span className="font-mono">{mod.original.causeId}</span>{' '}
                ({formatCurrency(mod.original.amount)}) to{' '}
                <span className="font-mono">{mod.modified.causeId}</span>{' '}
                ({formatCurrency(mod.modified.amount)})
              </p>
              <p className="italic mt-1">Reason: {mod.reason}</p>
            </div>
          ))}
        </div>
      )}

      {/* Detailed reasoning (collapsible) */}
      {reasoning && (
        <details className="mt-2">
          <summary className="text-xs text-amber-500 cursor-pointer hover:text-amber-700">
            Show detailed reasoning
          </summary>
          <p className="mt-1 text-xs text-amber-700 italic bg-white/30 rounded p-2">
            {reasoning}
          </p>
        </details>
      )}
    </div>
  );
};

/** Kincho's clarification request */
const ClarificationRequestContent: FC<{ content: Record<string, unknown> }> = ({ content }) => {
  const question = content.question as string;
  const context = content.context as string | undefined;
  const required = content.required as boolean | undefined;
  const options = content.options as string[] | undefined;

  return (
    <div className="space-y-2">
      <p className="text-sm text-amber-800 font-medium">
        {question}
      </p>
      {context && (
        <p className="text-xs text-amber-600 italic">
          Context: {context}
        </p>
      )}
      {options && options.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-amber-600 mb-1">Options:</p>
          <ul className="list-disc list-inside text-sm text-amber-700">
            {options.map((opt, i) => (
              <li key={i}>{opt}</li>
            ))}
          </ul>
        </div>
      )}
      {required && (
        <span className="inline-flex text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
          Required
        </span>
      )}
    </div>
  );
};

/** Vince's clarification response */
const ClarificationResponseContent: FC<{ content: Record<string, unknown> }> = ({ content }) => {
  const answer = content.answer as string;
  const confidence = content.confidence as number | undefined;
  const source = content.source as string | undefined;

  return (
    <div className="space-y-2">
      <p className="text-sm text-blue-800">
        {answer}
      </p>
      <div className="flex items-center gap-2 text-xs text-blue-600">
        {confidence !== undefined && (
          <span>Confidence: {Math.round(confidence * 100)}%</span>
        )}
        {source && (
          <span className="bg-blue-100 px-2 py-0.5 rounded">
            Source: {source.replace(/_/g, ' ')}
          </span>
        )}
      </div>
    </div>
  );
};

export default AgentConversationTimeline;
