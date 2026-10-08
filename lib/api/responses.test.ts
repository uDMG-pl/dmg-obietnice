import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  apiError,
  apiJson,
  emptyApiResponse,
  internalApiError,
  validationError,
} from "@/lib/api/responses";

describe("API response helpers", () => {
  it("keeps no-store while preserving explicit response options", async () => {
    const response = apiJson(
      { ok: true },
      {
        status: 202,
        headers: {
          "Cache-Control": "private",
          "X-Test": "yes",
        },
      },
    );

    expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-test")).toBe("yes");
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("uses the standard error envelope and omits absent details", async () => {
    const response = apiError(404, "NOT_FOUND", "Missing.");

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: { code: "NOT_FOUND", message: "Missing." },
    });
  });

  it("includes details and additional headers when provided", async () => {
    const response = apiError(
      429,
      "RATE_LIMIT_EXCEEDED",
      "Slow down.",
      { limit: 100 },
      { "Retry-After": "60" },
    );

    expect(response.headers.get("retry-after")).toBe("60");
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Slow down.",
        details: { limit: 100 },
      },
    });
  });

  it("serializes Zod issues into stable validation details", async () => {
    const parsed = z
      .object({ nested: z.object({ count: z.number().int().positive() }) })
      .safeParse({ nested: { count: 0 } });
    if (parsed.success) {
      throw new Error("Expected the fixture to fail validation.");
    }

    const response = validationError(parsed.error);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed.",
        details: [
          {
            path: "nested.count",
            code: "too_small",
          },
        ],
      },
    });
  });

  it("returns an empty no-store response", async () => {
    const response = emptyApiResponse(204);

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.text()).resolves.toBe("");
  });

  it("logs internal failures without leaking their details", async () => {
    const failure = new Error("database credentials");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = internalApiError(failure);

    expect(consoleError).toHaveBeenCalledWith(
      "Management API request failed.",
      failure,
    );
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
      },
    });
  });
});
