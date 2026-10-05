import "server-only";

import { ObjectId, type Collection, type Filter } from "mongodb";

import type { Obietnica, ObietnicaDocument } from "@/lib/definitions";
import { getMongoDb } from "@/lib/mongodb";
import {
  getObietniceCollectionName,
  normalizeObietnica,
  OBIETNICA_PROJECTION,
} from "@/lib/obietnice";
import type {
  PromiseCreateInput,
  PromiseListQuery,
  PromisePatchInput,
} from "@/lib/promises/schema";

export type PromisePage = {
  items: Obietnica[];
  nextCursor: string | null;
  pagination?: {
    currentPage: number;
    totalCount: number;
    totalPages: number;
  };
};

export async function listPromises(
  query: PromiseListQuery,
): Promise<PromisePage> {
  const collection = await getPromisesCollection();
  if (query.page !== undefined) {
    // Count using the existing ID index, then fetch only the requested page.
    const totalCount = await collection.countDocuments(
      {},
      {
        hint: "_id_",
        maxTimeMS: 5_000,
      },
    );
    const totalPages = Math.max(1, Math.ceil(totalCount / query.limit));
    const currentPage = Math.min(query.page, totalPages);
    const documents = await collection
      .find({}, { projection: OBIETNICA_PROJECTION, maxTimeMS: 5_000 })
      .sort({ _id: -1 })
      .skip((currentPage - 1) * query.limit)
      .limit(query.limit)
      .toArray();

    return {
      items: documents.map(normalizeObietnica),
      nextCursor:
        currentPage < totalPages
          ? (documents.at(-1)?._id.toHexString() ?? null)
          : null,
      pagination: { currentPage, totalCount, totalPages },
    };
  }

  const filter: Filter<ObietnicaDocument> = query.cursor
    ? { _id: { $lt: new ObjectId(query.cursor) } }
    : {};
  const documents = await collection
    .find(filter, { projection: OBIETNICA_PROJECTION })
    .sort({ _id: -1 })
    .limit(query.limit + 1)
    .toArray();
  const hasNextPage = documents.length > query.limit;
  const pageDocuments = hasNextPage
    ? documents.slice(0, query.limit)
    : documents;

  return {
    items: pageDocuments.map(normalizeObietnica),
    nextCursor: hasNextPage
      ? (pageDocuments.at(-1)?._id.toHexString() ?? null)
      : null,
  };
}

export async function getPromise(id: string): Promise<Obietnica | null> {
  const collection = await getPromisesCollection();
  const document = await collection.findOne(
    { _id: new ObjectId(id) },
    { projection: OBIETNICA_PROJECTION },
  );

  return document ? normalizeObietnica(document) : null;
}

export async function createPromise(
  input: PromiseCreateInput,
): Promise<Obietnica> {
  const collection = await getPromisesCollection();
  const document = createPromiseDocument(input);

  await collection.insertOne(document);

  return normalizeObietnica(document);
}

export async function updatePromise(
  id: string,
  input: PromisePatchInput,
): Promise<Obietnica | null> {
  const collection = await getPromisesCollection();
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, ""> = {};

  for (const [field, value] of Object.entries(input)) {
    if (value === null) {
      $unset[field] = "";
    } else {
      $set[field] = value;
    }
  }

  const document = await collection.findOneAndUpdate(
    { _id: new ObjectId(id) },
    {
      ...(Object.keys($set).length > 0 ? { $set } : {}),
      ...(Object.keys($unset).length > 0 ? { $unset } : {}),
    },
    {
      projection: OBIETNICA_PROJECTION,
      returnDocument: "after",
    },
  );

  return document ? normalizeObietnica(document) : null;
}

export async function deletePromise(id: string): Promise<boolean> {
  const collection = await getPromisesCollection();
  const result = await collection.deleteOne({ _id: new ObjectId(id) });

  return result.deletedCount === 1;
}

async function getPromisesCollection(): Promise<Collection<ObietnicaDocument>> {
  const db = await getMongoDb();

  return db.collection<ObietnicaDocument>(getObietniceCollectionName());
}

function createPromiseDocument(input: PromiseCreateInput): ObietnicaDocument {
  return {
    _id: new ObjectId(),
    title: input.title,
    ...(input.description ? { description: input.description } : {}),
    ...(input.url ? { url: input.url } : {}),
    ...(input.datePromised ? { datePromised: input.datePromised } : {}),
    ...(input.dateDue ? { dateDue: input.dateDue } : {}),
    status: input.status,
    ...(input.notes ? { notes: input.notes } : {}),
    tags: input.tags,
  };
}
