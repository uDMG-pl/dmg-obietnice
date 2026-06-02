import type {
  ObietnicaDate,
  ObietnicaDateDocument,
  ObietnicaDatePrecision,
  ObietnicaPartialDateDocument,
} from "@/lib/definitions";

const MIN_YEAR = 1000;
const MAX_YEAR = 9999;

const monthFormatter = new Intl.DateTimeFormat("pl-PL", {
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

const dayFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

export function normalizeObietnicaDate(
  value?: ObietnicaDateDocument,
): ObietnicaDate | undefined {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    return normalizeDateInstance(value);
  }

  if (typeof value === "string") {
    return normalizeStringDate(value);
  }

  return normalizePartialDateDocument(value);
}

export function formatObietnicaDate(date: ObietnicaDate) {
  switch (date.precision) {
    case "year":
      return String(date.year);
    case "month":
      return monthFormatter.format(createUtcDate(date));
    case "day":
      return dayFormatter.format(createUtcDate(date));
  }
}

export function getObietnicaDateSortTime(date?: ObietnicaDate) {
  return date?.sortTime;
}

function normalizePartialDateDocument(
  value: ObietnicaPartialDateDocument,
): ObietnicaDate | undefined {
  const year = normalizeInteger(value.year);
  const month = normalizeInteger(value.month);
  const day = normalizeInteger(value.day);

  if (!isValidYear(year)) {
    return undefined;
  }

  if (month !== undefined && !isValidMonth(month)) {
    return undefined;
  }

  if (day !== undefined) {
    if (month === undefined || !isValidDay(year, month, day)) {
      return undefined;
    }

    return createObietnicaDate(year, month, day, "day");
  }

  if (month !== undefined) {
    return createObietnicaDate(year, month, undefined, "month");
  }

  return createObietnicaDate(year, undefined, undefined, "year");
}

function normalizeStringDate(value: string) {
  const trimmedValue = value.trim();
  const yearMatch = /^(\d{4})$/.exec(trimmedValue);
  const monthMatch = /^(\d{4})-(\d{1,2})$/.exec(trimmedValue);
  const dayMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmedValue);

  if (yearMatch) {
    return normalizePartialDateDocument({ year: yearMatch[1] });
  }

  if (monthMatch) {
    return normalizePartialDateDocument({
      year: monthMatch[1],
      month: monthMatch[2],
    });
  }

  if (dayMatch) {
    return normalizePartialDateDocument({
      year: dayMatch[1],
      month: dayMatch[2],
      day: dayMatch[3],
    });
  }

  return normalizeDateInstance(new Date(trimmedValue));
}

function normalizeDateInstance(value: Date) {
  if (Number.isNaN(value.getTime())) {
    return undefined;
  }

  return createObietnicaDate(
    value.getUTCFullYear(),
    value.getUTCMonth() + 1,
    value.getUTCDate(),
    "day",
  );
}

function createObietnicaDate(
  year: number,
  month: number | undefined,
  day: number | undefined,
  precision: ObietnicaDatePrecision,
): ObietnicaDate {
  const sortMonth = month ?? 1;
  const sortDay = day ?? 1;

  return {
    year,
    ...(precision !== "year" && month ? { month } : {}),
    ...(precision === "day" && day ? { day } : {}),
    precision,
    dateTime: formatDateTime(year, month, day, precision),
    sortTime: Date.UTC(year, sortMonth - 1, sortDay),
  };
}

function formatDateTime(
  year: number,
  month: number | undefined,
  day: number | undefined,
  precision: ObietnicaDatePrecision,
) {
  if (precision === "year") {
    return String(year);
  }

  const formattedMonth = padDatePart(month ?? 1);

  if (precision === "month") {
    return `${year}-${formattedMonth}`;
  }

  return `${year}-${formattedMonth}-${padDatePart(day ?? 1)}`;
}

function createUtcDate(date: ObietnicaDate) {
  return new Date(Date.UTC(date.year, (date.month ?? 1) - 1, date.day ?? 1));
}

function normalizeInteger(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? value : undefined;
  }

  const trimmedValue = value.trim();

  if (!/^\d+$/.test(trimmedValue)) {
    return undefined;
  }

  const numberValue = Number(trimmedValue);

  return Number.isInteger(numberValue) ? numberValue : undefined;
}

function isValidYear(year: number | undefined): year is number {
  return year !== undefined && year >= MIN_YEAR && year <= MAX_YEAR;
}

function isValidMonth(month: number) {
  return month >= 1 && month <= 12;
}

function isValidDay(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    day >= 1 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}
