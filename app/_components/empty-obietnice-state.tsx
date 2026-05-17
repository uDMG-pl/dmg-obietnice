import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function EmptyObietniceState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Brak obietnic</CardTitle>
        <CardDescription>
          W kolekcji nie ma jeszcze rekordów do wyświetlenia.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
