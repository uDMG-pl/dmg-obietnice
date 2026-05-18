import { z } from "zod";

const clipHostPattern =
  /^https:\/\/(?:[\w-]+\.)?(?:twitch\.tv|kick\.com|youtube\.com|youtu\.be|drive\.google\.com|streamable\.com)\//i;

export const zglosFormSchema = z.object({
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
