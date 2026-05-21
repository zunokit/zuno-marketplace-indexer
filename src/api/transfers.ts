/**
 * `/api/transfers/recent` — read-side helper for "things changed hands".
 *
 * The indexer stores domain-level events (`nft_purchased`, `batch_minted`,
 * `auction_settled`, ...) rather than raw `Transfer` logs. Several downstream
 * consumers (the activity feed widget, the wallet's "recent activity" tab,
 * notification fan-out) all want the same thing: the latest events where an
 * NFT actually changed owner, in time order.
 *
 * The validator + canonical event-type list live in `transfers-query.ts` so
 * they can be unit-tested without the Ponder runtime.
 */

import { db } from "ponder:api";
import schema from "ponder:schema";
import { and, desc, eq, gte, inArray } from "ponder";
import { Hono } from "hono";

import { serializeBigInts } from "@/shared/utils/helpers";
import {
  TRANSFER_EVENT_TYPES,
  TransferQueryError,
  parseTransferQuery,
  type ParsedTransferQuery,
} from "./transfers-query";

export const transfersApi = new Hono();

transfersApi.get("/api/transfers/recent", async (c) => {
  let parsed: ParsedTransferQuery;
  try {
    parsed = parseTransferQuery(c.req.query() as Record<string, string | undefined>);
  } catch (err) {
    if (err instanceof TransferQueryError) {
      return c.json({ error: err.message, field: err.field }, 400);
    }
    throw err;
  }

  const conditions: ReturnType<typeof eq>[] = [];
  conditions.push(
    parsed.eventType
      ? eq(schema.event.eventType, parsed.eventType)
      : inArray(schema.event.eventType, [...TRANSFER_EVENT_TYPES]),
  );
  if (parsed.collection) {
    conditions.push(eq(schema.event.collection, parsed.collection));
  }
  if (parsed.actor) {
    conditions.push(eq(schema.event.actor, parsed.actor));
  }
  if (parsed.sinceTimestamp !== undefined) {
    conditions.push(gte(schema.event.blockTimestamp, BigInt(parsed.sinceTimestamp)));
  }

  try {
    const rows = await db
      .select()
      .from(schema.event)
      .where(and(...conditions))
      .orderBy(desc(schema.event.blockTimestamp))
      .limit(parsed.limit)
      .offset(parsed.offset);

    return c.json(
      serializeBigInts({
        success: true,
        data: rows,
        pagination: { limit: parsed.limit, offset: parsed.offset },
      }),
    );
  } catch (error) {
    console.error("Recent transfers API error:", error);
    return c.json({ error: "Failed to fetch recent transfers" }, 500);
  }
});

export {
  TRANSFER_EVENT_TYPES,
  TransferQueryError,
  parseTransferQuery,
} from "./transfers-query";
