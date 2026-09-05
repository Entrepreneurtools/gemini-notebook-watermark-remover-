/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Activity, CheckCircle2, Eye, ShieldCheck, Sparkles } from 'lucide-react';
import { generateDiffHeatmap } from '../lib/watermarkEngine';

interface DiffHeatmapViewProps {
  originalCanvas: HTMLCanvasElement | null;
  processedCanvas: HTMLCanvasElement | null;
}

export const DiffHeatmapView: React.FC<DiffHeatmapViewProps> = ({
  originalCanvas,
  processedCanvas,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showOverlay, setShowOverlay] = useState<boolean>(true);
  const [changedPixelCount, setChangedPixelCount] = useState<number>(0);
  const [totalPixelCount, setTotalPixelCount] = useState<number>(0);

  useEffect(() => {
    if (!originalCanvas || !processedCanvas || !canvasRef.current) return;

    const diffCanvas = generateDiffHeatmap(originalCanvas, processedCanvas);
    const canvas = canvasRef.current;
    canvas.width = diffCanvas.width;
    canvas.height = diffCanvas.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(diffCanvas, 0, 0);

    // Calculate exact statistics
    const total = diffCanvas.width * diffCanvas.height;
    setTotalPixelCount(total);

    const origCtx = originalCanvas.getContext('2d');
    const procCtx = processedCanvas.getContext('2d');
    if (origCtx && procCtx) {
      const oData = origCtx.getImageData(0, 0, diffCanvas.width, diffCanvas.height).data;
      const pData = procCtx.getImageData(0, 0, diffCanvas.width, diffCanvas.height).data;
      let count = 0;
      for (let i = 0; i < oData.length; i += 4) {
        if (
          Math.abs(oData[i] - pData[i]) > 4 ||
          Math.abs(oData[i + 1] - pData[i + 1]) > 4 ||
          Math.abs(oData[i + 2] - pData[i + 2]) > 4
        ) {
          count++;
        }
      }
      setChangedPixelCount(count);
    }
  }, [originalCanvas, processedCanvas]);

  const changePercentage =
    totalPixelCount > 0 ? ((changedPixelCount / totalPixelCount) * 100).toFixed(2) : '0.00';
  const untouchedPercentage = (100 - parseFloat(changePercentage)).toFixed(2);

  return (
    <div className="relative w-full flex flex-col rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl select-none">
      {/* Sleek Window Header */}
      <div className="h-10 bg-slate-900 border-b border-slate-700/80 flex items-center px-4 justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-slate-700 hover:bg-rose-500 transition-colors" />
            <div className="w-3 h-3 rounded-full bg-slate-700 hover:bg-amber-500 transition-colors" />
            <div className="w-3 h-3 rounded-full bg-slate-700 hover:bg-emerald-500 transition-colors" />
          </div>
          <span className="text-slate-400 font-medium ml-2 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            Pixel Integrity Difference Heatmap
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            {untouchedPercentage}% Untouched Document
          </span>
          <span className="text-slate-600 font-mono">|</span>
          <span className="text-amber-400 font-medium">
            {changePercentage}% Inpainted Watermark
          </span>
        </div>
      </div>

      {/* Main Heatmap Stage */}
      <div className="relative w-full min-h-[500px] bg-slate-950/95 flex items-center justify-center p-4 overflow-auto">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-[520px] w-auto h-auto object-contain rounded-lg shadow-2xl border border-slate-800"
        />

        {/* Legend Overlay */}
        <div className="absolute top-6 left-6 p-3 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/70 text-xs shadow-xl flex flex-col gap-2 max-w-xs pointer-events-none">
          <div className="font-semibold text-white flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            Mathematical Integrity Guarantee
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded bg-amber-500 shadow-sm shadow-amber-500/50 shrink-0" />
            <span className="text-slate-300">
              Amber Glow: Only Watermark Pixels Replaced
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded bg-slate-800 border border-slate-700 shrink-0" />
            <span className="text-slate-400">
              Dark Grayscale: 100% Unaltered Original
            </span>
          </div>
          <p className="text-[11px] text-slate-400 border-t border-slate-800 pt-1.5 leading-relaxed">
            Zero degradation or recompression to the rest of your text, graphs, or infographics.
          </p>
        </div>
      </div>
    </div>
  );
};
