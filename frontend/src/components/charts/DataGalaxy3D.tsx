"use client";

import React, { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Float } from '@react-three/drei';
import * as THREE from 'three';

// 单个 3D 柱子组件
function Bar({ position, height, color, label }: { position: [number, number, number], height: number, color: string, label: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHover] = useState(false);
  
  // 简单的悬浮动画
  useFrame((state, delta) => {
    if (meshRef.current) {
      const targetScaleY = hovered ? 1.1 : 1;
      meshRef.current.scale.y = THREE.MathUtils.lerp(meshRef.current.scale.y, targetScaleY, 0.1);
    }
  });

  return (
    <group position={position}>
      {/* 柱子本体 */}
      <mesh 
        ref={meshRef} 
        position={[0, height / 2, 0]} 
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[0.8, height, 0.8]} />
        <meshStandardMaterial color={hovered ? '#ffffff' : color} roughness={0.3} metalness={0.5} emissive={color} emissiveIntensity={0.2} />
      </mesh>
      
      {/* 底部标签 */}
      <Text
        position={[0, -0.5, 0.6]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.4}
        color="#888888"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
      
      {/* 顶部数值 */}
      {hovered && (
        <Float speed={5} rotationIntensity={0} floatIntensity={0.5}>
          <Text
            position={[0, height + 0.8, 0]}
            fontSize={0.5}
            color={color}
            anchorX="center"
            anchorY="middle"
          >
            {height.toFixed(1)}
          </Text>
        </Float>
      )}
    </group>
  );
}

// 场景组件
function Scene() {
  const data = [
    { label: 'Q1', value: 4.2, color: '#3B82F6' }, // Blue
    { label: 'Q2', value: 6.8, color: '#10B981' }, // Green
    { label: 'Q3', value: 3.5, color: '#F59E0B' }, // Yellow
    { label: 'Q4', value: 8.4, color: '#EF4444' }, // Red
  ];

  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight position={[10, 20, 10]} intensity={2.5} castShadow />
      <pointLight position={[-10, 10, -10]} intensity={1.5} />
      <hemisphereLight groundColor="#888888" color="#ffffff" intensity={1} />
      
      <group position={[-3, -2, 0]}>
        {data.map((item, index) => (
          <Bar 
            key={item.label}
            position={[index * 2, 0, 0]} 
            height={item.value} 
            color={item.color} 
            label={item.label} 
          />
        ))}
        
        {/* 底座平台 */}
        <mesh position={[3, -0.2, 0]} receiveShadow>
          <boxGeometry args={[9, 0.4, 3]} />
          <meshStandardMaterial color="#888888" opacity={0.2} transparent roughness={0.8} />
        </mesh>
      </group>

      <OrbitControls 
        enablePan={false}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={5}
        maxDistance={20}
      />
    </>
  );
}

export default function DataGalaxy3D() {
  return (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 flex flex-col h-full relative overflow-hidden">
      <div className="absolute top-6 left-6 z-10">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-zinc-100">数据星系 (3D 视图)</h3>
        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">拖拽以旋转视角，悬浮查看数据</p>
      </div>
      
      <div className="flex-1 min-h-[300px] w-full h-full cursor-grab active:cursor-grabbing">
        <Canvas shadows camera={{ position: [0, 5, 12], fov: 45 }}>
          <Scene />
        </Canvas>
      </div>
    </div>
  );
}