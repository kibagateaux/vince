/**
 * @module @bangui/app/components/three/VinceAvatar
 * Cute anime-style avatar built from primitives
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

// Cute pastel color palette
const COLORS = {
  skin: '#ffe4d6',
  hair: '#7c6fdc',
  hairHighlight: '#a394f5',
  eyes: '#4a9fff',
  eyeShine: '#ffffff',
  blush: '#ffb3ba',
  outfit: '#6dd5ed',
  outfitAccent: '#ff9a9e',
  white: '#ffffff',
};

/**
 * Big anime eye with shine
 */
const AnimeEye = ({
  position,
  behavior,
  time,
  side
}: {
  position: [number, number, number];
  behavior: VinceBehavior;
  time: number;
  side: 'left' | 'right';
}) => {
  const isHappy = behavior === 'celebrating' || behavior === 'speaking';
  const isThinking = behavior === 'processing';
  const isSad = behavior === 'disconnected';

  // Blink animation
  const blinkCycle = Math.sin(time * 0.5) > 0.98 ? 0.1 : 1;
  const eyeScale = isSad ? 0.8 : isHappy ? 1.1 : 1;

  // Eye squint when happy (curved line eyes)
  if (isHappy) {
    return (
      <group position={position}>
        {/* Happy curved eye */}
        <mesh rotation={[0, 0, side === 'left' ? 0.3 : -0.3]}>
          <torusGeometry args={[0.08, 0.025, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#2d2d2d" />
        </mesh>
      </group>
    );
  }

  return (
    <group position={position} scale={[eyeScale, eyeScale * blinkCycle, eyeScale]}>
      {/* Eye white */}
      <mesh>
        <sphereGeometry args={[0.12, 32, 32]} />
        <meshStandardMaterial color={COLORS.white} />
      </mesh>

      {/* Iris */}
      <mesh position={[0, 0, 0.06]}>
        <circleGeometry args={[0.08, 32]} />
        <meshStandardMaterial color={COLORS.eyes} />
      </mesh>

      {/* Pupil */}
      <mesh position={[0, 0, 0.07]}>
        <circleGeometry args={[0.04, 32]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>

      {/* Main shine */}
      <mesh position={[0.03, 0.03, 0.08]}>
        <circleGeometry args={[0.025, 16]} />
        <meshStandardMaterial
          color={COLORS.eyeShine}
          emissive={COLORS.eyeShine}
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Secondary shine */}
      <mesh position={[-0.02, -0.02, 0.08]}>
        <circleGeometry args={[0.012, 16]} />
        <meshStandardMaterial
          color={COLORS.eyeShine}
          emissive={COLORS.eyeShine}
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Sparkle when processing */}
      {isThinking && (
        <mesh
          position={[0.05, 0.05, 0.09]}
          rotation={[0, 0, time * 3]}
        >
          <ringGeometry args={[0.01, 0.02, 4]} />
          <meshStandardMaterial
            color="#fff59d"
            emissive="#fff59d"
            emissiveIntensity={1}
          />
        </mesh>
      )}
    </group>
  );
};

/**
 * Cute blush marks
 */
const Blush = ({ position }: { position: [number, number, number] }) => (
  <mesh position={position} rotation={[0, 0, 0]}>
    <circleGeometry args={[0.06, 32]} />
    <meshStandardMaterial
      color={COLORS.blush}
      transparent
      opacity={0.6}
    />
  </mesh>
);

/**
 * Floating sparkle/star
 */
const Sparkle = ({
  position,
  time,
  delay = 0
}: {
  position: [number, number, number];
  time: number;
  delay?: number;
}) => {
  const scale = 0.5 + Math.sin((time + delay) * 3) * 0.5;
  const opacity = 0.3 + Math.sin((time + delay) * 3) * 0.7;

  return (
    <mesh
      position={position}
      rotation={[0, 0, time * 2 + delay]}
      scale={[scale, scale, scale]}
    >
      <ringGeometry args={[0.02, 0.04, 4]} />
      <meshStandardMaterial
        color="#fff59d"
        emissive="#fff59d"
        emissiveIntensity={2}
        transparent
        opacity={opacity}
      />
    </mesh>
  );
};

/**
 * Cute arm with rounded hand
 */
const CuteArm = ({
  side,
  behavior,
  time
}: {
  side: 'left' | 'right';
  behavior: VinceBehavior;
  time: number;
}) => {
  const isLeft = side === 'left';
  const xPos = isLeft ? -0.35 : 0.35;

  // Arm poses based on behavior
  let armRotation = 0;
  let waveOffset = 0;

  switch (behavior) {
    case 'idle':
      armRotation = Math.sin(time * 0.8 + (isLeft ? 0 : Math.PI)) * 0.1;
      break;
    case 'listening':
      armRotation = isLeft ? 0.3 : -0.3;
      break;
    case 'processing':
      armRotation = Math.sin(time * 2) * 0.2;
      waveOffset = Math.sin(time * 4) * 0.1;
      break;
    case 'speaking':
      armRotation = Math.sin(time * 3 + (isLeft ? 0 : Math.PI)) * 0.3;
      break;
    case 'celebrating':
      // Waving!
      armRotation = -2.5 + Math.sin(time * 8) * 0.4;
      waveOffset = Math.sin(time * 10) * 0.2;
      break;
    case 'disconnected':
      armRotation = 0.5;
      break;
  }

  return (
    <group position={[xPos, -0.1, 0]}>
      {/* Arm */}
      <group rotation={[armRotation, 0, isLeft ? 0.3 : -0.3]}>
        <mesh position={[0, -0.15, 0]}>
          <capsuleGeometry args={[0.06, 0.2, 8, 16]} />
          <meshStandardMaterial color={COLORS.skin} />
        </mesh>

        {/* Hand (cute round) */}
        <mesh position={[waveOffset, -0.32, 0]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color={COLORS.skin} />
        </mesh>
      </group>
    </group>
  );
};

/**
 * Floating heart (for celebrating)
 */
const FloatingHeart = ({
  position,
  time,
  delay = 0
}: {
  position: [number, number, number];
  time: number;
  delay?: number;
}) => {
  const y = position[1] + Math.sin((time + delay) * 2) * 0.1;
  const scale = 0.8 + Math.sin((time + delay) * 3) * 0.2;

  return (
    <group position={[position[0], y, position[2]]} scale={[scale, scale, scale]}>
      {/* Heart shape from two spheres + cone */}
      <mesh position={[-0.03, 0, 0]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial
          color={COLORS.outfitAccent}
          emissive={COLORS.outfitAccent}
          emissiveIntensity={0.5}
        />
      </mesh>
      <mesh position={[0.03, 0, 0]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial
          color={COLORS.outfitAccent}
          emissive={COLORS.outfitAccent}
          emissiveIntensity={0.5}
        />
      </mesh>
      <mesh position={[0, -0.05, 0]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.06, 0.08, 16]} />
        <meshStandardMaterial
          color={COLORS.outfitAccent}
          emissive={COLORS.outfitAccent}
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  );
};

/**
 * Main cute anime Vince avatar
 */
export const VinceAvatar = ({ behavior, gazeTarget, intensity }: VinceAvatarProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  const currentGaze = useRef(new THREE.Vector3(0, 0, 5));
  const targetGaze = useMemo(() => new THREE.Vector3(...gazeTarget), [gazeTarget]);

  useFrame((state) => {
    timeRef.current = state.clock.getElapsedTime();
    const time = timeRef.current;

    if (!groupRef.current || !headRef.current) return;

    // Smooth gaze
    currentGaze.current.lerp(targetGaze, 0.08);
    const lookDir = currentGaze.current.clone().normalize();
    headRef.current.rotation.y = Math.atan2(lookDir.x, lookDir.z) * 0.4;
    headRef.current.rotation.x = -lookDir.y * 0.2;

    // Cute bouncy animations
    switch (behavior) {
      case 'idle':
        groupRef.current.position.y = Math.sin(time * 1.2) * 0.08;
        groupRef.current.rotation.z = Math.sin(time * 0.8) * 0.03;
        break;
      case 'listening':
        groupRef.current.position.y = Math.sin(time * 1.5) * 0.05;
        groupRef.current.rotation.x = 0.1; // Curious lean
        headRef.current.rotation.z = Math.sin(time * 2) * 0.1; // Head tilt
        break;
      case 'processing':
        groupRef.current.position.y = Math.sin(time * 2) * 0.1;
        groupRef.current.rotation.y = Math.sin(time * 1) * 0.2;
        break;
      case 'speaking':
        groupRef.current.position.y = Math.sin(time * 2) * 0.06;
        groupRef.current.rotation.z = Math.sin(time * 3) * 0.05;
        break;
      case 'celebrating':
        groupRef.current.position.y = Math.abs(Math.sin(time * 5)) * 0.25;
        groupRef.current.rotation.z = Math.sin(time * 6) * 0.1;
        break;
      case 'disconnected':
        groupRef.current.position.y = -0.1;
        headRef.current.rotation.x = 0.2;
        headRef.current.rotation.z = 0.1;
        break;
    }
  });

  const time = timeRef.current;
  const isCelebrating = behavior === 'celebrating';
  const isProcessing = behavior === 'processing';

  return (
    <group ref={groupRef} position={[0, 0, 0]} scale={1.8}>
      {/* Ambient glow */}
      <pointLight color={COLORS.outfit} intensity={0.5} distance={3} />

      {/* Sparkles when processing or celebrating */}
      {(isProcessing || isCelebrating) && (
        <>
          <Sparkle position={[0.4, 0.5, 0]} time={timeRef.current} delay={0} />
          <Sparkle position={[-0.5, 0.3, 0.1]} time={timeRef.current} delay={1} />
          <Sparkle position={[0.3, -0.2, 0.2]} time={timeRef.current} delay={2} />
          <Sparkle position={[-0.4, 0.6, -0.1]} time={timeRef.current} delay={0.5} />
        </>
      )}

      {/* Floating hearts when celebrating */}
      {isCelebrating && (
        <>
          <FloatingHeart position={[0.5, 0.4, 0]} time={timeRef.current} delay={0} />
          <FloatingHeart position={[-0.5, 0.5, 0]} time={timeRef.current} delay={1} />
          <FloatingHeart position={[0, 0.7, 0.2]} time={timeRef.current} delay={0.5} />
        </>
      )}

      {/* Body */}
      <mesh position={[0, -0.2, 0]}>
        <capsuleGeometry args={[0.25, 0.3, 16, 32]} />
        <meshStandardMaterial color={COLORS.outfit} />
      </mesh>

      {/* Outfit accent (collar/bow) */}
      <mesh position={[0, 0.05, 0.2]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial
          color={COLORS.outfitAccent}
          emissive={COLORS.outfitAccent}
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* Arms */}
      <CuteArm side="left" behavior={behavior} time={timeRef.current} />
      <CuteArm side="right" behavior={behavior} time={timeRef.current} />

      {/* Head */}
      <group ref={headRef} position={[0, 0.4, 0]}>
        {/* Face (slightly oval) */}
        <mesh scale={[1, 1.1, 0.9]}>
          <sphereGeometry args={[0.35, 32, 32]} />
          <meshStandardMaterial color={COLORS.skin} />
        </mesh>

        {/* Hair back */}
        <mesh position={[0, 0.1, -0.1]} scale={[1.1, 1, 0.8]}>
          <sphereGeometry args={[0.38, 32, 32]} />
          <meshStandardMaterial color={COLORS.hair} />
        </mesh>

        {/* Hair front bangs */}
        <mesh position={[0, 0.2, 0.15]} scale={[1, 0.4, 0.5]}>
          <sphereGeometry args={[0.35, 32, 32]} />
          <meshStandardMaterial color={COLORS.hair} />
        </mesh>

        {/* Hair side tufts */}
        <mesh position={[-0.3, 0, 0]} scale={[0.4, 0.6, 0.4]}>
          <sphereGeometry args={[0.25, 16, 16]} />
          <meshStandardMaterial color={COLORS.hair} />
        </mesh>
        <mesh position={[0.3, 0, 0]} scale={[0.4, 0.6, 0.4]}>
          <sphereGeometry args={[0.25, 16, 16]} />
          <meshStandardMaterial color={COLORS.hair} />
        </mesh>

        {/* Hair highlight */}
        <mesh position={[0.1, 0.3, 0.2]} scale={[0.3, 0.15, 0.2]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial color={COLORS.hairHighlight} />
        </mesh>

        {/* Ahoge (antenna hair) */}
        <mesh position={[0, 0.45, 0.1]} rotation={[0.3, 0, 0]}>
          <coneGeometry args={[0.03, 0.15, 8]} />
          <meshStandardMaterial color={COLORS.hair} />
        </mesh>

        {/* Eyes */}
        <AnimeEye
          position={[-0.12, 0.02, 0.28]}
          behavior={behavior}
          time={timeRef.current}
          side="left"
        />
        <AnimeEye
          position={[0.12, 0.02, 0.28]}
          behavior={behavior}
          time={timeRef.current}
          side="right"
        />

        {/* Blush marks */}
        <Blush position={[-0.2, -0.05, 0.25]} />
        <Blush position={[0.2, -0.05, 0.25]} />

        {/* Small cute nose */}
        <mesh position={[0, -0.02, 0.32]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshStandardMaterial color="#eecbbd" />
        </mesh>

        {/* Mouth */}
        <mesh
          position={[0, -0.12, 0.3]}
          rotation={[0, 0, 0]}
        >
          <torusGeometry args={[0.04, 0.015, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#e88a8a" />
        </mesh>

        {/* Ear accessories (small stars) */}
        <mesh position={[-0.35, 0.1, 0]} rotation={[0, -0.5, 0]}>
          <ringGeometry args={[0.02, 0.04, 5]} />
          <meshStandardMaterial
            color="#fff59d"
            emissive="#fff59d"
            emissiveIntensity={1}
          />
        </mesh>
        <mesh position={[0.35, 0.1, 0]} rotation={[0, 0.5, 0]}>
          <ringGeometry args={[0.02, 0.04, 5]} />
          <meshStandardMaterial
            color="#fff59d"
            emissive="#fff59d"
            emissiveIntensity={1}
          />
        </mesh>
      </group>

      {/* Floating platform/cloud */}
      <mesh position={[0, -0.6, 0]} scale={[1, 0.3, 1]}>
        <sphereGeometry args={[0.4, 32, 16]} />
        <meshStandardMaterial
          color="#e0f7fa"
          transparent
          opacity={0.7}
        />
      </mesh>
    </group>
  );
};
