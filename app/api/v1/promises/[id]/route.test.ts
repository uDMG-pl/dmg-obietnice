import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import type { Obietnica } from "@/lib/definitions";

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

const mocks = vi.hoisted(() => ({
  authenticateApiKey: vi.fn(),
  deletePromise: vi.fn(),
  getPromise: vi.fn(),
  revalidateTag: vi.fn(),
  updatePromise: vi.fn(),
}));

vi.mock("@/lib/api/authenticate", () => ({
  authenticateApiKey: mocks.authenticateApiKey,
}));

vi.mock("@/lib/promises/repository", () => ({
  deletePromise: mocks.deletePromise,
  getPromise: mocks.getPromise,
  updatePromise: mocks.updatePromise,
}));

vi.mock("next/cache", () => ({
  revalidateTag: mocks.revalidateTag,
}));

import { DELETE, GET, PATCH } from "@/app/api/v1/promises/[id]/route";

const id = "507f1f77bcf86cd799439011";
const promiseFixture: Obietnica = {
  id,
  title: "Obietnica",
  status: "fulfilled",
  tags: [],
};

describe("GET /api/v1/promises/{id}", () => {
  beforeEach(acceptAuthentication);

  it("rejects an invalid ObjectId", async () => {
    const response = await GET(request(), context("invalid"));

    expect(response.status).toBe(400);
    expect(mocks.getPromise).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_ID" },
    });
  });

  it("returns 404 when the promise does not exist", async () => {
    mocks.getPromise.mockResolvedValue(null);

    const response = await GET(request(), context());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "NOT_FOUND" },
    });
  });

  it("returns a serialized promise", async () => {
    mocks.getPromise.mockResolvedValue(promiseFixture);
    const apiRequest = request();

    const response = await GET(apiRequest, context());

    expect(mocks.authenticateApiKey).toHaveBeenCalledWith(apiRequest, "read");
    expect(mocks.getPromise).toHaveBeenCalledWith(id);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      data: {
        id,
        title: "Obietnica",
        status: "fulfilled",
        tags: [],
      },
    });
  });
});

describe("PATCH /api/v1/promises/{id}", () => {
  beforeEach(acceptAuthentication);

  it("passes explicit field clearing to the repository", async () => {
    mocks.updatePromise.mockResolvedValue(promiseFixture);
    const apiRequest = request({
      method: "PATCH",
      body: JSON.stringify({
        description: null,
        dateDue: null,
        tags: [],
      }),
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });

    const response = await PATCH(apiRequest, context());

    expect(mocks.authenticateApiKey).toHaveBeenCalledWith(apiRequest, "write");
    expect(mocks.updatePromise).toHaveBeenCalledWith(id, {
      description: null,
      dateDue: null,
      tags: [],
    });
    expect(mocks.revalidateTag).toHaveBeenCalledWith("obietnice", {
      expire: 0,
    });
    expect(response.status).toBe(200);
  });

  it("rejects an empty PATCH payload", async () => {
    const response = await PATCH(
      request({
        method: "PATCH",
        body: "{}",
        headers: { "Content-Type": "application/json" },
      }),
      context(),
    );

    expect(response.status).toBe(400);
    expect(mocks.updatePromise).not.toHaveBeenCalled();
  });

  it("returns 404 when the update target is missing", async () => {
    mocks.updatePromise.mockResolvedValue(null);

    const response = await PATCH(
      request({
        method: "PATCH",
        body: JSON.stringify({ title: "Nowy tytul" }),
        headers: { "Content-Type": "application/json" },
      }),
      context(),
    );

    expect(response.status).toBe(404);
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/v1/promises/{id}", () => {
  beforeEach(acceptAuthentication);

  it("deletes and returns an empty 204 response", async () => {
    mocks.deletePromise.mockResolvedValue(true);
    const apiRequest = request({ method: "DELETE" });

    const response = await DELETE(apiRequest, context());

    expect(mocks.authenticateApiKey).toHaveBeenCalledWith(apiRequest, "write");
    expect(mocks.deletePromise).toHaveBeenCalledWith(id);
    expect(mocks.revalidateTag).toHaveBeenCalledWith("obietnice", {
      expire: 0,
    });
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.text()).resolves.toBe("");
  });

  it("returns 404 when no promise was deleted", async () => {
    mocks.deletePromise.mockResolvedValue(false);

    const response = await DELETE(request({ method: "DELETE" }), context());

    expect(response.status).toBe(404);
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });
});

function acceptAuthentication() {
  mocks.authenticateApiKey.mockResolvedValue({
    authenticated: true,
    keyId: "key-id",
  });
}

function request(init?: NextRequestInit) {
  return new NextRequest(
    `https://example.test/api/v1/promises/${id}`,
    init,
  );
}

function context(routeId = id) {
  return { params: Promise.resolve({ id: routeId }) };
}
