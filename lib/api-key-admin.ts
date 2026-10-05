import "server-only";

import { randomBytes } from "node:crypto";

import {
  API_KEY_TABLE_NAME,
  type ApiKey,
} from "@better-auth/api-key";

import {
  API_KEY_CONFIG_ID,
  API_KEY_PERMISSION_RESOURCE,
  getAuth,
} from "@/lib/auth";
import { getMongoDb } from "@/lib/mongodb";

export type ManagedApiKeyScope = "read" | "read-write";

type StoredApiKey = Omit<ApiKey, "permissions"> & {
  permissions?: ApiKey["permissions"] | string;
};

export async function createManagedApiKey(options: {
  name: string;
  scope: ManagedApiKeyScope;
  expiresInDays?: number;
}) {
  const auth = await getAuth();
  const owner = await getOrCreateApiKeyOwner();
  const permissions = {
    [API_KEY_PERMISSION_RESOURCE]:
      options.scope === "read-write" ? ["read", "write"] : ["read"],
  };

  return auth.api.createApiKey({
    body: {
      configId: API_KEY_CONFIG_ID,
      userId: owner.id,
      name: options.name,
      expiresIn: options.expiresInDays
        ? options.expiresInDays * 86_400
        : null,
      permissions,
    },
  });
}

export async function listManagedApiKeys() {
  const auth = await getAuth();
  const owner = await getOrCreateApiKeyOwner();
  const context = await auth.$context;
  const keys = await context.adapter.findMany<StoredApiKey>({
    model: API_KEY_TABLE_NAME,
    where: [
      { field: "referenceId", value: owner.id },
      { field: "configId", value: API_KEY_CONFIG_ID },
    ],
    sortBy: {
      field: "createdAt",
      direction: "desc",
    },
    // Zero means unbounded in the MongoDB adapter; omitting it caps results at 100.
    limit: 0,
  });

  return keys.map((key) => ({
    id: key.id,
    name: key.name,
    start: key.start,
    enabled: key.enabled,
    permissions: parsePermissions(key.permissions),
    rateLimitMax: key.rateLimitMax,
    rateLimitTimeWindow: key.rateLimitTimeWindow,
    createdAt: toIsoString(key.createdAt),
    updatedAt: toIsoString(key.updatedAt),
    expiresAt: key.expiresAt ? toIsoString(key.expiresAt) : null,
    lastRequest: key.lastRequest ? toIsoString(key.lastRequest) : null,
  }));
}

export async function revokeManagedApiKey(keyId: string) {
  const auth = await getAuth();
  const owner = await getOrCreateApiKeyOwner();

  return auth.api.updateApiKey({
    body: {
      configId: API_KEY_CONFIG_ID,
      keyId,
      userId: owner.id,
      enabled: false,
    },
  });
}

async function getOrCreateApiKeyOwner() {
  await ensureBetterAuthIndexes();
  const auth = await getAuth();
  const context = await auth.$context;
  const email = process.env.API_KEY_OWNER_EMAIL;
  if (!email) {
    throw new Error("Missing API_KEY_OWNER_EMAIL environment variable.");
  }
  const existing = await context.internalAdapter.findUserByEmail(email, {
    includeAccounts: true,
  });

  if (existing) {
    await ensureCredentialAccount(existing.user.id, existing.accounts);
    return existing.user;
  }

  try {
    const user = await context.internalAdapter.createUser({
      name: "Promises API keys",
      email,
      emailVerified: true,
    });
    await ensureCredentialAccount(user.id, []);
    return user;
  } catch (error) {
    const concurrentOwner = await context.internalAdapter.findUserByEmail(
      email,
      { includeAccounts: true },
    );
    if (!concurrentOwner) {
      throw error;
    }

    await ensureCredentialAccount(
      concurrentOwner.user.id,
      concurrentOwner.accounts,
    );
    return concurrentOwner.user;
  }
}

async function ensureBetterAuthIndexes() {
  const db = await getMongoDb();

  await Promise.all([
    db.collection(API_KEY_TABLE_NAME).createIndex(
      { key: 1 },
      { name: "apikey_key_unique", unique: true },
    ),
    db.collection(API_KEY_TABLE_NAME).createIndex(
      { referenceId: 1, configId: 1 },
      { name: "apikey_owner_config" },
    ),
    db.collection("user").createIndex(
      { email: 1 },
      { name: "user_email_unique", unique: true },
    ),
  ]);
}

async function ensureCredentialAccount(
  userId: string,
  accounts: Array<{ providerId: string }>,
) {
  if (accounts.some((account) => account.providerId === "credential")) {
    return;
  }

  const auth = await getAuth();
  const context = await auth.$context;
  const password = randomBytes(48).toString("base64url");
  const passwordHash = await context.password.hash(password);

  await context.internalAdapter.linkAccount({
    accountId: userId,
    providerId: "credential",
    userId,
    password: passwordHash,
  });
}

function parsePermissions(value: StoredApiKey["permissions"]) {
  if (!value) {
    return null;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as Record<string, string[]>;
  } catch {
    return null;
  }
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
