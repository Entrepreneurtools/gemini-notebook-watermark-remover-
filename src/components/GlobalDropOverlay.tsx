/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { UploadCloud, Sparkles, Image as ImageIcon, FileText, ShieldCheck } from 'lucide-react';

interface GlobalDropOverlayProps {
  isVisible: boolean;
}

export const GlobalDropOverlay: React.FC<GlobalDropOverlayProps> = ({ isVisible }) => {
  if (!isVisible) return null;

  return (
    <div
      id="global-drag-drop-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-6 pointer-events-none animate-in fade-in zoom-in-95 duration-150"
    >
      <div className="relative max-w-lg w-full rounded-3xl border-2 border-dashed border-indigo-400 bg-slate-900/95 p-8 sm:p-10 shadow-2xl shadow-indigo-500/25 text-center flex flex-col items-center gap-5">
        {/* Glowing floating icon */}
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-xl shadow-indigo-600/50 animate-bounce">
            <UploadCloud className="w-10 h-10" />
          </div>
          <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-lg border-2 border-slate-900">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>

        {/* Text descriptions */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Drop Photo or Document Here
          </h2>
          <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
            Release your file anywhere to automatically detect and eliminate Google Gemini, NotebookLM, or arbitrary watermarks.
          </p>
        </div>

        {/* Format Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {['PNG', 'JPG / JPEG', 'WEBP', 'SVG', 'PDF Document'].map((fmt) => (
            <span
              key={fmt}
              className="px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700 text-xs font-semibold text-indigo-300"
            >
              {fmt}
            </span>
          ))}
        </div>

        {/* Privacy reassurance */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-950/60 px-3.5 py-1.5 rounded-full border border-slate-800">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>100% Client-Side Inpainting • Files Never Leave Your Browser</span>
        </div>
      </div>
    </div>
  );
};
