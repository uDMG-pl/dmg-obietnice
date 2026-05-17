import { Badge } from "@/components/ui/badge";
import type { Obietnica } from "@/lib/definitions";
import { ObietniceList } from "./obietnice-list";

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
      <Badge variant="outline" className="w-fit">
        DMG
      </Badge>
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold tracking-normal text-foreground sm:text-5xl">
          Lista obietnic
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          Publiczny przegląd obietnic zapisanych w rejestrze scamu.
        </p>
      </div>
    </header>
  );
}
