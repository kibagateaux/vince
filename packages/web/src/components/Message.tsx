/**
 * @module @bangui/web/components/Message
 * Chat message display component
 */

import type { FC } from 'react';
import type { DisplayMessage } from '../lib/types.js';
import type { ActionPrompt } from '@bangui/types';

/** Message component props */
interface MessageProps {
  readonly message: DisplayMessage;
  readonly onAction?: (action: ActionPrompt) => void;
}

/**
 * Renders a single chat message
 * @param props - Component props
 */
export const Message: FC<MessageProps> = ({ message, onAction }) => {
  const isUser = message.sender === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-md'
            : 'bg-gray-100 text-gray-900 rounded-bl-md'
        }`}
      >
        <p className="whitespace-pre-wrap text-sm">{message.content}</p>

        {/* Action buttons */}
        {message.actions && message.actions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.actions.map((action, i) => {
              if (action.type === 'questionnaire' && action.data.options) {
                return (action.data.options as string[]).map((option, j) => (
                  <button
                    key={`${i}-${j}`}
                    onClick={() => onAction?.(action)}
                    className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-800 shadow-sm hover:bg-gray-50 transition-colors"
                  >
                    {option}
                  </button>
                ));
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
                    className="rounded-full bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 transition-colors"
                  >
                    {buttonLabel}
                  </button>
                );
              }
              return null;
            })}
          </div>
        )}

        <span className="mt-1 block text-xs opacity-60">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  );
};
