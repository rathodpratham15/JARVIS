import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";

type VoiceState = "idle" | "listening" | "thinking" | "speaking";

// Per-state colours and animation params
const STATE_CONFIG: Record<VoiceState, {
  color: THREE.ColorRepresentation;
  emissive: THREE.ColorRepresentation;
  emissiveIntensity: number;
  cageColor: THREE.ColorRepresentation;
  rotSpeed: number;
  pulseAmp: number;
  sparkleColor: string;
}> = {
  idle:      { color: "#0ea5e9", emissive: "#0369a1", emissiveIntensity: 0.4, cageColor: "#164e63", rotSpeed: 0.003, pulseAmp: 0.02, sparkleColor: "#38bdf8" },
  listening: { color: "#e2e8f0", emissive: "#94a3b8", emissiveIntensity: 0.9, cageColor: "#94a3b8", rotSpeed: 0.012, pulseAmp: 0.06, sparkleColor: "#ffffff" },
  thinking:  { color: "#fbbf24", emissive: "#d97706", emissiveIntensity: 0.8, cageColor: "#78350f", rotSpeed: 0.008, pulseAmp: 0.05, sparkleColor: "#fde68a" },
  speaking:  { color: "#34d399", emissive: "#059669", emissiveIntensity: 0.9, cageColor: "#064e3b", rotSpeed: 0.015, pulseAmp: 0.07, sparkleColor: "#6ee7b7" },
};

// ------- Inner glowing sphere -------
function CoreSphere({ voiceState }: { voiceState: VoiceState }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const matRef = useRef<THREE.MeshStandardMaterial>(null!);
  const cfg = STATE_CONFIG[voiceState];
  const clock = useRef(0);

  useFrame((_, delta) => {
    clock.current += delta;
    if (!meshRef.current) return;
    // Gentle pulse on scale
    const pulse = 1 + Math.sin(clock.current * 3.5) * cfg.pulseAmp;
    meshRef.current.scale.setScalar(pulse);
    // Smooth emissive intensity
    if (matRef.current) {
      matRef.current.emissiveIntensity +=
        (cfg.emissiveIntensity - matRef.current.emissiveIntensity) * 0.05;
    }
  });

  const color = useMemo(() => new THREE.Color(cfg.color), [cfg.color]);
  const emissive = useMemo(() => new THREE.Color(cfg.emissive), [cfg.emissive]);

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 64, 64]} />
      <meshStandardMaterial
        ref={matRef}
        color={color}
        emissive={emissive}
        emissiveIntensity={cfg.emissiveIntensity}
        metalness={0.3}
        roughness={0.15}
        transparent
        opacity={0.92}
      />
    </mesh>
  );
}

// ------- Wireframe icosahedron cage -------
function WireCage({ voiceState, scale, reverse }: { voiceState: VoiceState; scale: number; reverse?: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const cfg = STATE_CONFIG[voiceState];

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const dir = reverse ? -1 : 1;
    meshRef.current.rotation.y += delta * cfg.rotSpeed * dir * 60;
    meshRef.current.rotation.x += delta * cfg.rotSpeed * dir * 30;
  });

  const color = useMemo(() => new THREE.Color(cfg.cageColor), [cfg.cageColor]);

  return (
    <mesh ref={meshRef} scale={scale}>
      <icosahedronGeometry args={[1, 1]} />
      <meshBasicMaterial color={color} wireframe />
    </mesh>
  );
}

// ------- Orbiting ring -------
function OrbitRing({ voiceState, radius, tilt, speed }: { voiceState: VoiceState; radius: number; tilt: number; speed: number }) {
  const groupRef = useRef<THREE.Group>(null!);
  const cfg = STATE_CONFIG[voiceState];
  const color = useMemo(() => new THREE.Color(cfg.cageColor), [cfg.cageColor]);

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * speed * cfg.rotSpeed * 60;
  });

  return (
    <group ref={groupRef} rotation={[tilt, 0, 0]}>
      <mesh>
        <torusGeometry args={[radius, 0.008, 8, 80]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

// ------- Scene (camera + lights + objects) -------
function OrbScene({ voiceState }: { voiceState: VoiceState }) {
  const cfg = STATE_CONFIG[voiceState];
  const lightColor = useMemo(() => new THREE.Color(cfg.color), [cfg.color]);

  return (
    <>
      <ambientLight intensity={0.15} />
      <pointLight position={[3, 3, 3]} intensity={1.2} color={lightColor} />
      <pointLight position={[-3, -2, -3]} intensity={0.6} color={lightColor} />

      <CoreSphere voiceState={voiceState} />
      <WireCage voiceState={voiceState} scale={1.35} />
      <WireCage voiceState={voiceState} scale={1.65} reverse />
      <OrbitRing voiceState={voiceState} radius={1.9} tilt={Math.PI / 4} speed={1} />
      <OrbitRing voiceState={voiceState} radius={2.1} tilt={-Math.PI / 6} speed={-0.7} />
      <OrbitRing voiceState={voiceState} radius={1.75} tilt={Math.PI / 2.5} speed={0.5} />

      <Sparkles
        count={60}
        scale={5}
        size={1.2}
        speed={voiceState === "idle" ? 0.2 : 0.8}
        color={cfg.sparkleColor}
        opacity={voiceState === "idle" ? 0.3 : 0.7}
      />
    </>
  );
}

// ------- Public component -------
interface JarvisOrb3DProps {
  voiceState: VoiceState;
  size?: number; // px, default 280
}

export const JarvisOrb3D: React.FC<JarvisOrb3DProps> = ({ voiceState, size = 280 }) => {
  return (
    <div style={{ width: size, height: size }} className="select-none">
      <Canvas
        camera={{ position: [0, 0, 4.5], fov: 40 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <OrbScene voiceState={voiceState} />
      </Canvas>
    </div>
  );
};
