import "server-only";

import { ObjectId, type Collection, type Filter } from "mongodb";

import type { ZgloszenieDocument } from "@/lib/definitions";
import { getMongoDb } from "@/lib/mongodb";
import {
  serializeSubmission,
  type SubmissionApiResource,
  type SubmissionCreateInput,
  type SubmissionListQuery,
  type SubmissionPatchInput,
} from "@/lib/submissions/schema";

const SUBMISSIONS_COLLECTION = "zgloszenia";
const SUBMISSION_PROJECTION = {
  clipUrl: 1,
  description: 1,
  status: 1,
  createdAt: 1,
};

export type SubmissionPage = {
  items: SubmissionApiResource[];
  nextCursor: string | null;
  pagination?: {
    currentPage: number;
    totalCount: number;
    totalPages: number;
  };
};

export async function listSubmissions(
  query: SubmissionListQuery,
): Promise<SubmissionPage> {
  const collection = await getSubmissionsCollection();
  const filter: Filter<ZgloszenieDocument> = query.status
    ? { status: query.status }
    : {};

  if (query.page !== undefined) {
    const totalCount = await collection.countDocuments(filter, {
      ...(query.status ? {} : { hint: "_id_" }),
      maxTimeMS: 5_000,
    });
    const totalPages = Math.max(1, Math.ceil(totalCount / query.limit));
    const currentPage = Math.min(query.page, totalPages);
    const documents = await collection
      .find(filter, { projection: SUBMISSION_PROJECTION, maxTimeMS: 5_000 })
      .sort({ _id: -1 })
      .skip((currentPage - 1) * query.limit)
      .limit(query.limit)
      .toArray();

    return {
      items: documents.map(serializeSubmission),
      nextCursor:
        currentPage < totalPages
          ? (documents.at(-1)?._id.toHexString() ?? null)
          : null,
      pagination: { currentPage, totalCount, totalPages },
    };
  }

  if (query.cursor) {
    filter._id = { $lt: new ObjectId(query.cursor) };
  }
  const documents = await collection
    .find(filter, { projection: SUBMISSION_PROJECTION, maxTimeMS: 5_000 })
    .sort({ _id: -1 })
    .limit(query.limit + 1)
    .toArray();
  const hasNextPage = documents.length > query.limit;
  const pageDocuments = hasNextPage
    ? documents.slice(0, query.limit)
    : documents;

  return {
    items: pageDocuments.map(serializeSubmission),
    nextCursor: hasNextPage
      ? (pageDocuments.at(-1)?._id.toHexString() ?? null)
      : null,
  };
}

export async function getSubmission(
  id: string,
): Promise<SubmissionApiResource | null> {
  const collection = await getSubmissionsCollection();
  const document = await collection.findOne(
    { _id: new ObjectId(id) },
    { projection: SUBMISSION_PROJECTION },
  );

  return document ? serializeSubmission(document) : null;
}

export async function createSubmission(
  input: SubmissionCreateInput,
): Promise<SubmissionApiResource> {
  const collection = await getSubmissionsCollection();
  const document: ZgloszenieDocument = {
    _id: new ObjectId(),
    clipUrl: input.clipUrl,
    description: input.description,
    status: input.status,
    createdAt: new Date(),
  };

  await collection.insertOne(document);

  return serializeSubmission(document);
}

export async function updateSubmission(
  id: string,
  input: SubmissionPatchInput,
): Promise<SubmissionApiResource | null> {
  const collection = await getSubmissionsCollection();
  const document = await collection.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: input },
    { projection: SUBMISSION_PROJECTION, returnDocument: "after" },
  );

  return document ? serializeSubmission(document) : null;
}

export async function deleteSubmission(id: string): Promise<boolean> {
  const collection = await getSubmissionsCollection();
  const result = await collection.deleteOne({ _id: new ObjectId(id) });

  return result.deletedCount === 1;
}

async function getSubmissionsCollection(): Promise<Collection<ZgloszenieDocument>> {
  const db = await getMongoDb();

  return db.collection<ZgloszenieDocument>(SUBMISSIONS_COLLECTION);
}
