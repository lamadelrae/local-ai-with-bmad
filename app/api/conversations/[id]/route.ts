import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { conversation, message } from "@/db/schema";
import { getAttachmentsByMessageIds, rowsToUIMessages } from "@/lib/chat-messages";

// AD-3/Consistency Conventions: better-sqlite3 needs Node native bindings,
// this route must not run on the Edge runtime.
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rows = await db.select().from(message).where(eq(message.conversationId, id)).orderBy(message.createdAt);
  const attachmentsByMessageId = await getAttachmentsByMessageIds(rows.map((r) => r.id));

  return Response.json({ conversationId: id, messages: rowsToUIMessages(rows, attachmentsByMessageId) });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // message rows cascade-delete via the FK's ON DELETE CASCADE (lib/db.ts enables
  // `foreign_keys` pragma, required for SQLite to enforce it).
  await db.delete(conversation).where(eq(conversation.id, id));

  return Response.json({ ok: true });
}
