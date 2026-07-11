import {
  createManagedApiKey,
  listManagedApiKeys,
  revokeManagedApiKey,
  type ManagedApiKeyScope,
} from "../lib/api-key-admin";

const [, , command, ...args] = process.argv;

async function main() {
  switch (command) {
    case "create":
      await createKey(args);
      return;
    case "list":
      await listKeys(args);
      return;
    case "revoke":
      await revokeKey(args);
      return;
    default:
      throw new Error(usage());
  }
}

async function createKey(args: string[]) {
  const name = readRequiredFlag(args, "--name");
  if (name.length > 32) {
    throw new Error("--name must be at most 32 characters.");
  }

  const scope = readRequiredFlag(args, "--scope");
  if (scope !== "read" && scope !== "read-write") {
    throw new Error("--scope must be read or read-write.");
  }

  const expiresInDays = readOptionalPositiveInteger(args, "--expires-in-days");
  if (expiresInDays !== undefined && expiresInDays > 365) {
    throw new Error("--expires-in-days must not exceed 365.");
  }

  const key = await createManagedApiKey({
    name,
    scope: scope as ManagedApiKeyScope,
    expiresInDays,
  });

  console.log("API key created. Store it now; it will not be shown again.");
  console.log(`id: ${key.id}`);
  console.log(`key: ${key.key}`);
  console.log(`scope: ${scope}`);
  console.log(`expiresAt: ${key.expiresAt?.toISOString() ?? "never"}`);
}

async function listKeys(args: string[]) {
  assertNoArguments(args);
  const keys = await listManagedApiKeys();

  console.log(JSON.stringify(keys, null, 2));
}

async function revokeKey(args: string[]) {
  const id = readRequiredFlag(args, "--id");
  await revokeManagedApiKey(id);

  console.log(`API key ${id} revoked.`);
}

function readRequiredFlag(args: string[], flag: string) {
  const index = args.indexOf(flag);
  const value = index >= 0 ? args[index + 1] : undefined;

  if (!value || value.startsWith("--")) {
    throw new Error(`Missing required ${flag} value.\n\n${usage()}`);
  }

  return value;
}

function readOptionalPositiveInteger(args: string[], flag: string) {
  const index = args.indexOf(flag);
  if (index < 0) {
    return undefined;
  }

  const value = Number(args[index + 1]);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${flag} must be a positive integer.`);
  }

  return value;
}

function assertNoArguments(args: string[]) {
  if (args.length > 0) {
    throw new Error(`Unexpected arguments: ${args.join(" ")}`);
  }
}

function usage() {
  return [
    "Usage:",
    "  npm run api-keys -- create --name NAME --scope read|read-write [--expires-in-days DAYS]",
    "  npm run api-keys -- list",
    "  npm run api-keys -- revoke --id ID",
  ].join("\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error.";
  console.error(message);
  process.exitCode = 1;
});
