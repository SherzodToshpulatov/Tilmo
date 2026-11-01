/** Minimal subset of Durable Object storage used by the ledger. */
export interface UsageStorage {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}

export interface UsageReservation {
  allowed: boolean;
  /** Billing period the characters were reserved in, e.g. `2026-10`. */
  period: string;
  used: number;
  limit: number;
}

export function billingPeriod(now: Date): string {
  return now.toISOString().slice(0, 7);
}

const usageKey = (period: string) => `characters:${period}`;

/**
 * Reserves characters against the monthly budget before calling the provider.
 * Runs inside a single Durable Object, so check-and-increment is not raced.
 */
export async function reserveCharacters(
  storage: UsageStorage,
  characters: number,
  limit: number,
  now: Date,
): Promise<UsageReservation> {
  const period = billingPeriod(now);
  const used = (await storage.get<number>(usageKey(period))) ?? 0;
  if (used + characters > limit) return { allowed: false, period, used, limit };

  await storage.put(usageKey(period), used + characters);
  return { allowed: true, period, used: used + characters, limit };
}

/** Returns characters for a request the provider definitely did not process. */
export async function releaseCharacters(storage: UsageStorage, characters: number, period: string): Promise<void> {
  const used = (await storage.get<number>(usageKey(period))) ?? 0;
  await storage.put(usageKey(period), Math.max(0, used - characters));
}
