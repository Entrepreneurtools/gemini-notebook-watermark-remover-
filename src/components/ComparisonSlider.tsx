/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Columns, Sparkles } from 'lucide-react';

interface ComparisonSliderProps {
  originalCanvas: HTMLCanvasElement | null;
  processedCanvas: HTMLCanvasElement | null;
}

export const ComparisonSlider: React.FC<ComparisonSliderProps> = ({
  originalCanvas,
  processedCanvas,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const origCanvasRef = useRef<HTMLCanvasElement>(null);
  const procCanvasRef = useRef<HTMLCanvasElement>(null);

  const [sliderPos, setSliderPos] = useState<number>(50); // percentage 0 - 100
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Draw original and processed canvases
  useEffect(() => {
    if (!originalCanvas || !processedCanvas) return;

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
  }, [originalCanvas, processedCanvas]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    updateSlider(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    updateSlider(e.clientX);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const updateSlider = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setSliderPos(pos);
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
          <span className="text-slate-400 font-medium ml-2 flex items-center gap-1.5">
            <Columns className="w-3.5 h-3.5 text-indigo-400" />
            Before / After Comparison Split
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-400 font-medium">◀ Original</span>
          <span className="text-slate-600 font-mono">|</span>
          <span className="text-indigo-400 font-semibold">Cleaned Upper-Color Fill ▶</span>
        </div>
      </div>

      {/* Main Slider Viewport */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative w-full h-[520px] overflow-hidden flex items-center justify-center bg-slate-950/90 cursor-ew-resize"
      >
        <div className="relative max-w-full max-h-[480px] aspect-video flex items-center justify-center">
          {/* Base: Cleaned Processed Canvas */}
          <canvas
            ref={procCanvasRef}
            className="block max-w-full max-h-[480px] w-auto h-auto object-contain rounded shadow-2xl border border-slate-800"
          />

          {/* Top Layer: Original Canvas clipped by slider position */}
          <div
            style={{
              clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)`,
            }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <canvas
              ref={origCanvasRef}
              className="block max-w-full max-h-[480px] w-auto h-auto object-contain rounded shadow-2xl border border-slate-800"
            />
          </div>

          {/* Draggable Divider Line & Indigo Glowing Handle */}
          <div
            style={{ left: `${sliderPos}%` }}
            className="absolute top-0 bottom-0 w-0.5 bg-indigo-500 shadow-[0_0_15px_#818cf8] pointer-events-none flex items-center justify-center -translate-x-1/2"
          >
            <div className="w-8 h-8 rounded-full bg-slate-900 border-2 border-indigo-400 shadow-xl flex items-center justify-center text-indigo-300 pointer-events-auto cursor-ew-resize hover:scale-110 active:scale-95 transition-transform">
              <Columns className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Labels Overlay */}
        <div className="absolute top-4 left-4 pointer-events-none px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-700 text-slate-300 text-[11px] font-semibold backdrop-blur-md">
          Original (With Watermark)
        </div>
        <div className="absolute top-4 right-4 pointer-events-none px-3 py-1.5 rounded-full bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 text-[11px] font-semibold backdrop-blur-md flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          Cleaned Result
        </div>
      </div>
    </div>
  );
};
