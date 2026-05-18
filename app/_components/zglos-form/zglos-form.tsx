"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
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
  const [captchaReady, setCaptchaReady] = useState(!turnstileEnabled);
  const formKey = state?.success ? "success" : "default";
  const lastNotifiedState = useRef<ZglosFormState>(null);

  useEffect(() => {
    if (!state || state === lastNotifiedState.current) {
      return;
    }

    lastNotifiedState.current = state;

    if (state.success) {
      toast.success(state.message, { id: "zglos-form" });
      if (turnstileEnabled) {
        setCaptchaReady(false);
        setTurnstileResetKey((key) => key + 1);
      }
      return;
    }

    if (state.fieldErrors) {
      return;
    }

    toast.error(state.message, { id: "zglos-form" });
  }, [state, turnstileEnabled]);

  useEffect(() => {
    if (!turnstileEnabled) {
      return;
    }

    if (state?.captchaError || state?.rateLimitError) {
      setCaptchaReady(false);
      setTurnstileResetKey((key) => key + 1);
    }
  }, [state, turnstileEnabled]);

  const submitDisabled =
    isPending || (turnstileEnabled && !captchaReady);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Formularz zgłoszenia</CardTitle>
      </CardHeader>
      <Form key={formKey} action={formAction}>
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
              resetKey={turnstileResetKey}
              onSuccess={() => setCaptchaReady(true)}
              onExpire={() => setCaptchaReady(false)}
            />
          ) : null}

          {turnstileEnabled && !captchaReady ? (
            <p className="text-sm text-muted-foreground">
              Przygotowywanie zabezpieczenia formularza…
            </p>
          ) : null}
        </CardContent>

        <CardFooter className="mt-4 justify-end">
          <Button type="submit" size="lg" disabled={submitDisabled}>
            <Send aria-hidden="true" />
            {isPending ? "Wysyłanie…" : "Wyślij"}
          </Button>
        </CardFooter>
      </Form>
    </Card>
  );
}
