/**
 * @module @bangui/app/components/three/VinceParticles
 * Particle system for processing state visual effects
 */

'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PARTICLE_CONFIG } from '../../lib/vince-animations';

interface VinceParticlesProps {
  active: boolean;
  intensity: number;
  isMobile?: boolean;
}

/**
 * Orbital particle system that activates during processing
 */
export const VinceParticles = ({ active, intensity, isMobile = false }: VinceParticlesProps) => {
  const pointsRef = useRef<THREE.Points>(null);
  const count = isMobile ? PARTICLE_CONFIG.count / 3 : PARTICLE_CONFIG.count;

  // Initialize particle positions
  const { positions, velocities, initialPositions } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const initialPositions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // Distribute particles in a sphere around the model
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = PARTICLE_CONFIG.radius * (0.5 + Math.random() * 0.5);

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      initialPositions[i * 3] = x;
      initialPositions[i * 3 + 1] = y;
      initialPositions[i * 3 + 2] = z;

      // Random velocities for orbital motion
      velocities[i * 3] = (Math.random() - 0.5) * 0.02;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
    }

    return { positions, velocities, initialPositions };
  }, [count]);

  // Animation state
  const opacityRef = useRef(0);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;

    const time = state.clock.getElapsedTime();
    const geometry = pointsRef.current.geometry;
    const positionAttr = geometry.getAttribute('position') as THREE.BufferAttribute;

    // Fade in/out based on active state
    const targetOpacity = active ? intensity : 0;
    opacityRef.current = THREE.MathUtils.lerp(opacityRef.current, targetOpacity, delta * 3);

    // Update material opacity
    const material = pointsRef.current.material as THREE.PointsMaterial;
    material.opacity = opacityRef.current;

    if (!active && opacityRef.current < 0.01) return;

    // Animate particles
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      // Get current position
      let x = positionAttr.array[i3] as number;
      let y = positionAttr.array[i3 + 1] as number;
      let z = positionAttr.array[i3 + 2] as number;

      // Orbital motion around Y axis
      const angle = time * PARTICLE_CONFIG.speed * (0.5 + (i % 3) * 0.25);
      const radius = Math.sqrt(x * x + z * z);

      // Update position with orbital motion
      (positionAttr.array as Float32Array)[i3] = Math.cos(angle + i * 0.1) * radius;
      (positionAttr.array as Float32Array)[i3 + 1] = y + Math.sin(time * 2 + i) * 0.01;
      (positionAttr.array as Float32Array)[i3 + 2] = Math.sin(angle + i * 0.1) * radius;

      // Add some vertical oscillation
      (positionAttr.array as Float32Array)[i3 + 1] += Math.sin(time * 3 + i * 0.5) * 0.02;
    }

    positionAttr.needsUpdate = true;

    // Rotate the whole particle system
    pointsRef.current.rotation.y = time * 0.1;
  });

  return (
    <points ref={pointsRef} position={[0, 0, 0]}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={PARTICLE_CONFIG.size}
        color={PARTICLE_CONFIG.color}
        transparent
        opacity={0}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};
