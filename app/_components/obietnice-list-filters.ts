import type { Obietnica, ObietnicaStatus } from "@/lib/definitions";
import { getObietnicaDateSortTime } from "@/lib/partial-date";

export type SortOption =
  | "newest"
  | "oldest"
  | "due_soon"
  | "due_latest"
  | "title_asc"
  | "title_desc";

export const statusOptions: Array<{
  value: ObietnicaStatus;
  label: string;
  indicatorClassName: string;
  dotClassName: string;
}> = [
  {
    value: "promised",
    label: "Obiecana",
    indicatorClassName: "bg-muted",
    dotClassName: "bg-muted-foreground/70",
  },
  {
    value: "fulfilled",
    label: "Spełniona",
    indicatorClassName: "bg-green-100 dark:bg-green-950/60",
    dotClassName: "bg-green-600 dark:bg-green-400",
  },
  {
    value: "unfulfilled",
    label: "Niespełniona",
    indicatorClassName: "bg-red-100 dark:bg-red-950/60",
    dotClassName: "bg-red-600 dark:bg-red-400",
  },
  {
    value: "partially_fulfilled",
    label: "Częściowo spełniona",
    indicatorClassName: "bg-amber-100 dark:bg-amber-950/60",
    dotClassName: "bg-amber-600 dark:bg-amber-400",
  },
];

export const sortOptions: Array<{
  value: SortOption;
  label: string;
}> = [
  {
    value: "newest",
    label: "Najnowsze",
  },
  {
    value: "oldest",
    label: "Najstarsze",
  },
  {
    value: "due_soon",
    label: "Termin najbliżej",
  },
  {
    value: "due_latest",
    label: "Termin najdalej",
  },
  {
    value: "title_asc",
    label: "Tytuł A-Z",
  },
  {
    value: "title_desc",
    label: "Tytuł Z-A",
  },
];

export function getFilteredAndSortedObietnice({
  obietnice,
  searchQuery,
  selectedStatuses,
  sortOption,
}: {
  obietnice: Obietnica[];
  searchQuery: string;
  selectedStatuses: ObietnicaStatus[];
  sortOption: SortOption;
}) {
  const queryParts = normalizeSearchValue(searchQuery)
    .split(/\s+/)
    .filter(Boolean);

  const matchingObietnice = obietnice.filter((obietnica) => {
    if (
      selectedStatuses.length > 0 &&
      !selectedStatuses.includes(obietnica.status)
    ) {
      return false;
    }

    const searchableValues = [
      normalizeSearchValue(obietnica.title),
      ...obietnica.tags.map(normalizeSearchValue),
    ];

    return queryParts.every((queryPart) =>
      searchableValues.some((value) => value.includes(queryPart)),
    );
  });

  return [...matchingObietnice].sort((firstObietnica, secondObietnica) =>
    compareObietnice(firstObietnica, secondObietnica, sortOption),
  );
}

export function getStatusFilterLabel(selectedStatuses: ObietnicaStatus[]) {
  if (selectedStatuses.length === 0) {
    return "Wszystkie statusy";
  }

  if (selectedStatuses.length === 1) {
    return (
      statusOptions.find((status) => status.value === selectedStatuses[0])
        ?.label ?? "Wybrany status"
    );
  }

  return `Statusy: ${selectedStatuses.length}`;
}

export function getSortOptionLabel(sortOption: SortOption) {
  return sortOptions.find((option) => option.value === sortOption)?.label;
}

function normalizeSearchValue(value: string) {
  return value.trim().toLocaleLowerCase("pl-PL");
}

function compareObietnice(
  firstObietnica: Obietnica,
  secondObietnica: Obietnica,
  sortOption: SortOption,
) {
  switch (sortOption) {
    case "oldest":
      return (
        compareDates(
          firstObietnica.datePromised,
          secondObietnica.datePromised,
        ) ||
        compareTitles(firstObietnica.title, secondObietnica.title)
      );
    case "due_soon":
      return (
        compareDates(firstObietnica.dateDue, secondObietnica.dateDue) ||
        compareDates(
          secondObietnica.datePromised,
          firstObietnica.datePromised,
        ) ||
        compareTitles(firstObietnica.title, secondObietnica.title)
      );
    case "due_latest":
      return (
        compareDates(secondObietnica.dateDue, firstObietnica.dateDue) ||
        compareDates(
          secondObietnica.datePromised,
          firstObietnica.datePromised,
        ) ||
        compareTitles(firstObietnica.title, secondObietnica.title)
      );
    case "title_asc":
      return (
        compareTitles(firstObietnica.title, secondObietnica.title) ||
        compareDates(secondObietnica.datePromised, firstObietnica.datePromised)
      );
    case "title_desc":
      return (
        compareTitles(secondObietnica.title, firstObietnica.title) ||
        compareDates(secondObietnica.datePromised, firstObietnica.datePromised)
      );
    case "newest":
    default:
      return (
        compareDates(
          secondObietnica.datePromised,
          firstObietnica.datePromised,
        ) ||
        compareTitles(firstObietnica.title, secondObietnica.title)
      );
  }
}

function compareDates(
  firstDate?: Obietnica["datePromised"],
  secondDate?: Obietnica["datePromised"],
) {
  const firstTime = getObietnicaDateSortTime(firstDate);
  const secondTime = getObietnicaDateSortTime(secondDate);

  if (firstTime === secondTime) {
    return 0;
  }

  if (firstTime === undefined) {
    return 1;
  }

  if (secondTime === undefined) {
    return -1;
  }

  return firstTime - secondTime;
}

function compareTitles(firstTitle: string, secondTitle: string) {
  return firstTitle.localeCompare(secondTitle, "pl-PL", {
    sensitivity: "base",
  });
}
