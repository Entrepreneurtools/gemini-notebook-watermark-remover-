/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Check,
  Crop,
  Eraser,
  Eye,
  EyeOff,
  Move,
  Paintbrush,
  RotateCcw,
  Sparkles,
  Target,
  Trash2,
  Wand2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { RemovalSettings, WatermarkBox } from '../types';
import { hasMaskPixels } from '../lib/watermarkEngine';

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
  onApplyRemoval?: () => void;
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
  onApplyRemoval,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const brushOverlayRef = useRef<HTMLCanvasElement>(null);
  const internalMaskRef = useRef<HTMLCanvasElement | null>(null);

  // Viewport Transform
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Tool Mode & Eraser Brush Settings
  const [toolMode, setToolMode] = useState<'box' | 'brush' | 'pan'>('box');
  const [brushSize, setBrushSize] = useState<number>(28);
  const [brushAction, setBrushAction] = useState<'paint' | 'unmask'>('paint');
  const [autoInpaint, setAutoInpaint] = useState<boolean>(true);
  const [showMaskOverlay, setShowMaskOverlay] = useState<boolean>(true);
  const [isBrushing, setIsBrushing] = useState<boolean>(false);
  const [hasBrushStrokes, setHasBrushStrokes] = useState<boolean>(false);

  // Undo History for Brush Strokes (stores canvas image snapshots)
  const [undoStack, setUndoStack] = useState<ImageData[]>([]);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Visual Cursor Ring Indicator
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [isCursorInside, setIsCursorInside] = useState<boolean>(false);

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

  // Sync internal mask canvas size with original canvas
  useEffect(() => {
    if (!originalCanvas) return;
    if (!internalMaskRef.current) {
      internalMaskRef.current = document.createElement('canvas');
    }
    const mask = internalMaskRef.current;
    if (mask.width !== originalCanvas.width || mask.height !== originalCanvas.height) {
      mask.width = originalCanvas.width;
      mask.height = originalCanvas.height;
      const ctx = mask.getContext('2d', { willReadFrequently: true });
      if (ctx) ctx.clearRect(0, 0, mask.width, mask.height);
      setUndoStack([]);
      setHasBrushStrokes(false);
    }
  }, [originalCanvas]);

  // If parent provided an existing brushMaskCanvas, sync it
  useEffect(() => {
    if (brushMaskCanvas && internalMaskRef.current) {
      const mask = internalMaskRef.current;
      const ctx = mask.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.clearRect(0, 0, mask.width, mask.height);
        ctx.drawImage(brushMaskCanvas, 0, 0);
        setHasBrushStrokes(hasMaskPixels(mask));
        renderOverlay();
      }
    }
  }, [brushMaskCanvas]);

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

  // Redraw the visible brush highlight overlay
  const renderOverlay = useCallback(() => {
    const overlay = brushOverlayRef.current;
    const mask = internalMaskRef.current;
    if (!overlay || !mask) return;

    overlay.width = mask.width;
    overlay.height = mask.height;

    const oCtx = overlay.getContext('2d');
    if (!oCtx) return;

    oCtx.clearRect(0, 0, overlay.width, overlay.height);

    // Draw translucent vibrant coral/ruby highlight over masked pixels
    oCtx.save();
    oCtx.globalAlpha = 0.55;
    oCtx.drawImage(mask, 0, 0);
    oCtx.restore();
  }, []);

  // Map client screen coordinate to original natural image coordinate
  const getCanvasPoint = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const displayCanvas = displayCanvasRef.current;
    if (!displayCanvas || !originalCanvas) return null;
    const rect = displayCanvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const scaleX = originalCanvas.width / rect.width;
    const scaleY = originalCanvas.height / rect.height;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    return {
      x: Math.max(0, Math.min(originalCanvas.width, x)),
      y: Math.max(0, Math.min(originalCanvas.height, y)),
    };
  };

  // Push current mask state to undo stack
  const saveToUndoStack = () => {
    const mask = internalMaskRef.current;
    if (!mask) return;
    const ctx = mask.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    try {
      const snap = ctx.getImageData(0, 0, mask.width, mask.height);
      setUndoStack((prev) => [...prev.slice(-12), snap]);
    } catch (e) {
      console.warn('Mask snapshot save error:', e);
    }
  };

  // Undo last brush stroke
  const handleUndoStroke = () => {
    const mask = internalMaskRef.current;
    if (!mask || undoStack.length === 0) return;

    const nextStack = [...undoStack];
    const prevSnapshot = nextStack.pop();
    setUndoStack(nextStack);

    const ctx = mask.getContext('2d', { willReadFrequently: true });
    if (ctx && prevSnapshot) {
      ctx.putImageData(prevSnapshot, 0, 0);
      renderOverlay();
      const hasPixels = hasMaskPixels(mask);
      setHasBrushStrokes(hasPixels);
      onBrushMaskChange?.(hasPixels ? mask : null);
      if (autoInpaint && onApplyRemoval) {
        onApplyRemoval();
      }
    }
  };

  // Clear all painted brush strokes
  const handleClearBrushMask = () => {
    const mask = internalMaskRef.current;
    if (!mask) return;
    saveToUndoStack();

    const ctx = mask.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.clearRect(0, 0, mask.width, mask.height);
    }
    renderOverlay();
    setHasBrushStrokes(false);
    onBrushMaskChange?.(null);
    if (autoInpaint && onApplyRemoval) {
      onApplyRemoval();
    }
  };

  // Start brush stroke
  const startBrushStroke = (clientX: number, clientY: number) => {
    const pt = getCanvasPoint(clientX, clientY);
    if (!pt || !internalMaskRef.current) return;

    saveToUndoStack();
    setIsBrushing(true);
    lastPointRef.current = pt;

    const ctx = internalMaskRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    if (brushAction === 'paint') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#EF4444'; // Ruby red
      ctx.strokeStyle = '#EF4444';
    } else {
      ctx.globalCompositeOperation = 'destination-out';
    }

    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw initial round dot
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();

    renderOverlay();
  };

  // Continue brush stroke
  const continueBrushStroke = (clientX: number, clientY: number) => {
    if (!isBrushing || !internalMaskRef.current || !lastPointRef.current) return;
    const pt = getCanvasPoint(clientX, clientY);
    if (!pt) return;

    const ctx = internalMaskRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    if (brushAction === 'paint') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#EF4444';
      ctx.strokeStyle = '#EF4444';
    } else {
      ctx.globalCompositeOperation = 'destination-out';
    }

    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();

    lastPointRef.current = pt;
    renderOverlay();
  };

  // Finish brush stroke
  const endBrushStroke = () => {
    if (!isBrushing) return;
    setIsBrushing(false);
    lastPointRef.current = null;

    const mask = internalMaskRef.current;
    if (!mask) return;

    const hasPixels = hasMaskPixels(mask);
    setHasBrushStrokes(hasPixels);
    onBrushMaskChange?.(hasPixels ? mask : null);

    if (autoInpaint && hasPixels && onApplyRemoval) {
      onApplyRemoval();
    }
  };

  // Handle Box Dragging & Resizing
  const handleMouseDown = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    if (toolMode !== 'box') return;

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

  // Global mouse move on container
  const handleContainerMouseMove = (e: React.MouseEvent) => {
    // Update cursor position inside container for circular brush ring
    if (containerRef.current) {
      const cRect = containerRef.current.getBoundingClientRect();
      setCursorPos({
        x: e.clientX - cRect.left,
        y: e.clientY - cRect.top,
      });
    }

    if (isPanning) {
      setPan({
        x: pan.x + (e.clientX - panStartRef.current.x),
        y: pan.y + (e.clientY - panStartRef.current.y),
      });
      panStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (toolMode === 'brush' && isBrushing) {
      continueBrushStroke(e.clientX, e.clientY);
      return;
    }

    if (!activeHandle || !originalCanvas || toolMode !== 'box') return;

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

  const handleContainerMouseUp = () => {
    if (isBrushing) {
      endBrushStroke();
    }
    setActiveHandle(null);
    setIsPanning(false);
  };

  // Preset Position Jumpers
  const applyPreset = (preset: 'gemini' | 'bottom-left' | 'top-right' | 'top-left') => {
    if (!originalCanvas) return;
    const w = originalCanvas.width;
    const h = originalCanvas.height;

    switch (preset) {
      case 'gemini':
        onWatermarkBoxChange({
          id: 'gemini-notebook',
          x: Math.max(0, w - 240),
          y: Math.max(0, h - 80),
          width: Math.min(235, w),
          height: Math.min(75, h),
        });
        break;
      case 'bottom-left':
        onWatermarkBoxChange({
          id: 'bottom-left',
          x: 10,
          y: Math.max(0, h - 80),
          width: Math.min(220, w - 20),
          height: Math.min(70, h),
        });
        break;
      case 'top-right':
        onWatermarkBoxChange({
          id: 'top-right',
          x: Math.max(0, w - 240),
          y: 10,
          width: Math.min(230, w - 10),
          height: Math.min(70, h),
        });
        break;
      case 'top-left':
        onWatermarkBoxChange({
          id: 'top-left',
          x: 10,
          y: 10,
          width: Math.min(220, w - 20),
          height: Math.min(70, h),
        });
        break;
    }
  };

  return (
    <div className="flex flex-col rounded-2xl bg-slate-900/40 backdrop-blur-md border border-slate-800 overflow-hidden shadow-2xl">
      {/* Top Titlebar */}
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

      {/* Primary Tool Mode Toolbar */}
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
            title="Bounding Box Selection Tool"
          >
            <Crop className="w-3.5 h-3.5" />
            <span>Box Zone</span>
          </button>

          <button
            id="tool-select-brush"
            onClick={() => setToolMode('brush')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-all relative ${
              toolMode === 'brush'
                ? 'bg-rose-600 text-white shadow-md font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
            title="Free-Form Eraser Brush: Paint directly over arbitrary watermark shapes"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Eraser Brush</span>
            {hasBrushStrokes && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping absolute -top-0.5 -right-0.5" />
            )}
          </button>

          <button
            id="tool-select-pan"
            onClick={() => setToolMode('pan')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-all ${
              toolMode === 'pan'
                ? 'bg-indigo-600 text-white shadow-md font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
            title="Pan and Zoom Viewport"
          >
            <Move className="w-3.5 h-3.5" />
            <span>Pan View</span>
          </button>
        </div>

        {/* Conditional Controls depending on tool mode */}
        {toolMode === 'box' ? (
          /* Quick Position Presets & Auto-Detect for Box Mode */
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

            <span className="text-slate-400 font-medium mr-1 flex items-center gap-1 hidden sm:inline-flex">
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
              Gemini Badge
            </button>
            <button
              id="preset-bottom-left"
              onClick={() => applyPreset('bottom-left')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-slate-300 font-medium transition-all hidden md:block"
            >
              Bottom-Left
            </button>
          </div>
        ) : toolMode === 'brush' ? (
          /* Inline Brush Actions */
          <div className="flex items-center gap-1.5">
            <button
              id="btn-undo-brush"
              onClick={handleUndoStroke}
              disabled={undoStack.length === 0}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 font-medium transition-all flex items-center gap-1 border border-slate-700/80"
              title="Undo last painted brush stroke"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Undo</span>
            </button>

            <button
              id="btn-clear-brush"
              onClick={handleClearBrushMask}
              disabled={!hasBrushStrokes}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-950/40 disabled:opacity-40 text-rose-300 hover:text-rose-200 border border-rose-900/30 font-medium transition-all flex items-center gap-1"
              title="Clear all painted brush strokes"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Clear Mask</span>
            </button>

            {onApplyRemoval && (
              <button
                id="btn-inpaint-brush-now"
                onClick={onApplyRemoval}
                disabled={isProcessing}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition-all flex items-center gap-1 shadow-md shadow-rose-600/30"
                title="Execute inpainting on the painted area"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Erase Painted Area</span>
              </button>
            )}
          </div>
        ) : null}

        {/* Zoom and Clean/Original Toggle */}
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

      {/* Secondary Eraser Brush Fine-Tuning Bar (Active when Eraser Brush tool is chosen) */}
      {toolMode === 'brush' && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-rose-950/20 border-b border-rose-900/30 text-xs animate-in fade-in duration-150">
          {/* Brush Size Slider & Presets */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-slate-300 font-semibold flex items-center gap-1">
                <Paintbrush className="w-3.5 h-3.5 text-rose-400" />
                Brush Size:
              </span>
              <input
                id="brush-size-slider"
                type="range"
                min="8"
                max="100"
                step="2"
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
                className="w-28 accent-rose-500 cursor-pointer"
              />
              <span className="font-mono text-rose-300 bg-rose-950/60 border border-rose-800/40 px-2 py-0.5 rounded text-[11px] min-w-[36px] text-center">
                {brushSize}px
              </span>
            </div>

            {/* Quick Size Presets */}
            <div className="flex items-center gap-1">
              {[
                { label: 'Fine', size: 14 },
                { label: 'Medium', size: 28 },
                { label: 'Large', size: 48 },
                { label: 'Jumbo', size: 72 },
              ].map((p) => (
                <button
                  key={p.label}
                  onClick={() => setBrushSize(p.size)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${
                    brushSize === p.size
                      ? 'bg-rose-600 text-white border-rose-500 font-semibold'
                      : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mode (Paint vs Unmask), Auto-inpaint Toggle, & Mask Visibility */}
          <div className="flex items-center gap-3">
            {/* Draw vs Erase Mask Toggle */}
            <div className="flex items-center bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/70">
              <button
                id="brush-mode-paint"
                onClick={() => setBrushAction('paint')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all flex items-center gap-1 ${
                  brushAction === 'paint'
                    ? 'bg-rose-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Paint over watermark to erase"
              >
                <Paintbrush className="w-3 h-3" />
                <span>Mark Watermark</span>
              </button>
              <button
                id="brush-mode-unmask"
                onClick={() => setBrushAction('unmask')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all flex items-center gap-1 ${
                  brushAction === 'unmask'
                    ? 'bg-slate-700 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Erase mask if you over-painted"
              >
                <Eraser className="w-3 h-3" />
                <span>Erase Mask</span>
              </button>
            </div>

            {/* Live Inpaint Checkbox */}
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-300">
              <input
                id="checkbox-auto-inpaint"
                type="checkbox"
                checked={autoInpaint}
                onChange={(e) => setAutoInpaint(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-rose-500 cursor-pointer"
              />
              <span className="text-[11px]">Live Inpaint on Release</span>
            </label>

            {/* Mask Overlay Visibility Toggle */}
            <button
              id="btn-toggle-mask-overlay"
              onClick={() => setShowMaskOverlay(!showMaskOverlay)}
              className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] flex items-center gap-1"
              title="Toggle visibility of the painted rose mask highlight"
            >
              {showMaskOverlay ? (
                <>
                  <Eye className="w-3 h-3 text-rose-400" />
                  <span>Mask Visible</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3 h-3 text-slate-400" />
                  <span>Mask Hidden</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Main Canvas Viewport */}
      <div
        ref={containerRef}
        onMouseMove={handleContainerMouseMove}
        onMouseUp={handleContainerMouseUp}
        onMouseLeave={() => {
          handleContainerMouseUp();
          setIsCursorInside(false);
        }}
        onMouseEnter={() => setIsCursorInside(true)}
        className={`relative w-full h-[520px] overflow-hidden flex items-center justify-center bg-slate-950/90 select-none ${
          toolMode === 'pan'
            ? 'cursor-grab active:cursor-grabbing'
            : toolMode === 'brush'
            ? 'cursor-crosshair'
            : 'cursor-default'
        }`}
        onMouseDown={(e) => {
          if (toolMode === 'pan' || e.button === 1) {
            setIsPanning(true);
            panStartRef.current = { x: e.clientX, y: e.clientY };
          }
        }}
      >
        {/* Floating Scanner / Brush Status Badge */}
        <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-full border border-slate-700/80 flex items-center gap-2 shadow-lg pointer-events-none z-20">
          <div
            className={`w-2 h-2 rounded-full ${
              toolMode === 'brush' ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500 animate-pulse'
            }`}
          />
          <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">
            {toolMode === 'brush'
              ? `Eraser Brush Active (${brushSize}px)`
              : 'Scanning Surface Colors...'}
          </span>
        </div>

        {/* Circular Brush Ring Cursor following mouse position */}
        {toolMode === 'brush' && isCursorInside && cursorPos && (
          <div
            style={{
              left: `${cursorPos.x}px`,
              top: `${cursorPos.y}px`,
              width: `${brushSize * zoom}px`,
              height: `${brushSize * zoom}px`,
              transform: 'translate(-50%, -50%)',
            }}
            className="pointer-events-none absolute rounded-full border border-white/90 shadow-[0_0_4px_rgba(0,0,0,0.8),inset_0_0_2px_rgba(239,68,68,0.7)] z-30"
          >
            {/* Center crosshair dot */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-white rounded-full" />
          </div>
        )}

        {/* Canvas & Overlay Container scaled by zoom and pan */}
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isPanning || activeHandle || isBrushing ? 'none' : 'transform 0.12s ease-out',
          }}
          className="relative shadow-2xl inline-block"
        >
          {/* Main Image Canvas */}
          <canvas
            ref={displayCanvasRef}
            className="block max-w-none rounded shadow-2xl border border-slate-800"
          />

          {/* Visible Painted Brush Mask Overlay */}
          <canvas
            ref={brushOverlayRef}
            className="absolute inset-0 pointer-events-none rounded"
            style={{
              opacity: showMaskOverlay ? 0.75 : 0,
              display: showMaskOverlay ? 'block' : 'none',
            }}
          />

          {/* Interactive Brush Surface Listener (only intercepts mouse in brush mode) */}
          {toolMode === 'brush' && (
            <div
              className="absolute inset-0 z-10 cursor-crosshair"
              onMouseDown={(e) => {
                if (e.button === 0) {
                  e.preventDefault();
                  startBrushStroke(e.clientX, e.clientY);
                }
              }}
              onTouchStart={(e) => {
                if (e.touches.length === 1) {
                  const touch = e.touches[0];
                  startBrushStroke(touch.clientX, touch.clientY);
                }
              }}
              onTouchMove={(e) => {
                if (e.touches.length === 1) {
                  const touch = e.touches[0];
                  continueBrushStroke(touch.clientX, touch.clientY);
                }
              }}
              onTouchEnd={() => {
                endBrushStroke();
              }}
            />
          )}

          {/* Interactive Watermark Bounding Box Overlay (Active in Box Mode) */}
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
      <div className="px-4 py-2 bg-slate-900/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <div className="flex items-center gap-4">
          <span>
            Canvas:{' '}
            <strong className="text-slate-200">
              {originalCanvas ? `${originalCanvas.width} × ${originalCanvas.height} px` : '—'}
            </strong>
          </span>
          {toolMode === 'brush' ? (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
              <span>
                Eraser Brush Size: <strong className="text-rose-300">{brushSize}px</strong>
              </span>
              {hasBrushStrokes ? (
                <span className="text-amber-400 font-semibold">• Mask Painted</span>
              ) : (
                <span className="text-slate-500">• Paint over any watermark</span>
              )}
            </span>
          ) : (
            <span>
              Box Zone:{' '}
              <strong className="text-emerald-400">
                x: {watermarkBox.x}, y: {watermarkBox.y}, {watermarkBox.width} × {watermarkBox.height} px
              </strong>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
          <span>Upper color extrapolation: seamless background reconstruction without blur</span>
        </div>
      </div>
    </div>
  );
};
