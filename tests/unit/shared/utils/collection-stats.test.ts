import {
  computeCollectionStats,
  groupEventsByCategory,
  type StatsEvent,
} from "@/shared/utils/collection-stats";

const NOW = 1_700_000_000;

const event = (overrides: Partial<StatsEvent> = {}): StatsEvent => ({
  eventType: "trade_executed",
  category: "trade",
  actor: "0xAAA0000000000000000000000000000000000000",
  counterparty: "0xBBB0000000000000000000000000000000000000",
  blockTimestamp: BigInt(NOW - 60),
  ...overrides,
});

describe("computeCollectionStats", () => {
  it("returns empty/zero stats for an empty array", () => {
    const stats = computeCollectionStats([], { now: NOW });
    expect(stats.totalEvents).toBe(0);
    expect(stats.uniqueParticipants).toBe(0);
    expect(stats.eventsByCategory).toEqual({});
    expect(stats.eventsByType).toEqual({});
    expect(stats.topActors).toEqual([]);
    expect(stats.activity).toEqual({ last24h: 0, last7d: 0, last30d: 0 });
  });

  it("counts events by category and eventType", () => {
    const stats = computeCollectionStats(
      [
        event(),
        event({ eventType: "list_created", category: "trade" }),
        event({ eventType: "mint_executed", category: "mint" }),
        event({ eventType: "auction_settled", category: "auction" }),
      ],
      { now: NOW },
    );
    expect(stats.totalEvents).toBe(4);
    expect(stats.eventsByCategory).toEqual({ trade: 2, mint: 1, auction: 1 });
    expect(stats.eventsByType).toEqual({
      trade_executed: 1,
      list_created: 1,
      mint_executed: 1,
      auction_settled: 1,
    });
  });

  it("treats actor addresses case-insensitively for uniqueness + ranking", () => {
    const stats = computeCollectionStats(
      [
        event({
          actor: "0xAAA0000000000000000000000000000000000000",
          counterparty: null,
        }),
        event({
          actor: "0xaaa0000000000000000000000000000000000000",
          counterparty: null,
        }),
        event({
          actor: "0xCCC0000000000000000000000000000000000000",
          counterparty: null,
        }),
      ],
      { now: NOW, topN: 5 },
    );
    expect(stats.uniqueParticipants).toBe(2); // 0xaaa* and 0xccc*
    expect(stats.topActors[0]).toEqual({
      actor: "0xaaa0000000000000000000000000000000000000",
      count: 2,
    });
    expect(stats.topActors[1]).toEqual({
      actor: "0xccc0000000000000000000000000000000000000",
      count: 1,
    });
  });

  it("collects all participants (actor + counterparty)", () => {
    const stats = computeCollectionStats(
      [
        event({
          actor: "0x1111111111111111111111111111111111111111",
          counterparty: "0x2222222222222222222222222222222222222222",
        }),
        event({
          actor: "0x1111111111111111111111111111111111111111",
          counterparty: null,
        }),
      ],
      { now: NOW },
    );
    expect(stats.uniqueParticipants).toBe(2);
  });

  it("bins events into activity windows by age", () => {
    const stats = computeCollectionStats(
      [
        event({ blockTimestamp: BigInt(NOW - 60) }), // last 24h
        event({ blockTimestamp: BigInt(NOW - 3 * 24 * 3600) }), // last 7d (not 24h)
        event({ blockTimestamp: BigInt(NOW - 20 * 24 * 3600) }), // last 30d
        event({ blockTimestamp: BigInt(NOW - 100 * 24 * 3600) }), // out
      ],
      { now: NOW },
    );
    expect(stats.activity).toEqual({ last24h: 1, last7d: 2, last30d: 3 });
  });

  it("respects topN", () => {
    const events: StatsEvent[] = [];
    for (let i = 0; i < 20; i += 1) {
      events.push(
        event({
          actor: `0x${(i + 1).toString(16).padStart(40, "0")}`,
          counterparty: null,
        }),
      );
    }
    const stats = computeCollectionStats(events, { now: NOW, topN: 5 });
    expect(stats.topActors.length).toBe(5);
  });

  it("sorts top actors deterministically by count desc then address asc", () => {
    const stats = computeCollectionStats(
      [
        event({ actor: "0xbb", counterparty: null }),
        event({ actor: "0xaa", counterparty: null }),
        event({ actor: "0xbb", counterparty: null }),
        event({ actor: "0xaa", counterparty: null }),
        event({ actor: "0xcc", counterparty: null }),
      ],
      { now: NOW, topN: 5 },
    );
    expect(stats.topActors).toEqual([
      { actor: "0xaa", count: 2 },
      { actor: "0xbb", count: 2 },
      { actor: "0xcc", count: 1 },
    ]);
  });

  it("rejects invalid options", () => {
    expect(() =>
      computeCollectionStats([], { now: NaN }),
    ).toThrow(/finite number/);
    expect(() =>
      computeCollectionStats([], { topN: 0 }),
    ).toThrow(/positive integer/);
    expect(() =>
      computeCollectionStats([], { topN: -1 }),
    ).toThrow(/positive integer/);
  });

  it("accepts numeric block timestamps in addition to bigint", () => {
    const stats = computeCollectionStats(
      [event({ blockTimestamp: NOW - 30 })],
      { now: NOW },
    );
    expect(stats.activity.last24h).toBe(1);
  });
});

describe("groupEventsByCategory", () => {
  it("groups events by their category bucket", () => {
    const grouped = groupEventsByCategory([
      event({ category: "trade" }),
      event({ category: "trade" }),
      event({ category: "mint" }),
    ]);
    expect(Object.keys(grouped).sort()).toEqual(["mint", "trade"]);
    expect(grouped.trade).toHaveLength(2);
    expect(grouped.mint).toHaveLength(1);
  });

  it("returns an empty object for an empty array", () => {
    expect(groupEventsByCategory([])).toEqual({});
  });
});
