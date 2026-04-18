import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, MeshWobbleMaterial, PerspectiveCamera, OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

const InstrumentalDetails = () => (
   <group>
      {/* Cables / Connections */}
      {Array.from({ length: 5 }).map((_, i) => (
        <Float key={i} speed={0.5} rotationIntensity={0.2}>
          <mesh position={[Math.sin(i) * 5, Math.cos(i) * 3, -2]}>
             <torusGeometry args={[0.5, 0.02, 16, 100, Math.PI]} />
             <meshStandardMaterial color="#444" metalness={0.8} />
          </mesh>
        </Float>
      ))}
      {/* Floating particles (Digital dust) */}
      <Float speed={2} floatIntensity={10}>
        <points>
           <bufferGeometry>
              <bufferAttribute 
                attach="attributes-position" 
                count={100} 
                array={new Float32Array(300).map(() => (Math.random() - 0.5) * 20)} 
                itemSize={3} 
              />
           </bufferGeometry>
           <pointsMaterial size={0.05} color="#3b82f6" transparent opacity={0.2} />
        </points>
      </Float>
   </group>
);

const InstrumentModel = ({ type, color }: { type: string, color: string }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.getElapsedTime() * 0.2;
      meshRef.current.rotation.z = Math.sin(state.clock.getElapsedTime() * 0.5) * 0.1;
    }
  });

  if (type === 'pads') {
    return (
      <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.5}>
        <group position={[0, -0.5, 0]}>
          {/* Main Chassis */}
          <mesh castShadow>
            <boxGeometry args={[4.2, 0.5, 4.2]} />
            <meshStandardMaterial color="#0a0a0b" metalness={0.9} roughness={0.1} />
          </mesh>
          <mesh position={[0, -0.2, 0]}>
             <boxGeometry args={[4.4, 0.3, 4.4]} />
             <meshStandardMaterial color="#111" metalness={1} roughness={0.05} />
          </mesh>
          {/* Pad Bed */}
          <mesh position={[0, 0.3, 0]}>
            <boxGeometry args={[3.8, 0.1, 3.8]} />
            <meshStandardMaterial color="#000" metalness={0.5} roughness={0.8} />
          </mesh>
          {/* Individual Pads */}
          {[-1.2, -0.4, 0.4, 1.2].map((x) => 
            [-1.2, -0.4, 0.4, 1.2].map((z) => (
              <mesh key={`${x}-${z}`} position={[x, 0.35, z]} castShadow>
                <boxGeometry args={[0.7, 0.15, 0.7]} />
                <meshStandardMaterial 
                  color={color} 
                  emissive={color} 
                  emissiveIntensity={0.3} 
                  metalness={0.3} 
                  roughness={0.1} 
                  transparent
                  opacity={0.9}
                />
              </mesh>
            ))
          )}
          {/* Side Screws */}
          {[-2, 2].map(x => [-2, 2].map(z => (
             <mesh key={`s-${x}-${z}`} position={[x, 0.2, z]}>
                <cylinderGeometry args={[0.05, 0.05, 0.1, 8]} />
                <meshStandardMaterial color="#333" />
             </mesh>
          )))}
        </group>
      </Float>
    );
  }

  if (type === 'synth') {
    return (
      <Float speed={1} rotationIntensity={0.5} floatIntensity={0.4}>
        <group rotation={[0.2, -0.4, 0]} position={[0, -1, 0]}>
          {/* Body */}
          <mesh castShadow>
            <boxGeometry args={[6, 0.6, 2]} />
            <meshStandardMaterial color="#080808" metalness={0.95} roughness={0.05} />
          </mesh>
          {/* Screen */}
          <mesh position={[1.5, 0.35, -0.5]} rotation={[-Math.PI / 12, 0, 0]}>
             <boxGeometry args={[1.5, 0.1, 0.8]} />
             <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
          </mesh>
          {/* Keys */}
          {Array.from({ length: 14 }).map((_, i) => (
            <mesh key={i} position={[-2.6 + i * 0.4, 0.35, 0.3]} castShadow>
              <boxGeometry args={[0.35, 0.15, 1.2]} />
              <meshStandardMaterial color="white" metalness={0.1} roughness={0.1} />
            </mesh>
          ))}
          {/* Black Keys */}
          {[0, 1, 3, 4, 5, 7, 8, 10, 11, 12].map((idx) => (
            <mesh key={`b-${idx}`} position={[-2.4 + idx * 0.4, 0.45, -0.1]} castShadow>
              <boxGeometry args={[0.2, 0.2, 0.8]} />
              <meshStandardMaterial color="#000" metalness={0.8} roughness={0.2} />
            </mesh>
          ))}
        </group>
      </Float>
    );
  }

  // Abstract pulse for hum / analysis
  return (
    <Float speed={5} rotationIntensity={2} floatIntensity={2}>
      <mesh ref={meshRef} castShadow>
        <sphereGeometry args={[1.5, 64, 64]} />
        <MeshDistortMaterial 
          color={color} 
          speed={3} 
          distort={0.4} 
          radius={1} 
          emissive={color} 
          emissiveIntensity={0.2}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
    </Float>
  );
};

interface StudioSceneProps {
  activeMode: 'hum' | 'seq' | 'pads' | 'keyboard' | 'master';
  accentColor?: string;
}

export const StudioScene: React.FC<StudioSceneProps> = ({ activeMode, accentColor = "#3b82f6" }) => {
  return (
    <div className="absolute inset-0 -z-10 bg-[#050505]">
      <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 0, 8]} fov={50} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1.5} castShadow />
        <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={2} castShadow />
        
        <group position={[0, 0, 0]}>
          <InstrumentalDetails />
          {activeMode === 'hum' && <InstrumentModel type="hum" color={accentColor} />}
          {(activeMode === 'seq' || activeMode === 'keyboard') && <InstrumentModel type="synth" color={accentColor} />}
          {activeMode === 'pads' && <InstrumentModel type="pads" color={accentColor} />}
          {activeMode === 'master' && (
             <Float speed={1} floatIntensity={0.5}>
                <mesh castShadow>
                  <octahedronGeometry args={[2]} />
                  <MeshWobbleMaterial color={accentColor} speed={1} factor={0.6} metalness={0.9} roughness={0.1} />
                </mesh>
             </Float>
          )}
        </group>

        <ContactShadows 
          position={[0, -3.5, 0]} 
          opacity={0.4} 
          scale={20} 
          blur={2} 
          far={4.5} 
        />
        
        <Environment preset="night" />
        <OrbitControls 
          enableZoom={false} 
          enablePan={false} 
          maxPolarAngle={Math.PI / 2} 
          minPolarAngle={Math.PI / 3} 
        />
      </Canvas>
    </div>
  );
};
