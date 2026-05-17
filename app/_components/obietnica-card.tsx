import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Obietnica } from "@/lib/definitions";

const dateFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

type ObietnicaCardProps = {
  obietnica: Obietnica;
};

export function ObietnicaCard({ obietnica }: ObietnicaCardProps) {
  const hasDetails =
    obietnica.datePromised ||
    obietnica.dateDue ||
    obietnica.url ||
    obietnica.notes;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <CardTitle>{obietnica.title}</CardTitle>
            {obietnica.description ? (
              <CardDescription>{obietnica.description}</CardDescription>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 sm:justify-end">
            <ObietnicaStatusBadge fulfilled={obietnica.fulfilled} />
          </div>
        </div>
      </CardHeader>

      {hasDetails ? <ObietnicaDetails obietnica={obietnica} /> : null}
    </Card>
  );
}

function ObietnicaStatusBadge({ fulfilled }: { fulfilled: boolean }) {
  return (
    <Badge variant={fulfilled ? "secondary" : "outline"}>
      {fulfilled ? "Spełniona" : "Niespełniona"}
    </Badge>
  );
}

function ObietnicaDetails({ obietnica }: ObietnicaCardProps) {
  return (
    <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {obietnica.datePromised ? (
          <DateMetadata
            label="Obiecana"
            dateTime={obietnica.datePromised}
          />
        ) : null}
        {obietnica.dateDue ? (
          <DateMetadata label="Termin" dateTime={obietnica.dateDue} />
        ) : null}
        {obietnica.url ? <SourceLink url={obietnica.url} /> : null}
      </div>
      {obietnica.notes ? (
        <p className="leading-6 text-foreground">{obietnica.notes}</p>
      ) : null}
    </CardContent>
  );
}

function DateMetadata({
  label,
  dateTime,
}: {
  label: string;
  dateTime: string;
}) {
  return (
    <span>
      {label}: <time dateTime={dateTime}>{formatDate(dateTime)}</time>
    </span>
  );
}

function SourceLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      className="font-medium text-primary underline-offset-4 hover:underline"
      target="_blank"
      rel="noreferrer"
    >
      Źródło
    </a>
  );
}

function formatDate(date: string) {
  return dateFormatter.format(new Date(date));
}
