import "server-only";

import { isTurnstileEnabled } from "@/lib/turnstile-config";

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Cloudflare test secret — always passes; dev only. */
const DEV_SECRET_KEY = "1x0000000000000000000000000000000AA";

function getTurnstileSecretKey(): string {
  return process.env.TURNSTILE_SECRET_KEY ?? DEV_SECRET_KEY;
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
