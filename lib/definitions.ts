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
  datePromised?: ObietnicaDateDocument;
  dateDue?: ObietnicaDateDocument;
  status?: ObietnicaStatus | null;
  notes?: string | null;
  tags?: string[] | null;
};

export type ObietnicaDatePrecision = "year" | "month" | "day";

export type ObietnicaPartialDateDocument = {
  year: number | string;
  month?: number | string | null;
  day?: number | string | null;
};

export type ObietnicaDateDocument =
  | Date
  | string
  | ObietnicaPartialDateDocument
  | null;

export type ObietnicaDate = {
  year: number;
  month?: number;
  day?: number;
  precision: ObietnicaDatePrecision;
  dateTime: string;
  sortTime: number;
};

export type ObietnicaStatus =
  | "promised"
  | "partially_fulfilled"
  | "fulfilled"
  | "unfulfilled";

export type Obietnica = {
  id: string;
  title: string;
  description?: string;
  url?: string;
  datePromised?: ObietnicaDate;
  dateDue?: ObietnicaDate;
  status: ObietnicaStatus;
  notes?: string;
  tags: string[];
};

export type ZgloszenieStatus = "pending" | "reviewed" | "rejected" | "accepted";

export type ZgloszenieDocument = {
  _id: ObjectId;
  clipUrl: string;
  description: string;
  status: ZgloszenieStatus;
  createdAt: Date;
};

export type ZgloszenieInsert = Omit<ZgloszenieDocument, "_id">;
