/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { PdfPageData, RemovalSettings, WatermarkBox } from '../types';
import { processWatermarkRemoval } from './watermarkEngine';

// Configure the worker source using our local static worker in /public
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

/**
 * Loads a PDF file from an ArrayBuffer, renders all pages to high-resolution
 * HTML canvases, and returns structured page data.
 */
export async function renderPdfPages(fileBuffer: ArrayBuffer): Promise<PdfPageData[]> {
  const loadingTask = pdfjsLib.getDocument({ data: fileBuffer });
  const pdf = await loadingTask.promise;
  const pages: PdfPageData[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    // Render at 2x scale for crystal-clear retina document quality
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) continue;

    // Set white background default
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render page
    await page.render({
      canvasContext: ctx,
      viewport: viewport,
      canvas: canvas,
    }).promise;

    pages.push({
      pageNumber: pageNum,
      originalCanvasDataUrl: canvas.toDataURL('image/png'),
      processedCanvasDataUrl: null,
      width: canvas.width,
      height: canvas.height,
    });
  }

  return pages;
}

/**
 * Applies watermark removal to a specific PDF page canvas.
 */
export function removeWatermarkFromPageCanvas(
  pageCanvas: HTMLCanvasElement,
  box: WatermarkBox,
  settings: RemovalSettings
): HTMLCanvasElement {
  return processWatermarkRemoval(pageCanvas, box, settings);
}

/**
 * Helper to convert DataURL to HTMLCanvasElement
 */
export function dataUrlToCanvas(dataUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas);
      } else {
        reject(new Error('Failed to get 2d context'));
      }
    };
    img.onerror = (e) => reject(e);
    img.src = dataUrl;
  });
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const commaIdx = dataUrl.indexOf(',');
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Re-compiles all cleaned page canvases back into a single downloadable PDF document.
 */
export async function exportCleanPdf(
  pages: PdfPageData[]
): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();

  for (const page of pages) {
    const dataUrl = page.processedCanvasDataUrl || page.originalCanvasDataUrl;
    // Extract binary image data directly without fetch
    const imageBytes = dataUrlToUint8Array(dataUrl);

    const embeddedImage = await pdfDoc.embedPng(imageBytes);
    // Page dimensions at standard 72 DPI points (since canvas was rendered at 2x)
    const pageWidth = page.width / 2;
    const pageHeight = page.height / 2;

    const pdfPage = pdfDoc.addPage([pageWidth, pageHeight]);
    pdfPage.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    });
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}
