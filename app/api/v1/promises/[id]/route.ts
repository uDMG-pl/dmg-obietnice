import { revalidateTag } from "next/cache";
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
  deletePromise,
  getPromise,
  updatePromise,
} from "@/lib/promises/repository";
import {
  promiseIdSchema,
  promisePatchSchema,
  serializePromise,
} from "@/lib/promises/schema";

export const runtime = "nodejs";

type PromiseRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: NextRequest,
  context: PromiseRouteContext,
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

    const promise = await getPromise(id);
    if (!promise) {
      return notFound();
    }

    return apiJson({ data: serializePromise(promise) });
  } catch (error) {
    return internalApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: PromiseRouteContext,
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

    const parsedBody = promisePatchSchema.safeParse(body);
    if (!parsedBody.success) {
      return validationError(parsedBody.error);
    }

    const promise = await updatePromise(id, parsedBody.data);
    if (!promise) {
      return notFound();
    }

    revalidateTag("obietnice", { expire: 0 });

    return apiJson({ data: serializePromise(promise) });
  } catch (error) {
    return internalApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: PromiseRouteContext,
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

    const deleted = await deletePromise(id);
    if (!deleted) {
      return notFound();
    }

    revalidateTag("obietnice", { expire: 0 });

    return emptyApiResponse(204);
  } catch (error) {
    return internalApiError(error);
  }
}

async function parseId(context: PromiseRouteContext) {
  const { id } = await context.params;
  const parsedId = promiseIdSchema.safeParse(id);

  return parsedId.success ? parsedId.data : null;
}

function invalidId() {
  return apiError(
    400,
    "INVALID_ID",
    "Promise id must be a 24-character hexadecimal ObjectId.",
  );
}

function notFound() {
  return apiError(404, "NOT_FOUND", "Promise was not found.");
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
