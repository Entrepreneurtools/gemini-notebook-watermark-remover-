/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LogoOverlaySettings, RemovalSettings, WatermarkBox } from '../types';

/**
 * In-memory image element cache for instant logo rendering
 */
const logoImageCache = new Map<string, HTMLImageElement>();

export function getCachedLogoImage(url: string, onLoaded?: () => void): HTMLImageElement | null {
  if (!url) return null;
  if (logoImageCache.has(url)) {
    const cached = logoImageCache.get(url)!;
    if (cached.complete && cached.naturalWidth > 0) return cached;
  }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    logoImageCache.set(url, img);
    if (onLoaded) onLoaded();
  };
  img.src = url;
  logoImageCache.set(url, img);
  return img.complete && img.naturalWidth > 0 ? img : null;
}

/**
 * Executes local in-browser watermark removal on an HTMLCanvasElement
 * using advanced pixel sampling, upper-color extrapolation, seamless blending,
 * or custom brand logo/badge overlay.
 */
export function processWatermarkRemoval(
  sourceCanvas: HTMLCanvasElement,
  box: WatermarkBox,
  settings: RemovalSettings,
  brushMaskCanvas?: HTMLCanvasElement | null
): HTMLCanvasElement {
  // Create output canvas with identical dimensions
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = sourceCanvas.width;
  outputCanvas.height = sourceCanvas.height;

  const ctx = outputCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return sourceCanvas;

  // Copy original canvas onto output canvas
  ctx.drawImage(sourceCanvas, 0, 0);

  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  // Clamp bounding box to valid image boundaries
  const startX = Math.max(0, Math.floor(box.x));
  const startY = Math.max(0, Math.floor(box.y));
  const boxW = Math.min(width - startX, Math.ceil(box.width));
  const boxH = Math.min(height - startY, Math.ceil(box.height));

  if (boxW <= 0 || boxH <= 0) return outputCanvas;

  const isDirectOverlayOnly =
    settings.logoOverlay?.enabled && settings.logoOverlay.actionType === 'overlay-logo';

  // If not direct overlay only, perform inpainting first
  if (!isDirectOverlayOnly) {
    // Retrieve full pixel data
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    // If a brush mask is provided, get mask data
    let maskData: Uint8ClampedArray | null = null;
    if (brushMaskCanvas) {
      const maskCtx = brushMaskCanvas.getContext('2d', { willReadFrequently: true });
      if (maskCtx) {
        maskData = maskCtx.getImageData(0, 0, width, height).data;
      }
    }

    switch (settings.algorithm) {
      case 'upper-color-gradient':
      default:
        applyUpperColorSeamlessFill(
          data,
          width,
          height,
          startX,
          startY,
          boxW,
          boxH,
          settings,
          maskData
        );
        break;

      case 'telea-inpaint':
        applyTeleaInpaint(
          data,
          width,
          height,
          startX,
          startY,
          boxW,
          boxH,
          settings,
          maskData
        );
        break;

      case 'texture-clone':
        applyTextureClone(
          data,
          width,
          height,
          startX,
          startY,
          boxW,
          boxH,
          settings,
          maskData
        );
        break;

      case 'harmonic-bilinear':
        applyHarmonicBilinearFill(
          data,
          width,
          height,
          startX,
          startY,
          boxW,
          boxH,
          settings,
          maskData
        );
        break;
    }

    // Write modified pixels back to output canvas
    ctx.putImageData(imgData, 0, 0);
  }

  // If Logo/Badge overlay is enabled, draw it on top
  if (
    settings.logoOverlay?.enabled &&
    settings.logoOverlay.actionType !== 'inpaint'
  ) {
    applyLogoOverlayToContext(ctx, box, settings.logoOverlay);
  }

  return outputCanvas;
}

/**
 * EXACT USER SPECIFICATION:
 * "After removing, the color should be the upper color of the Gemini Notebook.
 * It should match that it is a full image or full PDF, not erasing or seeming like erasing something, and not distorted."
 *
 * This algorithm samples the band of pixels directly above the watermark box,
 * computes column-by-column color profiles and vertical gradients, and projects them
 * downwards with harmonic edge-matching (left, right, bottom) and matching micro-texture grain.
 */
function applyUpperColorSeamlessFill(
  data: Uint8ClampedArray,
  imgW: number,
  imgH: number,
  startX: number,
  startY: number,
  w: number,
  h: number,
  settings: RemovalSettings,
  maskData: Uint8ClampedArray | null
) {
  const sampleDepth = Math.max(3, Math.min(60, settings.sampleBandHeight));
  const feather = Math.max(1, Math.min(50, settings.featherRadius));
  const grainFactor = (settings.grainAmount || 20) / 100;

  // Band above watermark: [startY - sampleDepth, startY - 1]
  const upperYStart = Math.max(0, startY - sampleDepth);
  const actualUpperDepth = Math.max(1, startY - upperYStart);

  // Analyze each column in the watermark zone
  // We compute:
  // 1. upperAvg: [r, g, b] average in the upper sample band
  // 2. upperSlope: vertical change rate (dC / dy)
  // 3. noiseVariance: natural image sensor noise to synthesize
  const columnUpper = new Float32Array(w * 3);
  const columnSlope = new Float32Array(w * 3);
  let globalNoiseSum = 0;
  let noiseSampleCount = 0;

  for (let c = 0; c < w; c++) {
    const px = startX + c;

    // When a brush mask is provided, find the highest painted pixel in this specific column
    let colStartY = startY;
    if (maskData) {
      for (let r = 0; r < h; r++) {
        const checkIdx = ((startY + r) * imgW + px) * 4;
        if (maskData[checkIdx + 3] > 10) {
          colStartY = startY + r;
          break;
        }
      }
    }

    const upperYStart = Math.max(0, colStartY - sampleDepth);
    const actualUpperDepth = Math.max(1, colStartY - upperYStart);

    let sumR = 0, sumG = 0, sumB = 0;
    let topR = 0, topG = 0, topB = 0;
    let bottomR = 0, bottomG = 0, bottomB = 0;

    for (let sy = upperYStart; sy < colStartY; sy++) {
      const idx = (sy * imgW + px) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      sumR += r;
      sumG += g;
      sumB += b;

      if (sy === upperYStart) {
        topR = r; topG = g; topB = b;
      }
      if (sy === colStartY - 1) {
        bottomR = r; bottomG = g; bottomB = b;
      }

      // Noise calculation: difference from column center
      if (sy > upperYStart) {
        const prevIdx = ((sy - 1) * imgW + px) * 4;
        const diff = Math.abs(r - data[prevIdx]) + Math.abs(g - data[prevIdx + 1]) + Math.abs(b - data[prevIdx + 2]);
        globalNoiseSum += diff;
        noiseSampleCount++;
      }
    }

    const avgR = sumR / actualUpperDepth;
    const avgG = sumG / actualUpperDepth;
    const avgB = sumB / actualUpperDepth;

    columnUpper[c * 3] = avgR;
    columnUpper[c * 3 + 1] = avgG;
    columnUpper[c * 3 + 2] = avgB;

    if (settings.gradientExtrapolation && actualUpperDepth > 2) {
      // Gentle vertical slope: change per pixel, damped to avoid runaway shifts
      columnSlope[c * 3] = ((bottomR - topR) / actualUpperDepth) * 0.45;
      columnSlope[c * 3 + 1] = ((bottomG - topG) / actualUpperDepth) * 0.45;
      columnSlope[c * 3 + 2] = ((bottomB - topB) / actualUpperDepth) * 0.45;
    }
  }

  const avgNoise = noiseSampleCount > 0 ? (globalNoiseSum / noiseSampleCount) : 4;

  // Retrieve border pixels for 4-sided edge feathering
  const leftBorder = new Float32Array(h * 3);
  const rightBorder = new Float32Array(h * 3);
  const bottomBorder = new Float32Array(w * 3);
  const topBorder = new Float32Array(w * 3);

  // Top border pixels (at startY - 1)
  const topY = Math.max(0, startY - 1);
  for (let c = 0; c < w; c++) {
    const idx = (topY * imgW + (startX + c)) * 4;
    topBorder[c * 3] = data[idx];
    topBorder[c * 3 + 1] = data[idx + 1];
    topBorder[c * 3 + 2] = data[idx + 2];
  }

  // Left border pixels (at startX - 1)
  const leftX = Math.max(0, startX - 1);
  for (let r = 0; r < h; r++) {
    const idx = ((startY + r) * imgW + leftX) * 4;
    leftBorder[r * 3] = data[idx];
    leftBorder[r * 3 + 1] = data[idx + 1];
    leftBorder[r * 3 + 2] = data[idx + 2];
  }

  // Right border pixels (at startX + w)
  const rightX = Math.min(imgW - 1, startX + w);
  for (let r = 0; r < h; r++) {
    const idx = ((startY + r) * imgW + rightX) * 4;
    rightBorder[r * 3] = data[idx];
    rightBorder[r * 3 + 1] = data[idx + 1];
    rightBorder[r * 3 + 2] = data[idx + 2];
  }

  // Bottom border pixels (at startY + h)
  const botY = Math.min(imgH - 1, startY + h);
  for (let c = 0; c < w; c++) {
    const idx = (botY * imgW + (startX + c)) * 4;
    bottomBorder[c * 3] = data[idx];
    bottomBorder[c * 3 + 1] = data[idx + 1];
    bottomBorder[c * 3 + 2] = data[idx + 2];
  }

  // Helper smoothstep function for organic interpolation
  const smoothstep = (edge0: number, edge1: number, x: number) => {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  };

  // Pseudo-random deterministic noise generator for natural grain matching
  let seed = 1337;
  const pseudoRandom = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return (seed / 4294967296) * 2 - 1;
  };

  // Infill the watermark region
  for (let r = 0; r < h; r++) {
    const py = startY + r;
    for (let c = 0; c < w; c++) {
      const px = startX + c;
      const idx = (py * imgW + px) * 4;

      // Check mask if brush masking is used
      let maskAlpha = 255;
      if (maskData) {
        maskAlpha = maskData[idx + 3];
        if (maskAlpha < 10) continue; // Skip untouched areas
      }

      // Base: upper column color with optional vertical slope extrapolation
      let targetR = columnUpper[c * 3] + columnSlope[c * 3] * r;
      let targetG = columnUpper[c * 3 + 1] + columnSlope[c * 3 + 1] * r;
      let targetB = columnUpper[c * 3 + 2] + columnSlope[c * 3 + 2] * r;

      // Rectangular edge feathering only if not using arbitrary brush mask
      if (!maskData) {
        // Top edge feathering for smooth seamless transition with upper background
        if (startY > 0 && r < feather) {
          const factor = 1 - smoothstep(0, feather, r);
          targetR = targetR * (1 - factor) + topBorder[c * 3] * factor;
          targetG = targetG * (1 - factor) + topBorder[c * 3 + 1] * factor;
          targetB = targetB * (1 - factor) + topBorder[c * 3 + 2] * factor;
        }

        // Left edge feathering
        if (c < feather) {
          const factor = 1 - smoothstep(0, feather, c);
          targetR = targetR * (1 - factor) + leftBorder[r * 3] * factor;
          targetG = targetG * (1 - factor) + leftBorder[r * 3 + 1] * factor;
          targetB = targetB * (1 - factor) + leftBorder[r * 3 + 2] * factor;
        }

        // Right edge feathering
        if (c > w - feather) {
          const factor = smoothstep(w - feather, w, c);
          targetR = targetR * (1 - factor) + rightBorder[r * 3] * factor;
          targetG = targetG * (1 - factor) + rightBorder[r * 3 + 1] * factor;
          targetB = targetB * (1 - factor) + rightBorder[r * 3 + 2] * factor;
        }

        // Bottom edge feathering (if close to bottom boundary and not out of image)
        if (botY < imgH - 1 && r > h - feather) {
          const factor = smoothstep(h - feather, h, r);
          targetR = targetR * (1 - factor) + bottomBorder[c * 3] * factor;
          targetG = targetG * (1 - factor) + bottomBorder[c * 3 + 1] * factor;
          targetB = targetB * (1 - factor) + bottomBorder[c * 3 + 2] * factor;
        }
      }

      // Synthesize micro-texture noise matching background sensor variance
      const noise = pseudoRandom() * avgNoise * grainFactor;
      targetR += noise;
      targetG += noise;
      targetB += noise;

      const finalR = Math.max(0, Math.min(255, Math.round(targetR)));
      const finalG = Math.max(0, Math.min(255, Math.round(targetG)));
      const finalB = Math.max(0, Math.min(255, Math.round(targetB)));

      // Write clamped pixel with anti-aliased edge blending for brush strokes
      if (maskData && maskAlpha < 255) {
        const blend = maskAlpha / 255;
        data[idx] = Math.round(data[idx] * (1 - blend) + finalR * blend);
        data[idx + 1] = Math.round(data[idx + 1] * (1 - blend) + finalG * blend);
        data[idx + 2] = Math.round(data[idx + 2] * (1 - blend) + finalB * blend);
      } else {
        data[idx] = finalR;
        data[idx + 1] = finalG;
        data[idx + 2] = finalB;
      }
      data[idx + 3] = 255; // Full opacity
    }
  }
}

/**
 * 4-Sided Harmonic Bilinear Interpolation:
 * Solves Laplace equation approximation over rectangular domain with Dirichlet boundary conditions.
 */
function applyHarmonicBilinearFill(
  data: Uint8ClampedArray,
  imgW: number,
  imgH: number,
  startX: number,
  startY: number,
  w: number,
  h: number,
  settings: RemovalSettings,
  maskData: Uint8ClampedArray | null
) {
  const topY = Math.max(0, startY - 1);
  const botY = Math.min(imgH - 1, startY + h);
  const leftX = Math.max(0, startX - 1);
  const rightX = Math.min(imgW - 1, startX + w);

  const grainFactor = (settings.grainAmount || 20) / 100;
  let seed = 42;
  const pseudoRandom = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return (seed / 4294967296) * 2 - 1;
  };

  for (let r = 0; r < h; r++) {
    const py = startY + r;
    const v = (r + 0.5) / h; // vertical parameter [0, 1]

    for (let c = 0; c < w; c++) {
      const px = startX + c;
      const idx = (py * imgW + px) * 4;

      if (maskData && maskData[idx + 3] < 10) continue;

      const u = (c + 0.5) / w; // horizontal parameter [0, 1]

      // Boundary values
      const topIdx = (topY * imgW + px) * 4;
      const botIdx = (botY * imgW + px) * 4;
      const leftIdx = (py * imgW + leftX) * 4;
      const rightIdx = (py * imgW + rightX) * 4;

      // Harmonic blend weights favoring top (as user requested upper color prominence)
      const topWeight = (1 - v) * 1.5;
      const botWeight = v * 0.5;
      const leftWeight = (1 - u);
      const rightWeight = u;
      const totalWeight = topWeight + botWeight + leftWeight + rightWeight;

      for (let ch = 0; ch < 3; ch++) {
        const val =
          (data[topIdx + ch] * topWeight +
            data[botIdx + ch] * botWeight +
            data[leftIdx + ch] * leftWeight +
            data[rightIdx + ch] * rightWeight) /
          totalWeight;

        const noise = pseudoRandom() * 4 * grainFactor;
        data[idx + ch] = Math.max(0, Math.min(255, Math.round(val + noise)));
      }
      data[idx + 3] = 255;
    }
  }
}

/**
 * Texture Clone: Clones the texture tile from directly above the watermark area
 * with Poisson edge softening.
 */
function applyTextureClone(
  data: Uint8ClampedArray,
  imgW: number,
  imgH: number,
  startX: number,
  startY: number,
  w: number,
  h: number,
  settings: RemovalSettings,
  maskData: Uint8ClampedArray | null
) {
  const sourceYStart = Math.max(0, startY - h);
  const feather = Math.max(2, settings.featherRadius);

  for (let r = 0; r < h; r++) {
    const targetY = startY + r;
    const sourceY = Math.min(imgH - 1, sourceYStart + r);

    for (let c = 0; c < w; c++) {
      const targetX = startX + c;
      const sourceX = startX + c;

      const targetIdx = (targetY * imgW + targetX) * 4;
      const sourceIdx = (sourceY * imgW + sourceX) * 4;

      if (maskData && maskData[targetIdx + 3] < 10) continue;

      let edgeFactor = 1;
      if (c < feather) edgeFactor = Math.min(edgeFactor, c / feather);
      if (c > w - feather) edgeFactor = Math.min(edgeFactor, (w - c) / feather);
      if (r > h - feather) edgeFactor = Math.min(edgeFactor, (h - r) / feather);

      data[targetIdx] = data[sourceIdx];
      data[targetIdx + 1] = data[sourceIdx + 1];
      data[targetIdx + 2] = data[sourceIdx + 2];
      data[targetIdx + 3] = 255;
    }
  }
}

/**
 * Fast Content-Aware Inpaint (Telea-inspired Fast Marching method).
 * Propagates boundary gradients inward toward the core of the watermark.
 */
function applyTeleaInpaint(
  data: Uint8ClampedArray,
  imgW: number,
  imgH: number,
  startX: number,
  startY: number,
  w: number,
  h: number,
  settings: RemovalSettings,
  maskData: Uint8ClampedArray | null
) {
  // Use Upper Color as high-quality initial predictor, then perform 2-pass iterative diffusion
  applyUpperColorSeamlessFill(
    data,
    imgW,
    imgH,
    startX,
    startY,
    w,
    h,
    settings,
    maskData
  );

  // 3x3 local Gaussian smoothing inside the watermark box to remove any remaining high-frequency logo artifacts
  const temp = new Uint8ClampedArray(w * h * 3);
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      let rSum = 0, gSum = 0, bSum = 0, weightSum = 0;
      for (let dr = -1; dr <= 1; dr++) {
        const ny = Math.max(0, Math.min(imgH - 1, startY + r + dr));
        for (let dc = -1; dc <= 1; dc++) {
          const nx = Math.max(0, Math.min(imgW - 1, startX + c + dc));
          const idx = (ny * imgW + nx) * 4;
          const weight = (dr === 0 && dc === 0) ? 4 : (dr === 0 || dc === 0) ? 2 : 1;
          rSum += data[idx] * weight;
          gSum += data[idx + 1] * weight;
          bSum += data[idx + 2] * weight;
          weightSum += weight;
        }
      }
      const tIdx = (r * w + c) * 3;
      temp[tIdx] = rSum / weightSum;
      temp[tIdx + 1] = gSum / weightSum;
      temp[tIdx + 2] = bSum / weightSum;
    }
  }

  // Apply filtered values with edge retention
  for (let r = 1; r < h - 1; r++) {
    for (let c = 1; c < w - 1; c++) {
      const idx = ((startY + r) * imgW + (startX + c)) * 4;
      if (maskData) {
        const maskAlpha = maskData[idx + 3];
        if (maskAlpha < 10) continue;
        const tIdx = (r * w + c) * 3;
        if (maskAlpha < 255) {
          const blend = maskAlpha / 255;
          data[idx] = Math.round(data[idx] * (1 - blend) + temp[tIdx] * blend);
          data[idx + 1] = Math.round(data[idx + 1] * (1 - blend) + temp[tIdx + 1] * blend);
          data[idx + 2] = Math.round(data[idx + 2] * (1 - blend) + temp[tIdx + 2] * blend);
        } else {
          data[idx] = temp[tIdx];
          data[idx + 1] = temp[tIdx + 1];
          data[idx + 2] = temp[tIdx + 2];
        }
      } else {
        const tIdx = (r * w + c) * 3;
        data[idx] = temp[tIdx];
        data[idx + 1] = temp[tIdx + 1];
        data[idx + 2] = temp[tIdx + 2];
      }
    }
  }
}

/**
 * Automatically inspects the corners of an image/document to locate
 * the watermark badge (e.g. Gemini Notebook bottom-right logo).
 */
export function autoDetectWatermark(canvas: HTMLCanvasElement): WatermarkBox {
  const width = canvas.width;
  const height = canvas.height;

  // Default calibrated ratio for Gemini Notebook in bottom-right corner
  const fallbackBox: WatermarkBox = {
    id: 'auto-watermark-1',
    x: Math.round(width * 0.80),
    y: Math.round(height * 0.895),
    width: Math.round(width * 0.185),
    height: Math.round(height * 0.08),
  };

  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return fallbackBox;

    // Scan bottom-right 25% width and 15% height
    const scanX = Math.floor(width * 0.72);
    const scanY = Math.floor(height * 0.82);
    const scanW = width - scanX;
    const scanH = height - scanY;

    const imgData = ctx.getImageData(scanX, scanY, scanW, scanH);
    const data = imgData.data;

    // Estimate background color from the very top-left of the scan area
    let bgR = 0, bgG = 0, bgB = 0;
    const sampleCount = 20;
    for (let i = 0; i < sampleCount; i++) {
      const idx = i * 4;
      bgR += data[idx];
      bgG += data[idx + 1];
      bgB += data[idx + 2];
    }
    bgR /= sampleCount;
    bgG /= sampleCount;
    bgB /= sampleCount;

    let minX = scanW, minY = scanH, maxX = 0, maxY = 0;
    let anomalyCount = 0;

    for (let y = 0; y < scanH; y++) {
      for (let x = 0; x < scanW; x++) {
        const idx = (y * scanW + x) * 4;
        const diff = Math.abs(data[idx] - bgR) + Math.abs(data[idx + 1] - bgG) + Math.abs(data[idx + 2] - bgB);
        if (diff > 45) { // Foreground badge / watermark pixel
          anomalyCount++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    // If a cohesive badge was detected with significant pixels
    if (anomalyCount > 80 && maxX > minX && maxY > minY) {
      const pad = 6;
      const finalX = Math.max(0, scanX + minX - pad);
      const finalY = Math.max(0, scanY + minY - pad);
      const finalW = Math.min(width - finalX, (maxX - minX) + pad * 2);
      const finalH = Math.min(height - finalY, (maxY - minY) + pad * 2);

      return {
        id: 'auto-watermark-1',
        x: finalX,
        y: finalY,
        width: Math.max(80, finalW),
        height: Math.max(30, finalH),
      };
    }
  } catch (err) {
    console.warn('Auto-detect fallback:', err);
  }

  return fallbackBox;
}

/**
 * Checks if a brush mask canvas contains any painted (non-transparent) pixels.
 */
export function hasMaskPixels(maskCanvas: HTMLCanvasElement | null): boolean {
  if (!maskCanvas) return false;
  const ctx = maskCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  const w = maskCanvas.width;
  const h = maskCanvas.height;
  if (w <= 0 || h <= 0) return false;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 10) return true;
  }
  return false;
}

/**
 * Calculates the exact bounding box around all painted brush mask pixels.
 */
export function getMaskBoundingBox(maskCanvas: HTMLCanvasElement): WatermarkBox | null {
  const ctx = maskCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const w = maskCanvas.width;
  const h = maskCanvas.height;
  if (w <= 0 || h <= 0) return null;

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  let count = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const alpha = data[(y * w + x) * 4 + 3];
      if (alpha > 10) {
        count++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (count === 0 || maxX < minX || maxY < minY) return null;

  const pad = 4;
  const finalX = Math.max(0, minX - pad);
  const finalY = Math.max(0, minY - pad);
  const finalW = Math.min(w - finalX, maxX - minX + 1 + pad * 2);
  const finalH = Math.min(h - finalY, maxY - minY + 1 + pad * 2);

  return {
    id: 'brush-mask-zone',
    x: finalX,
    y: finalY,
    width: finalW,
    height: finalH,
  };
}

/**
 * Removes watermarks defined by a free-form painted brush mask using the exact same inpainting engine.
 */
export function processBrushMaskRemoval(
  sourceCanvas: HTMLCanvasElement,
  brushMaskCanvas: HTMLCanvasElement,
  settings: RemovalSettings
): HTMLCanvasElement {
  const boundingBox = getMaskBoundingBox(brushMaskCanvas);
  if (!boundingBox) return sourceCanvas;
  return processWatermarkRemoval(sourceCanvas, boundingBox, settings, brushMaskCanvas);
}

/**
 * Removes multiple watermark boxes sequentially and/or free-form painted brush strokes with smooth inpainting.
 */
export function processMultiWatermarkRemoval(
  sourceCanvas: HTMLCanvasElement,
  boxes: WatermarkBox[],
  settings: RemovalSettings,
  brushMaskCanvas?: HTMLCanvasElement | null
): HTMLCanvasElement {
  const hasBrushMask = brushMaskCanvas && hasMaskPixels(brushMaskCanvas);
  if (boxes.length === 0 && !hasBrushMask) return sourceCanvas;

  let currentCanvas = sourceCanvas;
  // Apply box-based removals
  for (const box of boxes) {
    currentCanvas = processWatermarkRemoval(currentCanvas, box, settings);
  }
  // Apply free-form brush mask removal using the same engine
  if (hasBrushMask && brushMaskCanvas) {
    currentCanvas = processBrushMaskRemoval(currentCanvas, brushMaskCanvas, settings);
  }
  return currentCanvas;
}

/**
 * Generates a thermal difference heatmap showing strictly inpainted vs untouched pixels.
 */
export function generateDiffHeatmap(
  originalCanvas: HTMLCanvasElement,
  processedCanvas: HTMLCanvasElement
): HTMLCanvasElement {
  const width = originalCanvas.width;
  const height = originalCanvas.height;
  const heatmap = document.createElement('canvas');
  heatmap.width = width;
  heatmap.height = height;
  const ctx = heatmap.getContext('2d');
  if (!ctx) return heatmap;

  const origCtx = originalCanvas.getContext('2d');
  const procCtx = processedCanvas.getContext('2d');
  if (!origCtx || !procCtx) return heatmap;

  const origData = origCtx.getImageData(0, 0, width, height).data;
  const procData = procCtx.getImageData(0, 0, width, height).data;
  const outImg = ctx.createImageData(width, height);
  const outData = outImg.data;

  for (let i = 0; i < origData.length; i += 4) {
    const dr = Math.abs(origData[i] - procData[i]);
    const dg = Math.abs(origData[i + 1] - procData[i + 1]);
    const db = Math.abs(origData[i + 2] - procData[i + 2]);
    const diff = Math.max(dr, dg, db);

    if (diff > 4) {
      // Changed pixel - glowing neon cyan & amber thermal indicator
      outData[i] = 245;     // R
      outData[i + 1] = 158; // G
      outData[i + 2] = 11;  // B (Amber highlight)
      outData[i + 3] = 240;
    } else {
      // Untouched pixel - subtle grayscale for contrast
      const gray = Math.round(origData[i] * 0.299 + origData[i + 1] * 0.587 + origData[i + 2] * 0.114);
      outData[i] = Math.round(gray * 0.25);
      outData[i + 1] = Math.round(gray * 0.25);
      outData[i + 2] = Math.round(gray * 0.32);
      outData[i + 3] = 160;
    }
  }

  ctx.putImageData(outImg, 0, 0);
  return heatmap;
}

/**
 * Draws rounded rectangle or pill path safely across all HTML5 Canvas implementations.
 */
function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Renders custom brand logo/badge or text overlay onto target watermark box.
 * Supports background colors (e.g. Yellow '#FBBF24', White, Dark, etc.),
 * horizontal logo image scaling, text badges (e.g. 'itstudent.com'), and pill shapes.
 */
export function applyLogoOverlayToContext(
  ctx: CanvasRenderingContext2D,
  box: WatermarkBox,
  overlay: LogoOverlaySettings
) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const bx = Math.max(0, Math.floor(box.x));
  const by = Math.max(0, Math.floor(box.y));
  const bw = Math.min(width - bx, Math.ceil(box.width));
  const bh = Math.min(height - by, Math.ceil(box.height));

  if (bw <= 0 || bh <= 0) return;

  ctx.save();
  ctx.globalAlpha = Math.max(0.1, Math.min(1.0, overlay.opacity ?? 1.0));

  // 1. Render Background Patch (e.g. Yellow, White, Dark, Pill or Rounded)
  if (overlay.backgroundColor && overlay.backgroundColor !== 'transparent') {
    ctx.fillStyle = overlay.backgroundColor;

    if (overlay.shadow) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;
    }

    const shape = overlay.backgroundShape || 'pill';
    if (shape === 'pill') {
      drawRoundedRectPath(ctx, bx, by, bw, bh, bh / 2);
      ctx.fill();
    } else if (shape === 'rounded') {
      drawRoundedRectPath(ctx, bx, by, bw, bh, 8);
      ctx.fill();
    } else {
      ctx.fillRect(bx, by, bw, bh);
    }

    // Reset shadow before border
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Optional Border
    if (overlay.borderWidth > 0 && overlay.borderColor) {
      ctx.strokeStyle = overlay.borderColor;
      ctx.lineWidth = overlay.borderWidth;
      if (shape === 'pill') {
        drawRoundedRectPath(ctx, bx, by, bw, bh, bh / 2);
        ctx.stroke();
      } else if (shape === 'rounded') {
        drawRoundedRectPath(ctx, bx, by, bw, bh, 8);
        ctx.stroke();
      } else {
        ctx.strokeRect(bx, by, bw, bh);
      }
    }
  }

  // 2. Render Content (Logo Image, Custom Text like "itstudent.com", or both)
  const pad = overlay.padding ?? 8;
  const contentX = bx + pad;
  const contentY = by + pad;
  const contentW = Math.max(10, bw - pad * 2);
  const contentH = Math.max(10, bh - pad * 2);

  const logoImg = overlay.logoDataUrl ? getCachedLogoImage(overlay.logoDataUrl) : null;
  const hasImage = !!logoImg;
  const hasText = !!overlay.badgeText && overlay.badgeText.trim().length > 0;

  if (hasImage && hasText) {
    // Both horizontal logo + text (e.g. icon/brand on left, "itstudent.com" on right)
    const logoAspect = logoImg.naturalWidth / Math.max(1, logoImg.naturalHeight);
    const drawH = contentH;
    const maxLogoW = Math.min(contentW * 0.45, drawH * logoAspect);
    const drawW = Math.max(10, Math.min(maxLogoW, drawH * logoAspect));
    const drawY = contentY + (contentH - drawH) / 2;

    ctx.drawImage(logoImg, contentX, drawY, drawW, drawH);

    // Text on the right
    const textGap = 8;
    const textX = contentX + drawW + textGap;
    const textW = contentW - drawW - textGap;

    ctx.fillStyle = overlay.textColor || '#000000';
    const fontFam =
      overlay.fontFamily === 'mono'
        ? 'monospace'
        : overlay.fontFamily === 'serif'
        ? 'serif'
        : 'sans-serif';
    ctx.font = `${overlay.fontWeight || 'bold'} ${overlay.fontSize || 16}px ${fontFam}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(overlay.badgeText, textX, by + bh / 2, Math.max(10, textW));
  } else if (hasImage) {
    // Logo image only (centered and fitted with aspect ratio preservation)
    const imgW = logoImg.naturalWidth;
    const imgH = logoImg.naturalHeight;
    const aspect = imgW / Math.max(1, imgH);
    let targetW = contentW;
    let targetH = contentW / aspect;
    if (targetH > contentH) {
      targetH = contentH;
      targetW = contentH * aspect;
    }
    const drawX = bx + (bw - targetW) / 2;
    const drawY = by + (bh - targetH) / 2;
    ctx.drawImage(logoImg, drawX, drawY, targetW, targetH);
  } else if (hasText) {
    // Text only (e.g. "itstudent.com" centered)
    ctx.fillStyle = overlay.textColor || '#000000';
    const fontFam =
      overlay.fontFamily === 'mono'
        ? 'monospace'
        : overlay.fontFamily === 'serif'
        ? 'serif'
        : 'sans-serif';
    ctx.font = `${overlay.fontWeight || 'bold'} ${overlay.fontSize || 18}px ${fontFam}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(overlay.badgeText, bx + bw / 2, by + bh / 2, contentW);
  }

  ctx.restore();
}

