/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { UploadCloud, Image as ImageIcon, Sparkles, FileText, Clipboard } from 'lucide-react';

interface PhotoDropZoneProps {
  onFileSelected: (file: File) => void;
  isDraggingGlobal?: boolean;
}

export const PhotoDropZone: React.FC<PhotoDropZoneProps> = ({
  onFileSelected,
  isDraggingGlobal = false,
}) => {
  const [isHoveredOver, setIsHoveredOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const localDragCounter = useRef(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    localDragCounter.current += 1;
    setIsHoveredOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    localDragCounter.current -= 1;
    if (localDragCounter.current <= 0) {
      localDragCounter.current = 0;
      setIsHoveredOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    localDragCounter.current = 0;
    setIsHoveredOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      onFileSelected(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
      e.target.value = '';
    }
  };

  return (
    <div
      id="photo-dropzone-bar"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`relative rounded-xl border-2 border-dashed transition-all cursor-pointer select-none group p-3 sm:p-4 ${
        isHoveredOver || isDraggingGlobal
          ? 'border-indigo-400 bg-indigo-950/40 shadow-xl shadow-indigo-500/20 scale-[1.01]'
          : 'border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/70 shadow-md'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/bmp,application/pdf"
        onChange={handleInputChange}
        className="hidden"
      />

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left Icon & Text */}
        <div className="flex items-center gap-3 text-center sm:text-left">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 ${
              isHoveredOver || isDraggingGlobal
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40 scale-110'
                : 'bg-indigo-950/60 border border-indigo-500/30 text-indigo-400 group-hover:border-indigo-500/50 group-hover:text-indigo-300'
            }`}
          >
            <UploadCloud className="w-5 h-5 animate-pulse" />
          </div>

          <div>
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="text-xs sm:text-sm font-bold text-white tracking-tight">
                {isHoveredOver ? 'Release to Remove Watermark' : 'Drag & Drop Any Photo or Document'}
              </span>
              <span className="hidden md:inline-flex text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                Auto-Clean
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Supports <strong className="text-slate-300">PNG, JPG, WEBP, SVG</strong> & multi-page{' '}
              <strong className="text-slate-300">PDF</strong> • Max 50MB
            </p>
          </div>
        </div>

        {/* Right Action Pill / Keyboard Shortcut */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden lg:inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-800/80 px-2 py-1 rounded-md border border-slate-700/60 font-mono">
            <Clipboard className="w-3 h-3 text-slate-400" />
            <span>Ctrl + V to paste</span>
          </span>

          <button
            type="button"
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 group-hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Browse Photo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
