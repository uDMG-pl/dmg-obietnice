import type { MongoClient, ObjectId } from "mongodb";
import type { ReactNode } from "react";

export type MongoGlobal = typeof globalThis & {
  __mongoClientPromise?: Promise<MongoClient>;
  __mongoClientUri?: string;
};

export type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export type ObietnicaDocument = {
  _id: ObjectId;
  title: string;
  description?: string | null;
  url?: string | null;
  datePromised?: Date | string | null;
  dateDue?: Date | string | null;
  fulfilled?: boolean | null;
  notes?: string | null;
};

export type Obietnica = {
  id: string;
  title: string;
  description?: string;
  url?: string;
  datePromised?: string;
  dateDue?: string;
  fulfilled: boolean;
  notes?: string;
};
