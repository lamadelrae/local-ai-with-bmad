"use client";

import { PDF_PAGE_FILENAME_MARKER } from "@/lib/pdf-page-marker";

export const PDF_PAGE_CAP = 5;

export type RenderedPdf = {
  pages: File[]; // one PNG File per rendered page, named "<basename>__pdfpage-N.png"
  totalPages: number;
  truncated: boolean;
};

let workerConfigured = false;

export async function renderPdfToImages(file: File, cap: number = PDF_PAGE_CAP): Promise<RenderedPdf> {
  // Dynamically imported, not imported at module top level: pdfjs-dist runs
  // browser-only code (e.g. `new DOMMatrix()`) as soon as its module is
  // evaluated, which breaks Next.js's server-side render pass even though
  // this file is "use client" — client components still get their module
  // graph evaluated once in Node for SSR. Deferring the import to inside this
  // function means it only runs when a user actually attaches a PDF, client-side.
  const pdfjsLib = await import("pdfjs-dist");

  if (!workerConfigured) {
    // Bundled locally (not loaded from a CDN) — required to preserve FR5's
    // local-only guarantee. Turbopack/webpack resolve this `new URL(...,
    // import.meta.url)` pattern as a static asset reference at build time.
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
    workerConfigured = true;
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const totalPages = pdf.numPages;
  const pageCount = Math.min(totalPages, cap);
  const baseName = file.name.replace(/\.pdf$/i, "");

  const pages: File[] = [];
  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 }); // legible resolution without huge payloads

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not get 2D canvas context for PDF rendering");

    await page.render({ canvas, canvasContext: context, viewport }).promise;

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error(`Failed to render page ${pageNum} of ${file.name} to an image`);

    pages.push(new File([blob], `${baseName}${PDF_PAGE_FILENAME_MARKER}${pageNum}.png`, { type: "image/png" }));
  }

  return { pages, totalPages, truncated: totalPages > cap };
}
