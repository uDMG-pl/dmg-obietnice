import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  authenticateApiKey: vi.fn(),
  createSubmission: vi.fn(),
  deleteSubmission: vi.fn(),
  getSubmission: vi.fn(),
  listSubmissions: vi.fn(),
  updateSubmission: vi.fn(),
}));

vi.mock("@/lib/api/authenticate", () => ({
  authenticateApiKey: mocks.authenticateApiKey,
}));
vi.mock("@/lib/submissions/repository", () => mocks);

import { GET as list, POST } from "@/app/api/v1/submissions/route";
import { DELETE, GET, PATCH } from "@/app/api/v1/submissions/[id]/route";

const id = "507f1f77bcf86cd799439011";
const resource = {
  id,
  clipUrl: "https://youtu.be/example",
  description: "A promise to publish a report.",
  status: "pending",
  createdAt: "2026-07-11T12:00:00.000Z",
};
const context = (routeId = id) => ({ params: Promise.resolve({ id: routeId }) });

describe("submissions API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.authenticateApiKey.mockResolvedValue({ authenticated: true, keyId: "key-id" });
    mocks.listSubmissions.mockResolvedValue({ items: [resource], nextCursor: null });
    mocks.createSubmission.mockResolvedValue(resource);
    mocks.getSubmission.mockResolvedValue(resource);
    mocks.updateSubmission.mockResolvedValue({ ...resource, status: "accepted" });
    mocks.deleteSubmission.mockResolvedValue(true);
  });

  const endpoints = [
    { name: "list", permission: "read", call: (req: NextRequest) => list(req) },
    { name: "get", permission: "read", call: (req: NextRequest) => GET(req, context()) },
    { name: "create", permission: "write", call: (req: NextRequest) => POST(req) },
    { name: "update", permission: "write", call: (req: NextRequest) => PATCH(req, context()) },
    { name: "delete", permission: "write", call: (req: NextRequest) => DELETE(req, context()) },
  ];

  it.each(endpoints)("checks $permission permission before $name accesses storage", async ({ call, permission }) => {
    const denied = Response.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
    mocks.authenticateApiKey.mockResolvedValue({ authenticated: false, response: denied });
    const req = request();

    expect(await call(req)).toBe(denied);
    expect(mocks.authenticateApiKey).toHaveBeenCalledWith(req, permission);
    for (const name of ["listSubmissions", "getSubmission", "createSubmission", "updateSubmission", "deleteSubmission"] as const) {
      expect(mocks[name]).not.toHaveBeenCalled();
    }
  });

  it("lists submissions with the same default pagination envelope as promises", async () => {
    const response = await list(request());

    expect(mocks.listSubmissions).toHaveBeenCalledWith({ limit: 50 });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      data: [resource], pagination: { limit: 50, nextCursor: null },
    });
  });

  it("forwards cursor pagination and the status filter", async () => {
    await list(request("GET", undefined, `?limit=25&cursor=${id}&status=pending`));

    expect(mocks.listSubmissions).toHaveBeenCalledWith({ limit: 25, cursor: id, status: "pending" });
  });

  it("returns numbered pagination and filtered totals", async () => {
    mocks.listSubmissions.mockResolvedValue({
      items: [resource], nextCursor: null,
      pagination: { currentPage: 2, totalCount: 26, totalPages: 2 },
    });

    const response = await list(request("GET", undefined, "?page=2&limit=25&status=pending"));

    expect(mocks.listSubmissions).toHaveBeenCalledWith({ page: 2, limit: 25, status: "pending" });
    await expect(response.json()).resolves.toMatchObject({
      pagination: { limit: 25, nextCursor: null, currentPage: 2, totalCount: 26, totalPages: 2 },
    });
  });

  it.each([
    "?limit=0", "?limit=101", "?page=0", "?page=1.5", "?page=",
    `?page=2&cursor=${id}`, "?cursor=invalid", "?status=fulfilled", "?limti=25",
  ])("rejects invalid list queries: %s", async (query) => {
    const response = await list(request("GET", undefined, query));

    expect(response.status).toBe(400);
    expect(mocks.listSubmissions).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("creates a trimmed pending submission and returns its location", async () => {
    const response = await POST(request("POST", {
      clipUrl: `  ${resource.clipUrl}  `, description: `  ${resource.description}  `,
    }));

    expect(mocks.createSubmission).toHaveBeenCalledWith({
      clipUrl: resource.clipUrl, description: resource.description, status: "pending",
    });
    expect(response.status).toBe(201);
    expect(response.headers.get("location")).toBe(`https://example.test/api/v1/submissions/${id}`);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ data: resource });
  });

  it.each(["pending", "reviewed", "rejected", "accepted"])("allows the existing status on creation: %s", async (status) => {
    expect((await POST(request("POST", {
      clipUrl: resource.clipUrl, description: resource.description, status,
    }))).status).toBe(201);
    expect(mocks.createSubmission).toHaveBeenCalledWith(expect.objectContaining({ status }));
  });

  it("gets a single submission", async () => {
    const response = await GET(request(), context());

    expect(mocks.getSubmission).toHaveBeenCalledWith(id);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ data: resource });
  });

  it("updates status alone without replacing the content or creation date", async () => {
    const response = await PATCH(request("PATCH", { status: "accepted" }), context());

    expect(mocks.updateSubmission).toHaveBeenCalledWith(id, { status: "accepted" });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { ...resource, status: "accepted" } });
  });

  it("allows correcting the clip and description", async () => {
    const response = await PATCH(request("PATCH", {
      clipUrl: "https://clips.twitch.tv/example", description: "  Corrected description.  ",
    }), context());

    expect(response.status).toBe(200);
    expect(mocks.updateSubmission).toHaveBeenCalledWith(id, {
      clipUrl: "https://clips.twitch.tv/example", description: "Corrected description.",
    });
  });

  it.each([
    {}, { status: "fulfilled" }, { status: null }, { clipUrl: null }, { description: null },
    { description: "short" }, { description: "x".repeat(2001) },
    { clipUrl: "http://youtu.be/example" }, { clipUrl: "https://example.com/clip" },
    { clipUrl: "https://youtube.com.evil.test/clip" }, { createdAt: resource.createdAt }, { id },
  ])("rejects invalid edits or immutable fields: %j", async (body) => {
    const response = await PATCH(request("PATCH", body), context());

    expect(response.status).toBe(400);
    expect(mocks.updateSubmission).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("requires valid content on creation", async () => {
    const response = await POST(request("POST", { status: "pending" }));

    expect(response.status).toBe(400);
    expect(mocks.createSubmission).not.toHaveBeenCalled();
  });

  it.each(["POST", "PATCH"])("handles invalid JSON and media type for %s", async (method) => {
    const call = (req: NextRequest) => method === "POST" ? POST(req) : PATCH(req, context());
    const url = "https://example.test/api/v1/submissions";
    const invalidJson = await call(new NextRequest(url, {
      method, body: "{", headers: { "content-type": "application/json" },
    }));
    expect(invalidJson.status).toBe(400);
    await expect(invalidJson.json()).resolves.toMatchObject({ error: { code: "INVALID_JSON" } });
    expect((await call(new NextRequest(url, { method, body: "status=accepted" }))).status).toBe(415);
    expect(mocks.createSubmission).not.toHaveBeenCalled();
    expect(mocks.updateSubmission).not.toHaveBeenCalled();
  });

  it.each([GET, PATCH, DELETE])("rejects invalid IDs before accessing storage", async (handler) => {
    const response = await handler(request(), context("invalid"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INVALID_ID" } });
    expect(mocks.getSubmission).not.toHaveBeenCalled();
    expect(mocks.updateSubmission).not.toHaveBeenCalled();
    expect(mocks.deleteSubmission).not.toHaveBeenCalled();
  });

  it("returns 404 for missing read, update, and delete targets", async () => {
    mocks.getSubmission.mockResolvedValue(null);
    mocks.updateSubmission.mockResolvedValue(null);
    mocks.deleteSubmission.mockResolvedValue(false);

    for (const response of [
      await GET(request(), context()),
      await PATCH(request("PATCH", { status: "accepted" }), context()),
      await DELETE(request("DELETE"), context()),
    ]) {
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toMatchObject({ error: { code: "NOT_FOUND" } });
    }
  });

  it("deletes with an empty no-store 204 response", async () => {
    const response = await DELETE(request("DELETE"), context());

    expect(mocks.deleteSubmission).toHaveBeenCalledWith(id);
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.text()).resolves.toBe("");
  });

  it("handles storage failures without exposing internal details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.listSubmissions.mockRejectedValue(new Error("database credentials"));

    const response = await list(request());

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
    });
  });
});

function request(method = "GET", body?: unknown, search = "") {
  return new NextRequest(`https://example.test/api/v1/submissions${search}`, {
    method,
    headers: { "content-type": "application/json; charset=utf-8" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
