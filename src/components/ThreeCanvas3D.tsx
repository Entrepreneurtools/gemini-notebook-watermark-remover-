/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Eye, Layers, RotateCcw, ScanLine, Sparkles } from 'lucide-react';
import { WatermarkBox } from '../types';

interface ThreeCanvas3DProps {
  originalCanvas: HTMLCanvasElement | null;
  processedCanvas: HTMLCanvasElement | null;
  watermarkBox: WatermarkBox;
  isProcessing?: boolean;
}

export const ThreeCanvas3D: React.FC<ThreeCanvas3DProps> = ({
  originalCanvas,
  processedCanvas,
  watermarkBox,
  isProcessing = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [exploded, setExploded] = useState(false);
  const [showProcessed, setShowProcessed] = useState(true);
  const [enableScanline, setEnableScanline] = useState(true);

  // References to keep track of Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const baseMeshRef = useRef<THREE.Mesh | null>(null);
  const watermarkMeshRef = useRef<THREE.Mesh | null>(null);
  const laserLineRef = useRef<THREE.Line | null>(null);
  const origTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const procTextureRef = useRef<THREE.CanvasTexture | null>(null);

  // Mouse tilt tracking
  const targetRotation = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const currentRotation = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 550;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 4.5);

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x22c55e, 2.5, 10);
    pointLight.position.set(2, 2, 3);
    scene.add(pointLight);

    const cyanLight = new THREE.PointLight(0x0ea5e9, 2.0, 10);
    cyanLight.position.set(-2, -2, 2);
    scene.add(cyanLight);

    // 5. Ambient Cyber Particle Grid (Floating Tech Dust)
    const particleCount = 200;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 4;

      const isGreen = Math.random() > 0.5;
      colors[i * 3] = isGreen ? 0.13 : 0.05;
      colors[i * 3 + 1] = isGreen ? 0.77 : 0.65;
      colors[i * 3 + 2] = isGreen ? 0.37 : 0.91;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.04,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
    });
    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particleSystem);

    // 6. Holographic Card Mesh
    const imgAspect = originalCanvas ? originalCanvas.width / originalCanvas.height : 16 / 9;
    const planeHeight = 2.0;
    const planeWidth = planeHeight * imgAspect;
    const cardGeometry = new THREE.PlaneGeometry(planeWidth, planeHeight, 32, 32);

    // Textures
    const displayCanvas = (showProcessed && processedCanvas) ? processedCanvas : (originalCanvas || document.createElement('canvas'));
    const texture = new THREE.CanvasTexture(displayCanvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    origTextureRef.current = texture;

    const cardMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.25,
      metalness: 0.15,
      side: THREE.DoubleSide,
    });

    const baseMesh = new THREE.Mesh(cardGeometry, cardMaterial);
    scene.add(baseMesh);
    baseMeshRef.current = baseMesh;

    // Glowing rim frame
    const frameGeo = new THREE.EdgesGeometry(cardGeometry);
    const frameMat = new THREE.LineBasicMaterial({ color: 0x22c55e, linewidth: 2, transparent: true, opacity: 0.75 });
    const frameWire = new THREE.LineSegments(frameGeo, frameMat);
    baseMesh.add(frameWire);

    // 7. Holographic Laser Scanline
    const laserMat = new THREE.LineBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.9 });
    const laserPoints = [
      new THREE.Vector3(-planeWidth / 2, 0, 0.02),
      new THREE.Vector3(planeWidth / 2, 0, 0.02),
    ];
    const laserGeo = new THREE.BufferGeometry().setFromPoints(laserPoints);
    const laserLine = new THREE.Line(laserGeo, laserMat);
    baseMesh.add(laserLine);
    laserLineRef.current = laserLine;

    // 8. Watermark Exploded Tag Mesh
    if (originalCanvas && watermarkBox.width > 0) {
      const normW = (watermarkBox.width / originalCanvas.width) * planeWidth;
      const normH = (watermarkBox.height / originalCanvas.height) * planeHeight;
      const wmGeo = new THREE.PlaneGeometry(normW, normH);

      // Create cropped watermark canvas
      const wmCanvas = document.createElement('canvas');
      wmCanvas.width = Math.max(10, watermarkBox.width);
      wmCanvas.height = Math.max(10, watermarkBox.height);
      const wmCtx = wmCanvas.getContext('2d');
      if (wmCtx && originalCanvas) {
        wmCtx.drawImage(
          originalCanvas,
          watermarkBox.x,
          watermarkBox.y,
          watermarkBox.width,
          watermarkBox.height,
          0,
          0,
          wmCanvas.width,
          wmCanvas.height
        );
      }
      const wmTex = new THREE.CanvasTexture(wmCanvas);
      const wmMat = new THREE.MeshBasicMaterial({
        map: wmTex,
        transparent: true,
        opacity: 0.95,
      });

      const wmMesh = new THREE.Mesh(wmGeo, wmMat);
      // Position relative to base mesh center
      const posX = ((watermarkBox.x + watermarkBox.width / 2) / originalCanvas.width - 0.5) * planeWidth;
      const posY = (0.5 - (watermarkBox.y + watermarkBox.height / 2) / originalCanvas.height) * planeHeight;
      wmMesh.position.set(posX, posY, 0.03);

      const wmBoxWire = new THREE.LineSegments(
        new THREE.EdgesGeometry(wmGeo),
        new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 2 })
      );
      wmMesh.add(wmBoxWire);

      baseMesh.add(wmMesh);
      watermarkMeshRef.current = wmMesh;
    }

    // Mouse move tilt handler
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetRotation.current = {
        x: y * 0.45,
        y: x * 0.55,
      };
    };

    const handleMouseLeave = () => {
      targetRotation.current = { x: 0, y: 0 };
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth camera/mesh tilt damping
      currentRotation.current.x += (targetRotation.current.x - currentRotation.current.y * 0.05 - currentRotation.current.x) * 0.08;
      currentRotation.current.y += (targetRotation.current.y - currentRotation.current.y) * 0.08;

      if (baseMeshRef.current) {
        baseMeshRef.current.rotation.x = currentRotation.current.x;
        baseMeshRef.current.rotation.y = currentRotation.current.y;
      }

      // Laser scan sweep
      if (laserLineRef.current && enableScanline) {
        const sweepY = Math.sin(elapsedTime * 2.2) * (planeHeight / 2);
        laserLineRef.current.position.y = sweepY;
        laserLineRef.current.visible = true;
      } else if (laserLineRef.current) {
        laserLineRef.current.visible = false;
      }

      // Rotate particle cloud gently
      particleSystem.rotation.y = elapsedTime * 0.03;
      particleSystem.rotation.x = Math.sin(elapsedTime * 0.02) * 0.05;

      renderer.render(scene, camera);
    };

    animate();

    // Resize observer
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      renderer.dispose();
    };
  }, [originalCanvas, showProcessed, processedCanvas, watermarkBox, enableScanline]);

  // Handle Explode Animation on Watermark Mesh
  useEffect(() => {
    if (!watermarkMeshRef.current) return;
    const targetZ = exploded ? 0.45 : 0.03;
    const targetScale = exploded ? 1.08 : 1.0;

    watermarkMeshRef.current.position.z = targetZ;
    watermarkMeshRef.current.scale.set(targetScale, targetScale, targetScale);
    watermarkMeshRef.current.visible = !showProcessed || exploded;
  }, [exploded, showProcessed]);

  return (
    <div className="relative w-full flex flex-col rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl select-none">
      {/* Sleek Window Header Bar */}
      <div className="h-10 bg-slate-900 border-b border-slate-700/80 flex items-center px-4 justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-slate-700 hover:bg-rose-500 transition-colors" />
            <div className="w-3 h-3 rounded-full bg-slate-700 hover:bg-amber-500 transition-colors" />
            <div className="w-3 h-3 rounded-full bg-slate-700 hover:bg-emerald-500 transition-colors" />
          </div>
          <span className="text-slate-400 font-medium ml-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            3D Hologram Stage • Perspective Inspection
          </span>
        </div>

        <div className="flex items-center gap-2 text-slate-400 font-medium">
          <span className="text-[11px]">WebGL 3D Accelerated</span>
        </div>
      </div>

      <div className="relative w-full h-[500px] overflow-hidden bg-slate-950 flex items-center justify-center">
        {/* 3D WebGL Canvas */}
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Floating 3D HUD Controls */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 p-1.5 rounded-xl text-xs text-slate-200">
          <button
            id="btn-3d-toggle-processed"
            onClick={() => setShowProcessed(!showProcessed)}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all font-medium ${
              showProcessed
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-semibold'
                : 'hover:bg-slate-800 text-slate-400'
            }`}
            title="Toggle Cleaned vs Original View"
          >
            <Eye className="w-3.5 h-3.5" />
            {showProcessed ? 'Showing: Cleaned' : 'Showing: Original'}
          </button>

          <button
            id="btn-3d-toggle-explode"
            onClick={() => setExploded(!exploded)}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all font-medium ${
              exploded
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
                : 'hover:bg-slate-800 text-slate-400'
            }`}
            title="Explode watermark layer along Z-axis in 3D"
          >
            <Layers className="w-3.5 h-3.5" />
            {exploded ? '3D Explode: ON' : '3D Explode: OFF'}
          </button>

          <button
            id="btn-3d-toggle-scanline"
            onClick={() => setEnableScanline(!enableScanline)}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all font-medium ${
              enableScanline
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
                : 'hover:bg-slate-800 text-slate-400'
            }`}
            title="Toggle Holographic Laser Scanline"
          >
            <ScanLine className="w-3.5 h-3.5" />
            Laser Beam
          </button>
        </div>

        {/* Tilt Hint in Bottom */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-3.5 py-1.5 bg-slate-900/80 backdrop-blur-md rounded-full border border-slate-700/60 text-[11px] text-slate-300 flex items-center gap-2 pointer-events-none shadow-lg">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
          <span>Move mouse to tilt 3D card • Seamless upper-color fill</span>
        </div>
      </div>
    </div>
  );
};
