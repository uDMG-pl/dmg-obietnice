import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ZglosForm } from "@/app/_components/zglos-form/zglos-form";
import { isTurnstileEnabled } from "@/lib/turnstile-config";

export const metadata: Metadata = {
  title: "Zgłoś klip | Lista obietnic",
  description: "Prosty formularz do zgłaszania klipów z obietnicami DMG.",
};

export default function ZglosPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-10 lg:px-16">
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <Badge variant="outline" className="w-fit">
            Zgłoszenie
          </Badge>
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-semibold tracking-normal text-foreground sm:text-5xl">
              Zgłoś klip
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              Wklej adres klipu i dopisz krótki opis obietnicy, którą warto
              dodać do listy.
            </p>
          </div>
          <Link
            href="/"
            className="w-fit text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Wróć do listy
          </Link>
        </header>

        <ZglosForm turnstileEnabled={isTurnstileEnabled()} />
      </section>
    </main>
  );
}
