/**
 * @module @bangui/app/components/three/VinceEffects
 * Post-processing effects - bloom, depth of field, lens flare
 */

'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  EffectComposer,
  Bloom,
  DepthOfField,
  Vignette,
  Noise,
} from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';
import * as THREE from 'three';
import type { VinceBehavior } from '../../hooks/useVinceState';

interface VinceEffectsProps {
  behavior: VinceBehavior;
  intensity: number;
  enabled?: boolean;
}

// Effect intensity by behavior
const BEHAVIOR_EFFECTS = {
  idle: { bloom: 1.0, dofBlur: 2, noise: 0.02 },
  listening: { bloom: 1.2, dofBlur: 2.5, noise: 0.02 },
  processing: { bloom: 1.8, dofBlur: 3, noise: 0.03 },
  speaking: { bloom: 1.3, dofBlur: 2, noise: 0.02 },
  celebrating: { bloom: 2.5, dofBlur: 4, noise: 0.04 },
  disconnected: { bloom: 0.4, dofBlur: 5, noise: 0.05 },
};

/**
 * Lens flare sprite component
 */
const LensFlare = ({
  position,
  color,
  size,
  intensity
}: {
  position: [number, number, number];
  color: string;
  size: number;
  intensity: number;
}) => {
  const spriteRef = useRef<THREE.Sprite>(null);
  const { camera } = useThree();

  useFrame((state) => {
    if (!spriteRef.current) return;

    // Face camera
    spriteRef.current.quaternion.copy(camera.quaternion);

    // Pulse effect
    const time = state.clock.getElapsedTime();
    const pulse = 1 + Math.sin(time * 2) * 0.2;
    spriteRef.current.scale.setScalar(size * pulse * intensity);
  });

  return (
    <sprite ref={spriteRef} position={position}>
      <spriteMaterial
        color={color}
        transparent
        opacity={0.6 * intensity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </sprite>
  );
};

/**
 * Hexagonal lens flare element
 */
const HexFlare = ({
  offset,
  size,
  color,
  opacity,
  behavior,
}: {
  offset: number;
  size: number;
  color: string;
  opacity: number;
  behavior: VinceBehavior;
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();

    // Position along view axis
    meshRef.current.position.set(offset * 0.5, offset * 0.3, -2);
    meshRef.current.quaternion.copy(camera.quaternion);

    // Subtle rotation
    meshRef.current.rotation.z = time * 0.2 + offset;

    // Pulse
    const pulse = 1 + Math.sin(time * 3 + offset) * 0.1;
    meshRef.current.scale.setScalar(size * pulse);
  });

  const actualOpacity = behavior === 'processing' || behavior === 'celebrating'
    ? opacity * 1.5
    : opacity;

  return (
    <mesh ref={meshRef}>
      <circleGeometry args={[1, 6]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={actualOpacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

/**
 * Anamorphic streak effect
 */
const AnamorphicStreak = ({
  color,
  behavior,
  intensity,
}: {
  color: string;
  behavior: VinceBehavior;
  intensity: number;
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();

    meshRef.current.quaternion.copy(camera.quaternion);

    // Breathing width
    const breathe = 1 + Math.sin(time * 1.5) * 0.2;
    const baseWidth = behavior === 'processing' ? 4 :
                      behavior === 'celebrating' ? 5 : 2.5;

    meshRef.current.scale.set(baseWidth * breathe * intensity, 0.02, 1);
  });

  return (
    <mesh ref={meshRef} position={[0, 0, -1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.3 * intensity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
};

/**
 * Complete lens flare system
 */
const LensFlareSystem = ({
  behavior,
  intensity,
}: {
  behavior: VinceBehavior;
  intensity: number;
}) => {
  const colors = {
    idle: '#6366f1',
    listening: '#06b6d4',
    processing: '#8b5cf6',
    speaking: '#3b82f6',
    celebrating: '#f59e0b',
    disconnected: '#6b7280',
  };

  const color = colors[behavior];
  const isActive = behavior !== 'disconnected';

  if (!isActive) return null;

  return (
    <group>
      {/* Main glow */}
      <LensFlare position={[0, 0, 0]} color={color} size={0.8} intensity={intensity} />

      {/* Hexagonal flares */}
      <HexFlare offset={0.3} size={0.15} color={color} opacity={0.2} behavior={behavior} />
      <HexFlare offset={0.6} size={0.1} color="#ffffff" opacity={0.15} behavior={behavior} />
      <HexFlare offset={-0.4} size={0.12} color={color} opacity={0.18} behavior={behavior} />
      <HexFlare offset={-0.8} size={0.08} color="#ffffff" opacity={0.1} behavior={behavior} />

      {/* Anamorphic streak */}
      <AnamorphicStreak color={color} behavior={behavior} intensity={intensity} />
    </group>
  );
};

/**
 * Post-processing effects that respond to Vince's behavior
 */
export const VinceEffects = ({ behavior, intensity, enabled = true }: VinceEffectsProps) => {
  const effects = BEHAVIOR_EFFECTS[behavior];

  if (!enabled) {
    return null;
  }

  return (
    <>
      {/* Lens flare system (rendered in scene) */}
      <LensFlareSystem behavior={behavior} intensity={intensity} />

      {/* Post-processing stack */}
      <EffectComposer>
        {/* Bloom for glow */}
        <Bloom
          intensity={effects.bloom * intensity}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          kernelSize={KernelSize.LARGE}
          blendFunction={BlendFunction.ADD}
        />

        {/* Depth of field for cinematic blur */}
        <DepthOfField
          focusDistance={0.01}
          focalLength={0.02}
          bokehScale={effects.dofBlur}
        />

        {/* Vignette for focus */}
        <Vignette
          offset={0.3}
          darkness={behavior === 'disconnected' ? 0.7 : 0.4}
          blendFunction={BlendFunction.NORMAL}
        />

        {/* Film grain for texture */}
        <Noise
          opacity={effects.noise}
          blendFunction={BlendFunction.OVERLAY}
        />
      </EffectComposer>
    </>
  );
};
