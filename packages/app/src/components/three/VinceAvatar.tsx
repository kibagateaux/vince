/**
 * @module @bangui/app/components/three/VinceAvatar
 * Abstract AI entity - glowing orb with reactive animations
 */

'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { VinceBehavior } from '../../hooks/useVinceState';

interface VinceAvatarProps {
  behavior: VinceBehavior;
  gazeTarget: [number, number, number];
  intensity: number;
}

// Color schemes for different states
const STATE_COLORS = {
  idle: { primary: '#6366f1', secondary: '#818cf8', glow: '#4f46e5' },
  listening: { primary: '#06b6d4', secondary: '#22d3ee', glow: '#0891b2' },
  processing: { primary: '#8b5cf6', secondary: '#a78bfa', glow: '#7c3aed' },
  speaking: { primary: '#3b82f6', secondary: '#60a5fa', glow: '#2563eb' },
  celebrating: { primary: '#f59e0b', secondary: '#fbbf24', glow: '#d97706' },
  disconnected: { primary: '#6b7280', secondary: '#9ca3af', glow: '#4b5563' },
};

/**
 * Floating ring that orbits the core
 */
const OrbitRing = ({
  radius,
  thickness,
  speed,
  axis,
  offset,
  color,
  opacity,
}: {
  radius: number;
  thickness: number;
  speed: number;
  axis: 'x' | 'y' | 'z';
  offset: number;
  color: string;
  opacity: number;
}) => {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const time = state.clock.getElapsedTime();

    if (axis === 'x') {
      ref.current.rotation.x = time * speed + offset;
    } else if (axis === 'y') {
      ref.current.rotation.y = time * speed + offset;
    } else {
      ref.current.rotation.z = time * speed + offset;
    }
  });

  return (
    <mesh ref={ref}>
      <torusGeometry args={[radius, thickness, 16, 64]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.5}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

/**
 * Particle system orbiting the core
 */
const OrbitalParticles = ({
  count,
  radius,
  color,
  behavior,
}: {
  count: number;
  radius: number;
  color: string;
  behavior: VinceBehavior;
}) => {
  const pointsRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius * (0.8 + Math.random() * 0.4);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      speeds[i] = 0.5 + Math.random() * 1.5;
    }

    return { positions, speeds };
  }, [count, radius]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const time = state.clock.getElapsedTime();

    const speedMultiplier = behavior === 'processing' ? 2 :
                           behavior === 'celebrating' ? 3 : 1;

    pointsRef.current.rotation.y = time * 0.2 * speedMultiplier;
    pointsRef.current.rotation.x = Math.sin(time * 0.3) * 0.2;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particles.positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        color={color}
        transparent
        opacity={0.8}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

/**
 * Pulsing wave ring
 */
const PulseWave = ({
  delay,
  color,
  behavior,
}: {
  delay: number;
  color: string;
  behavior: VinceBehavior;
}) => {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const time = state.clock.getElapsedTime();

    const speed = behavior === 'processing' ? 1.5 :
                  behavior === 'celebrating' ? 2 : 1;

    const cycle = ((time * speed + delay) % 2) / 2;
    const scale = 0.5 + cycle * 1.5;
    const opacity = 1 - cycle;

    ref.current.scale.set(scale, scale, scale);
    (ref.current.material as THREE.MeshStandardMaterial).opacity = opacity * 0.5;
  });

  return (
    <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.8, 0.85, 64]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={1}
        transparent
        opacity={0.5}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

/**
 * Inner energy core with distortion
 */
const EnergyCore = ({
  color,
  behavior,
  intensity,
}: {
  color: string;
  behavior: VinceBehavior;
  intensity: number;
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current || !glowRef.current) return;
    const time = state.clock.getElapsedTime();

    // Core pulse
    const pulseSpeed = behavior === 'processing' ? 4 :
                       behavior === 'celebrating' ? 6 : 2;
    const pulse = 1 + Math.sin(time * pulseSpeed) * 0.1 * intensity;

    meshRef.current.scale.set(pulse, pulse, pulse);

    // Glow pulse (slightly offset)
    const glowPulse = 1.2 + Math.sin(time * pulseSpeed + 0.5) * 0.15 * intensity;
    glowRef.current.scale.set(glowPulse, glowPulse, glowPulse);

    // Subtle rotation
    meshRef.current.rotation.y = time * 0.5;
    meshRef.current.rotation.x = Math.sin(time * 0.3) * 0.2;
  });

  return (
    <group>
      {/* Outer glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.6, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          transparent
          opacity={0.2}
        />
      </mesh>

      {/* Main core */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[0.4, 2]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.5}
          roughness={0.1}
          metalness={0.8}
        />
      </mesh>

      {/* Inner bright spot */}
      <mesh>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Core light */}
      <pointLight color={color} intensity={2} distance={5} />
    </group>
  );
};

/**
 * Main abstract AI entity
 */
export const VinceAvatar = ({ behavior, gazeTarget, intensity }: VinceAvatarProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const colors = STATE_COLORS[behavior];

  // Smooth position tracking
  const currentPos = useRef({ x: 0, y: 0 });

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.getElapsedTime();

    // Gentle floating motion
    const floatSpeed = behavior === 'celebrating' ? 2 : 0.8;
    const floatAmount = behavior === 'disconnected' ? 0.02 : 0.08;

    groupRef.current.position.y = Math.sin(time * floatSpeed) * floatAmount;

    // Subtle position shift toward gaze
    const targetX = gazeTarget[0] * 0.1;
    const targetY = gazeTarget[1] * 0.05;
    currentPos.current.x += (targetX - currentPos.current.x) * 0.02;
    currentPos.current.y += (targetY - currentPos.current.y) * 0.02;

    groupRef.current.position.x = currentPos.current.x;

    // Behavior-specific motion
    if (behavior === 'listening') {
      groupRef.current.position.z = 0.2; // Move slightly forward
    } else if (behavior === 'disconnected') {
      groupRef.current.position.y -= 0.2;
    } else {
      groupRef.current.position.z = 0;
    }
  });

  const particleCount = behavior === 'processing' ? 150 :
                        behavior === 'celebrating' ? 200 : 80;

  return (
    <group ref={groupRef}>
      {/* Energy core */}
      <EnergyCore
        color={colors.primary}
        behavior={behavior}
        intensity={intensity}
      />

      {/* Orbital rings */}
      <OrbitRing
        radius={0.8}
        thickness={0.015}
        speed={0.5}
        axis="y"
        offset={0}
        color={colors.secondary}
        opacity={0.6}
      />
      <OrbitRing
        radius={0.9}
        thickness={0.01}
        speed={-0.3}
        axis="x"
        offset={Math.PI / 4}
        color={colors.primary}
        opacity={0.4}
      />
      <OrbitRing
        radius={1.0}
        thickness={0.008}
        speed={0.4}
        axis="z"
        offset={Math.PI / 2}
        color={colors.glow}
        opacity={0.3}
      />

      {/* Orbiting particles */}
      <OrbitalParticles
        count={particleCount}
        radius={1.2}
        color={colors.secondary}
        behavior={behavior}
      />

      {/* Pulse waves */}
      <PulseWave delay={0} color={colors.primary} behavior={behavior} />
      <PulseWave delay={0.7} color={colors.secondary} behavior={behavior} />
      <PulseWave delay={1.4} color={colors.glow} behavior={behavior} />

      {/* Ambient light matching state */}
      <pointLight
        color={colors.glow}
        intensity={intensity * 1.5}
        distance={8}
        position={[0, 0, 0]}
      />
    </group>
  );
};
