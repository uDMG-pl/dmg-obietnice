import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuth: vi.fn(),
  verifyApiKey: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  API_KEY_CONFIG_ID: "promises",
  API_KEY_PERMISSION_RESOURCE: "promises",
  getAuth: mocks.getAuth,
}));

import { authenticateApiKey } from "@/lib/api/authenticate";

describe("authenticateApiKey", () => {
  beforeEach(() => {
    mocks.verifyApiKey.mockReset();
    mocks.getAuth.mockReset();
    mocks.getAuth.mockResolvedValue({
      api: { verifyApiKey: mocks.verifyApiKey },
    });
  });

  it.each([undefined, "", "   "])(
    "returns 401 when the API key is missing (%j)",
    async (key) => {
      const response = await rejectedResponse(key, "read");

      expect(response.status).toBe(401);
      expect(response.headers.get("www-authenticate")).toBe(
        'ApiKey realm="promises-api"',
      );
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "UNAUTHORIZED",
          message: "API key is required.",
        },
      });
      expect(mocks.getAuth).not.toHaveBeenCalled();
    },
  );

  it("trims and verifies the key using the promises config", async () => {
    mocks.verifyApiKey.mockResolvedValue({
      valid: true,
      key: {
        id: "key-id",
        permissions: { promises: ["read"] },
      },
    });

    const result = await authenticateApiKey(
      requestWithKey("  dmg_secret  "),
      "read",
    );

    expect(mocks.verifyApiKey).toHaveBeenCalledWith({
      body: { configId: "promises", key: "dmg_secret" },
    });
    expect(result).toEqual({ authenticated: true, keyId: "key-id" });
  });

  it.each([
    { permissions: undefined },
    { permissions: null },
    { permissions: {} },
    { permissions: { promises: ["read"] } },
  ])("returns 403 when write permission is absent: %j", async (key) => {
    mocks.verifyApiKey.mockResolvedValue({ valid: true, key: { id: "id", ...key } });

    const response = await rejectedResponse("dmg_secret", "write");

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "FORBIDDEN" },
    });
  });

  it("accepts a key carrying the requested write permission", async () => {
    mocks.verifyApiKey.mockResolvedValue({
      valid: true,
      key: {
        id: "writer-id",
        permissions: { promises: ["read", "write"] },
      },
    });

    await expect(
      authenticateApiKey(requestWithKey("dmg_writer"), "write"),
    ).resolves.toEqual({ authenticated: true, keyId: "writer-id" });
  });

  it.each([
    { valid: false },
    { valid: false, error: { code: "KEY_DISABLED" } },
    { valid: false, error: { code: "KEY_EXPIRED" } },
    { valid: true },
  ])("returns 401 for an unusable key result: %j", async (verification) => {
    mocks.verifyApiKey.mockResolvedValue(verification);

    const response = await rejectedResponse("dmg_bad", "read");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "API key is invalid, disabled, or expired.",
      },
    });
  });

  it.each(["RATE_LIMITED", "RATE_LIMIT_EXCEEDED", "USAGE_EXCEEDED"])(
    "maps Better Auth %s errors to 429",
    async (code) => {
      mocks.verifyApiKey.mockResolvedValue({
        valid: false,
        error: { code, details: { tryAgainIn: 1_501 } },
      });

      const response = await rejectedResponse("dmg_limited", "read");

      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).toBe("2");
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "API key rate limit exceeded.",
        },
      });
    },
  );

  it("clamps Retry-After to at least one second", async () => {
    mocks.verifyApiKey.mockResolvedValue({
      valid: false,
      error: {
        code: "RATE_LIMITED",
        details: { tryAgainIn: 0 },
      },
    });

    const response = await rejectedResponse("dmg_limited", "read");

    expect(response.headers.get("retry-after")).toBe("1");
  });

  it("omits Retry-After when Better Auth supplies no numeric delay", async () => {
    mocks.verifyApiKey.mockResolvedValue({
      valid: false,
      error: {
        code: "RATE_LIMITED",
        details: { tryAgainIn: "soon" },
      },
    });

    const response = await rejectedResponse("dmg_limited", "read");

    expect(response.headers.get("retry-after")).toBeNull();
  });
});

function requestWithKey(key?: string) {
  return new Request("https://example.test/api/v1/promises", {
    headers: key === undefined ? undefined : { "x-api-key": key },
  });
}

async function rejectedResponse(
  key: string | undefined,
  permission: "read" | "write",
) {
  const result = await authenticateApiKey(requestWithKey(key), permission);
  if (result.authenticated) {
    throw new Error("Expected authentication to be rejected.");
  }

  return result.response;
}
