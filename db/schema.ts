import { nanoid } from "nanoid";
import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, blob } from "drizzle-orm/sqlite-core";

// CONVERSATION — one row per chat thread. Per AD-9/Architecture Spine Entities.
export const conversation = sqliteTable("conversation", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  title: text("title"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`),
});

// MESSAGE — one row per turn. `role` is app-level constrained to 'user' | 'assistant'
// (AD-9). `content` is always plain display text, never a serialized parts array.
export const message = sqliteTable("message", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversation.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`),
});

// ATTACHMENT — one row per image, or per rendered PDF page (AD-9/AD-7).
// `kind='image'` for a native JPEG/PNG; `kind='pdf-page'` for a page rendered
// from a PDF (Story 3.2), with `pageIndex` set only in that case.
export const attachment = sqliteTable("attachment", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  messageId: text("message_id")
    .notNull()
    .references(() => message.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["image", "pdf-page"] }).notNull(),
  pageIndex: integer("page_index"),
  data: blob("data", { mode: "buffer" }).notNull(),
  filename: text("filename"),
  // Precise MIME subtype (e.g. "image/png" vs "image/jpeg") — needed to
  // rebuild a correct `data:` URL on redisplay; `kind` alone isn't enough.
  mediaType: text("media_type").notNull(),
});

export type Conversation = typeof conversation.$inferSelect;
export type Message = typeof message.$inferSelect;
export type Attachment = typeof attachment.$inferSelect;
