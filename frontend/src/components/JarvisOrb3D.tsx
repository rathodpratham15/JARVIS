import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sparkles, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

type VoiceState = "idle" | "listening" | "thinking" | "speaking";

const STATE_CONFIG: Record<VoiceState, {
  color: THREE.ColorRepresentation;
  emissive: THREE.ColorRepresentation;
  emissiveIntensity: number;
  cageColor: THREE.ColorRepresentation;
  rotSpeed: number;
  pulseAmp: number;
  sparkleColor: string;
}> = {
  idle:      { color: "#0ea5e9", emissive: "#0369a1", emissiveIntensity: 0.5, cageColor: "#164e63", rotSpeed: 0.003, pulseAmp: 0.02, sparkleColor: "#38bdf8" },
  listening: { color: "#e2e8f0", emissive: "#94a3b8", emissiveIntensity: 0.9, cageColor: "#94a3b8", rotSpeed: 0.012, pulseAmp: 0.06, sparkleColor: "#ffffff" },
  thinking:  { color: "#fbbf24", emissive: "#d97706", emissiveIntensity: 0.8, cageColor: "#78350f", rotSpeed: 0.008, pulseAmp: 0.05, sparkleColor: "#fde68a" },
  speaking:  { color: "#34d399", emissive: "#059669", emissiveIntensity: 0.9, cageColor: "#064e3b", rotSpeed: 0.015, pulseAmp: 0.07, sparkleColor: "#6ee7b7" },
};

const fresnelVert = /* glsl */`
varying vec3 vNormal;
varying vec3 vViewDir;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 worldPos = modelViewMatrix * vec4(position, 1.0);
  vViewDir = normalize(-worldPos.xyz);
  gl_Position = projectionMatrix * worldPos;
}`;

const fresnelFrag = /* glsl */`
uniform vec3 rimColor;
uniform float rimPower;
uniform float rimStrength;
varying vec3 vNormal;
varying vec3 vViewDir;
void main() {
  float rim = 1.0 - max(dot(vNormal, vViewDir), 0.0);
  rim = pow(rim, rimPower) * rimStrength;
  gl_FragColor = vec4(rimColor * rim, rim * 0.85);
}`;

function OrbScene({ voiceState }: { voiceState: VoiceState }) {
  const outerRef = useRef<THREE.Mesh>(null!);
  const cage1Ref = useRef<THREE.Mesh>(null!);
  const cage2Ref = useRef<THREE.Mesh>(null!);
  const clock = useRef(0);
  const cfg = STATE_CONFIG[voiceState];

  const fresnelUniforms = useMemo(() => ({
    rimColor: { value: new THREE.Color(cfg.color) },
    rimPower:  { value: 2.8 },
    rimStrength: { value: 1.4 },
  }), []);

  const cageColor = useMemo(() => new THREE.Color(cfg.cageColor), [cfg.cageColor]);

  useFrame((_, delta) => {
    clock.current += delta;
    const pulse = 1 + Math.sin(clock.current * 3) * cfg.pulseAmp;
    if (outerRef.current) outerRef.current.scale.setScalar(pulse);
    if (cage1Ref.current) {
      cage1Ref.current.rotation.y += delta * cfg.rotSpeed * 55;
      cage1Ref.current.rotation.x += delta * cfg.rotSpeed * 25;
    }
    if (cage2Ref.current) {
      cage2Ref.current.rotation.y -= delta * cfg.rotSpeed * 40;
      cage2Ref.current.rotation.z += delta * cfg.rotSpeed * 15;
    }
    fresnelUniforms.rimColor.value.set(cfg.color);
    fresnelUniforms.rimStrength.value = 1.2 + Math.sin(clock.current * 2) * 0.3;
  });

  return (
    <>
      <ambientLight intensity={0.05} />
      <pointLight position={[0, 0, 0]} intensity={cfg.emissiveIntensity * 3} color={cfg.color} />
      <pointLight position={[2, 2, 2]} intensity={0.8} color={cfg.color} />

      {/* Fresnel rim sphere */}
      <mesh ref={outerRef}>
        <sphereGeometry args={[1, 64, 64]} />
        <shaderMaterial
          vertexShader={fresnelVert}
          fragmentShader={fresnelFrag}
          uniforms={fresnelUniforms}
          transparent
          side={THREE.FrontSide}
          depthWrite={false}
        />
      </mesh>

      {/* Inner glow core */}
      <mesh>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial
          color={cfg.color}
          emissive={cfg.emissive}
          emissiveIntensity={cfg.emissiveIntensity * 2}
        />
      </mesh>

      {/* Counter-rotating wireframe cages */}
      <mesh ref={cage1Ref} scale={1.4}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color={cageColor} wireframe transparent opacity={0.5} />
      </mesh>
      <mesh ref={cage2Ref} scale={1.7}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color={cageColor} wireframe transparent opacity={0.25} />
      </mesh>

      <Sparkles count={50} scale={4.5} size={1.5} speed={cfg.rotSpeed * 30} color={cfg.sparkleColor} opacity={0.6} />

      {/* Drag to rotate — damping makes it feel weighty */}
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.6}
      />
    </>
  );
}

interface JarvisOrb3DProps {
  voiceState: VoiceState;
  size?: number;
}

export const JarvisOrb3D: React.FC<JarvisOrb3DProps> = ({ voiceState, size = 280 }) => (
  <div style={{ width: size, height: size }} className="select-none cursor-grab active:cursor-grabbing">
    <Canvas
      camera={{ position: [0, 0, 4.5], fov: 40 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      <OrbScene voiceState={voiceState} />
    </Canvas>
  </div>
);
