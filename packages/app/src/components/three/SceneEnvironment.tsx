/**
 * @module @bangui/app/components/three/SceneEnvironment
 * Lighting and environment setup for the 3D scene
 */

'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import type { VinceBehavior } from '../../hooks/useVinceState';

interface SceneEnvironmentProps {
  behavior: VinceBehavior;
  intensity: number;
}

/**
 * Scene environment with dynamic lighting based on Vince's behavior
 */
export const SceneEnvironment = ({ behavior, intensity }: SceneEnvironmentProps) => {
  const spotLightRef = useRef<THREE.SpotLight>(null);
  const rimLightRef = useRef<THREE.PointLight>(null);

  // Dynamic light colors based on behavior
  const lightColors = useMemo(() => {
    switch (behavior) {
      case 'processing':
        return {
          spot: new THREE.Color('#818CF8'), // Indigo
          rim: new THREE.Color('#4F46E5'),
          ambient: 0.4,
        };
      case 'celebrating':
        return {
          spot: new THREE.Color('#FCD34D'), // Gold
          rim: new THREE.Color('#F59E0B'),
          ambient: 0.5,
        };
      case 'disconnected':
        return {
          spot: new THREE.Color('#6B7280'), // Gray
          rim: new THREE.Color('#4B5563'),
          ambient: 0.2,
        };
      case 'speaking':
        return {
          spot: new THREE.Color('#60A5FA'), // Blue
          rim: new THREE.Color('#3B82F6'),
          ambient: 0.4,
        };
      default:
        return {
          spot: new THREE.Color('#E0E7FF'), // Light indigo
          rim: new THREE.Color('#818CF8'),
          ambient: 0.3,
        };
    }
  }, [behavior]);

  // Animate lights
  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    if (spotLightRef.current) {
      // Subtle pulsing based on behavior
      const pulseSpeed = behavior === 'processing' ? 2 : 0.5;
      const pulseIntensity = 0.1 * Math.sin(time * pulseSpeed) * intensity;
      spotLightRef.current.intensity = 1.5 + pulseIntensity;
      spotLightRef.current.color.copy(lightColors.spot);
    }

    if (rimLightRef.current) {
      rimLightRef.current.intensity = 0.8 * intensity;
      rimLightRef.current.color.copy(lightColors.rim);
    }
  });

  return (
    <>
      {/* HDR Environment for reflections */}
      <Environment preset="city" />

      {/* Ambient light */}
      <ambientLight intensity={lightColors.ambient * intensity} />

      {/* Main spotlight from front-top */}
      <spotLight
        ref={spotLightRef}
        position={[0, 5, 5]}
        angle={0.4}
        penumbra={0.5}
        intensity={1.5}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0001}
      />

      {/* Rim light from behind */}
      <pointLight
        ref={rimLightRef}
        position={[0, 2, -3]}
        intensity={0.8}
      />

      {/* Fill light from side */}
      <pointLight
        position={[-3, 1, 2]}
        intensity={0.3}
        color="#E0E7FF"
      />

      {/* Ground shadow */}
      <ContactShadows
        position={[0, -1.5, 0]}
        opacity={0.4 * intensity}
        scale={10}
        blur={2}
        far={4}
      />

      {/* Gradient background */}
      <mesh position={[0, 0, -5]} scale={[20, 20, 1]}>
        <planeGeometry />
        <meshBasicMaterial color="#0F0F23" />
      </mesh>
    </>
  );
};
