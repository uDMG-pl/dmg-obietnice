import "server-only";

import { unstable_cache } from "next/cache";

import type { Obietnica, ObietnicaDocument } from "@/lib/definitions";
import { getMongoDb } from "@/lib/mongodb";

const REVALIDATE_SECONDS = Number(process.env.REVALIDATE_SECONDS ?? 300);

const projection = {
  title: 1,
  description: 1,
  url: 1,
  datePromised: 1,
  dateDue: 1,
  fulfilled: 1,
  notes: 1,
};

function formatDate(value?: Date | string | null) {
  if (!value) {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

function normalizeObietnica(document: ObietnicaDocument): Obietnica {
  return {
    id: document._id.toString(),
    title: document.title,
    description: document.description ?? undefined,
    url: document.url ?? undefined,
    datePromised: formatDate(document.datePromised),
    dateDue: formatDate(document.dateDue),
    fulfilled: document.fulfilled ?? false,
    notes: document.notes ?? undefined,
  };
}

export const getObietnice = unstable_cache(
  async () => {
    const collectionName = process.env.MONGODB_COLLECTION ?? "obietnice";
    const db = await getMongoDb();
    const documents = await db
      .collection<ObietnicaDocument>(collectionName)
      .find({}, { projection })
      .sort({ datePromised: -1, dateDue: -1, _id: -1 })
      .limit(50)
      .toArray();

    return documents.map(normalizeObietnica);
  },
  ["obietnice-list"],
  {
    revalidate: REVALIDATE_SECONDS,
    tags: ["obietnice"],
  },
);
