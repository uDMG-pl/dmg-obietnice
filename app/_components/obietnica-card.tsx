import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Obietnica, ObietnicaStatus } from "@/lib/definitions";
import { CircleAlert } from "lucide-react";

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

          <div className="flex gap-1 items-center">
            <ObietnicaNote note={obietnica.notes} />
            <ObietnicaStatusBadge status={obietnica.status} />
          </div>
        </div>
      </CardHeader>

      {hasDetails ? <ObietnicaDetails obietnica={obietnica} /> : null}
    </Card>
  );
}

const statusConfig = {
  promised: {
    label: "Obiecana",
    className: "",
  },
  partially_fulfilled: {
    label: "Częściowo spełniona",
    className:
      "border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-300",
  },
  fulfilled: {
    label: "Spełniona",
    className:
      "border-green-200 bg-green-100 text-green-800 hover:bg-green-100 dark:border-green-900/50 dark:bg-green-950/50 dark:text-green-300",
  },
  unfulfilled: {
    label: "Niespełniona",
    className:
      "border-red-200 bg-red-100 text-red-800 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300",
  },
} satisfies Record<
  ObietnicaStatus,
  {
    label: string;
    className: string;
  }
>;

function ObietnicaNote({ note }: { note: Obietnica["notes"] }) {
  if (!note) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger>
        <CircleAlert className="text-muted-foreground" size={16} />
      </TooltipTrigger>
      <TooltipContent>{note}</TooltipContent>
    </Tooltip>
  );
}

function ObietnicaStatusBadge({ status }: { status: ObietnicaStatus }) {
  const config = statusConfig[status];

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

function ObietnicaTagBadge({ tag }: { tag: string }) {
  return (
    <Badge
      variant="outline"
      className="border-border/60 bg-muted/30 text-muted-foreground"
    >
      {tag}
    </Badge>
  );
}

function ObietnicaDetails({ obietnica }: ObietnicaCardProps) {
  return (
    <CardContent className="flex gap-3 text-sm text-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {obietnica.datePromised ? (
          <DateMetadata label="Obiecana" dateTime={obietnica.datePromised} />
        ) : null}
        {obietnica.dateDue ? (
          <DateMetadata label="Termin" dateTime={obietnica.dateDue} />
        ) : null}
        {obietnica.url ? <SourceLink url={obietnica.url} /> : null}
      </div>
      <div className="flex gap-2">
        {obietnica.tags.map((tag) => (
          <ObietnicaTagBadge key={tag} tag={tag} />
        ))}
      </div>
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
