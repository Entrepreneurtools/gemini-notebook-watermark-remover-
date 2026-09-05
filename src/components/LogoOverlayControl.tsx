/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import {
  Bookmark,
  Check,
  ChevronDown,
  Globe,
  Image as ImageIcon,
  Palette,
  Sparkles,
  Trash2,
  Type,
  UploadCloud,
  X,
} from 'lucide-react';
import { LogoOverlaySettings, WatermarkActionType } from '../types';

interface LogoOverlayControlProps {
  overlaySettings: LogoOverlaySettings;
  onChange: (settings: LogoOverlaySettings) => void;
  onRefreshCanvas: () => void;
}

export const LogoOverlayControl: React.FC<LogoOverlayControlProps> = ({
  overlaySettings,
  onChange,
  onRefreshCanvas,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick background color presets (starting with yellow as explicitly requested by user)
  const colorPresets = [
    { label: 'Yellow (Brand)', color: '#FBBF24', textColor: '#000000' },
    { label: 'White', color: '#FFFFFF', textColor: '#0F172A' },
    { label: 'Dark Slate', color: '#0F172A', textColor: '#FFFFFF' },
    { label: 'Royal Indigo', color: '#4F46E5', textColor: '#FFFFFF' },
    { label: 'Emerald', color: '#10B981', textColor: '#FFFFFF' },
    { label: 'Transparent', color: 'transparent', textColor: '#FFFFFF' },
  ];

  // Handle image upload (horizontal logo, SVG, PNG, WebP, JPG)
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const nextSettings: LogoOverlaySettings = {
        ...overlaySettings,
        enabled: true,
        logoDataUrl: dataUrl,
        logoFileName: file.name,
        actionType:
          overlaySettings.actionType === 'inpaint'
            ? 'inpaint-and-overlay'
            : overlaySettings.actionType,
      };
      onChange(nextSettings);
      setTimeout(onRefreshCanvas, 50);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogoImage = () => {
    const nextSettings: LogoOverlaySettings = {
      ...overlaySettings,
      logoDataUrl: null,
      logoFileName: undefined,
    };
    onChange(nextSettings);
    setTimeout(onRefreshCanvas, 50);
  };

  const handleActionTypeSelect = (type: WatermarkActionType) => {
    const nextSettings: LogoOverlaySettings = {
      ...overlaySettings,
      actionType: type,
      enabled: type !== 'inpaint',
    };
    onChange(nextSettings);
    setTimeout(onRefreshCanvas, 50);
  };

  const isOverlayActive =
    overlaySettings.enabled && overlaySettings.actionType !== 'inpaint';

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5 rounded-2xl bg-slate-900/50 border border-slate-800 text-xs text-slate-300">
      {/* Strategy Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div>
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-amber-400" />
            Watermark Treatment & Logo Overlay
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Erase seamlessly or place your own horizontal logo & website badge over the watermark.
          </p>
        </div>

        {/* Strategy Selector Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-950/80 rounded-xl border border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => handleActionTypeSelect('inpaint')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              overlaySettings.actionType === 'inpaint'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Erase (Inpaint)
          </button>
          <button
            type="button"
            onClick={() => handleActionTypeSelect('inpaint-and-overlay')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              overlaySettings.actionType === 'inpaint-and-overlay'
                ? 'bg-amber-500 text-slate-950 shadow font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            Clean + Brand Logo
          </button>
          <button
            type="button"
            onClick={() => handleActionTypeSelect('overlay-logo')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              overlaySettings.actionType === 'overlay-logo'
                ? 'bg-amber-500 text-slate-950 shadow font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Direct Logo Patch
          </button>
        </div>
      </div>

      {/* Expanded Controls when Overlay Mode is Active */}
      {isOverlayActive && (
        <div className="space-y-4 pt-1 animate-in fade-in duration-200">
          {/* Step 1: Background Patch Color & Shape */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Color Selection */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-amber-400" />
                1. Background Patch Color
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {colorPresets.map((preset) => {
                  const isSelected = overlaySettings.backgroundColor === preset.color;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        onChange({
                          ...overlaySettings,
                          backgroundColor: preset.color,
                          textColor: preset.textColor || overlaySettings.textColor,
                        });
                        setTimeout(onRefreshCanvas, 30);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-amber-400 bg-amber-400/15 text-white ring-1 ring-amber-400/50'
                          : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full border border-black/20"
                        style={{
                          backgroundColor:
                            preset.color === 'transparent' ? '#334155' : preset.color,
                        }}
                      />
                      <span>{preset.label}</span>
                    </button>
                  );
                })}

                {/* Custom Color Input */}
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-800 bg-slate-950/60">
                  <input
                    type="color"
                    value={
                      overlaySettings.backgroundColor === 'transparent'
                        ? '#fbbf24'
                        : overlaySettings.backgroundColor
                    }
                    onChange={(e) => {
                      onChange({
                        ...overlaySettings,
                        backgroundColor: e.target.value,
                      });
                      setTimeout(onRefreshCanvas, 30);
                    }}
                    className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                    title="Choose custom background color"
                  />
                  <span className="text-[10px] font-mono text-slate-400">Custom</span>
                </div>
              </div>
            </div>

            {/* Shape & Corner Radius */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-indigo-400" />
                Shape & Style
              </label>
              <div className="flex items-center gap-2">
                {(['pill', 'rounded', 'sharp'] as const).map((shape) => (
                  <button
                    key={shape}
                    type="button"
                    onClick={() => {
                      onChange({ ...overlaySettings, backgroundShape: shape });
                      setTimeout(onRefreshCanvas, 30);
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-center font-medium capitalize border transition-all cursor-pointer ${
                      overlaySettings.backgroundShape === shape
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-semibold'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    {shape === 'pill' ? 'Oval Pill' : shape === 'rounded' ? 'Soft Corner' : 'Rectangle'}
                  </button>
                ))}

                {/* Shadow Checkbox */}
                <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950/60 text-slate-400 cursor-pointer hover:text-white">
                  <input
                    type="checkbox"
                    checked={overlaySettings.shadow}
                    onChange={(e) => {
                      onChange({ ...overlaySettings, shadow: e.target.checked });
                      setTimeout(onRefreshCanvas, 30);
                    }}
                    className="rounded text-indigo-600 focus:ring-0"
                  />
                  <span>Shadow</span>
                </label>
              </div>
            </div>
          </div>

          {/* Step 2: Content (Horizontal Logo Image and/or Custom Text like itstudent.com) */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Horizontal Logo Upload */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                Upload Horizontal Logo / Icon
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/svg+xml, image/jpeg, image/webp"
                onChange={handleLogoUpload}
                className="hidden"
              />

              {overlaySettings.logoDataUrl ? (
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="w-16 h-8 rounded bg-slate-950 flex items-center justify-center p-1 border border-slate-800 shrink-0">
                      <img
                        src={overlaySettings.logoDataUrl}
                        alt="Custom Brand Logo"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-semibold text-white truncate">
                        {overlaySettings.logoFileName || 'Horizontal_Logo.png'}
                      </p>
                      <span className="text-[10px] text-emerald-400 font-medium">
                        Active on Watermark Area
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-all cursor-pointer"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveLogoImage}
                      className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded transition-all cursor-pointer"
                      title="Remove custom logo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-3 rounded-lg border border-dashed border-slate-700 hover:border-amber-400/60 bg-slate-900/40 hover:bg-slate-900 flex items-center justify-center gap-2 text-slate-300 hover:text-white transition-all cursor-pointer group"
                >
                  <UploadCloud className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                  <span className="font-semibold text-xs">Upload Horizontal Logo / Banner</span>
                  <span className="text-[10px] text-slate-500">(PNG, SVG, JPG)</span>
                </button>
              )}
            </div>

            {/* Custom Brand Text / Website (e.g. itstudent.com) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-indigo-400" />
                  Brand Text or Website
                </label>
                {/* One click preset as requested by user! */}
                <button
                  type="button"
                  onClick={() => {
                    onChange({
                      ...overlaySettings,
                      badgeText: 'itstudent.com',
                    });
                    setTimeout(onRefreshCanvas, 30);
                  }}
                  className="text-[10px] text-amber-400 hover:text-amber-300 underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  Use Example: "itstudent.com"
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={overlaySettings.badgeText}
                    onChange={(e) => {
                      onChange({
                        ...overlaySettings,
                        badgeText: e.target.value,
                      });
                      setTimeout(onRefreshCanvas, 30);
                    }}
                    placeholder="e.g. itstudent.com"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-semibold placeholder:text-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  />
                  {overlaySettings.badgeText && (
                    <button
                      type="button"
                      onClick={() => {
                        onChange({ ...overlaySettings, badgeText: '' });
                        setTimeout(onRefreshCanvas, 30);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Text Color Picker */}
                <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-slate-700 bg-slate-900">
                  <input
                    type="color"
                    value={overlaySettings.textColor}
                    onChange={(e) => {
                      onChange({
                        ...overlaySettings,
                        textColor: e.target.value,
                      });
                      setTimeout(onRefreshCanvas, 30);
                    }}
                    className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                    title="Text Color"
                  />
                </div>
              </div>

              {/* Font Size & Font Family Controls */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <div className="flex items-center gap-2">
                  <span>Size: {overlaySettings.fontSize}px</span>
                  <input
                    type="range"
                    min={10}
                    max={36}
                    step={1}
                    value={overlaySettings.fontSize}
                    onChange={(e) => {
                      onChange({
                        ...overlaySettings,
                        fontSize: Number(e.target.value),
                      });
                      setTimeout(onRefreshCanvas, 30);
                    }}
                    className="w-20 accent-amber-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onChange({ ...overlaySettings, fontFamily: 'sans' });
                      setTimeout(onRefreshCanvas, 30);
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                      overlaySettings.fontFamily === 'sans'
                        ? 'bg-slate-800 text-white font-bold'
                        : 'text-slate-500'
                    }`}
                  >
                    Sans
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onChange({ ...overlaySettings, fontFamily: 'mono' });
                      setTimeout(onRefreshCanvas, 30);
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                      overlaySettings.fontFamily === 'mono'
                        ? 'bg-slate-800 text-white font-bold'
                        : 'text-slate-500'
                    }`}
                  >
                    Mono
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onChange({ ...overlaySettings, fontFamily: 'serif' });
                      setTimeout(onRefreshCanvas, 30);
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-serif ${
                      overlaySettings.fontFamily === 'serif'
                        ? 'bg-slate-800 text-white font-bold'
                        : 'text-slate-500'
                    }`}
                  >
                    Serif
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
