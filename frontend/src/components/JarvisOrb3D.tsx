import React, { useRef, useMemo } from "react";
import { Canvas, useFrame, extend } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";

export type OrbVariant = "holographic" | "plasma" | "neural";
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

// ─────────────────────────────────────────────────────────────
// VARIANT 1: HOLOGRAPHIC  (transparent rim-glow sphere + cage)
// ─────────────────────────────────────────────────────────────

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

function HolographicOrb({ voiceState }: { voiceState: VoiceState }) {
  const outerRef = useRef<THREE.Mesh>(null!);
  const cage1Ref = useRef<THREE.Mesh>(null!);
  const cage2Ref = useRef<THREE.Mesh>(null!);
  const clock = useRef(0);
  const cfg = STATE_CONFIG[voiceState];
  const rimColor = useMemo(() => new THREE.Color(cfg.color), [cfg.color]);

  const fresnelUniforms = useMemo(() => ({
    rimColor: { value: rimColor },
    rimPower: { value: 2.8 },
    rimStrength: { value: 1.4 },
  }), []);

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

  const cageColor = useMemo(() => new THREE.Color(cfg.cageColor), [cfg.cageColor]);

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

      {/* Inner glow core (tiny bright sphere) */}
      <mesh>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial
          color={cfg.color}
          emissive={cfg.emissive}
          emissiveIntensity={cfg.emissiveIntensity * 2}
        />
      </mesh>

      {/* Wireframe cages */}
      <mesh ref={cage1Ref} scale={1.4}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color={cageColor} wireframe transparent opacity={0.5} />
      </mesh>
      <mesh ref={cage2Ref} scale={1.7}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color={cageColor} wireframe transparent opacity={0.25} />
      </mesh>

      <Sparkles count={50} scale={4.5} size={1.5} speed={cfg.rotSpeed * 30} color={cfg.sparkleColor} opacity={0.6} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// VARIANT 2: PLASMA  (vertex-displacement animated surface)
// ─────────────────────────────────────────────────────────────

const plasmaVert = /* glsl */`
uniform float uTime;
uniform float uSpeed;
uniform float uAmplitude;
varying vec3 vNormal;
varying float vDisplace;

float hash(float n) { return fract(sin(n) * 43758.5453); }
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n = i.x + i.y * 57.0 + 113.0 * i.z;
  return mix(
    mix(mix(hash(n),       hash(n+1.0),   f.x),
        mix(hash(n+57.0),  hash(n+58.0),  f.x), f.y),
    mix(mix(hash(n+113.0), hash(n+114.0), f.x),
        mix(hash(n+170.0), hash(n+171.0), f.x), f.y),
    f.z);
}

void main(){
  float n1 = vnoise(normal * 2.5 + uTime * uSpeed);
  float n2 = vnoise(normal * 5.0 - uTime * uSpeed * 0.7);
  float d = (n1 * 0.7 + n2 * 0.3) * 2.0 - 1.0;
  d *= uAmplitude;
  vDisplace = d;
  vNormal = normal;
  vec3 pos = position + normal * d;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}`;

const plasmaFrag = /* glsl */`
uniform vec3 uColorA;
uniform vec3 uColorB;
varying float vDisplace;
void main(){
  float t = clamp(vDisplace * 3.0 + 0.5, 0.0, 1.0);
  vec3 col = mix(uColorA, uColorB, t);
  gl_FragColor = vec4(col, 1.0);
}`;

function PlasmaOrb({ voiceState }: { voiceState: VoiceState }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const cfg = STATE_CONFIG[voiceState];
  const clock = useRef(0);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSpeed: { value: 0.4 },
    uAmplitude: { value: 0.18 },
    uColorA: { value: new THREE.Color(cfg.emissive) },
    uColorB: { value: new THREE.Color(cfg.color) },
  }), []);

  useFrame((_, delta) => {
    clock.current += delta;
    uniforms.uTime.value = clock.current;
    uniforms.uSpeed.value = 0.3 + cfg.rotSpeed * 30;
    uniforms.uAmplitude.value = 0.14 + cfg.pulseAmp * 1.5;
    uniforms.uColorA.value.set(cfg.emissive);
    uniforms.uColorB.value.set(cfg.color);
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.15;
  });

  return (
    <>
      <ambientLight intensity={0.2} />
      <pointLight position={[3, 3, 3]} intensity={1.5} color={cfg.color} />
      <pointLight position={[-3, -3, -3]} intensity={0.8} color={cfg.emissive} />
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 128, 128]} />
        <shaderMaterial
          vertexShader={plasmaVert}
          fragmentShader={plasmaFrag}
          uniforms={uniforms}
        />
      </mesh>
      <Sparkles count={30} scale={3.5} size={0.8} speed={cfg.rotSpeed * 20} color={cfg.sparkleColor} opacity={0.4} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// VARIANT 3: NEURAL NETWORK  (nodes on sphere + connecting lines)
// ─────────────────────────────────────────────────────────────

const NODE_COUNT = 80;
const CONNECT_DIST = 0.85; // fraction of diameter

function fibonacciSphere(n: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const phi = Math.PI * (Math.sqrt(5) - 1);
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = phi * i;
    pts.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r));
  }
  return pts;
}

function NeuralOrb({ voiceState }: { voiceState: VoiceState }) {
  const groupRef = useRef<THREE.Group>(null!);
  const lineRef = useRef<THREE.LineSegments>(null!);
  const cfg = STATE_CONFIG[voiceState];
  const clock = useRef(0);

  const nodes = useMemo(() => fibonacciSphere(NODE_COUNT), []);

  const lineGeo = useMemo(() => {
    const positions: number[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (nodes[i].distanceTo(nodes[j]) < CONNECT_DIST) {
          positions.push(nodes[i].x, nodes[i].y, nodes[i].z);
          positions.push(nodes[j].x, nodes[j].y, nodes[j].z);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [nodes]);

  const nodePosArr = useMemo(() => {
    const arr = new Float32Array(nodes.length * 3);
    nodes.forEach((v, i) => { arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z; });
    return arr;
  }, [nodes]);

  const nodeGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(nodePosArr, 3));
    return g;
  }, [nodePosArr]);

  useFrame((_, delta) => {
    clock.current += delta;
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * cfg.rotSpeed * 30;
      groupRef.current.rotation.x += delta * cfg.rotSpeed * 10;
    }
  });

  const lineColor = useMemo(() => new THREE.Color(cfg.cageColor), [cfg.cageColor]);
  const nodeColor = useMemo(() => new THREE.Color(cfg.color), [cfg.color]);

  return (
    <>
      <ambientLight intensity={0.1} />
      <pointLight position={[2, 2, 2]} intensity={1.2} color={cfg.color} />
      <pointLight position={[-2, -2, -2]} intensity={0.5} color={cfg.emissive} />

      <group ref={groupRef}>
        {/* Ghost sphere */}
        <mesh>
          <sphereGeometry args={[0.98, 32, 32]} />
          <meshStandardMaterial
            color={cfg.color}
            emissive={cfg.emissive}
            emissiveIntensity={0.15}
            transparent
            opacity={0.08}
          />
        </mesh>

        {/* Connections */}
        <lineSegments ref={lineRef} geometry={lineGeo}>
          <lineBasicMaterial color={lineColor} transparent opacity={0.35} />
        </lineSegments>

        {/* Nodes as points */}
        <points geometry={nodeGeo}>
          <pointsMaterial color={nodeColor} size={0.04} sizeAttenuation />
        </points>
      </group>

      <Sparkles count={40} scale={4} size={1.2} speed={cfg.rotSpeed * 25} color={cfg.sparkleColor} opacity={0.5} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// PUBLIC COMPONENT
// ─────────────────────────────────────────────────────────────

interface JarvisOrb3DProps {
  voiceState: VoiceState;
  size?: number;
  variant?: OrbVariant;
}

export const JarvisOrb3D: React.FC<JarvisOrb3DProps> = ({
  voiceState,
  size = 280,
  variant = "holographic",
}) => (
  <div style={{ width: size, height: size }} className="select-none">
    <Canvas
      camera={{ position: [0, 0, 4.5], fov: 40 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      {variant === "holographic" && <HolographicOrb voiceState={voiceState} />}
      {variant === "plasma"      && <PlasmaOrb      voiceState={voiceState} />}
      {variant === "neural"      && <NeuralOrb      voiceState={voiceState} />}
    </Canvas>
  </div>
);
