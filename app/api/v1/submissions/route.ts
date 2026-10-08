import type { NextRequest } from "next/server";

import { authenticateApiKey } from "@/lib/api/authenticate";
import {
  apiError,
  apiJson,
  internalApiError,
  validationError,
} from "@/lib/api/responses";
import { createSubmission, listSubmissions } from "@/lib/submissions/repository";
import {
  submissionCreateSchema,
  submissionListQuerySchema,
} from "@/lib/submissions/schema";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const authentication = await authenticateApiKey(request, "read");
    if (!authentication.authenticated) {
      return authentication.response;
    }

    const parsedQuery = submissionListQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!parsedQuery.success) {
      return validationError(parsedQuery.error);
    }

    const page = await listSubmissions(parsedQuery.data);

    return apiJson({
      data: page.items,
      pagination: {
        limit: parsedQuery.data.limit,
        nextCursor: page.nextCursor,
        ...page.pagination,
      },
    });
  } catch (error) {
    return internalApiError(error);
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const authentication = await authenticateApiKey(request, "write");
    if (!authentication.authenticated) {
      return authentication.response;
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

    const parsedBody = submissionCreateSchema.safeParse(body);
    if (!parsedBody.success) {
      return validationError(parsedBody.error);
    }

    const submission = await createSubmission(parsedBody.data);

    return apiJson(
      { data: submission },
      {
        status: 201,
        headers: {
          Location: new URL(
            `/api/v1/submissions/${submission.id}`,
            request.url,
          ).toString(),
        },
      },
    );
  } catch (error) {
    return internalApiError(error);
  }
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
