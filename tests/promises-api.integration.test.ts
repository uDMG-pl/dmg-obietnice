import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";

import { ObjectId, type Db } from "mongodb";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/v1/promises/route";
import { DELETE, GET as getOne, PATCH } from "@/app/api/v1/promises/[id]/route";
import {
  createManagedApiKey,
  listManagedApiKeys,
  revokeManagedApiKey,
} from "@/lib/api-key-admin";
import { closeMongoClient, getMongoDb } from "@/lib/mongodb";

// Only the Next.js cache needs a request runtime. Auth and MongoDB stay real.
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}));

const execFileAsync = promisify(execFile);
const mongoUri = process.env.TEST_MONGODB_URI;

describe.skipIf(!mongoUri)("promises API with MongoDB and Better Auth", () => {
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

function cli(...args: string[]) {
  return execFileAsync(process.execPath, [
    "--conditions=react-server", "--import", "tsx", "scripts/api-keys.ts", ...args,
  ], { env: process.env, timeout: 5_000 });
}
