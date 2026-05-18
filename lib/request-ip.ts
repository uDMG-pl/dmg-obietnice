import "server-only";

import { headers } from "next/headers";

export async function getRequestIp(): Promise<string> {
  const headerList = await headers();

  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0]?.trim();
    if (ip) {
      return ip;
    }
  }

  const realIp = headerList.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
}
