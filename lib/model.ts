import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const LOCAL_MODEL_BASE_URL =
  process.env.LOCAL_MODEL_BASE_URL ?? "http://localhost:8080/v1";

const localProvider = createOpenAICompatible({
  name: "llama-cpp",
  baseURL: LOCAL_MODEL_BASE_URL,
  apiKey: "not-needed",
});

export const localModel = localProvider.chatModel("gemma-4-E2B-it");
