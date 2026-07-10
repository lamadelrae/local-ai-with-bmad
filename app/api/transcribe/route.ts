import { generateText } from "ai";
import { localModel } from "@/lib/model";

// Ephemeral by design (AD-8): no import of lib/db.ts, no CONVERSATION/MESSAGE/
// ATTACHMENT row is ever written here. The only path that creates a MESSAGE
// row is /api/chat — this route must not become a second one.
// Native input_audio (confirmed working end-to-end in Story 4.1's smoke test,
// see 4-1-smoke-test-native-audio-input.md) is plain HTTP against the
// existing llama-server; no Node-only API is needed, so this does not require
// runtime = "nodejs" the way /api/chat does for better-sqlite3.

const TRANSCRIPTION_PROMPT = "Transcribe this audio verbatim. Reply with only the transcription, nothing else.";

export async function POST(req: Request) {
  const { audio, format }: { audio: string; format: string } = await req.json();

  if (!audio) {
    return Response.json({ error: "No audio provided" }, { status: 400 });
  }

  try {
    const { text } = await generateText({
      model: localModel,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: TRANSCRIPTION_PROMPT },
            { type: "file", data: audio, mediaType: `audio/${format}` },
          ],
        },
      ],
    });

    return Response.json({ text: text.trim() });
  } catch {
    // AD-5: errors surface plainly, no retry/backoff engineering.
    return Response.json({ error: "Transcription failed" }, { status: 502 });
  }
}
