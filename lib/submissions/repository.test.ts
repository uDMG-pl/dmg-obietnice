import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

import type { ZgloszenieDocument } from "@/lib/definitions";

const mocks = vi.hoisted(() => ({
  collection: vi.fn(),
  countDocuments: vi.fn(),
  deleteOne: vi.fn(),
  find: vi.fn(),
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  getMongoDb: vi.fn(),
  insertOne: vi.fn(),
  limit: vi.fn(),
  sort: vi.fn(),
  skip: vi.fn(),
  toArray: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({ getMongoDb: mocks.getMongoDb }));

import {
  createSubmission,
  deleteSubmission,
  getSubmission,
  listSubmissions,
  updateSubmission,
} from "@/lib/submissions/repository";
import { createZgloszenie } from "@/lib/zgloszenia";

const projection = { clipUrl: 1, description: 1, status: 1, createdAt: 1 };
const id = "507f1f77bcf86cd799439011";
const document: ZgloszenieDocument = {
  _id: new ObjectId(id),
  clipUrl: "https://youtu.be/example",
  description: "A promise to publish a report.",
  status: "pending",
  createdAt: new Date("2026-07-11T12:00:00.000Z"),
};
const resource = {
  id,
  clipUrl: document.clipUrl,
  description: document.description,
  status: document.status,
  createdAt: document.createdAt.toISOString(),
};

describe("submission repository", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getMongoDb.mockResolvedValue({ collection: mocks.collection });
    mocks.collection.mockReturnValue(mocks);
    mocks.find.mockReturnValue(mocks);
    mocks.sort.mockReturnValue(mocks);
    mocks.skip.mockReturnValue(mocks);
    mocks.limit.mockReturnValue(mocks);
  });

  it("reads existing submissions and exposes only documented fields", async () => {
    mocks.findOne.mockResolvedValue({ ...document, privateField: "internal" });

    expect(await getSubmission(id)).toEqual(resource);
    expect(mocks.collection).toHaveBeenCalledWith("zgloszenia");
    expect(mocks.findOne).toHaveBeenCalledWith(
      { _id: new ObjectId(id) },
      { projection },
    );
  });

  it("combines the status filter with an exclusive cursor", async () => {
    mocks.toArray.mockResolvedValue([
      document,
      { ...document, _id: new ObjectId("507f1f77bcf86cd799439010") },
    ]);
    const cursor = "507f1f77bcf86cd799439012";

    const result = await listSubmissions({ limit: 1, status: "pending", cursor });

    expect(mocks.find).toHaveBeenCalledWith(
      { status: "pending", _id: { $lt: new ObjectId(cursor) } },
      { projection, maxTimeMS: 5_000 },
    );
    expect(mocks.sort).toHaveBeenCalledWith({ _id: -1 });
    expect(mocks.limit).toHaveBeenCalledWith(2);
    expect(result).toEqual({ items: [resource], nextCursor: id });
    expect(mocks.countDocuments).not.toHaveBeenCalled();
  });

  it("returns a null cursor on a final cursor page", async () => {
    mocks.toArray.mockResolvedValue([document]);

    expect(await listSubmissions({ limit: 2 })).toEqual({
      items: [resource], nextCursor: null,
    });
  });

  it.each([
    { count: 3, requestedPage: 1, currentPage: 1, totalPages: 2, nextCursor: id },
    { count: 3, requestedPage: 99, currentPage: 2, totalPages: 2, nextCursor: null },
    { count: 0, requestedPage: 99, currentPage: 1, totalPages: 1, nextCursor: null },
  ])("counts and clamps filtered pages: %j", async (expected) => {
    mocks.countDocuments.mockResolvedValue(expected.count);
    mocks.toArray.mockResolvedValue(expected.count ? [document] : []);

    const result = await listSubmissions({
      limit: 2, page: expected.requestedPage, status: "pending",
    });

    expect(mocks.countDocuments).toHaveBeenCalledWith(
      { status: "pending" }, { maxTimeMS: 5_000 },
    );
    expect(mocks.find).toHaveBeenCalledWith(
      { status: "pending" }, { projection, maxTimeMS: 5_000 },
    );
    expect(mocks.skip).toHaveBeenCalledWith((expected.currentPage - 1) * 2);
    expect(mocks.limit).toHaveBeenCalledWith(2);
    expect(result).toEqual({
      items: expected.count ? [resource] : [],
      nextCursor: expected.nextCursor,
      pagination: {
        currentPage: expected.currentPage,
        totalCount: expected.count,
        totalPages: expected.totalPages,
      },
    });
  });

  it("counts unfiltered pages with the existing ID index", async () => {
    mocks.countDocuments.mockResolvedValue(0);
    mocks.toArray.mockResolvedValue([]);

    await listSubmissions({ limit: 50, page: 1 });

    expect(mocks.countDocuments).toHaveBeenCalledWith(
      {}, { hint: "_id_", maxTimeMS: 5_000 },
    );
  });

  it("creates the existing BSON document shape with a server-owned timestamp", async () => {
    const before = Date.now();

    const result = await createSubmission({
      clipUrl: document.clipUrl, description: document.description, status: "accepted",
    });

    const stored = mocks.insertOne.mock.calls[0][0];
    expect(stored).toEqual({
      _id: expect.any(ObjectId),
      clipUrl: document.clipUrl,
      description: document.description,
      status: "accepted",
      createdAt: expect.any(Date),
    });
    expect(stored.createdAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.id).toBe(stored._id.toHexString());
    expect(result.createdAt).toBe(stored.createdAt.toISOString());
  });

  it("keeps public form submissions pending and returns their original ID format", async () => {
    const result = await createZgloszenie({
      clipUrl: document.clipUrl, description: document.description,
    });

    const stored = mocks.insertOne.mock.calls[0][0];
    expect(stored.status).toBe("pending");
    expect(result).toBe(stored._id.toHexString());
  });

  it("atomically changes only supplied fields and returns the updated submission", async () => {
    mocks.findOneAndUpdate.mockResolvedValue({ ...document, status: "reviewed" });

    expect(await updateSubmission(id, { status: "reviewed" })).toEqual({
      ...resource, status: "reviewed",
    });
    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: new ObjectId(id) },
      { $set: { status: "reviewed" } },
      { projection, returnDocument: "after" },
    );
  });

  it("returns null for missing read and update targets", async () => {
    mocks.findOne.mockResolvedValue(null);
    mocks.findOneAndUpdate.mockResolvedValue(null);

    expect(await getSubmission(id)).toBeNull();
    expect(await updateSubmission(id, { status: "rejected" })).toBeNull();
  });

  it.each([0, 1])("reports whether a deletion found a document: %s", async (count) => {
    mocks.deleteOne.mockResolvedValue({ deletedCount: count });

    expect(await deleteSubmission(id)).toBe(count === 1);
    expect(mocks.deleteOne).toHaveBeenCalledWith({ _id: new ObjectId(id) });
  });
});
