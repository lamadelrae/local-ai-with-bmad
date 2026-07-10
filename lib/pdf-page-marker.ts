// Shared between lib/pdf-render.ts (client, renders PDF pages to images) and
// lib/chat-messages.ts (server, persists them) — kept in its own file with no
// "use client" directive and no pdfjs-dist import, so server code importing
// it never pulls in browser-only rendering code.
export const PDF_PAGE_FILENAME_MARKER = "__pdfpage-";
