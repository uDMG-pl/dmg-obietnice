import "server-only";

import { createSubmission } from "@/lib/submissions/repository";
import type { SubmissionCreateInput } from "@/lib/submissions/schema";

export async function createZgloszenie(
  input: Omit<SubmissionCreateInput, "status">,
): Promise<string> {
  const submission = await createSubmission({ ...input, status: "pending" });

  return submission.id;
}
