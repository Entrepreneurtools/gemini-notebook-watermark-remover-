/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Crop,
  Maximize2,
  Minimize2,
  Move,
  Paintbrush,
  RotateCcw,
  Sparkles,
  Target,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { RemovalSettings, WatermarkBox } from '../types';

interface CanvasEditorProps {
  originalCanvas: HTMLCanvasElement | null;
  processedCanvas: HTMLCanvasElement | null;
  watermarkBox: WatermarkBox;
  onWatermarkBoxChange: (box: WatermarkBox) => void;
  settings: RemovalSettings;
  showProcessed: boolean;
  onToggleProcessed: () => void;
  brushMaskCanvas: HTMLCanvasElement | null;
  onBrushMaskChange?: (canvas: HTMLCanvasElement | null) => void;
  isProcessing?: boolean;
  onAutoDetect?: () => void;
}

export const CanvasEditor: React.FC<CanvasEditorProps> = ({
  originalCanvas,
  processedCanvas,
  watermarkBox,
  onWatermarkBoxChange,
  settings,
  showProcessed,
  onToggleProcessed,
  brushMaskCanvas,
  onBrushMaskChange,
  isProcessing = false,
  onAutoDetect,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const brushOverlayRef = useRef<HTMLCanvasElement>(null);

  // Viewport Transform
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Tool Mode
  const [toolMode, setToolMode] = useState<'box' | 'brush' | 'pan'>('box');
  const [brushSize, setBrushSize] = useState<number>(24);
  const [isBrushing, setIsBrushing] = useState<boolean>(false);

  // Box Drag & Resize
  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const dragStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    boxX: number;
    boxY: number;
    boxW: number;
    boxH: number;
  }>({ mouseX: 0, mouseY: 0, boxX: 0, boxY: 0, boxW: 0, boxH: 0 });

  // Calculate scale between display canvas and natural image
  const [scale, setScale] = useState<number>(1);

  // Auto-fit canvas on load
  useEffect(() => {
    if (!containerRef.current || !originalCanvas) return;
    const containerW = containerRef.current.clientWidth;
    const containerH = containerRef.current.clientHeight;

    const fitScale = Math.min(
      (containerW - 40) / originalCanvas.width,
      (containerH - 40) / originalCanvas.height,
      1
    );
    setZoom(fitScale);
    setPan({ x: 0, y: 0 });
  }, [originalCanvas]);

  // Render Display Canvas
  useEffect(() => {
    const canvas = displayCanvasRef.current;
    if (!canvas || !originalCanvas) return;

    canvas.width = originalCanvas.width;
    canvas.height = originalCanvas.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const source = showProcessed && processedCanvas ? processedCanvas : originalCanvas;
    ctx.drawImage(source, 0, 0);
  }, [originalCanvas, processedCanvas, showProcessed]);

  // Handle Box Dragging & Resizing
  const handleMouseDown = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    if (toolMode === 'brush') return;

    setActiveHandle(handle);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      boxX: watermarkBox.x,
      boxY: watermarkBox.y,
      boxW: watermarkBox.width,
      boxH: watermarkBox.height,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: pan.x + (e.clientX - panStartRef.current.x),
        y: pan.y + (e.clientY - panStartRef.current.y),
      });
      panStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (!activeHandle || !originalCanvas) return;

    const dx = (e.clientX - dragStartRef.current.mouseX) / zoom;
    const dy = (e.clientY - dragStartRef.current.mouseY) / zoom;
    const { boxX, boxY, boxW, boxH } = dragStartRef.current;

    let newX = boxX;
    let newY = boxY;
    let newW = boxW;
    let newH = boxH;

    if (activeHandle === 'move') {
      newX = Math.max(0, Math.min(originalCanvas.width - newW, boxX + dx));
      newY = Math.max(0, Math.min(originalCanvas.height - newH, boxY + dy));
    } else if (activeHandle === 'se') {
      newW = Math.max(20, boxW + dx);
      newH = Math.max(15, boxH + dy);
    } else if (activeHandle === 'sw') {
      newX = Math.max(0, boxX + dx);
      newW = Math.max(20, boxW - dx);
      newH = Math.max(15, boxH + dy);
    } else if (activeHandle === 'ne') {
      newY = Math.max(0, boxY + dy);
      newW = Math.max(20, boxW + dx);
      newH = Math.max(15, boxH - dy);
    } else if (activeHandle === 'nw') {
      newX = Math.max(0, boxX + dx);
      newY = Math.max(0, boxY + dy);
      newW = Math.max(20, boxW - dx);
      newH = Math.max(15, boxH - dy);
    } else if (activeHandle === 'n') {
      newY = Math.max(0, boxY + dy);
      newH = Math.max(15, boxH - dy);
    } else if (activeHandle === 's') {
      newH = Math.max(15, boxH + dy);
    } else if (activeHandle === 'w') {
      newX = Math.max(0, boxX + dx);
      newW = Math.max(20, boxW - dx);
    } else if (activeHandle === 'e') {
      newW = Math.max(20, boxW + dx);
    }

    onWatermarkBoxChange({
      ...watermarkBox,
      x: Math.round(newX),
      y: Math.round(newY),
      width: Math.round(newW),
      height: Math.round(newH),
    });
  };

  const handleMouseUp = () => {
    setActiveHandle(null);
    setIsPanning(false);
    setIsBrushing(false);
  };

  // Preset Position Jumpers
  const applyPreset = (preset: 'gemini' | 'bottom-left' | 'top-right' | 'top-left') => {
    if (!originalCanvas) return;
    const w = originalCanvas.width;
    const h = originalCanvas.height;

    switch (preset) {
      case 'gemini':
        // Exactly matches the bottom-right Gemini Notebook pill badge!
        onWatermarkBoxChange({
          id: 'gemini-notebook',
          x: Math.round(w * 0.81),
          y: Math.round(h * 0.90),
          width: Math.round(w * 0.175),
          height: Math.round(h * 0.075),
        });
        break;
      case 'bottom-left':
        onWatermarkBoxChange({
          id: 'bottom-left',
          x: Math.round(w * 0.02),
          y: Math.round(h * 0.90),
          width: Math.round(w * 0.18),
          height: Math.round(h * 0.075),
        });
        break;
      case 'top-right':
        onWatermarkBoxChange({
          id: 'top-right',
          x: Math.round(w * 0.81),
          y: Math.round(h * 0.02),
          width: Math.round(w * 0.175),
          height: Math.round(h * 0.075),
        });
        break;
      case 'top-left':
        onWatermarkBoxChange({
          id: 'top-left',
          x: Math.round(w * 0.02),
          y: Math.round(h * 0.02),
          width: Math.round(w * 0.175),
          height: Math.round(h * 0.075),
        });
        break;
    }
  };

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
          <span className="text-slate-400 font-medium ml-2">
            Local Workspace Canvas • Upper-Color Inpainting
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 font-mono">
            {originalCanvas ? `${originalCanvas.width} × ${originalCanvas.height} px` : ''}
          </span>
        </div>
      </div>

      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-900/60 backdrop-blur-md border-b border-slate-800 text-xs">
        {/* Tool Mode Selection */}
        <div className="flex items-center gap-1.5 bg-slate-800/60 p-1 rounded-xl border border-slate-700/60">
          <button
            id="tool-select-box"
            onClick={() => setToolMode('box')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-all ${
              toolMode === 'box'
                ? 'bg-indigo-600 text-white shadow-md font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Crop className="w-3.5 h-3.5" />
            Area Selection
          </button>
          <button
            id="tool-select-brush"
            onClick={() => setToolMode('brush')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-all ${
              toolMode === 'brush'
                ? 'bg-indigo-600 text-white shadow-md font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Paintbrush className="w-3.5 h-3.5" />
            Manual Healing
          </button>
          <button
            id="tool-select-pan"
            onClick={() => setToolMode('pan')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-all ${
              toolMode === 'pan'
                ? 'bg-indigo-600 text-white shadow-md font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Move className="w-3.5 h-3.5" />
            Pan View
          </button>
        </div>

        {/* Quick Position Presets & Auto-Detect */}
        <div className="flex items-center gap-1.5">
          {onAutoDetect && (
            <button
              id="canvas-auto-detect-btn"
              onClick={onAutoDetect}
              className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all flex items-center gap-1 shadow-sm"
              title="Automatically detect watermark badge in corners"
            >
              <Sparkles className="w-3 h-3" />
              <span>Auto-Detect</span>
            </button>
          )}

          <span className="text-slate-400 font-medium mr-1 flex items-center gap-1">
            <Target className="w-3.5 h-3.5 text-indigo-400" />
            Preset:
          </span>
          <button
            id="preset-gemini-notebook"
            onClick={() => applyPreset('gemini')}
            className="px-2.5 py-1.5 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-medium transition-all flex items-center gap-1"
            title="Snap box to bottom-right corner for Gemini Notebook watermark"
          >
            <Sparkles className="w-3 h-3 text-indigo-400" />
            Gemini Notebook (Bottom-Right)
          </button>
          <button
            id="preset-bottom-left"
            onClick={() => applyPreset('bottom-left')}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-slate-300 font-medium transition-all"
          >
            Bottom-Left
          </button>
          <button
            id="preset-top-right"
            onClick={() => applyPreset('top-right')}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-slate-300 font-medium transition-all"
          >
            Top-Right
          </button>
        </div>

        {/* Zoom and Before/After View */}
        <div className="flex items-center gap-2">
          <button
            id="btn-peek-toggle"
            onClick={onToggleProcessed}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
              showProcessed
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-slate-800 border border-slate-700 text-slate-300'
            }`}
          >
            {showProcessed ? 'Showing: Cleaned' : 'Showing: Original'}
          </button>

          <div className="flex items-center gap-1 bg-slate-800/60 border border-slate-700/60 p-1 rounded-xl">
            <button
              id="btn-zoom-out"
              onClick={() => setZoom((z) => Math.max(0.2, z - 0.15))}
              className="p-1 hover:bg-slate-700 rounded text-slate-300"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 text-[11px] font-mono text-slate-300 min-w-[42px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              id="btn-zoom-in"
              onClick={() => setZoom((z) => Math.min(3.0, z + 0.15))}
              className="p-1 hover:bg-slate-700 rounded text-slate-300"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              id="btn-reset-view"
              onClick={() => {
                if (originalCanvas && containerRef.current) {
                  const fit = Math.min(
                    (containerRef.current.clientWidth - 40) / originalCanvas.width,
                    (containerRef.current.clientHeight - 40) / originalCanvas.height,
                    1
                  );
                  setZoom(fit);
                  setPan({ x: 0, y: 0 });
                }
              }}
              className="p-1 hover:bg-slate-700 rounded text-slate-300"
              title="Reset Zoom / Fit"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`relative w-full h-[520px] overflow-hidden flex items-center justify-center bg-slate-950/90 ${
          toolMode === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        }`}
        onMouseDown={(e) => {
          if (toolMode === 'pan' || e.button === 1) {
            setIsPanning(true);
            panStartRef.current = { x: e.clientX, y: e.clientY };
          }
        }}
      >
        {/* Floating Surface Colors Scanner Pill */}
        <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-full border border-slate-700/80 flex items-center gap-2 shadow-lg pointer-events-none z-10">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">
            Scanning Surface Colors...
          </span>
        </div>

        {/* Canvas & Overlay Container scaled by zoom and pan */}
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isPanning || activeHandle ? 'none' : 'transform 0.12s ease-out',
          }}
          className="relative shadow-2xl inline-block"
        >
          {/* Main Image Canvas */}
          <canvas
            ref={displayCanvasRef}
            className="block max-w-none rounded shadow-2xl border border-slate-800"
          />

          {/* Interactive Watermark Bounding Box Overlay */}
          {originalCanvas && toolMode === 'box' && (
            <div
              style={{
                left: `${watermarkBox.x}px`,
                top: `${watermarkBox.y}px`,
                width: `${watermarkBox.width}px`,
                height: `${watermarkBox.height}px`,
              }}
              className="absolute pointer-events-auto border-2 border-indigo-500 border-dashed rounded-lg bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.25)]"
            >
              {/* Upper Sampling Band Indicator */}
              <div
                style={{
                  top: `-${settings.sampleBandHeight}px`,
                  height: `${settings.sampleBandHeight}px`,
                  left: 0,
                  width: '100%',
                }}
                className="absolute border border-dashed border-cyan-400 bg-cyan-500/15 pointer-events-none flex items-center justify-center overflow-hidden"
              >
                <span className="text-[9px] font-bold text-cyan-300 uppercase tracking-widest px-1 bg-slate-950/80 rounded">
                  ▲ Upper Color Sample ({settings.sampleBandHeight}px)
                </span>
              </div>

              {/* Tag Label */}
              <div className="absolute -top-6 left-0 bg-indigo-500 text-white text-[9px] font-semibold px-2 py-0.5 rounded shadow">
                Selected: Logo Removal
              </div>

              {/* Move Draggable Area */}
              <div
                onMouseDown={(e) => handleMouseDown(e, 'move')}
                className="absolute inset-0 cursor-move flex items-center justify-center group"
              >
                <div className="px-2 py-1 bg-slate-900/90 text-indigo-300 text-[11px] font-semibold rounded-md border border-indigo-500/40 shadow flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                  <Crop className="w-3 h-3 text-indigo-400" />
                  Watermark Target ({watermarkBox.width} × {watermarkBox.height})
                </div>
              </div>

              {/* 8-Direction Resizing Handles */}
              {/* Corners */}
              <div
                onMouseDown={(e) => handleMouseDown(e, 'nw')}
                className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-indigo-400 border-2 border-slate-950 rounded-sm cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
              />
              <div
                onMouseDown={(e) => handleMouseDown(e, 'ne')}
                className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-indigo-400 border-2 border-slate-950 rounded-sm cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
              />
              <div
                onMouseDown={(e) => handleMouseDown(e, 'sw')}
                className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-indigo-400 border-2 border-slate-950 rounded-sm cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
              />
              <div
                onMouseDown={(e) => handleMouseDown(e, 'se')}
                className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-indigo-400 border-2 border-slate-950 rounded-sm cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
              />

              {/* Edge Centers */}
              <div
                onMouseDown={(e) => handleMouseDown(e, 'n')}
                className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-2 bg-indigo-400 border border-slate-950 rounded cursor-ns-resize"
              />
              <div
                onMouseDown={(e) => handleMouseDown(e, 's')}
                className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-2 bg-indigo-400 border border-slate-950 rounded cursor-ns-resize"
              />
              <div
                onMouseDown={(e) => handleMouseDown(e, 'w')}
                className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-2 h-4 bg-indigo-400 border border-slate-950 rounded cursor-ew-resize"
              />
              <div
                onMouseDown={(e) => handleMouseDown(e, 'e')}
                className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-2 h-4 bg-indigo-400 border border-slate-950 rounded cursor-ew-resize"
              />
            </div>
          )}

          {/* Processing Laser Scan Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-indigo-500/10 pointer-events-none overflow-hidden">
              <div className="w-full h-1 bg-gradient-to-r from-transparent via-indigo-400 to-transparent animate-pulse shadow-[0_0_20px_#818cf8]" />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Status Info Bar */}
      <div className="px-4 py-2 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-4">
          <span>
            Canvas Resolution:{' '}
            <strong className="text-slate-200">
              {originalCanvas ? `${originalCanvas.width} × ${originalCanvas.height} px` : '—'}
            </strong>
          </span>
          <span>
            Watermark Box:{' '}
            <strong className="text-emerald-400">
              x: {watermarkBox.x}, y: {watermarkBox.y}, {watermarkBox.width} × {watermarkBox.height} px
            </strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
          <span>Upper color sampling band: {settings.sampleBandHeight}px directly above badge</span>
        </div>
      </div>
    </div>
  );
};
