/**
 * @module @bangui/app/hooks/useVinceState
 * State machine for Vince's reactive behaviors
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

export type VinceBehavior =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'celebrating'
  | 'disconnected';

export interface VinceState {
  behavior: VinceBehavior;
  gazeTarget: [number, number, number];
  intensity: number; // 0-1 for effect intensity
  lastMessageIndex: number;
}

interface UseVinceStateProps {
  connectionState: 'connected' | 'connecting' | 'disconnected' | 'error';
  isWaitingForResponse: boolean;
  inputHasText: boolean;
  messageCount: number;
  lastMessageSender?: 'user' | 'vince';
  depositConfirmed?: boolean;
}

const DEFAULT_GAZE: [number, number, number] = [0, 0, 5];

/**
 * Hook that manages Vince's reactive state based on chat activity
 */
export const useVinceState = ({
  connectionState,
  isWaitingForResponse,
  inputHasText,
  messageCount,
  lastMessageSender,
  depositConfirmed = false,
}: UseVinceStateProps): VinceState => {
  const [behavior, setBehavior] = useState<VinceBehavior>('idle');
  const [gazeTarget, setGazeTarget] = useState<[number, number, number]>(DEFAULT_GAZE);
  const [intensity, setIntensity] = useState(0.5);
  const [lastMessageIndex, setLastMessageIndex] = useState(0);
  const [celebrationTimeout, setCelebrationTimeout] = useState<NodeJS.Timeout | null>(null);

  // Determine behavior based on inputs
  useEffect(() => {
    // Clear any existing celebration timeout when state changes
    if (celebrationTimeout && !depositConfirmed) {
      clearTimeout(celebrationTimeout);
      setCelebrationTimeout(null);
    }

    // Priority-based state machine
    if (connectionState === 'disconnected' || connectionState === 'error') {
      setBehavior('disconnected');
      setIntensity(0.2);
      return;
    }

    if (depositConfirmed) {
      setBehavior('celebrating');
      setIntensity(1);
      // Auto-return to idle after celebration
      const timeout = setTimeout(() => {
        setBehavior('idle');
        setIntensity(0.5);
      }, 3000);
      setCelebrationTimeout(timeout);
      return;
    }

    if (isWaitingForResponse) {
      setBehavior('processing');
      setIntensity(0.8);
      return;
    }

    if (lastMessageSender === 'vince' && messageCount > lastMessageIndex) {
      setBehavior('speaking');
      setIntensity(0.7);
      setLastMessageIndex(messageCount);
      // Auto-transition to idle
      const timeout = setTimeout(() => {
        setBehavior(inputHasText ? 'listening' : 'idle');
        setIntensity(inputHasText ? 0.6 : 0.5);
      }, 1500);
      return () => clearTimeout(timeout);
    }

    if (inputHasText) {
      setBehavior('listening');
      setIntensity(0.6);
      return;
    }

    setBehavior('idle');
    setIntensity(0.5);
  }, [
    connectionState,
    isWaitingForResponse,
    inputHasText,
    messageCount,
    lastMessageSender,
    depositConfirmed,
    lastMessageIndex,
    celebrationTimeout,
  ]);

  // Update gaze target based on behavior
  useEffect(() => {
    switch (behavior) {
      case 'listening':
        // Look slightly towards input area (bottom center)
        setGazeTarget([0, -0.5, 5]);
        break;
      case 'processing':
        // Look slightly up and to the side (thinking)
        setGazeTarget([0.3, 0.3, 5]);
        break;
      case 'speaking':
        // Look directly at user
        setGazeTarget([0, 0, 5]);
        break;
      case 'celebrating':
        // Look up
        setGazeTarget([0, 0.5, 5]);
        break;
      case 'disconnected':
        // Look down
        setGazeTarget([0, -0.3, 5]);
        break;
      default:
        setGazeTarget(DEFAULT_GAZE);
    }
  }, [behavior]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (celebrationTimeout) {
        clearTimeout(celebrationTimeout);
      }
    };
  }, [celebrationTimeout]);

  return useMemo(() => ({
    behavior,
    gazeTarget,
    intensity,
    lastMessageIndex,
  }), [behavior, gazeTarget, intensity, lastMessageIndex]);
};
