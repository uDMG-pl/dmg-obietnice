import { z } from "zod";

import { submissionContentSchema } from "@/lib/submissions/schema";

export const zglosFormSchema = submissionContentSchema;

export type ZglosFormInput = z.infer<typeof zglosFormSchema>;

export function parseZglosFormData(formData: FormData) {
  return zglosFormSchema.safeParse({
    clipUrl: formData.get("clipUrl"),
    description: formData.get("description"),
  });
}

export function zglosFieldErrors(
  error: z.ZodError<ZglosFormInput>,
): Partial<Record<keyof ZglosFormInput, string>> {
  const fields: Partial<Record<keyof ZglosFormInput, string>> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];
    if ((field === "clipUrl" || field === "description") && !fields[field]) {
      fields[field] = issue.message;
    }
  }

  return fields;
}
