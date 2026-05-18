"use client";

import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { useActionState, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Send } from "lucide-react";
import {
  submitZglos,
  type ZglosFormState,
} from "@/app/_components/zglos-form/actions";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ZglosFormProps = {
  turnstileEnabled?: boolean;
};

export function ZglosForm({ turnstileEnabled = true }: ZglosFormProps) {
  const [state, formAction, isPending] = useActionState<
    ZglosFormState,
    FormData
  >(submitZglos, null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const formKey = state?.success ? "success" : "default";
  const formRef = useRef<HTMLFormElement>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  useEffect(() => {
    if (!turnstileEnabled) {
      return;
    }

    if (state?.captchaError || state?.rateLimitError) {
      setTurnstileResetKey((key) => key + 1);
    }
  }, [state, turnstileEnabled]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!turnstileEnabled) {
      return;
    }

    const token = turnstileRef.current?.getResponse();
    if (token) {
      return;
    }

    event.preventDefault();
    turnstileRef.current?.execute();
  }

  function handleTurnstileSuccess() {
    formRef.current?.requestSubmit();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Formularz zgłoszenia</CardTitle>
      </CardHeader>
      <Form
        key={formKey}
        ref={formRef}
        action={formAction}
        onSubmit={turnstileEnabled ? handleSubmit : undefined}
      >
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="clip-url">Clip URL</Label>
            <Input
              id="clip-url"
              name="clipUrl"
              type="url"
              required
              placeholder="https://..."
              aria-invalid={state?.fieldErrors?.clipUrl ? true : undefined}
              aria-describedby={
                state?.fieldErrors?.clipUrl ? "clip-url-error" : undefined
              }
              className="h-10 bg-background px-3"
            />
            {state?.fieldErrors?.clipUrl ? (
              <p id="clip-url-error" className="text-sm text-destructive">
                {state.fieldErrors.clipUrl}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Opis</Label>
            <Textarea
              id="description"
              name="description"
              required
              rows={5}
              placeholder="Co zostało obiecane?"
              aria-invalid={state?.fieldErrors?.description ? true : undefined}
              aria-describedby={
                state?.fieldErrors?.description ? "description-error" : undefined
              }
              className="min-h-32 resize-y bg-background leading-6"
            />
            {state?.fieldErrors?.description ? (
              <p id="description-error" className="text-sm text-destructive">
                {state.fieldErrors.description}
              </p>
            ) : null}
          </div>

          {turnstileEnabled ? (
            <TurnstileWidget
              turnstileRef={turnstileRef}
              resetKey={turnstileResetKey}
              onSuccess={handleTurnstileSuccess}
            />
          ) : null}

          {state?.captchaError || state?.rateLimitError ? (
            <p className="text-sm text-destructive">{state.message}</p>
          ) : null}

          {state &&
          !state.captchaError &&
          !state.rateLimitError &&
          !state.fieldErrors ? (
            <p
              className={
                state.success
                  ? "rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground"
                  : "text-sm text-destructive"
              }
              aria-live="polite"
            >
              {state.message}
            </p>
          ) : null}
        </CardContent>

        <CardFooter className="mt-4 justify-end">
          <Button type="submit" size="lg" disabled={isPending}>
            <Send aria-hidden="true" />
            {isPending ? "Wysyłanie…" : "Wyślij"}
          </Button>
        </CardFooter>
      </Form>
    </Card>
  );
}
