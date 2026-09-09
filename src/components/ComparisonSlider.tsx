/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ArrowLeftRight,
  ArrowUpDown,
  Columns,
  Download,
  Eye,
  EyeOff,
  Layers,
  Maximize2,
  RefreshCw,
  RotateCcw,
  Sliders,
  Sparkles,
  Split,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { WatermarkBox } from '../types';

interface ComparisonSliderProps {
  originalCanvas: HTMLCanvasElement | null;
  processedCanvas: HTMLCanvasElement | null;
  watermarkBox?: WatermarkBox;
  onSwitchToEditor?: () => void;
}

type CompareMode = 'slider' | 'side-by-side' | 'hold-flip' | 'diff-blink';

export const ComparisonSlider: React.FC<ComparisonSliderProps> = ({
  originalCanvas,
  processedCanvas,
  watermarkBox,
  onSwitchToEditor,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageWrapperRef = useRef<HTMLDivElement>(null);
  const origCanvasRef = useRef<HTMLCanvasElement>(null);
  const procCanvasRef = useRef<HTMLCanvasElement>(null);

  // Side-by-Side refs
  const sideOrigCanvasRef = useRef<HTMLCanvasElement>(null);
  const sideProcCanvasRef = useRef<HTMLCanvasElement>(null);

  // Compare mode & options
  const [compareMode, setCompareMode] = useState<CompareMode>('slider');
  const [sliderPos, setSliderPos] = useState<number>(50); // percentage 0 - 100
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [isHoldingOriginal, setIsHoldingOriginal] = useState<boolean>(false);
  const [isAutoBlinking, setIsAutoBlinking] = useState<boolean>(false);
  const [blinkPhase, setBlinkPhase] = useState<boolean>(false); // false = cleaned, true = original

  // Zoom & Pan for detailed inspection
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Hover loupe coordinates across both views
  const [hoverCoord, setHoverCoord] = useState<{ x: number; y: number } | null>(null);

  // Draw canvases when source canvases change
  useEffect(() => {
    if (!originalCanvas || !processedCanvas) return;

    // Slider canvases
    const orig = origCanvasRef.current;
    const proc = procCanvasRef.current;

    if (orig && proc) {
      orig.width = originalCanvas.width;
      orig.height = originalCanvas.height;
      proc.width = processedCanvas.width;
      proc.height = processedCanvas.height;

      const origCtx = orig.getContext('2d');
      const procCtx = proc.getContext('2d');

      if (origCtx) origCtx.drawImage(originalCanvas, 0, 0);
      if (procCtx) procCtx.drawImage(processedCanvas, 0, 0);
    }

    // Side-by-side canvases
    const sideOrig = sideOrigCanvasRef.current;
    const sideProc = sideProcCanvasRef.current;
    if (sideOrig && sideProc) {
      sideOrig.width = originalCanvas.width;
      sideOrig.height = originalCanvas.height;
      sideProc.width = processedCanvas.width;
      sideProc.height = processedCanvas.height;

      const sideOrigCtx = sideOrig.getContext('2d');
      const sideProcCtx = sideProc.getContext('2d');

      if (sideOrigCtx) sideOrigCtx.drawImage(originalCanvas, 0, 0);
      if (sideProcCtx) sideProcCtx.drawImage(processedCanvas, 0, 0);
    }
  }, [originalCanvas, processedCanvas, compareMode]);

  // Auto-Blink interval timer
  useEffect(() => {
    if (!isAutoBlinking || compareMode !== 'diff-blink') return;
    const interval = setInterval(() => {
      setBlinkPhase((p) => !p);
    }, 1200);
    return () => clearInterval(interval);
  }, [isAutoBlinking, compareMode]);

  // Keyboard shortcut listener: Spacebar to Hold-to-Compare
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        setIsHoldingOriginal(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsHoldingOriginal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Pointer drag for split slider
  const handlePointerDown = (e: React.PointerEvent) => {
    // If middle click or space held, initiate panning
    if (e.button === 1 || e.shiftKey) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }
    setIsDragging(true);
    updateSlider(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
      return;
    }
    if (!isDragging) return;
    updateSlider(e.clientX, e.clientY);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    setIsPanning(false);
  };

  const updateSlider = (clientX: number, clientY: number) => {
    if (!imageWrapperRef.current) return;
    const rect = imageWrapperRef.current.getBoundingClientRect();
    if (orientation === 'horizontal') {
      const pos = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      setSliderPos(pos);
    } else {
      const pos = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
      setSliderPos(pos);
    }
  };

  // Download high-resolution stitched Before / After comparison image
  const handleDownloadComparisonCollage = useCallback(() => {
    if (!originalCanvas || !processedCanvas) return;

    const w = originalCanvas.width;
    const h = originalCanvas.height;
    const margin = 28;
    const headerH = 70;
    const footerH = 46;

    // Side-by-side stitch
    const collage = document.createElement('canvas');
    collage.width = w * 2 + margin * 3;
    collage.height = h + headerH + footerH + margin * 2;
    const ctx = collage.getContext('2d');
    if (!ctx) return;

    // Dark slate background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, collage.width, collage.height);

    // Top Header title & domain branding
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
    ctx.fillText('Gemini Watermark Remover — Before / After Comparison', margin, 42);

    ctx.fillStyle = '#818cf8';
    ctx.font = '600 15px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('geminiwatermarkremover.itsstudent.com', collage.width - margin, 42);
    ctx.textAlign = 'left';

    // Subheader labels
    const leftX = margin;
    const rightX = w + margin * 2;
    const imageY = headerH + margin;

    // Left card banner: BEFORE (Original)
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(leftX, headerH, 100, 24);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('BEFORE (ORIGINAL)', leftX + 8, headerH + 16);

    // Right card banner: AFTER (Cleaned)
    ctx.fillStyle = '#10b981';
    ctx.fillRect(rightX, headerH, 110, 24);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('AFTER (CLEANED)', rightX + 8, headerH + 16);

    // Draw images
    ctx.drawImage(originalCanvas, leftX, imageY, w, h);
    ctx.drawImage(processedCanvas, rightX, imageY, w, h);

    // Subtle outline around both images
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(leftX, imageY, w, h);
    ctx.strokeRect(rightX, imageY, w, h);

    // Bottom caption
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('Processed locally with seamless upper-color extrapolation and sensor noise synthesis.', margin, collage.height - 18);

    // Trigger download
    const link = document.createElement('a');
    link.download = `before-after-comparison-${Date.now()}.png`;
    link.href = collage.toDataURL('image/png');
    link.click();
  }, [originalCanvas, processedCanvas]);

  return (
    <div className="relative w-full flex flex-col rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl select-none">
      {/* Sleek Top Navigation & Mode Selector Bar */}
      <div className="bg-slate-900 border-b border-slate-700/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Branding & Sub-mode switchers */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 hidden sm:flex">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
            <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
            <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
          </div>

          <div className="flex items-center gap-1.5 text-white font-bold tracking-tight">
            <Columns className="w-4 h-4 text-indigo-400" />
            <span>Before / After Comparison</span>
          </div>

          {/* Sub-mode Pills */}
          <div className="flex items-center bg-slate-950/80 p-0.5 rounded-xl border border-slate-800">
            <button
              id="btn-compare-split-slider"
              type="button"
              onClick={() => setCompareMode('slider')}
              className={`px-3 py-1 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                compareMode === 'slider'
                  ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Split className="w-3.5 h-3.5" />
              <span>Split Wipe</span>
            </button>

            <button
              id="btn-compare-side-by-side"
              type="button"
              onClick={() => setCompareMode('side-by-side')}
              className={`px-3 py-1 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                compareMode === 'side-by-side'
                  ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Side-by-Side</span>
            </button>

            <button
              id="btn-compare-hold-flip"
              type="button"
              onClick={() => setCompareMode('hold-flip')}
              className={`px-3 py-1 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                compareMode === 'hold-flip'
                  ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Hold to Flip</span>
            </button>
          </div>
        </div>

        {/* Center: Slider Presets & Orientation (Visible in slider mode) */}
        {compareMode === 'slider' && (
          <div className="flex items-center gap-2">
            {/* Quick Snap Positions */}
            <div className="flex items-center gap-1 bg-slate-950/70 border border-slate-800 p-0.5 rounded-lg text-[11px]">
              {[
                { label: '0%', val: 0, title: 'Cleaned Only' },
                { label: '25%', val: 25, title: 'Quarter Split' },
                { label: '50%', val: 50, title: 'Equal Split' },
                { label: '75%', val: 75, title: 'Three Quarter' },
                { label: '100%', val: 100, title: 'Original Only' },
              ].map((p) => (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => setSliderPos(p.val)}
                  title={p.title}
                  className={`px-2 py-0.5 rounded font-mono transition-all ${
                    sliderPos === p.val
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Split Orientation Toggle */}
            <button
              type="button"
              onClick={() => setOrientation((o) => (o === 'horizontal' ? 'vertical' : 'horizontal'))}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition-all flex items-center gap-1"
              title={`Switch to ${orientation === 'horizontal' ? 'Vertical (Top/Bottom)' : 'Horizontal (Left/Right)'} split`}
            >
              {orientation === 'horizontal' ? (
                <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-400" />
              ) : (
                <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400" />
              )}
            </button>
          </div>
        )}

        {/* Right: Export Comparison & Zoom Controls */}
        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 p-0.5 rounded-xl">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}
              className="p-1 text-slate-400 hover:text-white rounded"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1 text-[11px] font-mono text-slate-300 min-w-[36px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3.5, z + 0.2))}
              className="p-1 text-slate-400 hover:text-white rounded"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="p-1 text-slate-400 hover:text-white rounded"
              title="Reset Zoom / Pan"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Download Combined Comparison Collage */}
          <button
            id="btn-download-comparison-collage"
            type="button"
            onClick={handleDownloadComparisonCollage}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
            title="Download high-resolution side-by-side comparison image (PNG)"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Save Comparison</span>
          </button>

          {onSwitchToEditor && (
            <button
              type="button"
              onClick={onSwitchToEditor}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700/80 transition-all flex items-center gap-1"
              title="Return to Workspace Editor"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Workspace</span>
            </button>
          )}
        </div>
      </div>

      {/* Primary Comparison Viewport */}
      {compareMode === 'slider' && (
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`relative w-full h-[550px] overflow-hidden flex items-center justify-center bg-slate-950/90 ${
            orientation === 'horizontal' ? 'cursor-ew-resize' : 'cursor-ns-resize'
          }`}
        >
          {/* Exact-fit Image Wrapper */}
          <div
            ref={imageWrapperRef}
            style={{
              transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.05s ease-out',
            }}
            className="relative inline-flex items-center justify-center max-w-full max-h-[500px]"
          >
            {/* Base Layer: Cleaned Inpainted Result */}
            <canvas
              ref={procCanvasRef}
              className="block max-w-full max-h-[500px] w-auto h-auto object-contain rounded-lg shadow-2xl border border-slate-800"
            />

            {/* Top Layer: Original Canvas clipped by slider position */}
            <div
              style={{
                clipPath:
                  orientation === 'horizontal'
                    ? `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)`
                    : `polygon(0 0, 100% 0, 100% ${sliderPos}%, 0 ${sliderPos}%)`,
              }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <canvas
                ref={origCanvasRef}
                className="block max-w-full max-h-[500px] w-auto h-auto object-contain rounded-lg"
              />
            </div>

            {/* Draggable Divider Line & Handle */}
            {orientation === 'horizontal' ? (
              <div
                style={{ left: `${sliderPos}%` }}
                className="absolute top-0 bottom-0 w-0.5 bg-indigo-500 shadow-[0_0_15px_#818cf8] pointer-events-none flex items-center justify-center -translate-x-1/2"
              >
                <div className="w-9 h-9 rounded-full bg-slate-900 border-2 border-indigo-400 shadow-xl flex items-center justify-center text-indigo-300 pointer-events-auto cursor-ew-resize hover:scale-110 active:scale-95 transition-transform">
                  <ArrowLeftRight className="w-4 h-4" />
                </div>
              </div>
            ) : (
              <div
                style={{ top: `${sliderPos}%` }}
                className="absolute left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_15px_#818cf8] pointer-events-none flex items-center justify-center -translate-y-1/2"
              >
                <div className="w-9 h-9 rounded-full bg-slate-900 border-2 border-indigo-400 shadow-xl flex items-center justify-center text-indigo-300 pointer-events-auto cursor-ns-resize hover:scale-110 active:scale-95 transition-transform">
                  <ArrowUpDown className="w-4 h-4" />
                </div>
              </div>
            )}
          </div>

          {/* Floating Pill Badges */}
          <div className="absolute top-4 left-4 pointer-events-none px-3.5 py-1.5 rounded-full bg-slate-900/85 border border-rose-500/40 text-rose-300 text-xs font-semibold backdrop-blur-md shadow-lg flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span>Original (With Watermark)</span>
          </div>
          <div className="absolute top-4 right-4 pointer-events-none px-3.5 py-1.5 rounded-full bg-slate-900/85 border border-emerald-500/40 text-emerald-300 text-xs font-semibold backdrop-blur-md shadow-lg flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Cleaned Result ({Math.round(100 - sliderPos)}% visible)</span>
          </div>

          {/* Bottom Hint */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 backdrop-blur-md">
            Drag divider left/right to compare before and after
          </div>
        </div>
      )}

      {/* Side-by-Side Dual View */}
      {compareMode === 'side-by-side' && (
        <div className="w-full h-[550px] p-4 bg-slate-950/95 overflow-auto flex flex-col md:flex-row items-center justify-center gap-4">
          {/* Left Card: BEFORE */}
          <div className="flex-1 w-full h-full flex flex-col rounded-xl bg-slate-900/70 border border-rose-500/30 overflow-hidden shadow-xl">
            <div className="h-9 px-3 bg-rose-950/30 border-b border-rose-900/40 flex items-center justify-between text-xs font-semibold text-rose-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                BEFORE: Original Image
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-rose-900/40 text-rose-300 font-mono">
                Watermarked
              </span>
            </div>
            <div className="flex-1 flex items-center justify-center p-3 overflow-hidden">
              <canvas
                ref={sideOrigCanvasRef}
                className="max-w-full max-h-full w-auto h-auto object-contain rounded border border-slate-800 shadow-lg"
              />
            </div>
          </div>

          {/* Right Card: AFTER */}
          <div className="flex-1 w-full h-full flex flex-col rounded-xl bg-slate-900/70 border border-emerald-500/30 overflow-hidden shadow-xl">
            <div className="h-9 px-3 bg-emerald-950/30 border-b border-emerald-900/40 flex items-center justify-between text-xs font-semibold text-emerald-300">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                AFTER: Cleaned Result
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-900/40 text-emerald-300 font-mono">
                Inpainted
              </span>
            </div>
            <div className="flex-1 flex items-center justify-center p-3 overflow-hidden">
              <canvas
                ref={sideProcCanvasRef}
                className="max-w-full max-h-full w-auto h-auto object-contain rounded border border-slate-800 shadow-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Hold-to-Compare / Flip Mode */}
      {compareMode === 'hold-flip' && (
        <div className="relative w-full h-[550px] overflow-hidden flex flex-col items-center justify-center bg-slate-950/90 p-4">
          <div className="relative max-w-full max-h-[460px] flex items-center justify-center">
            {isHoldingOriginal ? (
              <canvas
                ref={origCanvasRef}
                className="block max-w-full max-h-[460px] w-auto h-auto object-contain rounded-lg shadow-2xl border-2 border-rose-500/60"
              />
            ) : (
              <canvas
                ref={procCanvasRef}
                className="block max-w-full max-h-[460px] w-auto h-auto object-contain rounded-lg shadow-2xl border-2 border-emerald-500/60"
              />
            )}

            {/* Current State Overlay Badge */}
            <div
              className={`absolute top-4 left-4 px-3.5 py-1.5 rounded-full text-xs font-bold backdrop-blur-md shadow-xl border ${
                isHoldingOriginal
                  ? 'bg-rose-950/80 text-rose-300 border-rose-500/50'
                  : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
              }`}
            >
              {isHoldingOriginal ? '🔴 Showing: ORIGINAL (Watermarked)' : '🟢 Showing: CLEANED (Inpainted)'}
            </div>
          </div>

          {/* Interactive Hold Button & Controls */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              id="btn-hold-to-compare"
              type="button"
              onPointerDown={() => setIsHoldingOriginal(true)}
              onPointerUp={() => setIsHoldingOriginal(false)}
              onPointerLeave={() => setIsHoldingOriginal(false)}
              className={`px-6 py-2.5 rounded-xl font-bold text-xs transition-all shadow-lg select-none flex items-center gap-2 cursor-pointer ${
                isHoldingOriginal
                  ? 'bg-rose-600 text-white scale-95 shadow-rose-600/40'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>{isHoldingOriginal ? 'Viewing Original (Release to Clean)' : 'Press & Hold to View Original'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsHoldingOriginal((h) => !h)}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs border border-slate-700/80 transition-all flex items-center gap-1.5"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-400" />
              <span>Click to Toggle State</span>
            </button>

            <span className="text-[11px] text-slate-400 font-medium">
              Tip: You can also hold <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono text-[10px]">Spacebar</kbd>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

