/**
 * @module @bangui/app/components/three/VinceScene
 * Main 3D scene wrapper with Canvas and Suspense
 */

'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera, Preload } from '@react-three/drei';
import * as THREE from 'three';
import type { VinceBehavior } from '../../hooks/useVinceState';
import { VinceAvatar } from './VinceAvatar';
import { VinceParticles } from './VinceParticles';
import { VinceEffects } from './VinceEffects';
import { SceneEnvironment } from './SceneEnvironment';
import { CAMERA_CONFIG, MOBILE_CONFIG } from '../../lib/vince-animations';

interface VinceSceneProps {
  behavior: VinceBehavior;
  gazeTarget: [number, number, number];
  intensity: number;
  scrollY?: number;
}

/**
 * Loading fallback while 3D assets load
 */
const LoadingFallback = () => (
  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950">
    <div className="text-center">
      <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-indigo-600/20 animate-pulse flex items-center justify-center">
        <span className="text-2xl font-bold text-indigo-400">V</span>
      </div>
      <p className="text-slate-400 text-sm">Loading Vince...</p>
    </div>
  </div>
);

/**
 * WebGL error fallback
 */
const WebGLFallback = () => (
  <div className="absolute inset-0 bg-gradient-to-b from-slate-900 to-slate-950">
    <div className="absolute inset-0 opacity-30">
      {/* Static fallback gradient */}
      <div className="absolute inset-0 bg-gradient-radial from-indigo-900/50 to-transparent" />
    </div>
  </div>
);

/**
 * Inner scene content (inside Canvas)
 */
const SceneContent = ({
  behavior,
  gazeTarget,
  intensity,
  scrollY = 0,
  isMobile,
}: VinceSceneProps & { isMobile: boolean }) => {
  // Calculate camera offset from scroll
  const scrollOffset = Math.min(scrollY / 1000, CAMERA_CONFIG.scrollParallax.maxOffset);

  return (
    <>
      {/* Camera with scroll parallax */}
      <PerspectiveCamera
        makeDefault
        position={[
          CAMERA_CONFIG.default.position[0],
          CAMERA_CONFIG.default.position[1] - scrollOffset * 0.5,
          CAMERA_CONFIG.default.position[2] + scrollOffset,
        ]}
        fov={CAMERA_CONFIG.default.fov}
      />

      {/* Environment and lighting */}
      <SceneEnvironment behavior={behavior} intensity={intensity} />

      {/* Procedural avatar */}
      <VinceAvatar
        behavior={behavior}
        gazeTarget={gazeTarget}
        intensity={intensity}
      />

      {/* Particles (during processing) */}
      <VinceParticles
        active={behavior === 'processing'}
        intensity={intensity}
        isMobile={isMobile}
      />

      {/* Post-processing effects (disabled on mobile) */}
      <VinceEffects
        behavior={behavior}
        intensity={intensity}
        enabled={!isMobile && !MOBILE_CONFIG.disablePostProcessing}
      />

      {/* Preload assets */}
      <Preload all />
    </>
  );
};

/**
 * Main VinceScene component
 * Renders the 3D background with Vince model
 */
export const VinceScene = (props: VinceSceneProps) => {
  const [hasWebGL, setHasWebGL] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Client-side detection
  useEffect(() => {
    setIsClient(true);

    // Check WebGL support
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      setHasWebGL(!!gl);
    } catch {
      setHasWebGL(false);
    }

    // Check if mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle WebGL context loss
  const handleCreated = useCallback((state: { gl: THREE.WebGLRenderer }) => {
    const canvas = state.gl.domElement;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      console.warn('WebGL context lost');
      setHasWebGL(false);
    });
  }, []);

  // Don't render on server
  if (!isClient) {
    return <LoadingFallback />;
  }

  // Fallback if WebGL not available
  if (!hasWebGL) {
    return <WebGLFallback />;
  }

  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        dpr={isMobile ? 1 : [1, 2]}
        gl={{
          antialias: !isMobile,
          alpha: false,
          powerPreference: isMobile ? 'low-power' : 'high-performance',
        }}
        onCreated={handleCreated}
        style={{ background: '#0F0F23' }}
      >
        <Suspense fallback={null}>
          <SceneContent {...props} isMobile={isMobile} />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default VinceScene;
