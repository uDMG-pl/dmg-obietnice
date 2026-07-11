import { describe, expect, it } from "vitest";

import {
  formatObietnicaDate,
  getObietnicaDateSortTime,
  normalizeObietnicaDate,
} from "@/lib/partial-date";

describe("normalizeObietnicaDate", () => {
  it.each([
    [
      "2026",
      {
        year: 2026,
        precision: "year",
        dateTime: "2026",
        sortTime: Date.UTC(2026, 0, 1),
      },
    ],
    [
      { year: "2026", month: "7" },
      {
        year: 2026,
        month: 7,
        precision: "month",
        dateTime: "2026-07",
        sortTime: Date.UTC(2026, 6, 1),
      },
    ],
    [
      "2024-2-29",
      {
        year: 2024,
        month: 2,
        day: 29,
        precision: "day",
        dateTime: "2024-02-29",
        sortTime: Date.UTC(2024, 1, 29),
      },
    ],
  ])("normalizes %j while retaining its precision", (input, expected) => {
    expect(normalizeObietnicaDate(input)).toEqual(expected);
  });

  it("uses UTC components for Date documents", () => {
    expect(
      normalizeObietnicaDate(new Date("2025-12-31T23:30:00-02:00")),
    ).toMatchObject({
      year: 2026,
      month: 1,
      day: 1,
      precision: "day",
      dateTime: "2026-01-01",
    });
  });

  it.each([
    undefined,
    null,
    "not-a-date",
    "2023-02-29",
    { year: 2026, day: 1 },
    { year: 2026, month: 13 },
    { year: 999 },
    new Date(Number.NaN),
  ])("rejects an invalid legacy date: %j", (input) => {
    expect(normalizeObietnicaDate(input)).toBeUndefined();
  });
});

describe("partial date display helpers", () => {
  it("formats a year without inventing month or day precision", () => {
    const date = normalizeObietnicaDate("2026");

    expect(date && formatObietnicaDate(date)).toBe("2026");
    expect(getObietnicaDateSortTime(date)).toBe(Date.UTC(2026, 0, 1));
  });

  it("returns no sort value for a missing date", () => {
    expect(getObietnicaDateSortTime()).toBeUndefined();
  });
});
