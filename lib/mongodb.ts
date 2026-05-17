import "server-only";

import { MongoClient, type Db, type MongoClientOptions } from "mongodb";

import type { MongoGlobal } from "@/lib/definitions";

const options: MongoClientOptions = {};

const globalForMongo = globalThis as MongoGlobal;

let mongoClientPromise: Promise<MongoClient> | undefined;
let mongoClientUri: string | undefined;

function createMongoClient(uri: string) {
  const client = new MongoClient(uri, options);

  return client.connect();
}

export function getMongoClient() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable.");
  }

  if (process.env.NODE_ENV === "development") {
    if (!globalForMongo.__mongoClientPromise || globalForMongo.__mongoClientUri !== uri) {
      globalForMongo.__mongoClientUri = uri;
      globalForMongo.__mongoClientPromise = createMongoClient(uri);
    }

    return globalForMongo.__mongoClientPromise;
  }

  if (!mongoClientPromise || mongoClientUri !== uri) {
    mongoClientUri = uri;
    mongoClientPromise = createMongoClient(uri);
  }

  return mongoClientPromise;
}

export async function getMongoDb(dbName = process.env.MONGODB_DB): Promise<Db> {
  if (!dbName) {
    throw new Error("Missing MONGODB_DB environment variable.");
  }

  const client = await getMongoClient();

  return client.db(dbName);
}
