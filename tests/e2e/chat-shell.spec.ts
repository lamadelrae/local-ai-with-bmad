import { test, expect } from "../support/fixtures/merged-fixtures";

// Given/When/Then: the chat shell renders and accepts input without needing
// the local model container to be running — no message is submitted here.
// (Full send/receive coverage is a `*atdd`/`*automate` follow-up once the
// llama.cpp container is part of the test environment.)
test.describe("Chat shell", () => {
  test("should load the composer and accept typed input", async ({ page }) => {
    // Given the chat page
    await page.goto("/");

    // When the user types a message
    const composer = page.getByPlaceholder("Message Gemma...");
    await expect(composer).toBeVisible();
    await composer.fill("Hello, Gemma");

    // Then the composer reflects the typed text and a submit control is present
    await expect(composer).toHaveValue("Hello, Gemma");
    await expect(page.getByRole("button", { name: "Submit" })).toBeVisible();
  });
});
