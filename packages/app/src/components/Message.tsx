/**
 * @module @bangui/app/components/Message
 * Chat message display component with glass-morphism styling
 */

'use client';

import type { FC } from 'react';
import type { DisplayMessage } from '../lib/types';
import type { ActionPrompt } from '@bangui/types';

/** Message component props */
interface MessageProps {
  readonly message: DisplayMessage;
  readonly onAction?: (action: ActionPrompt) => void;
  readonly selectedOptions?: Set<string>;
  readonly onToggleOption?: (option: string) => void;
}

/**
 * Renders a single chat message with glass-morphism styling
 */
export const Message: FC<MessageProps> = ({ message, onAction, selectedOptions, onToggleOption }) => {
  const isUser = message.sender === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {/* Vince avatar for non-user messages */}
      {!isUser && (
        <div className="h-8 w-8 rounded-full bg-indigo-600/80 backdrop-blur-sm flex items-center justify-center flex-shrink-0 mr-3 border border-indigo-400/30 shadow-lg">
          <span className="text-sm font-bold text-white">V</span>
        </div>
      )}

      <div
        className={`max-w-[80%] px-4 py-3 ${
          isUser
            ? 'glass-card-user text-white'
            : 'glass-card-vince text-white'
        }`}
      >
        <p className="whitespace-pre-wrap text-sm glass-text">{message.content}</p>

        {/* Action buttons */}
        {message.actions && message.actions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.actions.map((action, i) => {
              if (action.type === 'questionnaire' && action.data.options) {
                return (action.data.options as string[]).map((option, j) => {
                  const isSelected = selectedOptions?.has(option) ?? false;
                  return (
                    <button
                      key={`${i}-${j}`}
                      onClick={() => onToggleOption?.(option)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                        isSelected
                          ? 'bg-indigo-500/80 text-white border border-indigo-400/50 shadow-md'
                          : 'bg-white/10 text-white/90 border border-white/20 hover:bg-white/20 backdrop-blur-sm'
                      }`}
                    >
                      {option}
                    </button>
                  );
                });
              }
              if (action.type === 'deposit') {
                const amount = action.data.amount as string | undefined;
                const token = action.data.token as string | undefined;
                const buttonLabel = amount && token
                  ? `Deposit ${amount} ${token}`
                  : 'Make Deposit';
                return (
                  <button
                    key={i}
                    onClick={() => onAction?.(action)}
                    className="rounded-full bg-emerald-500/80 backdrop-blur-sm px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500/90 transition-all border border-emerald-400/30 shadow-lg hover:shadow-emerald-500/30"
                  >
                    {buttonLabel}
                  </button>
                );
              }
              return null;
            })}
          </div>
        )}

        <span className="mt-1 block text-xs text-white/50">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  );
};
