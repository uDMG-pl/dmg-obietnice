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
import { formatObietnicaDate } from "@/lib/partial-date";
import { CircleAlert } from "lucide-react";

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
    <Card className="ring-0 ring-transparent gradient-border gradient-border-to-tl gradient-border-from-neutral-800 gradient-border-via-neutral-900 gradient-border-to-neutral-800">
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
    label: "Częściowo zrealizowana",
    className:
      "border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-300",
  },
  fulfilled: {
    label: "Spełniona",
    className:
      "border-green-200 bg-green-100 text-green-800 hover:bg-green-100 dark:border-green-900/50 dark:bg-green-950/50 dark:text-green-300",
  },
  fulfilled_late: {
    label: "Spełniona po terminie",
    className:
      "border-[#c6c973] bg-[#f0f2bf] text-[#4e5418] hover:bg-[#f0f2bf] dark:border-[#62672d] dark:bg-[#2e3315] dark:text-[#d5dc80]",
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
          <DateMetadata label="Obiecana" date={obietnica.datePromised} />
        ) : null}
        {obietnica.dateDue ? (
          <DateMetadata label="Termin" date={obietnica.dateDue} />
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
  date,
}: {
  label: string;
  date: NonNullable<Obietnica["datePromised"]>;
}) {
  return (
    <span>
      {label}: <time dateTime={date.dateTime}>{formatObietnicaDate(date)}</time>
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
