/**
 * @module @bangui/app/components/three/VinceEffects
 * Post-processing effects for the 3D scene
 */

'use client';

import {
  EffectComposer,
  Bloom,
  DepthOfField,
  Vignette,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import type { VinceBehavior } from '../../hooks/useVinceState';
import { EFFECTS_CONFIG } from '../../lib/vince-animations';

interface VinceEffectsProps {
  behavior: VinceBehavior;
  intensity: number;
  enabled?: boolean;
}

/**
 * Post-processing effects that respond to Vince's behavior
 */
export const VinceEffects = ({ behavior, intensity, enabled = true }: VinceEffectsProps) => {
  // Dynamic effect parameters based on behavior
  const getBloomIntensity = () => {
    switch (behavior) {
      case 'processing':
        return EFFECTS_CONFIG.bloom.intensity * 1.5 * intensity;
      case 'celebrating':
        return EFFECTS_CONFIG.bloom.intensity * 2 * intensity;
      case 'disconnected':
        return EFFECTS_CONFIG.bloom.intensity * 0.3 * intensity;
      default:
        return EFFECTS_CONFIG.bloom.intensity * intensity;
    }
  };

  if (!enabled) {
    return null;
  }

  return (
    <EffectComposer>
      {/* Bloom for glow effects */}
      <Bloom
        intensity={getBloomIntensity()}
        luminanceThreshold={EFFECTS_CONFIG.bloom.luminanceThreshold}
        luminanceSmoothing={EFFECTS_CONFIG.bloom.luminanceSmoothing}
        blendFunction={BlendFunction.ADD}
      />

      {/* Depth of field for focus effect */}
      <DepthOfField
        focusDistance={EFFECTS_CONFIG.depthOfField.focusDistance}
        focalLength={EFFECTS_CONFIG.depthOfField.focalLength}
        bokehScale={EFFECTS_CONFIG.depthOfField.bokehScale * (behavior === 'disconnected' ? 1.5 : 1)}
      />

      {/* Vignette for cinematic framing */}
      <Vignette
        offset={0.3}
        darkness={behavior === 'disconnected' ? 0.8 : 0.5}
        blendFunction={BlendFunction.NORMAL}
      />

    </EffectComposer>
  );
};
