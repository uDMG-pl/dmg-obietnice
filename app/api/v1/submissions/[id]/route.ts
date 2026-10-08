import type { NextRequest } from "next/server";

import { authenticateApiKey } from "@/lib/api/authenticate";
import {
  apiError,
  apiJson,
  emptyApiResponse,
  internalApiError,
  validationError,
} from "@/lib/api/responses";
import {
  deleteSubmission,
  getSubmission,
  updateSubmission,
} from "@/lib/submissions/repository";
import {
  submissionIdSchema,
  submissionPatchSchema,
} from "@/lib/submissions/schema";

export const runtime = "nodejs";

type SubmissionRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: NextRequest,
  context: SubmissionRouteContext,
): Promise<Response> {
  try {
    const authentication = await authenticateApiKey(request, "read");
    if (!authentication.authenticated) {
      return authentication.response;
    }

    const id = await parseId(context);
    if (!id) {
      return invalidId();
    }

    const submission = await getSubmission(id);
    if (!submission) {
      return notFound();
    }

    return apiJson({ data: submission });
  } catch (error) {
    return internalApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: SubmissionRouteContext,
): Promise<Response> {
  try {
    const authentication = await authenticateApiKey(request, "write");
    if (!authentication.authenticated) {
      return authentication.response;
    }

    const id = await parseId(context);
    if (!id) {
      return invalidId();
    }

    if (!isJsonRequest(request)) {
      return apiError(
        415,
        "UNSUPPORTED_MEDIA_TYPE",
        "Content-Type must be application/json.",
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Request body is not valid JSON.");
    }

    const parsedBody = submissionPatchSchema.safeParse(body);
    if (!parsedBody.success) {
      return validationError(parsedBody.error);
    }

    const submission = await updateSubmission(id, parsedBody.data);
    if (!submission) {
      return notFound();
    }

    return apiJson({ data: submission });
  } catch (error) {
    return internalApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: SubmissionRouteContext,
): Promise<Response> {
  try {
    const authentication = await authenticateApiKey(request, "write");
    if (!authentication.authenticated) {
      return authentication.response;
    }

    const id = await parseId(context);
    if (!id) {
      return invalidId();
    }

    const deleted = await deleteSubmission(id);
    if (!deleted) {
      return notFound();
    }

    return emptyApiResponse(204);
  } catch (error) {
    return internalApiError(error);
  }
}

async function parseId(context: SubmissionRouteContext) {
  const { id } = await context.params;
  const parsedId = submissionIdSchema.safeParse(id);

  return parsedId.success ? parsedId.data : null;
}

function invalidId() {
  return apiError(
    400,
    "INVALID_ID",
    "Submission id must be a 24-character hexadecimal ObjectId.",
  );
}

function notFound() {
  return apiError(404, "NOT_FOUND", "Submission was not found.");
}

function isJsonRequest(request: Request) {
  return (
    request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase() === "application/json"
  );
}
