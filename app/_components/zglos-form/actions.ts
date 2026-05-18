"use server";

import {
  parseZglosFormData,
  zglosFieldErrors,
} from "@/app/_components/zglos-form/schema";
import {
  consumeRateLimit,
  formatRetryAfter,
} from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request-ip";
import { isTurnstileEnabled } from "@/lib/turnstile-config";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { createZgloszenie } from "@/lib/zgloszenia";

export type ZglosFormState = {
  success: boolean;
  message: string;
  captchaError?: boolean;
  rateLimitError?: boolean;
  fieldErrors?: {
    clipUrl?: string;
    description?: string;
  };
} | null;

export async function submitZglos(
  _prevState: ZglosFormState,
  formData: FormData,
): Promise<ZglosFormState> {
  const parsed = parseZglosFormData(formData);

  if (!parsed.success) {
    const fieldErrors = zglosFieldErrors(parsed.error);

    return {
      success: false,
      message:
        fieldErrors.clipUrl ??
        fieldErrors.description ??
        "Popraw błędy w formularzu.",
      fieldErrors,
    };
  }

  const ip = await getRequestIp();
  const rateLimit = await consumeRateLimit(`zglos:${ip}`);

  if (!rateLimit.allowed) {
    return {
      success: false,
      message: `Za dużo zgłoszeń z tego adresu. Spróbuj ponownie za ${formatRetryAfter(rateLimit.retryAfterSec)}.`,
      rateLimitError: true,
    };
  }

  if (isTurnstileEnabled()) {
    const token = formData.get("cf-turnstile-response");

    if (typeof token !== "string" || !token) {
      return {
        success: false,
        message: "Uzupełnij captchę przed wysłaniem.",
        captchaError: true,
      };
    }

    const captchaValid = await verifyTurnstileToken(token);
    if (!captchaValid) {
      return {
        success: false,
        message: "Captcha jest niepoprawna. Spróbuj jeszcze raz.",
        captchaError: true,
      };
    }
  }

  try {
    await createZgloszenie(parsed.data);
  } catch {
    return {
      success: false,
      message: "Nie udało się zapisać zgłoszenia. Spróbuj ponownie za chwilę.",
    };
  }

  return {
    success: true,
    message: "Dzięki, zgłoszenie jest gotowe do obsługi.",
  };
}
