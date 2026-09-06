/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import {
  Activity,
  Box,
  CheckCircle2,
  Columns,
  Cpu,
  Download,
  FileText,
  Image as ImageIcon,
  Layers,
  Shield,
  Sparkles,
  Upload,
} from 'lucide-react';
import { ViewMode } from '../types';

interface HeaderProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLoadSample: (sampleType: 'gemini-startup' | 'pdf-report') => void;
  isDocumentLoaded: boolean;
  documentName: string;
  isPdfDocument?: boolean;
  onQuickDownload?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  viewMode,
  onViewModeChange,
  onFileUpload,
  onLoadSample,
  isDocumentLoaded,
  documentName,
  isPdfDocument,
  onQuickDownload,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <nav className="flex items-center justify-between px-4 sm:px-8 py-3 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
      {/* Brand Identity */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/25 text-base tracking-wider shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
              Gemini <span className="text-indigo-400 font-semibold">Watermark Remover</span>
            </span>
            <span className="hidden xl:inline text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 font-medium border border-indigo-500/30">
              Gemini & NotebookLM & All
            </span>
          </div>
          <a
            href="https://geminiwatermarkremover.itsstudent.com"
            className="text-[11px] text-slate-400 hover:text-indigo-300 transition-colors font-mono tracking-tight"
            title="Visit geminiwatermarkremover.itsstudent.com"
          >
            geminiwatermarkremover.itsstudent.com
          </a>
        </div>
      </div>

      {/* Center View Mode Pills */}
      <div className="hidden sm:flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl">
        <button
          id="tab-2d-editor"
          onClick={() => onViewModeChange('2d-editor')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
            viewMode === '2d-editor'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-semibold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Workspace</span>
        </button>

        <button
          id="tab-split-compare"
          onClick={() => onViewModeChange('split-compare')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
            viewMode === 'split-compare'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-semibold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Columns className="w-3.5 h-3.5" />
          <span>Split Slider</span>
        </button>

        <button
          id="tab-diff-heatmap"
          onClick={() => onViewModeChange('diff-heatmap')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
            viewMode === 'diff-heatmap'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-semibold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
          title="Verify pixel difference heatmap"
        >
          <Activity className="w-3.5 h-3.5 text-amber-400" />
          <span>Diff Heatmap</span>
        </button>

        <button
          id="tab-3d-hologram"
          onClick={() => onViewModeChange('3d-hologram')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
            viewMode === '3d-hologram'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-semibold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Box className="w-3.5 h-3.5" />
          <span>3D Hologram</span>
        </button>
      </div>

      {/* Right Controls: Upload & Prominent Instant Download */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          onChange={onFileUpload}
          className="hidden"
        />

        <button
          id="btn-upload-file"
          onClick={() => fileInputRef.current?.click()}
          className="px-3.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-800 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-all shadow-sm"
        >
          <Upload className="w-3.5 h-3.5 text-indigo-400" />
          <span>Upload File</span>
        </button>

        {/* Prominent, Unmissable Top Download Button */}
        {isDocumentLoaded && onQuickDownload && (
          <button
            id="btn-header-quick-download"
            onClick={onQuickDownload}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-600/25 transition-all active:scale-95"
            title="Download Clean File Instantly"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Clean {isPdfDocument ? 'PDF' : 'Image'}</span>
          </button>
        )}

        {/* Fast Sample Toggles (on larger screens) */}
        <div className="hidden xl:flex items-center gap-1 pl-2 border-l border-slate-800">
          <button
            id="btn-sample-startup"
            onClick={() => onLoadSample('gemini-startup')}
            className="px-2 py-1 rounded bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-[11px] font-medium transition-all"
            title="Load sample infographic"
          >
            Sample Graphic
          </button>
          <button
            id="btn-sample-pdf"
            onClick={() => onLoadSample('pdf-report')}
            className="px-2 py-1 rounded bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-[11px] font-medium transition-all"
            title="Load sample PDF"
          >
            Sample PDF
          </button>
        </div>
      </div>
    </nav>
  );
};
