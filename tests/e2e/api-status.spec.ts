import { test, expect } from "../support/fixtures/merged-fixtures";

// Given/When/Then: the status endpoint always responds 200 regardless of
// whether the local llama.cpp container is up (see app/api/status/route.ts).
test.describe("GET /api/status", () => {
  test("should report model server online state without erroring", async ({ apiRequest }) => {
    // Given the app is running
    // When we ask for model server status
    const { status, body } = await apiRequest<{ online: boolean }>({
      method: "GET",
      path: "/api/status",
    });

    // Then it responds successfully with a boolean online flag
    expect(status).toBe(200);
    expect(typeof body.online).toBe("boolean");
  });
});
