import type { Obietnica } from "@/lib/definitions";
import { EmptyObietniceState } from "./empty-obietnice-state";
import { ObietnicaCard } from "./obietnica-card";

type ObietniceListProps = {
  obietnice: Obietnica[];
};

export function ObietniceList({ obietnice }: ObietniceListProps) {
  if (obietnice.length === 0) {
    return <EmptyObietniceState />;
  }

  return (
    <div className="grid gap-4">
      {obietnice.map((obietnica) => (
        <ObietnicaCard key={obietnica.id} obietnica={obietnica} />
      ))}
    </div>
  );
}
