import "server-only";

import { unstable_cache } from "next/cache";

import type {
  Obietnica,
  ObietnicaDocument,
  ObietnicaStatus,
} from "@/lib/definitions";
import { getMongoDb } from "@/lib/mongodb";
import {
  getObietnicaDateSortTime,
  normalizeObietnicaDate,
} from "@/lib/partial-date";

const REVALIDATE_SECONDS = Number(process.env.REVALIDATE_SECONDS ?? 300);
const OBIETNICE_LIMIT = 50;
const OBIETNICA_STATUSES = [
  "promised",
  "partially_fulfilled",
  "fulfilled",
  "unfulfilled",
] as const satisfies readonly ObietnicaStatus[];

const projection = {
  title: 1,
  description: 1,
  url: 1,
  datePromised: 1,
  dateDue: 1,
  status: 1,
  notes: 1,
  tags: 1,
};

function normalizeStatus(status?: ObietnicaStatus | null): ObietnicaStatus {
  return status && OBIETNICA_STATUSES.includes(status) ? status : "promised";
}

function normalizeTags(tags?: string[] | null): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .map((tag) => tag.trim())
    .filter((tag, index, allTags) => tag && allTags.indexOf(tag) === index);
}

function normalizeObietnica(document: ObietnicaDocument): Obietnica {
  return {
    id: document._id.toString(),
    title: document.title,
    description: document.description ?? undefined,
    url: document.url ?? undefined,
    datePromised: normalizeObietnicaDate(document.datePromised),
    dateDue: normalizeObietnicaDate(document.dateDue),
    status: normalizeStatus(document.status),
    notes: document.notes ?? undefined,
    tags: normalizeTags(document.tags),
  };
}

function compareDefaultObietnice(
  firstObietnica: Obietnica,
  secondObietnica: Obietnica,
) {
  return (
    compareDatesDescending(
      firstObietnica.datePromised,
      secondObietnica.datePromised,
    ) ||
    compareDatesDescending(firstObietnica.dateDue, secondObietnica.dateDue) ||
    secondObietnica.id.localeCompare(firstObietnica.id)
  );
}

function compareDatesDescending(
  firstDate?: Obietnica["datePromised"],
  secondDate?: Obietnica["datePromised"],
) {
  const firstTime = getObietnicaDateSortTime(firstDate);
  const secondTime = getObietnicaDateSortTime(secondDate);

  if (firstTime === secondTime) {
    return 0;
  }

  if (firstTime === undefined) {
    return 1;
  }

  if (secondTime === undefined) {
    return -1;
  }

  return secondTime - firstTime;
}

export const getObietnice = unstable_cache(
  async () => {
    const collectionName = process.env.MONGODB_COLLECTION ?? "obietnice";
    const db = await getMongoDb();
    const documents = await db
      .collection<ObietnicaDocument>(collectionName)
      .find({}, { projection })
      .toArray();

    return documents
      .map(normalizeObietnica)
      .sort(compareDefaultObietnice)
      .slice(0, OBIETNICE_LIMIT);
  },
  ["obietnice-list"],
  {
    revalidate: REVALIDATE_SECONDS,
    tags: ["obietnice"],
  },
);
