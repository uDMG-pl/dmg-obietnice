import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

import type { Obietnica, ObietnicaStatus } from "@/lib/definitions";

const mocks = vi.hoisted(() => ({
  collection: vi.fn(),
  deleteOne: vi.fn(),
  find: vi.fn(),
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  getMongoDb: vi.fn(),
  insertOne: vi.fn(),
  limit: vi.fn(),
  normalizeObietnica: vi.fn(),
  projection: {
    title: 1,
    description: 1,
    url: 1,
    datePromised: 1,
    dateDue: 1,
    status: 1,
    notes: 1,
    tags: 1,
  },
  sort: vi.fn(),
  toArray: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({
  getMongoDb: mocks.getMongoDb,
}));

vi.mock("@/lib/obietnice", () => ({
  getObietniceCollectionName: () => "obietnice",
  normalizeObietnica: mocks.normalizeObietnica,
  OBIETNICA_PROJECTION: mocks.projection,
}));

import {
  createPromise,
  deletePromise,
  getPromise,
  listPromises,
  updatePromise,
} from "@/lib/promises/repository";

type PromiseDocumentFixture = {
  _id: ObjectId;
  title: string;
  status?: ObietnicaStatus;
  tags?: string[];
};

describe("promise repository", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mocks.getMongoDb.mockResolvedValue({ collection: mocks.collection });
    mocks.collection.mockReturnValue({
      deleteOne: mocks.deleteOne,
      find: mocks.find,
      findOne: mocks.findOne,
      findOneAndUpdate: mocks.findOneAndUpdate,
      insertOne: mocks.insertOne,
    });
    mocks.find.mockReturnValue({ sort: mocks.sort });
    mocks.sort.mockReturnValue({ limit: mocks.limit });
    mocks.limit.mockReturnValue({ toArray: mocks.toArray });
    mocks.normalizeObietnica.mockImplementation(normalizeFixture);
  });

  it("uses an exclusive cursor and returns the cursor of the last page item", async () => {
    const cursor = "507f1f77bcf86cd799439014";
    const documents = [
      fixture("507f1f77bcf86cd799439013", "Pierwsza"),
      fixture("507f1f77bcf86cd799439012", "Druga"),
      fixture("507f1f77bcf86cd799439011", "Nastepna strona"),
    ];
    mocks.toArray.mockResolvedValue(documents);

    const result = await listPromises({ limit: 2, cursor });

    expect(mocks.collection).toHaveBeenCalledWith("obietnice");
    expect(mocks.find).toHaveBeenCalledWith(
      { _id: { $lt: new ObjectId(cursor) } },
      { projection: mocks.projection },
    );
    expect(mocks.sort).toHaveBeenCalledWith({ _id: -1 });
    expect(mocks.limit).toHaveBeenCalledWith(3);
    expect(mocks.normalizeObietnica).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      items: [normalizeFixture(documents[0]), normalizeFixture(documents[1])],
      nextCursor: documents[1]._id.toHexString(),
    });
  });

  it("returns a null cursor when the database has no extra item", async () => {
    const documents = [
      fixture("507f1f77bcf86cd799439013", "Pierwsza"),
      fixture("507f1f77bcf86cd799439012", "Druga"),
    ];
    mocks.toArray.mockResolvedValue(documents);

    const result = await listPromises({ limit: 2 });

    expect(mocks.find).toHaveBeenCalledWith(
      {},
      { projection: mocks.projection },
    );
    expect(result.nextCursor).toBeNull();
    expect(result.items).toHaveLength(2);
  });

  it("creates and inserts a document compatible with the existing collection", async () => {
    mocks.insertOne.mockResolvedValue({ acknowledged: true });

    const result = await createPromise({
      title: "Nowa obietnica",
      description: "Opis",
      url: "https://example.com/source",
      datePromised: { year: 2026, month: 7 },
      dateDue: null,
      status: "promised",
      notes: null,
      tags: ["transport"],
    });

    expect(mocks.insertOne).toHaveBeenCalledOnce();
    const [document] = mocks.insertOne.mock.calls[0];
    expect(document).toEqual({
      _id: expect.any(ObjectId),
      title: "Nowa obietnica",
      description: "Opis",
      url: "https://example.com/source",
      datePromised: { year: 2026, month: 7 },
      status: "promised",
      tags: ["transport"],
    });
    expect(document).not.toHaveProperty("dateDue");
    expect(document).not.toHaveProperty("notes");
    expect(mocks.normalizeObietnica).toHaveBeenCalledWith(document);
    expect(result.id).toBe(document._id.toHexString());
  });

  it("maps PATCH values to $set and nulls to $unset", async () => {
    const updatedDocument = fixture(
      "507f1f77bcf86cd799439011",
      "Zmieniona obietnica",
    );
    mocks.findOneAndUpdate.mockResolvedValue(updatedDocument);

    const result = await updatePromise(updatedDocument._id.toHexString(), {
      title: "Zmieniona obietnica",
      description: null,
      dateDue: null,
      tags: [],
    });

    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: updatedDocument._id },
      {
        $set: {
          title: "Zmieniona obietnica",
          tags: [],
        },
        $unset: {
          description: "",
          dateDue: "",
        },
      },
      {
        projection: mocks.projection,
        returnDocument: "after",
      },
    );
    expect(result).toEqual(normalizeFixture(updatedDocument));
  });

  it("returns null when a promise cannot be found", async () => {
    const promiseId = "507f1f77bcf86cd799439011";
    mocks.findOne.mockResolvedValue(null);

    const result = await getPromise(promiseId);

    expect(mocks.findOne).toHaveBeenCalledWith(
      { _id: new ObjectId(promiseId) },
      { projection: mocks.projection },
    );
    expect(mocks.normalizeObietnica).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it.each([
    [0, false],
    [1, true],
  ])(
    "maps deletedCount=%i to %j",
    async (deletedCount, expected) => {
      const promiseId = "507f1f77bcf86cd799439011";
      mocks.deleteOne.mockResolvedValue({ deletedCount });

      const result = await deletePromise(promiseId);

      expect(mocks.deleteOne).toHaveBeenCalledWith({
        _id: new ObjectId(promiseId),
      });
      expect(result).toBe(expected);
    },
  );
});

function fixture(id: string, title: string): PromiseDocumentFixture {
  return {
    _id: new ObjectId(id),
    title,
    status: "promised",
    tags: [],
  };
}

function normalizeFixture(document: PromiseDocumentFixture): Obietnica {
  return {
    id: document._id.toHexString(),
    title: document.title,
    status: document.status ?? "promised",
    tags: document.tags ?? [],
  };
}
