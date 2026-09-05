/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Crop,
  Download,
  FileText,
  Plus,
  RefreshCw,
  Sliders,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { LogoOverlaySettings, RemovalAlgorithm, RemovalSettings } from '../types';
import { LogoOverlayControl } from './LogoOverlayControl';

interface RemovalControlsProps {
  settings: RemovalSettings;
  onSettingsChange: (settings: RemovalSettings) => void;
  onApplyRemoval: () => void;
  onReset: () => void;
  onDownloadImage: (format: 'png' | 'jpeg') => void;
  onDownloadPdf?: () => void;
  isPdfDocument: boolean;
  isProcessing: boolean;
  hasProcessed: boolean;
  onAutoDetect?: () => void;
  onAddBox?: () => void;
}

export const RemovalControls: React.FC<RemovalControlsProps> = ({
  settings,
  onSettingsChange,
  onApplyRemoval,
  onReset,
  onDownloadImage,
  onDownloadPdf,
  isPdfDocument,
  isProcessing,
  hasProcessed,
  onAutoDetect,
  onAddBox,
}) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);

  const defaultOverlay: LogoOverlaySettings = {
    enabled: false,
    actionType: 'inpaint',
    logoDataUrl: null,
    badgeText: 'itstudent.com',
    textColor: '#000000',
    fontSize: 18,
    fontFamily: 'sans',
    fontWeight: 'bold',
    backgroundColor: '#FBBF24', // Yellow by default as requested by user
    backgroundShape: 'pill',
    borderWidth: 0,
    borderColor: '#F59E0B',
    opacity: 1.0,
    padding: 8,
    shadow: true,
  };

  const currentOverlay = settings.logoOverlay || defaultOverlay;

  const handleOverlayChange = (newOverlay: LogoOverlaySettings) => {
    onSettingsChange({
      ...settings,
      logoOverlay: newOverlay,
    });
  };

  const handleAlgorithmChange = (algo: RemovalAlgorithm) => {
    onSettingsChange({
      ...settings,
      algorithm: algo,
    });
  };

  return (
    <div className="flex flex-col gap-5 p-5 sm:p-6 rounded-2xl bg-slate-900/40 backdrop-blur-md border border-slate-800 text-slate-200 shadow-xl">
      {/* Top Prominent Easy Download & Actions Bar */}
      <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-sm">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                {isPdfDocument ? 'Cleaned PDF Document Ready' : 'Cleaned Image Ready'}
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                ✓ No Watermark
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Upper-color extrapolated fill applied seamlessly with zero blur or distortion.
            </p>
          </div>
        </div>

        {/* Primary Download Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {isPdfDocument && onDownloadPdf ? (
            <button
              id="btn-prominent-download-pdf"
              onClick={onDownloadPdf}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              <span>Download Clean PDF</span>
            </button>
          ) : (
            <>
              <button
                id="btn-prominent-download-png"
                onClick={() => onDownloadImage('png')}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Download Clean PNG</span>
              </button>
              <button
                id="btn-download-jpg"
                onClick={() => onDownloadImage('jpeg')}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs border border-slate-700 transition-all"
                title="Download as high quality JPEG"
              >
                JPG
              </button>
            </>
          )}
        </div>
      </div>

      {/* Secondary Fast Tools: Auto-Detect & Add 2nd Box */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          {onAutoDetect && (
            <button
              id="btn-auto-detect-watermark"
              onClick={onAutoDetect}
              className="px-3.5 py-2 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              title="Automatically detect watermark badge in corners"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Auto-Detect Watermark</span>
            </button>
          )}

          {onAddBox && (
            <button
              id="btn-add-watermark-zone"
              onClick={onAddBox}
              className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              title="Add an additional watermark removal bounding box"
            >
              <Plus className="w-3.5 h-3.5 text-slate-400" />
              <span>Add 2nd Watermark Box</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-apply-removal"
            onClick={onApplyRemoval}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/20 flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                <span>Inpainting...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-3.5 h-3.5 text-white" />
                <span>Re-Apply Inpainting</span>
              </>
            )}
          </button>

          <button
            id="btn-reset-clean"
            onClick={onReset}
            className="px-3.5 py-2 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700 text-slate-300 font-medium text-xs transition-all flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          {/* Toggle for Fine-Tuning Drawer */}
          <button
            type="button"
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className="px-3.5 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-300 font-medium flex items-center gap-1.5 transition-all"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            <span>Fine-Tuning</span>
            {isAdvancedOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {/* Brand Logo & Website Badge Overlay Control */}
      <LogoOverlayControl
        overlaySettings={currentOverlay}
        onChange={handleOverlayChange}
        onRefreshCanvas={onApplyRemoval}
      />

      {/* Collapsible Fine-Tuning Drawer (Keeps the UI simple & non-chaotic) */}
      {isAdvancedOpen && (
        <div className="pt-4 border-t border-slate-800/80 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Patch Settings */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                Inpainting Algorithm
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  id="algo-upper-color"
                  onClick={() => handleAlgorithmChange('upper-color-gradient')}
                  className={`p-3 rounded-lg border text-left transition-all relative ${
                    settings.algorithm === 'upper-color-gradient'
                      ? 'bg-indigo-600/15 border-indigo-500/50 text-white shadow-lg shadow-indigo-500/10'
                      : 'bg-slate-800/40 border-slate-700/80 text-slate-300 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-indigo-400 flex items-center gap-1">
                      Upper Color Extrapolation
                    </span>
                    <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                      Recommended
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Samples pixels directly above logo; continuous luminance flow without blur.
                  </p>
                </button>

                <button
                  id="algo-telea-inpaint"
                  onClick={() => handleAlgorithmChange('telea-inpaint')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    settings.algorithm === 'telea-inpaint'
                      ? 'bg-indigo-600/15 border-indigo-500/50 text-white shadow-lg shadow-indigo-500/10'
                      : 'bg-slate-800/40 border-slate-700/80 text-slate-300 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-200">Context-Aware Diffusion</span>
                    <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      FMM
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Diffuses perimeter boundary gradients inward with local Gaussian smoothing.
                  </p>
                </button>

                <button
                  id="algo-texture-clone"
                  onClick={() => handleAlgorithmChange('texture-clone')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    settings.algorithm === 'texture-clone'
                      ? 'bg-indigo-600/15 border-indigo-500/50 text-white shadow-lg shadow-indigo-500/10'
                      : 'bg-slate-800/40 border-slate-700/80 text-slate-300 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-200">Texture Clone & Blend</span>
                    <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      Clone
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Clones matching texture tile directly from upper backdrop.
                  </p>
                </button>

                <button
                  id="algo-harmonic-bilinear"
                  onClick={() => handleAlgorithmChange('harmonic-bilinear')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    settings.algorithm === 'harmonic-bilinear'
                      ? 'bg-indigo-600/15 border-indigo-500/50 text-white shadow-lg shadow-indigo-500/10'
                      : 'bg-slate-800/40 border-slate-700/80 text-slate-300 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-200">Mean Color Interpolation</span>
                    <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      Linear
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    4-way Dirichlet boundary interpolation with smoothstep curve.
                  </p>
                </button>
              </div>
            </div>

            {/* Right Column: Fine-Tuning Calibration */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Surface & Noise Calibration
              </h3>

              <div className="space-y-3.5 bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
                {/* Smoothing Radius */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <label className="text-slate-400 font-medium">Smoothing / Feather Radius</label>
                    <span className="text-indigo-400 font-mono font-semibold">
                      {settings.featherRadius} px
                    </span>
                  </div>
                  <input
                    id="slider-feather-radius"
                    type="range"
                    min="1"
                    max="25"
                    value={settings.featherRadius}
                    onChange={(e) =>
                      onSettingsChange({
                        ...settings,
                        featherRadius: Number(e.target.value),
                      })
                    }
                    className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                    <span>1px</span>
                    <span>25px</span>
                  </div>
                </div>

                {/* Upper Sample Band */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <label className="text-slate-400 font-medium">Upper Color Sample Band Depth</label>
                    <span className="text-indigo-400 font-mono font-semibold">
                      {settings.sampleBandHeight} px
                    </span>
                  </div>
                  <input
                    id="slider-sample-band"
                    type="range"
                    min="4"
                    max="50"
                    value={settings.sampleBandHeight}
                    onChange={(e) =>
                      onSettingsChange({
                        ...settings,
                        sampleBandHeight: Number(e.target.value),
                      })
                    }
                    className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                    <span>4px</span>
                    <span>50px</span>
                  </div>
                </div>

                {/* Micro Grain */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <label className="text-slate-400 font-medium">Sensor Noise / Micro-Grain</label>
                    <span className="text-indigo-400 font-mono font-semibold">
                      {settings.grainAmount}%
                    </span>
                  </div>
                  <input
                    id="slider-grain-amount"
                    type="range"
                    min="0"
                    max="100"
                    value={settings.grainAmount}
                    onChange={(e) =>
                      onSettingsChange({
                        ...settings,
                        grainAmount: Number(e.target.value),
                      })
                    }
                    className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                    <span>0% (Smooth)</span>
                    <span>100% (High Grain)</span>
                  </div>
                </div>

                {/* Anti-Distortion Toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <div>
                    <span className="text-xs text-slate-300 font-medium block">
                      Anti-Distortion Continuous Gradient
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Extrapolates vertical luminance slope to avoid flat patches
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onSettingsChange({
                        ...settings,
                        gradientExtrapolation: !settings.gradientExtrapolation,
                      })
                    }
                    className={`w-10 h-5 rounded-full relative p-0.5 transition-colors ${
                      settings.gradientExtrapolation ? 'bg-indigo-600' : 'bg-slate-700'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 bg-white rounded-full transition-transform ${
                        settings.gradientExtrapolation ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
