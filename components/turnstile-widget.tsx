"use client";

import dynamic from "next/dynamic";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { type Ref, useRef } from "react";
import { getTurnstileSiteKey } from "@/lib/turnstile-config";

const Turnstile = dynamic(
  () => import("@marsidev/react-turnstile").then((mod) => mod.Turnstile),
  { ssr: false },
);

type TurnstileWidgetProps = {
  turnstileRef?: Ref<TurnstileInstance | null>;
  onExpire?: () => void;
  onSuccess?: (token: string) => void;
  resetKey?: number;
};

export function TurnstileWidget({
  turnstileRef,
  onExpire,
  onSuccess,
  resetKey,
}: TurnstileWidgetProps) {
  const localRef = useRef<TurnstileInstance>(null);

  function setRef(instance: TurnstileInstance | null) {
    localRef.current = instance;
    if (typeof turnstileRef === "function") {
      turnstileRef(instance);
    } else if (turnstileRef) {
      turnstileRef.current = instance;
    }
  }

  return (
    <Turnstile
      key={resetKey}
      ref={setRef}
      siteKey={getTurnstileSiteKey()}
      onSuccess={onSuccess}
      onExpire={() => {
        localRef.current?.reset();
        onExpire?.();
      }}
      className="sr-only"
      options={{
        size: "invisible",
        execution: "execute",
        appearance: "interaction-only",
        language: "pl",
      }}
    />
  );
}
