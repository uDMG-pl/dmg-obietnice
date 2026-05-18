import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Obietnica } from "@/lib/definitions";
import { ObietniceList } from "./obietnice-list";
import { buttonVariants } from "@/components/ui/button";

type ObietnicePageProps = {
  obietnice: Obietnica[];
};

export function ObietnicePage({ obietnice }: ObietnicePageProps) {
  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-10 lg:px-16">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <ObietnicePageHeader />
        <ObietniceList obietnice={obietnice} />
      </section>
    </main>
  );
}

function ObietnicePageHeader() {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Badge variant="outline" className="w-fit">
          DMG
        </Badge>
        <nav
          aria-label="Linki zewnętrzne"
          className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground"
        >
          <Link
            href="https://udmg.pl"
            target="_blank"
            className="transition-colors hover:text-foreground"
          >
            udmg.pl
          </Link>
          <Link
            href="https://github.com/jmalinkiewicz/dmg-obietnice"
            target="_blank"
            className="transition-colors hover:text-foreground"
          >
            github
          </Link>
          <span
            aria-disabled="true"
            className="cursor-not-allowed text-muted-foreground/50"
          >
            API
          </span>
        </nav>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h1 className="text-4xl font-semibold tracking-normal text-foreground sm:text-5xl">
            Lista obietnic
          </h1>
          <Link
            className={
              buttonVariants({ variant: "default", size: "lg" }) +
              " rounded-full!"
            }
            href="/zglos"
          >
            <PlusCircle aria-hidden="true" className="size-4" />
            Zgłoś obietnicę
          </Link>
        </div>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          Publiczna przeglądarka obietnic zapisanych w rejestrze scamu.
        </p>
      </div>
    </header>
  );
}
