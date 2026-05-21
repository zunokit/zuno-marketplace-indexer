/**
 * Pure aggregation helpers for collection-level statistics.
 *
 * The indexer's `/api/collections/:address/stats` route queries the
 * event table and feeds the result through these helpers. By keeping
 * the math pure (no Ponder virtual modules, no DB, no env), the
 * aggregation logic is unit-testable in isolation and reusable by
 * scripts and back-fill jobs.
 *
 * Event shape (subset of ponder.schema.ts `event` row):
 *   - eventType: string
 *   - category: 'auction' | 'offer' | 'trade' | 'mint' | 'collection'
 *   - actor: 0x-hex
 *   - counterparty: 0x-hex | null
 *   - blockTimestamp: bigint (unix seconds)
 *   - data: arbitrary JSON
 */

export interface StatsEvent {
  eventType: string;
  category: string;
  actor: string;
  counterparty?: string | null;
  blockTimestamp: bigint | number;
}

export interface ActorCount {
  actor: string;
  count: number;
}

export interface CollectionStats {
  /** Number of unique actors that appear as `actor` or `counterparty`. */
  uniqueParticipants: number;
  /** Count of events per category. */
  eventsByCategory: Record<string, number>;
  /** Count of events per specific eventType. */
  eventsByType: Record<string, number>;
  /** Top N actors by event count, sorted descending. */
  topActors: ActorCount[];
  /** Activity windows (seconds back from `now`). */
  activity: {
    last24h: number;
    last7d: number;
    last30d: number;
  };
  /** Total event count. */
  totalEvents: number;
}

export interface ComputeStatsOptions {
  /** Reference timestamp for activity windows (unix seconds). Default: now. */
  now?: number;
  /** Maximum number of top actors to return. Default: 10. */
  topN?: number;
}

const ONE_DAY_SEC = 24 * 60 * 60;

function asUnixSec(ts: bigint | number): number {
  if (typeof ts === "number") return Math.floor(ts);
  // Ponder stores block timestamps as bigint seconds — coerce safely.
  return Number(ts);
}

function bumpCount(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/**
 * Computes per-collection statistics from a (possibly large) array of
 * events. The function is pure: same input ⇒ same output. Allocates a
 * couple of intermediate Maps but does a single linear pass.
 */
export function computeCollectionStats(
  events: readonly StatsEvent[],
  options: ComputeStatsOptions = {},
): CollectionStats {
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const topN = options.topN ?? 10;
  if (!Number.isFinite(now)) {
    throw new Error("computeCollectionStats: `now` must be a finite number");
  }
  if (!Number.isInteger(topN) || topN <= 0) {
    throw new Error("computeCollectionStats: `topN` must be a positive integer");
  }

  const byCategory = new Map<string, number>();
  const byType = new Map<string, number>();
  const actorCounts = new Map<string, number>();
  const participants = new Set<string>();

  let last24h = 0;
  let last7d = 0;
  let last30d = 0;
  let total = 0;

  for (const ev of events) {
    if (!ev) continue;
    total += 1;
    bumpCount(byCategory, ev.category);
    bumpCount(byType, ev.eventType);
    const actorKey = ev.actor.toLowerCase();
    bumpCount(actorCounts, actorKey);
    participants.add(actorKey);
    if (ev.counterparty) {
      participants.add(ev.counterparty.toLowerCase());
    }

    const ts = asUnixSec(ev.blockTimestamp);
    const age = now - ts;
    if (age >= 0) {
      if (age <= ONE_DAY_SEC) last24h += 1;
      if (age <= 7 * ONE_DAY_SEC) last7d += 1;
      if (age <= 30 * ONE_DAY_SEC) last30d += 1;
    }
  }

  const topActors: ActorCount[] = Array.from(actorCounts.entries())
    .map(([actor, count]) => ({ actor, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      // Stable secondary sort so tests can rely on order.
      return a.actor.localeCompare(b.actor);
    })
    .slice(0, topN);

  return {
    uniqueParticipants: participants.size,
    eventsByCategory: Object.fromEntries(byCategory),
    eventsByType: Object.fromEntries(byType),
    topActors,
    activity: {
      last24h,
      last7d,
      last30d,
    },
    totalEvents: total,
  };
}

/**
 * Convenience: groups events into category-bucketed arrays. Useful when
 * the caller wants to re-process buckets individually (e.g. compute
 * trade volume from `data.priceWei`).
 */
export function groupEventsByCategory<T extends StatsEvent>(
  events: readonly T[],
): Record<string, T[]> {
  const buckets: Record<string, T[]> = {};
  for (const ev of events) {
    const bucket = buckets[ev.category] ?? (buckets[ev.category] = []);
    bucket.push(ev);
  }
  return buckets;
}
