/**
 * @module @bangui/app/components/three/VinceModel
 * 3D Vince model with reactive animations
 */

'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import type { VinceBehavior } from '../../hooks/useVinceState';
import {
  FLOAT_CONFIG,
  LEAN_CONFIG,
  GAZE_CONFIG,
  MODEL_CONFIG,
  ANIMATION_SPEEDS,
} from '../../lib/vince-animations';

interface VinceModelProps {
  behavior: VinceBehavior;
  gazeTarget: [number, number, number];
  intensity: number;
}

/**
 * Vince 3D model with behavior-driven animations
 */
export const VinceModel = ({ behavior, gazeTarget, intensity }: VinceModelProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/models/vince.glb');
  const { actions, names } = useAnimations(animations, groupRef);

  // Clone scene to avoid shared state issues
  const clonedScene = useMemo(() => scene.clone(), [scene]);

  // Log available animations and play the first one
  useEffect(() => {
    console.log('Available animations:', names);
    if (names.length > 0 && actions[names[0]]) {
      actions[names[0]]?.reset().fadeIn(0.5).play();
    }
  }, [actions, names]);

  // Animation state refs
  const currentLean = useRef(0);
  const currentGaze = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 5));
  const floatOffset = useRef(0);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const time = state.clock.getElapsedTime();
    const speed = ANIMATION_SPEEDS[behavior];

    // Floating animation (always active, intensity varies)
    floatOffset.current = Math.sin(time * FLOAT_CONFIG.frequency * speed) * FLOAT_CONFIG.amplitude;
    const floatY = floatOffset.current * intensity;

    // Lean animation (for listening state)
    const targetLean = behavior === 'listening' ? LEAN_CONFIG.amount : 0;
    currentLean.current = THREE.MathUtils.lerp(
      currentLean.current,
      targetLean,
      delta / LEAN_CONFIG.duration
    );

    // Gaze tracking (smooth head rotation)
    const targetGaze = new THREE.Vector3(...gazeTarget);
    currentGaze.current.lerp(targetGaze, GAZE_CONFIG.smoothing);

    // Calculate look rotation
    const lookDirection = currentGaze.current.clone().normalize();
    const rotationY = Math.atan2(lookDirection.x, lookDirection.z) * 0.3; // Damped rotation
    const rotationX = -Math.atan2(lookDirection.y, Math.sqrt(lookDirection.x ** 2 + lookDirection.z ** 2)) * 0.3;

    // Apply transformations
    groupRef.current.position.y = MODEL_CONFIG.position[1] + floatY;
    groupRef.current.position.x = Math.sin(time * 0.3) * 0.1; // Gentle sway
    groupRef.current.rotation.x = MODEL_CONFIG.rotation[0] + currentLean.current + rotationX;

    // Slow idle rotation + subtle oscillation
    const idleRotation = time * 0.1; // Slow continuous rotation
    const oscillation = Math.sin(time * 0.5) * FLOAT_CONFIG.rotationAmplitude;
    groupRef.current.rotation.y = MODEL_CONFIG.rotation[1] + rotationY + idleRotation + oscillation;

    // Celebration animation
    if (behavior === 'celebrating') {
      groupRef.current.rotation.y += Math.sin(time * 3) * 0.2;
      groupRef.current.position.y += Math.abs(Math.sin(time * 4)) * 0.2;
    }

    // Disconnected dimming (handled via material)
    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const material = child.material as THREE.MeshStandardMaterial;
        if (behavior === 'disconnected') {
          material.emissiveIntensity = 0.1;
          material.opacity = 0.7;
        } else {
          material.emissiveIntensity = 0.3 * intensity;
          material.opacity = 1;
        }
      }
    });
  });

  return (
    <group ref={groupRef} position={MODEL_CONFIG.position} scale={MODEL_CONFIG.scale}>
      <primitive object={clonedScene} />
    </group>
  );
};

// Preload the model
useGLTF.preload('/models/vince.glb');
