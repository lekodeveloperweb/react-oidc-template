import { describe, it, expect, vi, beforeEach } from "vitest";

describe("customFetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mocks before each import
    Object.defineProperty(global, "localStorage", {
      value: { getItem: vi.fn() },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(import.meta, "env", {
      value: {
        VITE_API_URL: "http://localhost:8081",
        VITE_OIDC_AUTHORITY: "http://auth/realms/custom-realm",
        VITE_OIDC_AUDIENCE: "audience",
        VITE_OIDC_CLIENT_ID: "client-id",
        VITE_APP_PATH_PREFIX: "/",
      },
      writable: true,
      configurable: true,
    });
  });

  // Helper to create mock response
  const createMockResponse = (
    overrides: Partial<Response> & {
      json?: () => Promise<unknown>;
      text?: () => Promise<string>;
    } = {},
  ) => ({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(""),
    ...overrides,
  });

  // Helper to create mock response with custom body text
  const createMockResponseWithText = (body: string, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body),
    json: () => Promise.resolve(body ? JSON.parse(body) : {}),
  });

  describe("successful requests", () => {
    it("returns parsed JSON on success", async () => {
      const mockData = { id: 1, name: "test" };
      const body = JSON.stringify(mockData);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(body),
        json: () => Promise.resolve(mockData),
      });

      const { customFetch } = await import("./api-client");
      const result = await customFetch("/api/test", { method: "GET" });
      expect(result).toEqual(mockData);
    });

    it("prepends base URL when URL has no protocol", async () => {
      global.fetch = vi.fn().mockResolvedValue(createMockResponse());

      const { customFetch } = await import("./api-client");
      await customFetch("/api/test", { method: "GET" });

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8081/api/test",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("uses URL as-is when it has protocol", async () => {
      global.fetch = vi.fn().mockResolvedValue(createMockResponse());

      const { customFetch } = await import("./api-client");
      await customFetch("https://other.com/api/test", { method: "GET" });

      expect(global.fetch).toHaveBeenCalledWith(
        "https://other.com/api/test",
        expect.any(Object),
      );
    });

    it("includes Authorization header with token", async () => {
      (
        global.localStorage as unknown as { getItem: ReturnType<typeof vi.fn> }
      ).getItem.mockReturnValue(
        JSON.stringify({ access_token: "test-token-123" }),
      );
      global.fetch = vi.fn().mockResolvedValue(createMockResponse());

      const { customFetch } = await import("./api-client");
      await customFetch("/api/test", { method: "GET" });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-token-123",
          }),
        }),
      );
    });

    it("merges custom headers with defaults", async () => {
      global.fetch = vi.fn().mockResolvedValue(createMockResponse());

      const { customFetch } = await import("./api-client");
      await customFetch("/api/test", {
        method: "GET",
        headers: { "X-Custom-Header": "value" },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "X-Custom-Header": "value",
          }),
        }),
      );
    });

    it("works without Authorization when no token", async () => {
      (
        global.localStorage as unknown as { getItem: ReturnType<typeof vi.fn> }
      ).getItem.mockReturnValue(null);
      global.fetch = vi.fn().mockResolvedValue(createMockResponse());

      const { customFetch } = await import("./api-client");
      await customFetch("/api/test", { method: "GET" });

      const call =
        (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] ?? [];
      const headers = call[1].headers as Record<string, string>;
      expect(headers.Authorization).toBeUndefined();
    });

    it("returns empty object on 204 No Content", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValue(createMockResponseWithText("", 204));

      const { customFetch } = await import("./api-client");
      const result = await customFetch("/api/test", { method: "DELETE" });
      expect(result).toEqual({});
    });

    it("returns empty object on 200 OK with empty body", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValue(createMockResponseWithText("", 200));

      const { customFetch } = await import("./api-client");
      const result = await customFetch("/api/test", { method: "DELETE" });
      expect(result).toEqual({});
    });
  });
});
