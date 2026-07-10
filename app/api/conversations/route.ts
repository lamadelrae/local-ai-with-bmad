import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { conversation } from "@/db/schema";

// AD-3/Consistency Conventions: better-sqlite3 needs Node native bindings,
// this route must not run on the Edge runtime.
export const runtime = "nodejs";

export async function GET() {
  const rows = await db
    .select({ id: conversation.id, title: conversation.title, updatedAt: conversation.updatedAt })
    .from(conversation)
    .orderBy(desc(conversation.updatedAt));

  return Response.json({ conversations: rows });
}
