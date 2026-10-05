import { z } from "zod";

import type { Obietnica, ObietnicaDate } from "@/lib/definitions";

const objectIdPattern = /^[0-9a-f]{24}$/i;

const titleSchema = z.string().trim().min(1).max(200);
const optionalTextSchema = z.string().trim().min(1).max(2000).nullable();
const urlSchema = z
  .string()
  .trim()
  .max(2048)
  .pipe(z.url())
  .refine((value) => value.startsWith("https://"), {
    message: "URL must use HTTPS.",
  })
  .nullable();

export const promiseStatusSchema = z.enum([
  "promised",
  "partially_fulfilled",
  "fulfilled",
  "fulfilled_late",
  "unfulfilled",
]);

export const promiseDateSchema = z
  .strictObject({
    year: z.number().int().min(1000).max(9999),
    month: z.number().int().min(1).max(12).optional(),
    day: z.number().int().min(1).max(31).optional(),
  })
  .superRefine((value, context) => {
    if (value.day === undefined) {
      return;
    }

    if (value.month === undefined) {
      context.addIssue({
        code: "custom",
        message: "Month is required when day is provided.",
        path: ["month"],
      });
      return;
    }

    const date = new Date(Date.UTC(value.year, value.month - 1, value.day));
    if (
      date.getUTCFullYear() !== value.year ||
      date.getUTCMonth() !== value.month - 1 ||
      date.getUTCDate() !== value.day
    ) {
      context.addIssue({
        code: "custom",
        message: "Date is not valid.",
        path: ["day"],
      });
    }
  });

const nullableDateSchema = promiseDateSchema.nullable();
const tagsSchema = z
  .array(z.string().trim().min(1).max(64))
  .max(20)
  .transform((tags) => [...new Set(tags)]);

export const promiseCreateSchema = z.strictObject({
  title: titleSchema,
  description: optionalTextSchema.optional(),
  url: urlSchema.optional(),
  datePromised: nullableDateSchema.optional(),
  dateDue: nullableDateSchema.optional(),
  status: promiseStatusSchema.default("promised"),
  notes: optionalTextSchema.optional(),
  tags: tagsSchema.default([]),
});

export const promisePatchSchema = z
  .strictObject({
    title: titleSchema.optional(),
    description: optionalTextSchema.optional(),
    url: urlSchema.optional(),
    datePromised: nullableDateSchema.optional(),
    dateDue: nullableDateSchema.optional(),
    status: promiseStatusSchema.optional(),
    notes: optionalTextSchema.optional(),
    tags: tagsSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

export const promiseListQuerySchema = z
  .strictObject({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().regex(objectIdPattern).optional(),
    page: z.coerce.number().int().positive().optional(),
  })
  .refine((query) => query.page === undefined || query.cursor === undefined, {
    message: "Use either page or cursor, not both.",
    path: ["page"],
  });

export const promiseIdSchema = z.string().regex(objectIdPattern);

export type PromiseCreateInput = z.infer<typeof promiseCreateSchema>;
export type PromisePatchInput = z.infer<typeof promisePatchSchema>;
export type PromiseListQuery = z.infer<typeof promiseListQuerySchema>;

export type PromiseApiResource = {
  id: string;
  title: string;
  description?: string;
  url?: string;
  datePromised?: PromiseApiDate;
  dateDue?: PromiseApiDate;
  status: Obietnica["status"];
  notes?: string;
  tags: string[];
};

type PromiseApiDate = {
  year: number;
  month?: number;
  day?: number;
};

export function serializePromise(promise: Obietnica): PromiseApiResource {
  return {
    id: promise.id,
    title: promise.title,
    ...(promise.description ? { description: promise.description } : {}),
    ...(promise.url ? { url: promise.url } : {}),
    ...(promise.datePromised
      ? { datePromised: serializeDate(promise.datePromised) }
      : {}),
    ...(promise.dateDue ? { dateDue: serializeDate(promise.dateDue) } : {}),
    status: promise.status,
    ...(promise.notes ? { notes: promise.notes } : {}),
    tags: promise.tags,
  };
}

function serializeDate(date: ObietnicaDate): PromiseApiDate {
  return {
    year: date.year,
    ...(date.month !== undefined ? { month: date.month } : {}),
    ...(date.day !== undefined ? { day: date.day } : {}),
  };
}
