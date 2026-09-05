/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Columns,
  Cpu,
  Download,
  Eye,
  FileCheck,
  FileText,
  HelpCircle,
  Info,
  Layers,
  Lock,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Wand2,
} from 'lucide-react';

import {
  DocumentItem,
  PdfPageData,
  RemovalSettings,
  ViewMode,
  WatermarkBox,
} from './types';
import {
  autoDetectWatermark,
  processMultiWatermarkRemoval,
  processWatermarkRemoval,
} from './lib/watermarkEngine';
import { dataUrlToCanvas, exportCleanPdf, renderPdfPages } from './lib/pdfEngine';
import { Header } from './components/Header';
import { CanvasEditor } from './components/CanvasEditor';
import { ThreeCanvas3D } from './components/ThreeCanvas3D';
import { ComparisonSlider } from './components/ComparisonSlider';
import { InspectorLoupe } from './components/InspectorLoupe';
import { RemovalControls } from './components/RemovalControls';
import { PdfPagesManager } from './components/PdfPagesManager';
import { DiffHeatmapView } from './components/DiffHeatmapView';

export default function App() {
  // Current Document State
  const [docItem, setDocItem] = useState<DocumentItem | null>(null);
  const [pdfPages, setPdfPages] = useState<PdfPageData[]>([]);
  const [currentPdfPageIndex, setCurrentPdfPageIndex] = useState<number>(0);

  // Active Canvases
  const [originalCanvas, setOriginalCanvas] = useState<HTMLCanvasElement | null>(null);
  const [processedCanvas, setProcessedCanvas] = useState<HTMLCanvasElement | null>(null);

  // Watermark Bounding Boxes (supports single or multi-zone)
  const [watermarkBoxes, setWatermarkBoxes] = useState<WatermarkBox[]>([
    {
      id: 'gemini-notebook',
      x: 1040,
      y: 650,
      width: 220,
      height: 55,
    },
  ]);
  const [activeBoxIndex, setActiveBoxIndex] = useState<number>(0);
  const watermarkBox = watermarkBoxes[activeBoxIndex] || watermarkBoxes[0];

  // Settings
  const [settings, setSettings] = useState<RemovalSettings>({
    algorithm: 'upper-color-gradient', // Default: exact user-requested upper color extrapolation
    sampleBandHeight: 18,
    featherRadius: 6,
    grainAmount: 22,
    gradientExtrapolation: true,
    colorTintAdjustment: null,
    logoOverlay: {
      enabled: false,
      actionType: 'inpaint',
      logoDataUrl: null,
      badgeText: 'itstudent.com',
      textColor: '#000000',
      fontSize: 18,
      fontFamily: 'sans',
      fontWeight: 'bold',
      backgroundColor: '#FBBF24', // Yellow default as requested by user
      backgroundShape: 'pill',
      borderWidth: 0,
      borderColor: '#F59E0B',
      opacity: 1.0,
      padding: 8,
      shadow: true,
    },
  });

  // View States
  const [viewMode, setViewMode] = useState<ViewMode>('2d-editor');
  const [showProcessed, setShowProcessed] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isProcessingAllPages, setIsProcessingAllPages] = useState<boolean>(false);
  const [hasProcessed, setHasProcessed] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Update a single box in the array
  const handleWatermarkBoxChange = (updatedBox: WatermarkBox) => {
    setWatermarkBoxes((prev) => {
      const next = [...prev];
      next[activeBoxIndex] = updatedBox;
      return next;
    });
  };

  // Add an additional watermark box
  const handleAddBox = () => {
    if (!originalCanvas) return;
    const w = originalCanvas.width;
    const h = originalCanvas.height;
    const newBox: WatermarkBox = {
      id: `watermark-zone-${watermarkBoxes.length + 1}`,
      x: Math.round(w * 0.05),
      y: Math.round(h * 0.90),
      width: Math.round(w * 0.18),
      height: Math.round(h * 0.075),
    };
    const updatedBoxes = [...watermarkBoxes, newBox];
    setWatermarkBoxes(updatedBoxes);
    setActiveBoxIndex(updatedBoxes.length - 1);

    // Re-inpaint both
    const cleaned = processMultiWatermarkRemoval(originalCanvas, updatedBoxes, settings);
    setProcessedCanvas(cleaned);
    setStatusMessage(`Added Zone #${updatedBoxes.length}. Both watermarks removed.`);
  };

  // Helper to load image URL into canvas and automatically clean on upload
  const loadImageToCanvas = useCallback(
    (url: string, name: string, isPdf = false) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 1280;
        canvas.height = img.naturalHeight || 720;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          setOriginalCanvas(canvas);

          // 1. Automatically detect the watermark badge in corners
          const detectedBox = autoDetectWatermark(canvas);
          setWatermarkBoxes([detectedBox]);
          setActiveBoxIndex(0);

          // 2. Automatically remove the watermark immediately on upload
          const initialClean = processWatermarkRemoval(canvas, detectedBox, settings);
          setProcessedCanvas(initialClean);
          setHasProcessed(true);
          setShowProcessed(true);

          setDocItem({
            id: 'doc-' + Date.now(),
            name,
            type: isPdf ? 'pdf' : 'image',
            fileSize: 1024 * 350,
            originalUrl: url,
            processedUrl: initialClean.toDataURL('image/png'),
            width: canvas.width,
            height: canvas.height,
          });

          setStatusMessage(`✓ Watermark automatically removed from "${name}". Ready to download!`);
        }
      };
      img.src = url;
    },
    [settings]
  );

  // Load default sample on mount ($4T AI Startup with Gemini Notebook watermark)
  useEffect(() => {
    loadImageToCanvas('/samples/startup_infographic.svg', 'AI_Startup_Infographic.svg');
  }, []);

  // Handle Manual Removal Execution
  const handleApplyRemoval = useCallback(() => {
    if (!originalCanvas) return;
    setIsProcessing(true);

    setTimeout(() => {
      try {
        const cleaned = processMultiWatermarkRemoval(originalCanvas, watermarkBoxes, settings);
        setProcessedCanvas(cleaned);
        setShowProcessed(true);
        setHasProcessed(true);
        setStatusMessage('Watermark removed using upper-color gradient extrapolation.');

        // If in PDF mode, update current page
        if (pdfPages.length > 0) {
          const updated = [...pdfPages];
          updated[currentPdfPageIndex] = {
            ...updated[currentPdfPageIndex],
            processedCanvasDataUrl: cleaned.toDataURL('image/png'),
            watermarkBox,
          };
          setPdfPages(updated);
        }
      } catch (err) {
        console.error('Removal error:', err);
      } finally {
        setIsProcessing(false);
      }
    }, 60);
  }, [originalCanvas, watermarkBoxes, settings, pdfPages, currentPdfPageIndex, watermarkBox]);

  // Handle Automatic Re-detection on demand
  const handleAutoDetect = useCallback(() => {
    if (!originalCanvas) return;
    const detected = autoDetectWatermark(originalCanvas);
    setWatermarkBoxes([detected]);
    setActiveBoxIndex(0);

    const cleaned = processWatermarkRemoval(originalCanvas, detected, settings);
    setProcessedCanvas(cleaned);
    setShowProcessed(true);
    setHasProcessed(true);
    setStatusMessage('✨ Auto-detected watermark badge and refreshed clean result.');
  }, [originalCanvas, settings]);

  // Handle Re-processing when box or settings change if already processed
  useEffect(() => {
    if (originalCanvas && hasProcessed) {
      const cleaned = processMultiWatermarkRemoval(originalCanvas, watermarkBoxes, settings);
      setProcessedCanvas(cleaned);
    }
  }, [watermarkBoxes, settings]);

  // Handle PDF Batch Processing ("Apply to all pages")
  const handleApplyToAllPages = async () => {
    if (pdfPages.length === 0) return;
    setIsProcessingAllPages(true);

    try {
      const updatedPages: PdfPageData[] = [];
      for (const page of pdfPages) {
        const pageCanvas = await dataUrlToCanvas(page.originalCanvasDataUrl);
        const cleanedCanvas = processMultiWatermarkRemoval(pageCanvas, watermarkBoxes, settings);
        updatedPages.push({
          ...page,
          processedCanvasDataUrl: cleanedCanvas.toDataURL('image/png'),
          watermarkBox,
        });
      }
      setPdfPages(updatedPages);

      // Update current displayed canvas
      if (updatedPages[currentPdfPageIndex]) {
        const currCanvas = await dataUrlToCanvas(
          updatedPages[currentPdfPageIndex].processedCanvasDataUrl!
        );
        setProcessedCanvas(currCanvas);
      }

      setStatusMessage(`Watermark removed across all ${pdfPages.length} PDF pages!`);
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.7 },
      });
    } catch (err) {
      console.error('Batch error:', err);
    } finally {
      setIsProcessingAllPages(false);
    }
  };

  // PDF Page Selection
  const handleSelectPdfPage = async (index: number) => {
    if (!pdfPages[index]) return;
    setCurrentPdfPageIndex(index);
    const targetPage = pdfPages[index];

    const orig = await dataUrlToCanvas(targetPage.originalCanvasDataUrl);
    setOriginalCanvas(orig);

    if (targetPage.processedCanvasDataUrl) {
      const proc = await dataUrlToCanvas(targetPage.processedCanvasDataUrl);
      setProcessedCanvas(proc);
    } else {
      const proc = processMultiWatermarkRemoval(orig, watermarkBoxes, settings);
      setProcessedCanvas(proc);
    }
  };

  // File Upload Handler (Images & PDFs) - Automatically removes watermark on upload!
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'application/pdf') {
      try {
        setStatusMessage('Reading PDF & automatically removing watermarks across pages...');
        const buffer = await file.arrayBuffer();
        const pages = await renderPdfPages(buffer);
        if (pages.length > 0) {
          // Auto-clean the first page immediately
          const firstCanvas = await dataUrlToCanvas(pages[0].originalCanvasDataUrl);
          setOriginalCanvas(firstCanvas);

          const detectedBox = autoDetectWatermark(firstCanvas);
          setWatermarkBoxes([detectedBox]);
          setActiveBoxIndex(0);

          // Clean all pages automatically on upload so user can download right away!
          const cleanedPages: PdfPageData[] = [];
          for (let i = 0; i < pages.length; i++) {
            const pageCanvas = await dataUrlToCanvas(pages[i].originalCanvasDataUrl);
            const box = autoDetectWatermark(pageCanvas);
            const clean = processWatermarkRemoval(pageCanvas, box, settings);
            cleanedPages.push({
              ...pages[i],
              processedCanvasDataUrl: clean.toDataURL('image/png'),
              watermarkBox: box,
            });
          }

          setPdfPages(cleanedPages);
          setCurrentPdfPageIndex(0);

          const firstClean = await dataUrlToCanvas(cleanedPages[0].processedCanvasDataUrl!);
          setProcessedCanvas(firstClean);
          setHasProcessed(true);
          setShowProcessed(true);

          setDocItem({
            id: 'pdf-' + Date.now(),
            name: file.name,
            type: 'pdf',
            fileSize: file.size,
            originalUrl: pages[0].originalCanvasDataUrl,
            processedUrl: firstClean.toDataURL('image/png'),
            width: firstCanvas.width,
            height: firstCanvas.height,
            pageCount: pages.length,
          });

          setStatusMessage(`✓ All ${pages.length} pages cleaned automatically! Ready to download.`);
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.7 },
          });
        }
      } catch (err) {
        console.error('PDF load error:', err);
        alert('Failed to parse PDF locally: ' + (err as Error).message);
      }
    } else if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setPdfPages([]);
        loadImageToCanvas(reader.result as string, file.name, false);
      };
      reader.readAsDataURL(file);
    }
  };

  // Sample Loader
  const handleLoadSample = async (sampleType: 'gemini-startup' | 'pdf-report') => {
    if (sampleType === 'gemini-startup') {
      setPdfPages([]);
      loadImageToCanvas('/samples/startup_infographic.svg', 'AI_Startup_Infographic.svg');
    } else if (sampleType === 'pdf-report') {
      try {
        setStatusMessage('Loading and auto-cleaning sample PDF report...');
        const response = await fetch('/samples/sample_report.pdf');
        const buffer = await response.arrayBuffer();
        const pages = await renderPdfPages(buffer);

        const firstCanvas = await dataUrlToCanvas(pages[0].originalCanvasDataUrl);
        setOriginalCanvas(firstCanvas);

        const detectedBox = autoDetectWatermark(firstCanvas);
        setWatermarkBoxes([detectedBox]);
        setActiveBoxIndex(0);

        // Pre-clean all sample pages
        const cleanedPages: PdfPageData[] = [];
        for (let i = 0; i < pages.length; i++) {
          const pageCanvas = await dataUrlToCanvas(pages[i].originalCanvasDataUrl);
          const box = autoDetectWatermark(pageCanvas);
          const clean = processWatermarkRemoval(pageCanvas, box, settings);
          cleanedPages.push({
            ...pages[i],
            processedCanvasDataUrl: clean.toDataURL('image/png'),
            watermarkBox: box,
          });
        }

        setPdfPages(cleanedPages);
        setCurrentPdfPageIndex(0);

        const firstClean = await dataUrlToCanvas(cleanedPages[0].processedCanvasDataUrl!);
        setProcessedCanvas(firstClean);
        setHasProcessed(true);
        setShowProcessed(true);

        setDocItem({
          id: 'pdf-sample',
          name: 'Healthcare_Report_2026.pdf',
          type: 'pdf',
          fileSize: buffer.byteLength,
          originalUrl: pages[0].originalCanvasDataUrl,
          processedUrl: firstClean.toDataURL('image/png'),
          width: firstCanvas.width,
          height: firstCanvas.height,
          pageCount: pages.length,
        });

        setStatusMessage('✓ 2-Page PDF automatically cleaned! Ready to download.');
      } catch (err) {
        console.error('Failed to load sample PDF:', err);
      }
    }
  };

  // Download Image (PNG or JPEG)
  const handleDownloadImage = (format: 'png' | 'jpeg') => {
    if (!processedCanvas) return;

    const mime = format === 'png' ? 'image/png' : 'image/jpeg';
    const dataUrl = processedCanvas.toDataURL(mime, 0.98);

    const a = document.createElement('a');
    a.href = dataUrl;
    const baseName = docItem?.name?.replace(/\.[^/.]+$/, '') || 'cleaned_image';
    a.download = `${baseName}_no_watermark.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 },
    });
  };

  // Download PDF
  const handleDownloadPdf = async () => {
    if (pdfPages.length === 0) return;
    setStatusMessage('Compiling clean PDF document...');

    try {
      const pdfBlob = await exportCleanPdf(pdfPages);
      const url = URL.createObjectURL(pdfBlob);

      const a = document.createElement('a');
      a.href = url;
      const baseName = docItem?.name?.replace(/\.[^/.]+$/, '') || 'cleaned_document';
      a.download = `${baseName}_no_watermark.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatusMessage('Clean PDF downloaded successfully!');
      confetti({
        particleCount: 70,
        spread: 80,
        origin: { y: 0.8 },
      });
    } catch (err) {
      console.error('PDF export error:', err);
      alert('Failed to export PDF: ' + (err as Error).message);
    }
  };

  const isPdf = docItem?.type === 'pdf';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Sleek Navigation Bar with Direct Download Button */}
      <Header
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onFileUpload={handleFileUpload}
        onLoadSample={handleLoadSample}
        isDocumentLoaded={!!docItem}
        documentName={docItem?.name || ''}
        isPdfDocument={isPdf}
        onQuickDownload={() => (isPdf ? handleDownloadPdf() : handleDownloadImage('png'))}
      />

      {/* Main Workspace Body */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden max-w-[1600px] w-full mx-auto">
        {/* Main Central Stage Area */}
        <main className="flex-1 p-4 sm:p-6 flex flex-col gap-5 overflow-y-auto">
          {/* Unmissable, Super Easy-to-Use Top Action & Download Hero Banner */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-indigo-950/60 via-slate-900/80 to-slate-900/60 border border-indigo-500/30 backdrop-blur-md shadow-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    {isPdf
                      ? `Clean PDF Ready (${pdfPages.length} Pages Cleaned)`
                      : 'Clean Result Ready (Watermark Removed)'}
                  </h2>
                  {settings.logoOverlay?.enabled && settings.logoOverlay.actionType !== 'inpaint' ? (
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Overlay: {settings.logoOverlay.logoFileName || settings.logoOverlay.badgeText || 'Brand Badge'}
                    </span>
                  ) : (
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Auto-Cleaned on Upload
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                  <span>
                    File: <strong className="text-slate-200">{docItem?.name || 'Document'}</strong>
                  </span>
                  <span className="text-slate-600">•</span>
                  <span>
                    {originalCanvas ? `${originalCanvas.width} × ${originalCanvas.height} px` : ''}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-indigo-400 font-medium">
                    {settings.logoOverlay?.enabled && settings.logoOverlay.actionType !== 'inpaint'
                      ? `Brand Overlay (${settings.logoOverlay.backgroundShape} • ${settings.logoOverlay.backgroundColor})`
                      : 'Upper-Color Extrapolation Applied'}
                  </span>
                </p>
              </div>
            </div>

            {/* Prominent, Large High-Contrast Download Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {isPdf ? (
                <button
                  id="hero-download-clean-pdf"
                  onClick={handleDownloadPdf}
                  className="flex-1 sm:flex-none px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-slate-950" />
                  <span>Download Clean PDF ({pdfPages.length} Pages)</span>
                </button>
              ) : (
                <>
                  <button
                    id="hero-download-clean-png"
                    onClick={() => handleDownloadImage('png')}
                    className="flex-1 sm:flex-none px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-slate-950" />
                    <span>Download Clean Image (PNG)</span>
                  </button>
                  <button
                    id="hero-download-clean-jpg"
                    onClick={() => handleDownloadImage('jpeg')}
                    className="px-3.5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-all cursor-pointer"
                    title="Download as high quality JPEG"
                  >
                    JPG
                  </button>
                </>
              )}

              {/* Fast View Toggle */}
              <button
                id="btn-quick-peek"
                onClick={() => setShowProcessed(!showProcessed)}
                className={`px-3 py-3 rounded-xl font-medium text-xs border transition-all flex items-center gap-1.5 ${
                  showProcessed
                    ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
                    : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                }`}
                title="Toggle between clean image and original with watermark"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{showProcessed ? 'Showing: Clean' : 'Showing: Original'}</span>
              </button>
            </div>
          </div>

          {/* PDF Page Manager (Rendered if multi-page PDF loaded) */}
          {pdfPages.length > 1 && (
            <PdfPagesManager
              pages={pdfPages}
              currentPageIndex={currentPdfPageIndex}
              onSelectPage={handleSelectPdfPage}
              onApplyToAllPages={handleApplyToAllPages}
              isProcessingAll={isProcessingAllPages}
            />
          )}

          {/* Primary Interactive Stage */}
          <div className="w-full">
            {viewMode === '2d-editor' && (
              <CanvasEditor
                originalCanvas={originalCanvas}
                processedCanvas={processedCanvas}
                watermarkBox={watermarkBox}
                onWatermarkBoxChange={handleWatermarkBoxChange}
                settings={settings}
                showProcessed={showProcessed}
                onToggleProcessed={() => setShowProcessed(!showProcessed)}
                brushMaskCanvas={null}
                isProcessing={isProcessing}
                onAutoDetect={handleAutoDetect}
              />
            )}

            {viewMode === 'split-compare' && (
              <ComparisonSlider
                originalCanvas={originalCanvas}
                processedCanvas={processedCanvas}
              />
            )}

            {viewMode === 'diff-heatmap' && (
              <DiffHeatmapView
                originalCanvas={originalCanvas}
                processedCanvas={processedCanvas}
              />
            )}

            {viewMode === '3d-hologram' && (
              <ThreeCanvas3D
                originalCanvas={originalCanvas}
                processedCanvas={processedCanvas}
                watermarkBox={watermarkBox}
                isProcessing={isProcessing}
              />
            )}
          </div>

          {/* High-Precision Corner Loupe / Magnifier */}
          <InspectorLoupe
            originalCanvas={originalCanvas}
            processedCanvas={processedCanvas}
            watermarkBox={watermarkBox}
          />

          {/* Removal Controls & Fine-Tuning Panel (Clean, non-chaotic drawer) */}
          <RemovalControls
            settings={settings}
            onSettingsChange={setSettings}
            onApplyRemoval={handleApplyRemoval}
            onReset={() => {
              if (originalCanvas) {
                setProcessedCanvas(originalCanvas);
                setShowProcessed(false);
                setStatusMessage('Reset canvas back to original watermark.');
              }
            }}
            onDownloadImage={handleDownloadImage}
            onDownloadPdf={handleDownloadPdf}
            isPdfDocument={isPdf}
            isProcessing={isProcessing}
            hasProcessed={hasProcessed}
            onAutoDetect={handleAutoDetect}
            onAddBox={handleAddBox}
          />

          {/* Technical Explainer (Non-intrusive footer card) */}
          <section className="p-5 rounded-2xl bg-slate-900/30 border border-slate-800 text-xs text-slate-400 flex flex-col gap-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" />
              Seamless Inpainting Architecture
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-slate-300">
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <strong className="text-indigo-400 block mb-1">1. Upper Color Sampling</strong>
                Samples color profile directly above the watermark boundary ({settings.sampleBandHeight}px) so background gradients transition smoothly.
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <strong className="text-indigo-400 block mb-1">2. Continuous Gradient Flow</strong>
                Propagates luminance slope downward across the logo zone, avoiding visible patches or flat rectangular artifacts.
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <strong className="text-indigo-400 block mb-1">3. Mathematical Verification</strong>
                Switch to <strong>Diff Heatmap</strong> to inspect modified pixels with zero alteration to surrounding infographics or text.
              </div>
            </div>
          </section>
        </main>

        {/* Sleek Interface Right Aside: Queue Panel */}
        <aside className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-900/30 p-5 flex flex-col justify-between gap-6 shrink-0">
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center justify-between">
              <span>Queue & Documents</span>
              <span className="text-[10px] text-indigo-400 font-mono">
                {pdfPages.length > 0 ? `${pdfPages.length} Pages` : '1 Item'}
              </span>
            </h3>

            <div className="space-y-3">
              {/* Active Current Item */}
              <div className="p-3 bg-indigo-600/10 rounded-lg border border-indigo-500/30 transition-all">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-medium text-white truncate max-w-[140px]">
                    {docItem?.name || 'Document'}
                  </span>
                  <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider">
                    Cleaned
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full w-full bg-emerald-500" />
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>
                    {docItem?.width} × {docItem?.height} px
                  </span>
                  <span className="text-emerald-400 font-semibold">
                    100% Inpainted
                  </span>
                </div>
              </div>

              {/* Sample 1 in queue */}
              <button
                type="button"
                onClick={() => handleLoadSample('gemini-startup')}
                className="w-full text-left p-3 bg-slate-800/50 hover:bg-slate-800/80 rounded-lg border border-slate-700/80 transition-all group cursor-pointer"
              >
                <div className="flex justify-between items-start mb-1.5">
                  <span className="text-xs font-medium text-slate-300 group-hover:text-white truncate max-w-[140px]">
                    AI_Startup_Infographic.svg
                  </span>
                  <span className="text-[10px] text-emerald-400 uppercase font-bold">Clean</span>
                </div>
                <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden">
                  <div className="w-full h-full bg-emerald-500" />
                </div>
              </button>

              {/* Sample 2 in queue */}
              <button
                type="button"
                onClick={() => handleLoadSample('pdf-report')}
                className="w-full text-left p-3 bg-slate-800/30 hover:bg-slate-800/60 rounded-lg border border-slate-700/50 transition-all group cursor-pointer"
              >
                <div className="flex justify-between items-start mb-1.5">
                  <span className="text-xs font-medium text-slate-400 group-hover:text-white truncate max-w-[140px]">
                    Healthcare_Report_2026.pdf
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase font-bold">2 Pages</span>
                </div>
                <div className="w-full h-1 bg-slate-700 rounded-full" />
              </button>
            </div>
          </div>

          {/* Local Processing Guarantee Card */}
          <div className="pt-4 border-t border-slate-800">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-lg shrink-0">
                🔒
              </div>
              <div>
                <p className="text-[11px] font-bold text-white">Local Processing</p>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Files never leave your browser. GPU & Canvas accelerated.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Sleek Interface Bottom Ticker Bar */}
      <footer className="h-8 bg-indigo-600 flex items-center px-6 justify-between text-[10px] font-medium text-white select-none z-20 shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
            STATUS: READY
          </span>
          <span className="hidden sm:inline text-indigo-200">•</span>
          <span className="hidden sm:inline">GPU ACCELERATION: ACTIVE</span>
          <span className="hidden md:inline text-indigo-200">•</span>
          <span className="hidden md:inline">IN-PAINT: UPPER-COLOR EXTRAPOLATION</span>
        </div>
        <div className="flex items-center gap-4 font-mono">
          <span>VERSION 2.1.0</span>
          <span className="hidden sm:inline">© 2026 WASH TOOLS</span>
        </div>
      </footer>
    </div>
  );
}
