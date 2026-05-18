import "server-only";

import { getMongoDb } from "@/lib/mongodb";

type RateLimitDoc = {
  _id: string;
  count: number;
  resetAt: Date;
};

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSec: number };

function getLimitConfig() {
  const max = Number(process.env.ZGLOS_RATE_LIMIT_MAX ?? 5);
  const windowSec = Number(process.env.ZGLOS_RATE_LIMIT_WINDOW_SEC ?? 900);

  return {
    max: Number.isFinite(max) && max > 0 ? max : 5,
    windowMs:
      Number.isFinite(windowSec) && windowSec > 0 ? windowSec * 1000 : 900_000,
  };
}

export async function consumeRateLimit(key: string): Promise<RateLimitResult> {
  const { max, windowMs } = getLimitConfig();
  const now = Date.now();
  const db = await getMongoDb();
  const collection = db.collection<RateLimitDoc>("rate_limits");

  const existing = await collection.findOne({ _id: key });

  if (!existing || existing.resetAt.getTime() <= now) {
    await collection.updateOne(
      { _id: key },
      { $set: { count: 1, resetAt: new Date(now + windowMs) } },
      { upsert: true },
    );
    return { allowed: true };
  }

  if (existing.count >= max) {
    return {
      allowed: false,
      retryAfterSec: Math.max(
        1,
        Math.ceil((existing.resetAt.getTime() - now) / 1000),
      ),
    };
  }

  const updated = await collection.findOneAndUpdate(
    { _id: key, count: { $lt: max } },
    { $inc: { count: 1 } },
    { returnDocument: "after" },
  );

  if (!updated) {
    return {
      allowed: false,
      retryAfterSec: Math.max(
        1,
        Math.ceil((existing.resetAt.getTime() - now) / 1000),
      ),
    };
  }

  return { allowed: true };
}

export function formatRetryAfter(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} s`;
  }

  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? "1 minutę" : `${minutes} min`;
}
