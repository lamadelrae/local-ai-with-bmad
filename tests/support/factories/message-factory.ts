import { faker } from "@faker-js/faker";

export type MessageRole = "user" | "assistant";

export type MessageOverrides = {
  role?: MessageRole;
  content?: string;
  conversationId?: string;
};

// Mirrors db/schema.ts `message` — id/timestamps are DB-generated, not faked here.
export const createMessage = (overrides: MessageOverrides = {}) => ({
  role: "user" as MessageRole,
  content: faker.lorem.sentence(),
  conversationId: faker.string.nanoid(),
  ...overrides,
});
