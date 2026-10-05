import { connection } from "next/server";

import { ObietnicePage } from "@/app/_components/obietnice-page";
import { getObietnice } from "@/lib/obietnice";

export default async function Home() {
  await connection();
  const obietnice = await getObietnice();

  return <ObietnicePage obietnice={obietnice} />;
}
