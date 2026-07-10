import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { desc, eq } from "drizzle-orm";
import { localModel } from "@/lib/model";
import { db } from "@/lib/db";
import { attachment, conversation, message } from "@/db/schema";
import { extractImageAttachments, extractText, getAttachmentsByMessageIds, rowsToUIMessages } from "@/lib/chat-messages";

// AD-3/Consistency Conventions: better-sqlite3 needs Node native bindings,
// this route must not run on the Edge runtime.
export const runtime = "nodejs";

const TITLE_MAX_LENGTH = 50;

async function getMostRecentConversation() {
  const [row] = await db
    .select()
    .from(conversation)
    .orderBy(desc(conversation.updatedAt))
    .limit(1);
  return row ?? null;
}

// GET returns the most recently updated conversation — used for the initial
// page load only. Story 2.2's /api/conversations/[id] loads a *specific*
// conversation when the user switches; this route is unaware of that.
export async function GET() {
  const active = await getMostRecentConversation();

  if (!active) {
    return Response.json({ conversationId: null, messages: [] });
  }

  const rows = await db
    .select()
    .from(message)
    .where(eq(message.conversationId, active.id))
    .orderBy(message.createdAt);

  const attachmentsByMessageId = await getAttachmentsByMessageIds(rows.map((r) => r.id));

  return Response.json({ conversationId: active.id, messages: rowsToUIMessages(rows, attachmentsByMessageId) });
}

export async function POST(req: Request) {
  const { messages, conversationId: requestedConversationId }: { messages: UIMessage[]; conversationId?: string } =
    await req.json();

  const incoming = messages[messages.length - 1];

  let active: typeof conversation.$inferSelect | null = null;
  let isFirstMessage = false;

  if (requestedConversationId) {
    // Client is targeting a specific conversation (switched via Story 2.2's
    // history list, or continuing the one it already knows about) — never
    // fall back to "most recent" here, that would silently misfile the
    // message into the wrong conversation if it isn't also the most recent.
    const [found] = await db.select().from(conversation).where(eq(conversation.id, requestedConversationId));
    active = found ?? null;

    if (!active) {
      // Story 2.2's "new conversation" flow: the client pre-generates an id
      // client-side (so it can address this conversation from the first
      // message onward) but withholds writing the row until now — this is
      // that write, using the client's id rather than minting a new one.
      const [created] = await db.insert(conversation).values({ id: requestedConversationId }).returning();
      active = created;
      isFirstMessage = true;
    }
  } else {
    // No id at all from the client — only expected on a fresh page load
    // before Story 2.2's client-side id generation has ever run.
    const [created] = await db.insert(conversation).values({}).returning();
    active = created;
    isFirstMessage = true;
  }

  const conversationId = active.id;

  if (incoming?.role === "user") {
    const text = extractText(incoming);
    const [userMessage] = await db
      .insert(message)
      .values({
        conversationId,
        role: "user",
        content: text,
      })
      .returning();

    // AD-9: content stays text-only; attachments are always separate rows.
    const images = extractImageAttachments(incoming);
    if (images.length > 0) {
      await db.insert(attachment).values(
        images.map((img) => ({
          messageId: userMessage.id,
          kind: img.kind,
          pageIndex: img.pageIndex,
          data: img.data,
          mediaType: img.mediaType,
          filename: img.filename,
        }))
      );
    }

    const now = new Date();
    await db
      .update(conversation)
      .set({
        updatedAt: now,
        ...(isFirstMessage ? { title: text.slice(0, TITLE_MAX_LENGTH) } : {}),
      })
      .where(eq(conversation.id, conversationId));
  }

  const result = streamText({
    model: localModel,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse({
    onFinish: async ({ responseMessage }) => {
      const text = extractText(responseMessage);
      if (!text) return;

      await db.insert(message).values({
        conversationId,
        role: "assistant",
        content: text,
      });

      await db
        .update(conversation)
        .set({ updatedAt: new Date() })
        .where(eq(conversation.id, conversationId));
    },
  });
}
