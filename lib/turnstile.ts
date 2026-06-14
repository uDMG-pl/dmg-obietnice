import "server-only";

import { isTurnstileEnabled } from "@/lib/turnstile-config";

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Cloudflare test secret — always passes; dev only. */
const DEV_SECRET_KEY = "1x0000000000000000000000000000000AA";

function getTurnstileSecretKey(): string {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  if (siteKey && secretKey) {
    return secretKey;
  }

  if (process.env.VERCEL_ENV !== "production") {
    return DEV_SECRET_KEY;
  }

  throw new Error(
    siteKey
      ? "Missing TURNSTILE_SECRET_KEY"
      : "Missing NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  );
}

type TurnstileVerifyResponse = {
  success: boolean;
};

export async function verifyTurnstileToken(token: string): Promise<boolean> {
  if (!isTurnstileEnabled()) {
    return true;
  }

  const secret = getTurnstileSecretKey();

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      secret,
      response: token,
    }),
  });

  if (!response.ok) {
    return false;
  }

  const data = (await response.json()) as TurnstileVerifyResponse;
  return data.success === true;
}
