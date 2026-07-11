import "server-only";

import { apiKey } from "@better-auth/api-key";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { betterAuth } from "better-auth";

import { getMongoClient, getMongoDb } from "@/lib/mongodb";

export const API_KEY_CONFIG_ID = "promises";
export const API_KEY_PERMISSION_RESOURCE = "promises";

let authPromise: ReturnType<typeof createAuth> | undefined;

export function getAuth(): ReturnType<typeof createAuth> {
  if (!authPromise) {
    authPromise = createAuth().catch((error) => {
      authPromise = undefined;
      throw error;
    });
  }

  return authPromise;
}

async function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("Missing BETTER_AUTH_SECRET environment variable.");
  }

  const [db, client] = await Promise.all([getMongoDb(), getMongoClient()]);
  const rateLimitMax = readPositiveInteger("API_RATE_LIMIT_MAX", 100);
  const rateLimitTimeWindow = readPositiveInteger(
    "API_RATE_LIMIT_WINDOW_MS",
    60_000,
  );

  return betterAuth({
    appName: "DMG Obietnice API",
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    secret,
    database: mongodbAdapter(db, {
      client,
      transaction: false,
    }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
    },
    plugins: [
      apiKey({
        configId: API_KEY_CONFIG_ID,
        apiKeyHeaders: "x-api-key",
        defaultPrefix: "dmg_",
        requireName: true,
        keyExpiration: {
          defaultExpiresIn: null,
        },
        rateLimit: {
          enabled: true,
          maxRequests: rateLimitMax,
          timeWindow: rateLimitTimeWindow,
        },
        permissions: {
          defaultPermissions: {
            [API_KEY_PERMISSION_RESOURCE]: ["read"],
          },
        },
      }),
    ],
  });
}

function readPositiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);

  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
