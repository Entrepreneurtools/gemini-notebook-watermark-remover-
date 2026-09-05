/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Check, CheckCircle2, Copy, FileText, Layers, Sparkles } from 'lucide-react';
import { PdfPageData } from '../types';

interface PdfPagesManagerProps {
  pages: PdfPageData[];
  currentPageIndex: number;
  onSelectPage: (index: number) => void;
  onApplyToAllPages: () => void;
  isProcessingAll: boolean;
}

export const PdfPagesManager: React.FC<PdfPagesManagerProps> = ({
  pages,
  currentPageIndex,
  onSelectPage,
  onApplyToAllPages,
  isProcessingAll,
}) => {
  if (pages.length <= 1) return null;

  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-slate-900/40 backdrop-blur-md border border-slate-800 text-slate-200 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-400" />
          <h4 className="text-sm font-semibold text-white">
            PDF Document Pages ({pages.length} Pages)
          </h4>
        </div>

        <button
          id="btn-apply-all-pages"
          onClick={onApplyToAllPages}
          disabled={isProcessingAll}
          className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
        >
          <Sparkles className="w-3.5 h-3.5 text-white" />
          {isProcessingAll ? 'Applying to All Pages...' : 'Apply Watermark Removal to All Pages'}
        </button>
      </div>

      {/* Pages Carousel / Grid */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-slate-700">
        {pages.map((page, idx) => {
          const isSelected = idx === currentPageIndex;
          const isCleaned = !!page.processedCanvasDataUrl;

          return (
            <button
              key={page.pageNumber}
              id={`pdf-page-thumb-${idx}`}
              onClick={() => onSelectPage(idx)}
              className={`relative flex-shrink-0 flex flex-col items-center p-2 rounded-xl border transition-all text-left group ${
                isSelected
                  ? 'bg-slate-800 border-indigo-500 shadow-md ring-2 ring-indigo-500/30'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Thumbnail Image */}
              <div className="w-24 h-32 bg-white rounded overflow-hidden flex items-center justify-center border border-slate-700 shadow-inner">
                <img
                  src={page.processedCanvasDataUrl || page.originalCanvasDataUrl}
                  alt={`Page ${page.pageNumber}`}
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Page Number & Status */}
              <div className="mt-2 flex items-center justify-between w-full text-[11px]">
                <span className="font-semibold text-slate-300">Page {page.pageNumber}</span>
                {isCleaned ? (
                  <span className="flex items-center text-emerald-400 text-[10px] font-bold">
                    <CheckCircle2 className="w-3 h-3 mr-0.5" /> Cleaned
                  </span>
                ) : (
                  <span className="text-slate-500 text-[10px]">Original</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
