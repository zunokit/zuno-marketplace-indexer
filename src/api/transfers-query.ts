/**
 * Pure query-string parser for `/api/transfers/recent`.
 *
 * Lives outside of `transfers.ts` so it can be unit-tested without spinning up
 * the Ponder runtime (`ponder:api` / `ponder:schema` are virtual modules that
 * are only available inside the indexer process).
 */

export const TRANSFER_EVENT_TYPES = [
  "nft_minted",
  "batch_minted",
  "nft_purchased",
  "auction_settled",
  "offer_accepted",
  "collection_offer_filled",
  "trait_offer_filled",
] as const;

export type TransferEventType = (typeof TRANSFER_EVENT_TYPES)[number];

const TRANSFER_EVENT_TYPE_SET = new Set<string>(TRANSFER_EVENT_TYPES);

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export interface ParsedTransferQuery {
  limit: number;
  offset: number;
  collection?: `0x${string}`;
  actor?: `0x${string}`;
  /** Unix-seconds lower bound for `blockTimestamp`. */
  sinceTimestamp?: number;
  /** When set, restricts to a single transfer-like event type. */
  eventType?: TransferEventType;
}

export class TransferQueryError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.field = field;
    this.name = "TransferQueryError";
  }
}

type RawParams = URLSearchParams | Record<string, string | undefined>;

function readParam(params: RawParams, key: string): string | undefined {
  if (params instanceof URLSearchParams) {
    return params.get(key) ?? undefined;
  }
  const value = params[key];
  return value ?? undefined;
}

function parseAddress(field: string, value: string): `0x${string}` {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new TransferQueryError(field, `${field} must be a 40-char hex address`);
  }
  return value.toLowerCase() as `0x${string}`;
}

function parsePositiveInt(field: string, value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw new TransferQueryError(field, `${field} must be a non-negative integer`);
  }
  return n;
}

/**
 * Validate + normalise the query-string portion of `/api/transfers/recent`.
 */
export function parseTransferQuery(params: RawParams): ParsedTransferQuery {
  const limitRaw = readParam(params, "limit");
  const offsetRaw = readParam(params, "offset");
  const pageRaw = readParam(params, "page");
  const collectionRaw = readParam(params, "collection");
  const actorRaw = readParam(params, "actor");
  const sinceRaw = readParam(params, "sinceTimestamp");
  const eventTypeRaw = readParam(params, "eventType");

  const limit = limitRaw
    ? Math.min(parsePositiveInt("limit", limitRaw), MAX_LIMIT)
    : DEFAULT_LIMIT;
  if (limit <= 0) {
    throw new TransferQueryError("limit", "limit must be > 0");
  }

  let offset = 0;
  if (offsetRaw) {
    offset = parsePositiveInt("offset", offsetRaw);
  } else if (pageRaw) {
    const page = parsePositiveInt("page", pageRaw);
    if (page < 1) {
      throw new TransferQueryError("page", "page must be >= 1");
    }
    offset = (page - 1) * limit;
  }

  const result: ParsedTransferQuery = { limit, offset };

  if (collectionRaw) {
    result.collection = parseAddress("collection", collectionRaw);
  }
  if (actorRaw) {
    result.actor = parseAddress("actor", actorRaw);
  }
  if (sinceRaw) {
    result.sinceTimestamp = parsePositiveInt("sinceTimestamp", sinceRaw);
  }
  if (eventTypeRaw) {
    if (!TRANSFER_EVENT_TYPE_SET.has(eventTypeRaw)) {
      throw new TransferQueryError(
        "eventType",
        `eventType must be one of: ${TRANSFER_EVENT_TYPES.join(", ")}`,
      );
    }
    result.eventType = eventTypeRaw as TransferEventType;
  }

  return result;
}
