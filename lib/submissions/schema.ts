import { z } from "zod";

import type { ZgloszenieDocument, ZgloszenieStatus } from "@/lib/definitions";

const objectIdPattern = /^[0-9a-f]{24}$/i;
const clipHostPattern =
  /^https:\/\/(?:[\w-]+\.)?(?:twitch\.tv|kick\.com|youtube\.com|youtu\.be|drive\.google\.com|streamable\.com)\//i;

// Shared with the public form so both entry points accept the same content.
export const submissionContentSchema = z.object({
  clipUrl: z
    .string("Podaj adres klipu.")
    .trim()
    .min(1, "Podaj adres klipu.")
    .max(2048, "Adres klipu jest za długi.")
    .pipe(z.url("Podaj poprawny adres URL (https://…)."))
    .refine((url) => url.startsWith("https://"), {
      message: "Adres klipu musi używać HTTPS.",
    })
    .refine((url) => clipHostPattern.test(url), {
      message:
        "Obsługuje linki z Twitcha, Kicka, YouTube, Google Drive i Streamable.",
    }),
  description: z
    .string("Dodaj opis obietnicy.")
    .trim()
    .min(10, "Opis musi mieć co najmniej 10 znaków.")
    .max(2000, "Opis może mieć maksymalnie 2000 znaków."),
});

export const submissionStatusSchema = z.enum([
  "pending",
  "reviewed",
  "rejected",
  "accepted",
]);

export const submissionCreateSchema = z.strictObject({
  ...submissionContentSchema.shape,
  status: submissionStatusSchema.default("pending"),
});

export const submissionPatchSchema = z
  .strictObject({
    clipUrl: submissionContentSchema.shape.clipUrl.optional(),
    description: submissionContentSchema.shape.description.optional(),
    status: submissionStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

export const submissionListQuerySchema = z
  .strictObject({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().regex(objectIdPattern).optional(),
    page: z.coerce.number().int().positive().optional(),
    status: submissionStatusSchema.optional(),
  })
  .refine((query) => query.page === undefined || query.cursor === undefined, {
    message: "Use either page or cursor, not both.",
    path: ["page"],
  });

export const submissionIdSchema = z.string().regex(objectIdPattern);

export type SubmissionCreateInput = z.infer<typeof submissionCreateSchema>;
export type SubmissionPatchInput = z.infer<typeof submissionPatchSchema>;
export type SubmissionListQuery = z.infer<typeof submissionListQuerySchema>;

export type SubmissionApiResource = {
  id: string;
  clipUrl: string;
  description: string;
  status: ZgloszenieStatus;
  createdAt: string;
};

export function serializeSubmission(
  document: ZgloszenieDocument,
): SubmissionApiResource {
  return {
    id: document._id.toHexString(),
    clipUrl: document.clipUrl,
    description: document.description,
    status: document.status,
    createdAt: document.createdAt.toISOString(),
  };
}
