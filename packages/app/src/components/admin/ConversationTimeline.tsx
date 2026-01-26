/**
 * @module @bangui/app/components/admin/ConversationTimeline
 * Timeline visualization with circular blobs for conversation messages
 */

'use client';

import { FC } from 'react';
import type { ConversationHealth, TimelineBlob } from '@bangui/types';

/** Health to blob color mapping */
const healthBlobColors: Record<ConversationHealth, string> = {
  success: 'bg-green-500',
  frustrated: 'bg-red-500',
  stalled: 'bg-yellow-500',
  active: 'bg-blue-500',
  abandoned: 'bg-gray-400',
};

/** Default blob colors */
const defaultBlobColors = { fill: 'bg-gray-500', ring: 'ring-gray-200' };

/** Sender to blob color mapping */
const senderBlobColors: Record<string, { fill: string; ring: string }> = {
  user: { fill: 'bg-blue-500', ring: 'ring-blue-200' },
  vince: { fill: 'bg-gray-500', ring: 'ring-gray-200' },
  system: { fill: 'bg-purple-500', ring: 'ring-purple-200' },
};

/** Get blob colors for a sender */
const getBlobColors = (sender: string) => senderBlobColors[sender] ?? defaultBlobColors;

interface ConversationTimelineProps {
  conversationId: string;
  messageCount: number;
  userMessageCount: number;
  vinceMessageCount: number;
  health: ConversationHealth;
  compact?: boolean;
  timeline?: readonly TimelineBlob[];
  onBlobClick?: (blobId: string) => void;
}

/**
 * Renders a timeline visualization with circular blobs
 */
export const ConversationTimeline: FC<ConversationTimelineProps> = ({
  conversationId,
  messageCount,
  userMessageCount,
  vinceMessageCount,
  health,
  compact = false,
  timeline,
  onBlobClick,
}) => {
  if (compact) {
    return (
      <CompactTimeline
        messageCount={messageCount}
        userMessageCount={userMessageCount}
        vinceMessageCount={vinceMessageCount}
        health={health}
      />
    );
  }

  if (!timeline || timeline.length === 0) {
    return (
      <div className="text-sm text-gray-400 py-4 text-center">
        No messages to display
      </div>
    );
  }

  return (
    <FullTimeline
      timeline={timeline}
      health={health}
      onBlobClick={onBlobClick}
    />
  );
};

/** Compact timeline for list view */
const CompactTimeline: FC<{
  messageCount: number;
  userMessageCount: number;
  vinceMessageCount: number;
  health: ConversationHealth;
}> = ({ messageCount, userMessageCount, vinceMessageCount, health }) => {
  const maxBlobs = 10;
  const userRatio = messageCount > 0 ? userMessageCount / messageCount : 0;

  const totalBlobs = Math.min(messageCount, maxBlobs);
  const userBlobs = Math.round(totalBlobs * userRatio);
  const vinceBlobs = totalBlobs - userBlobs;

  const blobs: ('user' | 'vince')[] = [];
  let userRemaining = userBlobs;
  let vinceRemaining = vinceBlobs;

  for (let i = 0; i < totalBlobs; i++) {
    if (i % 2 === 0 && userRemaining > 0) {
      blobs.push('user');
      userRemaining--;
    } else if (vinceRemaining > 0) {
      blobs.push('vince');
      vinceRemaining--;
    } else if (userRemaining > 0) {
      blobs.push('user');
      userRemaining--;
    }
  }

  return (
    <div className="flex items-center gap-1">
      <div className="text-xs text-gray-400 mr-2 w-8 text-right">
        {messageCount}
      </div>

      <div className="flex items-center gap-0.5 flex-1">
        {blobs.map((sender, idx) => {
          const colors = getBlobColors(sender);
          return (
            <div
              key={idx}
              className={`w-3 h-3 rounded-full ${colors.fill} opacity-80`}
              title={`${sender} message`}
            />
          );
        })}
        {messageCount > maxBlobs && (
          <div className="text-xs text-gray-400 ml-1">
            +{messageCount - maxBlobs}
          </div>
        )}
      </div>

      <div
        className={`w-3 h-3 rounded-full ${healthBlobColors[health]} ml-2`}
        title={`Status: ${health}`}
      />
    </div>
  );
};

/** Full timeline for detailed view */
const FullTimeline: FC<{
  timeline: readonly TimelineBlob[];
  health: ConversationHealth;
  onBlobClick?: (blobId: string) => void;
}> = ({ timeline, health, onBlobClick }) => {
  const sortedTimeline = [...timeline].sort((a, b) =>
    (a.sentAt as unknown as number) - (b.sentAt as unknown as number)
  );

  const firstTime = sortedTimeline[0]?.sentAt as unknown as number || 0;
  const lastTime = sortedTimeline[sortedTimeline.length - 1]?.sentAt as unknown as number || 0;
  const duration = lastTime - firstTime;

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-2 text-xs text-gray-500">
        <span>Start</span>
        <span>Timeline</span>
        <span>Latest</span>
      </div>

      <div className="relative h-20 bg-gray-100 rounded-lg overflow-hidden">
        <div className="absolute inset-x-0 top-1/2 h-0.5 bg-gray-300" />

        {sortedTimeline.map((blob) => {
          const time = blob.sentAt as unknown as number;
          const position = duration > 0 ? ((time - firstTime) / duration) * 100 : 50;
          const isUser = blob.sender === 'user';
          const blobHealth = blob.health || health;
          const colors = getBlobColors(blob.sender);

          return (
            <div
              key={blob.id}
              className="absolute transform -translate-x-1/2 cursor-pointer group"
              style={{
                left: `${Math.max(5, Math.min(95, position))}%`,
                top: isUser ? '25%' : '55%',
              }}
              onClick={() => onBlobClick?.(blob.id)}
              title={blob.contentPreview}
            >
              <div
                className={`w-4 h-4 rounded-full ${colors.fill} ring-2 ${colors.ring}
                  hover:scale-125 transition-transform shadow-sm
                  ${blobHealth === 'frustrated' ? 'ring-red-300' : ''}
                `}
              />

              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2
                hidden group-hover:block z-10 w-48">
                <div className="bg-gray-900 text-white text-xs rounded-lg p-2 shadow-lg">
                  <div className="font-medium mb-1">
                    {blob.sender === 'user' ? 'User' : 'Vince'}
                  </div>
                  <div className="text-gray-300 line-clamp-2">
                    {blob.contentPreview}
                  </div>
                  <div className="text-gray-400 mt-1">
                    {new Date(time).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-4 mt-3 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-gray-500">User</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-gray-500" />
          <span className="text-gray-500">Vince</span>
        </div>
        <div className="flex items-center gap-1">
          <div className={`w-3 h-3 rounded-full ${healthBlobColors[health]}`} />
          <span className="text-gray-500">{health}</span>
        </div>
      </div>
    </div>
  );
};
