import "server-only";

import type { ZglosFormInput } from "@/app/_components/zglos-form/schema";
import type { ZgloszenieInsert } from "@/lib/definitions";
import { getMongoDb } from "@/lib/mongodb";

const ZGLOSZENIA_COLLECTION = "zgloszenia";

export async function createZgloszenie(
  input: ZglosFormInput,
): Promise<string> {
  const db = await getMongoDb();
  const document: ZgloszenieInsert = {
    clipUrl: input.clipUrl,
    description: input.description,
    status: "pending",
    createdAt: new Date(),
  };

  const result = await db
    .collection<ZgloszenieInsert>(ZGLOSZENIA_COLLECTION)
    .insertOne(document);

  return result.insertedId.toString();
}
