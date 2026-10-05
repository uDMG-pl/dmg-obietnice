import { describe, expect, it } from "vitest";

import type { Obietnica } from "@/lib/definitions";
import {
  promiseCreateSchema,
  promiseDateSchema,
  promiseIdSchema,
  promiseListQuerySchema,
  promisePatchSchema,
  serializePromise,
} from "@/lib/promises/schema";

describe("promiseDateSchema", () => {
  it.each([
    { year: 2026 },
    { year: 2026, month: 7 },
    { year: 2024, month: 2, day: 29 },
  ])("accepts a valid partial date: %j", (date) => {
    expect(promiseDateSchema.parse(date)).toEqual(date);
  });

  it.each([
    { year: 999 },
    { year: 2026, month: 13 },
    { year: 2026, day: 11 },
    { year: 2023, month: 2, day: 29 },
    { year: 2024, month: 4, day: 31 },
    { year: 2024, month: 2, day: 29, precision: "day" },
  ])("rejects an invalid partial date: %j", (date) => {
    expect(promiseDateSchema.safeParse(date).success).toBe(false);
  });
});

describe("promise payload schemas", () => {
  it("normalizes a create payload and supplies defaults", () => {
    expect(
      promiseCreateSchema.parse({
        title: "  Nowa obietnica  ",
        description: "  Szczegoly  ",
        url: "  https://example.com/source  ",
        datePromised: { year: 2026, month: 7 },
        tags: ["transport", " transport ", "region"],
      }),
    ).toEqual({
      title: "Nowa obietnica",
      description: "Szczegoly",
      url: "https://example.com/source",
      datePromised: { year: 2026, month: 7 },
      status: "promised",
      tags: ["transport", "region"],
    });
  });

  it.each([
    { title: "Obietnica", url: "http://example.com" },
    { title: "Obietnica", status: "pending" },
    { title: "Obietnica", unknown: true },
  ])("rejects an invalid create payload: %j", (payload) => {
    expect(promiseCreateSchema.safeParse(payload).success).toBe(false);
  });

  it("requires at least one PATCH field", () => {
    expect(promisePatchSchema.safeParse({}).success).toBe(false);
  });

  it("preserves explicit PATCH clearing operations", () => {
    expect(
      promisePatchSchema.parse({
        description: null,
        url: null,
        datePromised: null,
        dateDue: null,
        notes: null,
        tags: [],
      }),
    ).toEqual({
      description: null,
      url: null,
      datePromised: null,
      dateDue: null,
      notes: null,
      tags: [],
    });
  });

  it.each([{ title: null }, { status: null }, { extra: "field" }])(
    "rejects an invalid PATCH payload: %j",
    (payload) => {
      expect(promisePatchSchema.safeParse(payload).success).toBe(false);
    },
  );
});

describe("promise list and id schemas", () => {
  const cursor = "507f1f77bcf86cd799439011";

  it("uses the default page size", () => {
    expect(promiseListQuerySchema.parse({})).toEqual({ limit: 50 });
  });

  it("coerces URL search parameters", () => {
    expect(promiseListQuerySchema.parse({ limit: "100", cursor })).toEqual({
      limit: 100,
      cursor,
    });
    expect(promiseListQuerySchema.parse({ page: "7", limit: "25" })).toEqual({
      page: 7,
      limit: 25,
    });
  });

  it.each([
    { limit: "0" },
    { limit: "101" },
    { limit: "1.5" },
    { cursor: "not-an-object-id" },
    { page: "0" },
    { page: "-1" },
    { page: "1.5" },
    { page: "no-page" },
    { page: "9007199254740992" },
    { page: "2", cursor },
    { extra: "query" },
  ])("rejects an invalid list query: %j", (query) => {
    expect(promiseListQuerySchema.safeParse(query).success).toBe(false);
  });

  it("accepts ObjectIds case-insensitively", () => {
    expect(promiseIdSchema.parse(cursor.toUpperCase())).toBe(
      cursor.toUpperCase(),
    );
  });
});

describe("serializePromise", () => {
  it("exposes API fields without internal date metadata", () => {
    const promise: Obietnica = {
      id: "507f1f77bcf86cd799439011",
      title: "Obietnica",
      description: "Opis",
      url: "https://example.com/source",
      datePromised: {
        year: 2024,
        month: 2,
        day: 29,
        precision: "day",
        dateTime: "2024-02-29",
        sortTime: Date.UTC(2024, 1, 29),
      },
      dateDue: {
        year: 2026,
        precision: "year",
        dateTime: "2026",
        sortTime: Date.UTC(2026, 0, 1),
      },
      status: "partially_fulfilled",
      notes: "Notatka",
      tags: ["transport"],
    };

    expect(serializePromise(promise)).toEqual({
      id: promise.id,
      title: "Obietnica",
      description: "Opis",
      url: "https://example.com/source",
      datePromised: { year: 2024, month: 2, day: 29 },
      dateDue: { year: 2026 },
      status: "partially_fulfilled",
      notes: "Notatka",
      tags: ["transport"],
    });
  });

  it("omits absent optional fields", () => {
    expect(
      serializePromise({
        id: "507f1f77bcf86cd799439011",
        title: "Obietnica",
        status: "promised",
        tags: [],
      }),
    ).toEqual({
      id: "507f1f77bcf86cd799439011",
      title: "Obietnica",
      status: "promised",
      tags: [],
    });
  });
});
