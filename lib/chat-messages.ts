import { inArray } from "drizzle-orm";
import type { UIMessage } from "ai";
import { db } from "@/lib/db";
import { attachment, type Attachment, type Message } from "@/db/schema";
import { PDF_PAGE_FILENAME_MARKER } from "@/lib/pdf-page-marker";

export function extractText(msg: UIMessage): string {
  return msg.parts
    .filter((part): part is Extract<UIMessage["parts"][number], { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("");
}

// Image attachments the client sent as data: URLs (produced by prompt-input's
// own blob-URL-to-data-URL conversion on submit — see components/ai-elements/
// prompt-input.tsx's convertBlobUrlToDataUrl). PDF pages (Story 3.2) arrive
// the same way — the server tells them apart only by the filename marker
// lib/pdf-render.ts stamps on each rendered page (AD-7: the model itself just
// sees plain images either way, per AD-6's single mechanism).
export type ExtractedImageAttachment = {
  data: Buffer;
  mediaType: string;
  filename: string | null;
  kind: "image" | "pdf-page";
  pageIndex: number | null;
};

const PDF_PAGE_FILENAME_PATTERN = new RegExp(`^(.*)${PDF_PAGE_FILENAME_MARKER}(\\d+)\\.png$`);

export function extractImageAttachments(msg: UIMessage): ExtractedImageAttachment[] {
  const fileParts = msg.parts.filter(
    (part): part is Extract<UIMessage["parts"][number], { type: "file" }> =>
      part.type === "file" && !!part.mediaType?.startsWith("image/")
  );

  const results: ExtractedImageAttachment[] = [];
  for (const part of fileParts) {
    const match = /^data:([^;]+);base64,(.+)$/.exec(part.url);
    if (!match) continue; // not a data: URL (e.g. conversion failed upstream) — skip rather than crash
    const [, mediaType, base64] = match;

    const pdfPageMatch = part.filename ? PDF_PAGE_FILENAME_PATTERN.exec(part.filename) : null;
    const kind: "image" | "pdf-page" = pdfPageMatch ? "pdf-page" : "image";
    // Marker is 1-based (readable filenames); pageIndex is 0-based (AD-9).
    const pageIndex = pdfPageMatch ? Number(pdfPageMatch[2]) - 1 : null;
    const filename = pdfPageMatch ? `${pdfPageMatch[1]}.png` : (part.filename ?? null);

    results.push({ data: Buffer.from(base64, "base64"), mediaType, filename, kind, pageIndex });
  }
  return results;
}

export async function getAttachmentsByMessageIds(messageIds: string[]): Promise<Map<string, Attachment[]>> {
  if (messageIds.length === 0) return new Map();

  const rows = await db.select().from(attachment).where(inArray(attachment.messageId, messageIds));
  const byMessageId = new Map<string, Attachment[]>();
  for (const row of rows) {
    const list = byMessageId.get(row.messageId) ?? [];
    list.push(row);
    byMessageId.set(row.messageId, list);
  }
  return byMessageId;
}

export function rowsToUIMessages(rows: Message[], attachmentsByMessageId: Map<string, Attachment[]>): UIMessage[] {
  return rows.map((row) => {
    const atts = attachmentsByMessageId.get(row.id) ?? [];
    return {
      id: row.id,
      role: row.role,
      parts: [
        // Attachments before text, matching the order the client sends on a
        // live submit (PromptInput's onSubmit puts files before text) — keeps
        // rendering consistent between a fresh send and a reload.
        ...atts.map((a) => ({
          type: "file" as const,
          mediaType: a.mediaType,
          filename: a.filename ?? undefined,
          url: `data:${a.mediaType};base64,${a.data.toString("base64")}`,
        })),
        { type: "text", text: row.content },
      ],
    };
  });
}
