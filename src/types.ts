/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type RemovalAlgorithm =
  | 'upper-color-gradient' // Exact user requested method: samples upper color profile & extrapolates smoothly down
  | 'telea-inpaint'        // Fast Marching Method Content-Aware Inpainting
  | 'texture-clone'        // Clones upper texture with Poisson blending
  | 'harmonic-bilinear';   // 4-side weighted boundary interpolation

export interface WatermarkBox {
  id: string;
  x: number;       // In pixels relative to natural image dimensions
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export type WatermarkActionType = 'inpaint' | 'overlay-logo' | 'inpaint-and-overlay';

export interface LogoOverlaySettings {
  enabled: boolean;
  actionType: WatermarkActionType; // 'inpaint' (clean erase) | 'overlay-logo' (direct cover) | 'inpaint-and-overlay' (clean background + place logo)
  logoDataUrl: string | null;      // User-uploaded horizontal logo (data URL or object URL)
  logoFileName?: string;
  badgeText: string;               // e.g. "itstudent.com"
  textColor: string;               // Hex color
  fontSize: number;                // In px (10 to 48)
  fontFamily: 'sans' | 'serif' | 'mono';
  fontWeight: 'normal' | 'bold' | 'black';
  backgroundColor: string;         // e.g. "#FBBF24" (Yellow default as requested: "Like a yellow or any other first")
  backgroundShape: 'pill' | 'rounded' | 'sharp' | 'transparent';
  borderWidth: number;             // 0, 1, 2
  borderColor: string;
  opacity: number;                 // 0.1 to 1.0
  padding: number;                 // 2 to 24px
  shadow: boolean;
}

export interface RemovalSettings {
  algorithm: RemovalAlgorithm;
  sampleBandHeight: number;  // Height in px above watermark to sample color (default: 18)
  featherRadius: number;     // Edge blur radius in px (default: 6)
  grainAmount: number;       // Noise/micro-texture matching (0 to 100, default: 22)
  gradientExtrapolation: boolean; // Extrapolate vertical luminosity gradient
  colorTintAdjustment: string | null; // Optional manual hex tint override
  logoOverlay?: LogoOverlaySettings; // Custom logo/badge overlay options
}

export interface DocumentItem {
  id: string;
  name: string;
  type: 'image' | 'pdf';
  fileSize: number;
  originalUrl: string;
  processedUrl: string | null;
  width: number;
  height: number;
  // For PDFs:
  pageCount?: number;
  currentPageIndex?: number;
  pages?: PdfPageData[];
}

export interface PdfPageData {
  pageNumber: number;
  originalCanvasDataUrl: string;
  processedCanvasDataUrl: string | null;
  width: number;
  height: number;
  watermarkBox?: WatermarkBox;
}

export type ViewMode = '2d-editor' | '3d-hologram' | 'split-compare' | 'diff-heatmap';

export interface DetectedWatermarkCandidate {
  label: string;
  confidence: number;
  box: WatermarkBox;
}

export type PresetType =
  | 'gemini-notebook-bottom-right'
  | 'bottom-left'
  | 'top-right'
  | 'top-left'
  | 'custom-box'
  | 'brush-mask';
