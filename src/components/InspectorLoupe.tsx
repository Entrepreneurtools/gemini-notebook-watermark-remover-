/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Search, Sliders, Sparkles } from 'lucide-react';
import { WatermarkBox } from '../types';

interface InspectorLoupeProps {
  originalCanvas: HTMLCanvasElement | null;
  processedCanvas: HTMLCanvasElement | null;
  watermarkBox: WatermarkBox;
}

export const InspectorLoupe: React.FC<InspectorLoupeProps> = ({
  originalCanvas,
  processedCanvas,
  watermarkBox,
}) => {
  const origLoupeCanvasRef = useRef<HTMLCanvasElement>(null);
  const procLoupeCanvasRef = useRef<HTMLCanvasElement>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(3); // 2x, 3x, 4x
  const [activeTab, setActiveTab] = useState<'processed' | 'original' | 'both'>('both');

  useEffect(() => {
    if (!originalCanvas || !processedCanvas || watermarkBox.width <= 0) return;

    // Crop the watermark region plus 30px padding above to clearly show the upper color match
    const cropPadAbove = 35;
    const cropPadSides = 15;

    const cropX = Math.max(0, watermarkBox.x - cropPadSides);
    const cropY = Math.max(0, watermarkBox.y - cropPadAbove);
    const cropW = Math.min(originalCanvas.width - cropX, watermarkBox.width + cropPadSides * 2);
    const cropH = Math.min(originalCanvas.height - cropY, watermarkBox.height + cropPadAbove + 15);

    const renderToCanvas = (
      src: HTMLCanvasElement,
      targetCanvas: HTMLCanvasElement | null
    ) => {
      if (!targetCanvas) return;
      targetCanvas.width = cropW * zoomLevel;
      targetCanvas.height = cropH * zoomLevel;
      const ctx = targetCanvas.getContext('2d');
      if (!ctx) return;

      ctx.imageSmoothingEnabled = false; // Crisp pixel inspection
      ctx.drawImage(
        src,
        cropX,
        cropY,
        cropW,
        cropH,
        0,
        0,
        targetCanvas.width,
        targetCanvas.height
      );

      // Draw dashed reference line marking where the upper color boundary was
      const boundaryY = cropPadAbove * zoomLevel;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, boundaryY);
      ctx.lineTo(targetCanvas.width, boundaryY);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    renderToCanvas(originalCanvas, origLoupeCanvasRef.current);
    renderToCanvas(processedCanvas, procLoupeCanvasRef.current);
  }, [originalCanvas, processedCanvas, watermarkBox, zoomLevel]);

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/40 backdrop-blur-md border border-slate-800 text-slate-300 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-indigo-400" />
          <h4 className="text-sm font-semibold text-white">
            High-Precision Pixel Loupe (Corner Inspection)
          </h4>
          <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3 h-3" />
            Seamless Upper-Color Extrapolation
          </span>
        </div>

        {/* Zoom Level Selectors */}
        <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/60 p-1 rounded-lg text-xs">
          <span className="text-slate-400 px-1 font-medium">Zoom:</span>
          {[2, 3, 4].map((z) => (
            <button
              key={z}
              id={`loupe-zoom-${z}x`}
              onClick={() => setZoomLevel(z)}
              className={`px-2.5 py-0.5 rounded font-mono font-medium transition-all ${
                zoomLevel === z
                  ? 'bg-indigo-600 text-white font-bold shadow'
                  : 'text-slate-300 hover:bg-slate-700/60'
              }`}
            >
              {z}x
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-400 mb-3 leading-relaxed">
        The blue dashed line indicates the exact boundary where the watermark began. Note how the upper background colors,
        gradient vector, and micro-sensor noise continue downward continuously across the corner.
      </p>

      {/* Side-by-Side Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Original */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Original Corner (With Watermark)</span>
            <span className="text-slate-500 font-mono text-[10px]">Gemini Notebook Badge</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 overflow-auto flex items-center justify-center min-h-[160px]">
            <canvas ref={origLoupeCanvasRef} className="max-w-full rounded shadow" />
          </div>
        </div>

        {/* Processed */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-indigo-400">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              Cleaned Corner (Upper Color Blended)
            </span>
            <span className="text-emerald-400 font-mono text-[10px]">Zero Artifacts</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-950 border border-indigo-500/30 overflow-auto flex items-center justify-center min-h-[160px] shadow-[0_0_15px_rgba(99,102,241,0.08)]">
            <canvas ref={procLoupeCanvasRef} className="max-w-full rounded shadow" />
          </div>
        </div>
      </div>
    </div>
  );
};
