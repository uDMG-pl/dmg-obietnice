import "server-only";

import {
  API_KEY_CONFIG_ID,
  API_KEY_PERMISSION_RESOURCE,
  getAuth,
} from "@/lib/auth";
import { apiError } from "@/lib/api/responses";

type ApiPermission = "read" | "write";

export type ApiAuthenticationResult =
  | { authenticated: true; keyId: string }
  | { authenticated: false; response: Response };

export async function authenticateApiKey(
  request: Request,
  permission: ApiPermission,
): Promise<ApiAuthenticationResult> {
  const key = request.headers.get("x-api-key")?.trim();
  if (!key) {
    return {
      authenticated: false,
      response: unauthorized("API key is required."),
    };
  }

  const auth = await getAuth();
  const result = await auth.api.verifyApiKey({
    body: {
      configId: API_KEY_CONFIG_ID,
      key,
    },
  });

  if (result.valid && result.key) {
    const permissions = result.key.permissions as
      | Record<string, string[]>
      | null
      | undefined;
    if (!permissions?.[API_KEY_PERMISSION_RESOURCE]?.includes(permission)) {
      return {
        authenticated: false,
        response: apiError(
          403,
          "FORBIDDEN",
          "API key does not have the required permission.",
        ),
      };
    }

    return {
      authenticated: true,
      keyId: result.key.id,
    };
  }

  const errorCode = result.error?.code;
  if (
    errorCode === "RATE_LIMITED" ||
    errorCode === "RATE_LIMIT_EXCEEDED" ||
    errorCode === "USAGE_EXCEEDED"
  ) {
    const retryAfter = getRetryAfter(result.error);
    return {
      authenticated: false,
      response: apiError(
        429,
        "RATE_LIMIT_EXCEEDED",
        "API key rate limit exceeded.",
        undefined,
        retryAfter ? { "Retry-After": retryAfter } : undefined,
      ),
    };
  }

  return {
    authenticated: false,
    response: unauthorized("API key is invalid, disabled, or expired."),
  };
}

function unauthorized(message: string) {
  return apiError(401, "UNAUTHORIZED", message, undefined, {
    "WWW-Authenticate": 'ApiKey realm="promises-api"',
  });
}

function getRetryAfter(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("details" in error)) {
    return undefined;
  }

  const details = error.details;
  if (
    !details ||
    typeof details !== "object" ||
    !("tryAgainIn" in details) ||
    typeof details.tryAgainIn !== "number"
  ) {
    return undefined;
  }

  return String(Math.max(1, Math.ceil(details.tryAgainIn / 1000)));
}
