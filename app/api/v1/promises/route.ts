import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";

import { authenticateApiKey } from "@/lib/api/authenticate";
import {
  apiError,
  apiJson,
  internalApiError,
  validationError,
} from "@/lib/api/responses";
import { createPromise, listPromises } from "@/lib/promises/repository";
import {
  promiseCreateSchema,
  promiseListQuerySchema,
  serializePromise,
} from "@/lib/promises/schema";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const authentication = await authenticateApiKey(request, "read");
    if (!authentication.authenticated) {
      return authentication.response;
    }

    const parsedQuery = promiseListQuerySchema.safeParse({
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
      cursor: request.nextUrl.searchParams.get("cursor") ?? undefined,
    });
    if (!parsedQuery.success) {
      return validationError(parsedQuery.error);
    }

    const page = await listPromises(parsedQuery.data);

    return apiJson({
      data: page.items.map(serializePromise),
      pagination: {
        limit: parsedQuery.data.limit,
        nextCursor: page.nextCursor,
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

    const parsedBody = promiseCreateSchema.safeParse(body);
    if (!parsedBody.success) {
      return validationError(parsedBody.error);
    }

    const promise = await createPromise(parsedBody.data);
    revalidateTag("obietnice", { expire: 0 });

    return apiJson(
      { data: serializePromise(promise) },
      {
        status: 201,
        headers: {
          Location: new URL(
            `/api/v1/promises/${promise.id}`,
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
      .toLowerCase() ===
    "application/json"
  );
}
