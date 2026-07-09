import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { localModel } from "@/lib/model";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: localModel,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
