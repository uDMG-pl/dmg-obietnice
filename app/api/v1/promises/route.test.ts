import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import type { Obietnica } from "@/lib/definitions";

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

const mocks = vi.hoisted(() => ({
  authenticateApiKey: vi.fn(),
  createPromise: vi.fn(),
  listPromises: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/api/authenticate", () => ({
  authenticateApiKey: mocks.authenticateApiKey,
}));

vi.mock("@/lib/promises/repository", () => ({
  createPromise: mocks.createPromise,
  listPromises: mocks.listPromises,
}));

vi.mock("next/cache", () => ({
  revalidateTag: mocks.revalidateTag,
}));

import { GET, POST } from "@/app/api/v1/promises/route";

const promiseFixture: Obietnica = {
  id: "507f1f77bcf86cd799439011",
  title: "Obietnica",
  datePromised: {
    year: 2026,
    month: 7,
    precision: "month",
    dateTime: "2026-07",
    sortTime: Date.UTC(2026, 6, 1),
  },
  status: "promised",
  tags: ["transport"],
};

describe("GET /api/v1/promises", () => {
  beforeEach(acceptAuthentication);

  it("forwards an authentication rejection", async () => {
    const denied = Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
    mocks.authenticateApiKey.mockResolvedValue({
      authenticated: false,
      response: denied,
    });

    const response = await GET(request());

    expect(response).toBe(denied);
    expect(mocks.listPromises).not.toHaveBeenCalled();
  });

  it("uses default pagination and serializes the page", async () => {
    mocks.listPromises.mockResolvedValue({
      items: [promiseFixture],
      nextCursor: null,
    });
    const apiRequest = request();

    const response = await GET(apiRequest);

    expect(mocks.authenticateApiKey).toHaveBeenCalledWith(apiRequest, "read");
    expect(mocks.listPromises).toHaveBeenCalledWith({ limit: 50 });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          id: promiseFixture.id,
          title: "Obietnica",
          datePromised: { year: 2026, month: 7 },
          status: "promised",
          tags: ["transport"],
        },
      ],
      pagination: { limit: 50, nextCursor: null },
    });
  });

  it("coerces list query parameters", async () => {
    const cursor = "507f1f77bcf86cd799439012";
    mocks.listPromises.mockResolvedValue({ items: [], nextCursor: cursor });

    const response = await GET(request(`?limit=25&cursor=${cursor}`));

    expect(mocks.listPromises).toHaveBeenCalledWith({ limit: 25, cursor });
    await expect(response.json()).resolves.toMatchObject({
      pagination: { limit: 25, nextCursor: cursor },
    });
  });

  it("returns a validation envelope for an invalid query", async () => {
    const response = await GET(request("?limit=101"));

    expect(response.status).toBe(400);
    expect(mocks.listPromises).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
  });
});

describe("POST /api/v1/promises", () => {
  beforeEach(acceptAuthentication);

  it("requires an application/json content type", async () => {
    const response = await POST(
      request("", { method: "POST", body: "title=Obietnica" }),
    );

    expect(response.status).toBe(415);
    expect(mocks.createPromise).not.toHaveBeenCalled();
  });

  it("reports malformed JSON", async () => {
    const response = await POST(
      jsonRequest("{", { method: "POST" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_JSON" },
    });
  });

  it("validates, creates, and locates a promise", async () => {
    mocks.createPromise.mockResolvedValue(promiseFixture);
    const apiRequest = jsonRequest(
      JSON.stringify({
        title: "  Obietnica  ",
        datePromised: { year: 2026, month: 7 },
        tags: ["transport", "transport"],
      }),
      { method: "POST" },
    );

    const response = await POST(apiRequest);

    expect(mocks.authenticateApiKey).toHaveBeenCalledWith(apiRequest, "write");
    expect(mocks.createPromise).toHaveBeenCalledWith({
      title: "Obietnica",
      datePromised: { year: 2026, month: 7 },
      status: "promised",
      tags: ["transport"],
    });
    expect(mocks.revalidateTag).toHaveBeenCalledWith("obietnice", {
      expire: 0,
    });
    expect(response.status).toBe(201);
    expect(response.headers.get("location")).toBe(
      `https://example.test/api/v1/promises/${promiseFixture.id}`,
    );
    await expect(response.json()).resolves.toMatchObject({
      data: { id: promiseFixture.id },
    });
  });
});

function acceptAuthentication() {
  mocks.authenticateApiKey.mockResolvedValue({
    authenticated: true,
    keyId: "key-id",
  });
}

function request(search = "", init?: NextRequestInit) {
  return new NextRequest(
    `https://example.test/api/v1/promises${search}`,
    init,
  );
}

function jsonRequest(body: string, init?: NextRequestInit) {
  return request("", {
    ...init,
    body,
    headers: { "Content-Type": "application/json" },
  });
}
