/**
 * @module @bangui/app/lib/vince-animations
 * Animation constants and configurations for Vince 3D model
 */

import type { VinceBehavior } from '../hooks/useVinceState';

/** Animation speed multipliers by behavior */
export const ANIMATION_SPEEDS: Record<VinceBehavior, number> = {
  idle: 0.5,
  listening: 0.7,
  processing: 1.2,
  speaking: 0.8,
  celebrating: 1.5,
  disconnected: 0.2,
};

/** Floating animation parameters */
export const FLOAT_CONFIG = {
  amplitude: 0.15, // How high/low the float goes
  frequency: 0.8, // How fast the float cycle is
  rotationAmplitude: 0.05, // Subtle rotation during float
};

/** Lean animation for listening state */
export const LEAN_CONFIG = {
  amount: 0.1, // How far to lean forward
  duration: 0.5, // Transition time in seconds
};

/** Particle system configuration */
export const PARTICLE_CONFIG = {
  count: 100,
  size: 0.02,
  speed: 0.5,
  radius: 1.5,
  color: '#4F46E5', // Indigo
  emissive: '#818CF8', // Light indigo
};

/** Post-processing effect settings */
export const EFFECTS_CONFIG = {
  bloom: {
    intensity: 0.3,
    luminanceThreshold: 0.8,
    luminanceSmoothing: 0.5,
  },
  depthOfField: {
    focusDistance: 0.02,
    focalLength: 0.02,
    bokehScale: 3,
  },
};

/** Camera positions and animations */
export const CAMERA_CONFIG = {
  default: {
    position: [0, 0.5, 4] as [number, number, number],
    fov: 50,
  },
  scrollParallax: {
    maxOffset: 0.3, // Max camera movement on scroll
    smoothing: 0.1, // Lerp factor for smooth movement
  },
};

/** Gaze tracking configuration */
export const GAZE_CONFIG = {
  smoothing: 0.05, // Lerp factor for smooth head tracking
  maxRotation: 0.3, // Max rotation in radians
};

/** Celebration animation */
export const CELEBRATION_CONFIG = {
  armRaise: {
    duration: 0.5,
    rotation: Math.PI * 0.5, // 90 degrees
  },
  confettiCount: 50,
  duration: 3000, // ms
};

/** Mobile-specific overrides */
export const MOBILE_CONFIG = {
  particleCount: 30, // Reduced particles
  disablePostProcessing: true,
  reducedAnimations: true,
};

/** Model configuration */
export const MODEL_CONFIG = {
  scale: 2.5,
  position: [0, -0.5, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
};
