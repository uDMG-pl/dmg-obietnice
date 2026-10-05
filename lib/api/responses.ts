import type { ZodError } from "zod";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

export function apiJson(
  body: unknown,
  init: ResponseInit = {},
): Response {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");

  return Response.json(body, {
    ...init,
    headers,
  });
}

export function apiError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
  headers?: HeadersInit,
): Response {
  return apiJson(
    {
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
      },
    },
    { status, headers },
  );
}

export function validationError(error: ZodError): Response {
  return apiError(
    400,
    "VALIDATION_ERROR",
    "Request validation failed.",
    error.issues.map((issue) => ({
      path: issue.path.join("."),
      code: issue.code,
      message: issue.message,
    })),
  );
}

export function emptyApiResponse(status: number): Response {
  return new Response(null, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

export function internalApiError(error: unknown): Response {
  console.error("Promises API request failed.", error);

  return apiError(
    500,
    "INTERNAL_ERROR",
    "An unexpected error occurred.",
  );
}
