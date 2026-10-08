import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";

import { ObjectId, type Db } from "mongodb";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/v1/promises/route";
import { DELETE, GET as getOne, PATCH } from "@/app/api/v1/promises/[id]/route";
import { GET as listSubmissions, POST as postSubmission } from "@/app/api/v1/submissions/route";
import {
  DELETE as deleteSubmission,
  GET as getSubmission,
  PATCH as patchSubmission,
} from "@/app/api/v1/submissions/[id]/route";
import {
  createManagedApiKey,
  listManagedApiKeys,
  revokeManagedApiKey,
} from "@/lib/api-key-admin";
import { closeMongoClient, getMongoDb } from "@/lib/mongodb";
import { createZgloszenie } from "@/lib/zgloszenia";

// Only the Next.js cache needs a request runtime. Auth and MongoDB stay real.
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}));

const execFileAsync = promisify(execFile);
const mongoUri = process.env.TEST_MONGODB_URI;

describe.skipIf(!mongoUri)("management APIs with MongoDB and Better Auth", () => {
  let db: Db;

  beforeAll(async () => {
    vi.stubEnv("MONGODB_URI", mongoUri!);
    vi.stubEnv("MONGODB_DB", `promises_api_test_${randomUUID().replaceAll("-", "")}`);
    vi.stubEnv("MONGODB_COLLECTION", "obietnice");
    vi.stubEnv("BETTER_AUTH_SECRET", "integration-test-secret-at-least-32-characters");
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
    vi.stubEnv("API_KEY_OWNER_EMAIL", "integration@localhost.invalid");
    vi.stubEnv("API_RATE_LIMIT_MAX", "100");
    vi.stubEnv("API_RATE_LIMIT_WINDOW_MS", "60000");
    db = await getMongoDb();
  });

  beforeEach(async () => {
    await db.dropDatabase();
  });

  afterAll(async () => {
    try {
      if (db) await db.dropDatabase();
    } finally {
      await closeMongoClient();
      vi.unstubAllEnvs();
    }
  });

  it("enforces permissions and persists CRUD changes with real keys", async () => {
    const reader = await createManagedApiKey({ name: "Reader", scope: "read" });
    const writer = await createManagedApiKey({ name: "Writer", scope: "read-write" });
    expect((await POST(request(reader.key, "POST", { title: "Denied" }))).status).toBe(403);
    expect(await db.collection("obietnice").countDocuments()).toBe(0);

    const created = await POST(request(writer.key, "POST", {
      title: "New promise",
      datePromised: { year: 2026, month: 7 },
      notes: "Remove me",
      tags: ["one", " one "],
    }));
    expect(created.status).toBe(201);
    const { data } = await created.json();
    const context = { params: Promise.resolve({ id: data.id }) };
    expect(data.tags).toEqual(["one"]);
    expect(data.datePromised).toEqual({ year: 2026, month: 7 });
    expect((await getOne(request(reader.key), context)).status).toBe(200);

    const updated = await PATCH(request(writer.key, "PATCH", {
      status: "fulfilled_late",
      notes: null,
      dateDue: { year: 2028, month: 2, day: 29 },
    }), context);
    expect(updated.status).toBe(200);
    expect((await updated.json()).data).not.toHaveProperty("notes");
    expect(await db.collection("obietnice").findOne({ _id: new ObjectId(data.id) }))
      .toMatchObject({ status: "fulfilled_late", dateDue: { year: 2028, month: 2, day: 29 } });

    await revokeManagedApiKey(reader.id);
    expect((await GET(request(reader.key))).status).toBe(401);
    expect((await DELETE(request(writer.key, "DELETE"), context)).status).toBe(204);
    expect((await getOne(request(writer.key), context)).status).toBe(404);
  });

  it("returns 429 with Retry-After when a real key exceeds its limit", async () => {
    const key = await createManagedApiKey({ name: "Limited", scope: "read" });
    await db.collection("apikey").updateOne(
      { _id: new ObjectId(key.id) },
      { $set: { rateLimitMax: 1 } },
    );
    expect((await GET(request(key.key))).status).toBe(200);
    const denied = await GET(request(key.key));
    expect(denied.status).toBe(429);
    expect(Number(denied.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("manages existing submissions with unchanged promise keys and permissions", async () => {
    const reader = await createManagedApiKey({ name: "Existing reader", scope: "read" });
    const writer = await createManagedApiKey({ name: "Existing writer", scope: "read-write" });
    expect(reader.permissions).toEqual({ promises: ["read"] });
    expect(writer.permissions).toEqual({ promises: ["read", "write"] });
    const id = await createZgloszenie({
      clipUrl: "https://youtu.be/example", description: "A submission from the public form.",
    });
    const context = { params: Promise.resolve({ id }) };
    const original = await db.collection("zgloszenia").findOne({ _id: new ObjectId(id) });

    expect((await GET(request(reader.key))).status).toBe(200);
    const listed = await listSubmissions(submissionRequest(reader.key));
    expect(listed.status).toBe(200);
    expect((await listed.json()).data).toEqual([{
      id,
      clipUrl: original!.clipUrl,
      description: original!.description,
      status: "pending",
      createdAt: original!.createdAt.toISOString(),
    }]);
    expect((await getSubmission(submissionRequest(reader.key), context)).status).toBe(200);
    expect((await postSubmission(submissionRequest(reader.key, "POST", {
      clipUrl: "https://youtu.be/example", description: "This write must be denied.",
    }))).status).toBe(403);
    expect((await patchSubmission(submissionRequest(reader.key, "PATCH", { status: "accepted" }), context)).status).toBe(403);
    expect((await deleteSubmission(submissionRequest(reader.key, "DELETE"), context)).status).toBe(403);
    expect(await db.collection("zgloszenia").countDocuments()).toBe(1);

    const updated = await patchSubmission(submissionRequest(writer.key, "PATCH", { status: "accepted" }), context);
    expect(updated.status).toBe(200);
    expect((await updated.json()).data).toMatchObject({ id, status: "accepted" });
    expect(await db.collection("zgloszenia").findOne({ _id: new ObjectId(id) }))
      .toEqual({ ...original, status: "accepted" });
    // Moderation is independent of publishing promises.
    expect(await db.collection("obietnice").countDocuments()).toBe(0);

    const created = await postSubmission(submissionRequest(writer.key, "POST", {
      clipUrl: "https://streamable.com/example", description: "An editorial API submission.",
    }));
    expect(created.status).toBe(201);
    const createdData = (await created.json()).data;
    expect(createdData.status).toBe("pending");
    expect(await db.collection("zgloszenia").findOne({ _id: new ObjectId(createdData.id) }))
      .toMatchObject({ createdAt: expect.any(Date), status: "pending" });

    await revokeManagedApiKey(reader.id);
    expect((await listSubmissions(submissionRequest(reader.key))).status).toBe(401);
    expect((await deleteSubmission(submissionRequest(writer.key, "DELETE"), context)).status).toBe(204);
    expect((await getSubmission(submissionRequest(writer.key), context)).status).toBe(404);
  });

  it("paginates and counts only matching submissions in the existing collection", async () => {
    const reader = await createManagedApiKey({ name: "Pagination", scope: "read" });
    const documents = ["pending", "accepted", "pending", "rejected", "pending"].map((status, index) => ({
      _id: new ObjectId(`507f1f77bcf86cd79943901${index}`),
      clipUrl: "https://youtu.be/example",
      description: "A pre-existing submission.",
      status,
      createdAt: new Date("2026-07-11T12:00:00.000Z"),
    }));
    await db.collection("zgloszenia").insertMany(documents);

    const first = await listSubmissions(submissionRequest(reader.key, "GET", undefined, "?status=pending&limit=2"));
    const firstPage = await first.json();
    expect(firstPage.data.map((item: { id: string }) => item.id)).toEqual([
      documents[4]._id.toHexString(), documents[2]._id.toHexString(),
    ]);
    expect(firstPage.pagination.nextCursor).toBe(documents[2]._id.toHexString());
    const next = await listSubmissions(submissionRequest(reader.key, "GET", undefined,
      `?status=pending&limit=2&cursor=${firstPage.pagination.nextCursor}`));
    expect(await next.json()).toMatchObject({
      data: [{ id: documents[0]._id.toHexString() }], pagination: { limit: 2, nextCursor: null },
    });

    const numbered = await listSubmissions(submissionRequest(reader.key, "GET", undefined, "?status=pending&limit=2&page=99"));
    expect(await numbered.json()).toMatchObject({
      data: [{ id: documents[0]._id.toHexString() }],
      pagination: { limit: 2, nextCursor: null, currentPage: 2, totalCount: 3, totalPages: 2 },
    });
    const empty = await listSubmissions(submissionRequest(reader.key, "GET", undefined, "?status=reviewed&page=99"));
    expect(await empty.json()).toEqual({
      data: [], pagination: { limit: 50, nextCursor: null, currentPage: 1, totalCount: 0, totalPages: 1 },
    });
    const unfiltered = await listSubmissions(submissionRequest(reader.key, "GET", undefined, "?page=1"));
    expect((await unfiltered.json()).pagination.totalCount).toBe(5);
  });

  it("shares the existing per-key rate limit between promises and submissions", async () => {
    const key = await createManagedApiKey({ name: "Shared limit", scope: "read" });
    await db.collection("apikey").updateOne(
      { _id: new ObjectId(key.id) }, { $set: { rateLimitMax: 1 } },
    );
    expect((await GET(request(key.key))).status).toBe(200);

    const denied = await listSubmissions(submissionRequest(key.key));

    expect(denied.status).toBe(429);
    expect(Number(denied.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("rejects missing, invalid, and expired keys on submissions", async () => {
    expect((await listSubmissions(new NextRequest("http://localhost:3000/api/v1/submissions"))).status).toBe(401);
    expect((await listSubmissions(submissionRequest("invalid"))).status).toBe(401);
    const key = await createManagedApiKey({ name: "Expired", scope: "read-write" });
    await db.collection("apikey").updateOne(
      { _id: new ObjectId(key.id) }, { $set: { expiresAt: new Date(Date.now() - 1_000) } },
    );
    expect((await listSubmissions(submissionRequest(key.key))).status).toBe(401);
  });

  it("lists every managed key past Better Auth's default 100-row limit", async () => {
    await createManagedApiKey({ name: "List fixture", scope: "read" });
    const initial = await listManagedApiKeys();
    const template = await db.collection("apikey").findOne();
    if (!template) throw new Error("Expected a stored key fixture.");
    const createdAt = new Date();
    const extraKeys = Array.from({ length: 105 }, (_, index) => ({
      ...template,
      _id: new ObjectId(),
      key: randomUUID(),
      name: `Bulk ${index}`,
      createdAt,
    }));
    await db.collection("apikey").insertMany(extraKeys);
    await db.collection("apikey").insertOne({
      ...template,
      _id: new ObjectId(),
      key: randomUUID(),
      configId: "unrelated",
    });

    const keys = await listManagedApiKeys();
    expect(keys).toHaveLength(initial.length + extraKeys.length);
    expect(new Set(keys.map((key) => key.id)).size).toBe(keys.length);
    for (const key of keys) expect(key).not.toHaveProperty("key");
  });

  it("finishes create, list, and revoke CLI processes without leaving connections open", async () => {
    const beforeCreation = Date.now();
    const created = await cli(
      "create", "--name", "CLI test", "--scope", "read", "--expires-in-days", "1",
    );
    const id = /^id: (.+)$/m.exec(created.stdout)?.[1];
    expect(id).toBeDefined();
    const expiresAt = new Date(/^expiresAt: (.+)$/m.exec(created.stdout)![1]);
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(beforeCreation + 86_400_000);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 86_400_000);
    const listed = await cli("list");
    expect(JSON.parse(listed.stdout)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id, enabled: true }),
    ]));
    await cli("revoke", "--id", id!);
    expect(await db.collection("apikey").findOne({ _id: new ObjectId(id) }))
      .toMatchObject({ enabled: false });
    await expect(cli("revoke", "--id", new ObjectId().toHexString()))
      .rejects.toMatchObject({ code: 1 });
  }, 20_000);

  it("rejects a misspelled expiry option before creating a non-expiring key", async () => {
    const count = await db.collection("apikey").countDocuments();
    await expect(cli("create", "--name", "Typo test", "--scope", "read", "--expires-in-day", "1"))
      .rejects.toMatchObject({ code: 1, stdout: "" });
    expect(await db.collection("apikey").countDocuments()).toBe(count);
  }, 10_000);
});

function request(key: string, method = "GET", body?: unknown) {
  return new NextRequest("http://localhost:3000/api/v1/promises", {
    method,
    headers: { "x-api-key": key, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function submissionRequest(key: string, method = "GET", body?: unknown, search = "") {
  return new NextRequest(`http://localhost:3000/api/v1/submissions${search}`, {
    method,
    headers: { "x-api-key": key, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function cli(...args: string[]) {
  return execFileAsync(process.execPath, [
    "--conditions=react-server", "--import", "tsx", "scripts/api-keys.ts", ...args,
  ], { env: process.env, timeout: 5_000 });
}
