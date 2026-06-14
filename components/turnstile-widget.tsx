"use client";

import dynamic from "next/dynamic";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { useRef } from "react";
import { getTurnstileSiteKey } from "@/lib/turnstile-config";

const Turnstile = dynamic(
  () => import("@marsidev/react-turnstile").then((mod) => mod.Turnstile),
  { ssr: false },
);

type TurnstileWidgetProps = {
  onExpire?: () => void;
  onSuccess?: (token: string) => void;
  resetKey?: number;
};

export function TurnstileWidget({
  onExpire,
  onSuccess,
  resetKey,
}: TurnstileWidgetProps) {
  const localRef = useRef<TurnstileInstance>(null);

  return (
    <Turnstile
      key={resetKey}
      ref={localRef}
      siteKey={getTurnstileSiteKey()}
      onSuccess={onSuccess}
      onExpire={() => {
        localRef.current?.reset();
        onExpire?.();
      }}
      options={{
        size: "invisible",
        execution: "render",
        appearance: "interaction-only",
        language: "pl",
      }}
    />
  );
}
