/**
 * Event Validation Schemas
 *
 * Zod schemas for type-safe event data validation.
 * Each event type has its own schema defining the structure of the JSONB data field.
 *
 * Benefits:
 * - Runtime type validation
 * - Auto-generated TypeScript types
 * - Self-documenting event structures
 * - Prevents invalid data from being stored
 *
 * @module schemas/event
 */

import { z } from "zod";

// ============================================================================
// Base Schemas & Helpers
// ============================================================================

/**
 * Ethereum address schema
 */
const AddressSchema = z.custom<`0x${string}`>((val) => {
  return typeof val === "string" && /^0x[a-fA-F0-9]{40}$/.test(val);
});

/**
 * BigInt as string schema (for prices, amounts, etc.)
 */
const BigIntStringSchema = z.string().regex(/^\d+$/);

/**
 * Unix timestamp (bigint)
 */
const TimestampSchema = z.bigint();

// ============================================================================
// Auction Event Schemas
// ============================================================================

/**
 * Auction Created Event Data
 */
export const AuctionCreatedDataSchema = z.object({
  auctionId: AddressSchema,
  auctionType: z.enum(["english", "dutch"]),
  startPrice: BigIntStringSchema,
  reservePrice: BigIntStringSchema.optional(),
  endPrice: BigIntStringSchema.optional(), // Dutch auctions
  priceDecrement: BigIntStringSchema.optional(), // Dutch auctions
  startTime: TimestampSchema,
  endTime: TimestampSchema,
  paymentToken: AddressSchema.optional(),
});

export type AuctionCreatedData = z.infer<typeof AuctionCreatedDataSchema>;

/**
 * Bid Placed Event Data
 */
export const BidPlacedDataSchema = z.object({
  auctionId: AddressSchema,
  bidAmount: BigIntStringSchema,
  previousBid: BigIntStringSchema.optional(),
  previousBidder: AddressSchema.optional(),
  isWinning: z.boolean().default(true),
});

export type BidPlacedData = z.infer<typeof BidPlacedDataSchema>;

/**
 * Auction Settled Event Data
 */
export const AuctionSettledDataSchema = z.object({
  auctionId: AddressSchema,
  winner: AddressSchema,
  finalPrice: BigIntStringSchema,
  totalBids: z.number(),
});

export type AuctionSettledData = z.infer<typeof AuctionSettledDataSchema>;

/**
 * Auction Cancelled Event Data
 */
export const AuctionCancelledDataSchema = z.object({
  auctionId: AddressSchema,
  reason: z.string().optional(),
});

export type AuctionCancelledData = z.infer<typeof AuctionCancelledDataSchema>;

// ============================================================================
// Offer Event Schemas
// ============================================================================

/**
 * Offer Created Event Data - Updated v4.0
 */
export const OfferCreatedDataSchema = z.object({
  offerId: z.string(), // bytes32 as string
  offerer: AddressSchema,
  collection: AddressSchema,
  tokenId: z.string(), // uint256 as string
  amount: BigIntStringSchema,
  offerType: z.number(), // enum as uint8
});

export type OfferCreatedData = z.infer<typeof OfferCreatedDataSchema>;

/**
 * Offer Accepted Event Data
 * Event signature: OfferAccepted(bytes32 offerId, address accepter, address collection, uint256 tokenId, uint256 amount)
 */
export const OfferAcceptedDataSchema = z.object({
  offerId: z.string(), // bytes32 as string
  accepter: AddressSchema,
  collection: AddressSchema,
  tokenId: z.string(), // uint256 as string
  amount: BigIntStringSchema,
});

export type OfferAcceptedData = z.infer<typeof OfferAcceptedDataSchema>;

/**
 * Offer Cancelled Event Data
 * Event signature: OfferCancelled(bytes32 offerId, address offerer, string reason)
 */
export const OfferCancelledDataSchema = z.object({
  offerId: z.string(), // bytes32 as string
  offerer: AddressSchema,
  reason: z.string(),
});

export type OfferCancelledData = z.infer<typeof OfferCancelledDataSchema>;

// ============================================================================
// Listing Event Schemas
// ============================================================================

/**
 * Listing Created Event Data
 * Actual event: NFTListed(bytes32 listingId, address contractAddress, uint256 tokenId, address seller, uint256 price)
 */
export const ListingCreatedDataSchema = z.object({
  listingId: z.string(), // bytes32
  contractAddress: AddressSchema, // NFT contract address
  tokenId: z.string(), // uint256
  seller: AddressSchema,
  price: BigIntStringSchema,
});

export type ListingCreatedData = z.infer<typeof ListingCreatedDataSchema>;

/**
 * Listing Cancelled Event Data
 * Actual event: ListingCancelled(bytes32 listingId, address contractAddress, uint256 tokenId, address seller)
 */
export const ListingCancelledDataSchema = z.object({
  listingId: z.string(),
  contractAddress: AddressSchema,
  tokenId: z.string(),
  seller: AddressSchema,
});

export type ListingCancelledData = z.infer<typeof ListingCancelledDataSchema>;

/**
 * Listing Filled Event Data
 * Actual event: NFTSold(bytes32 listingId, address contractAddress, uint256 tokenId, address seller, address buyer, uint256 price)
 */
export const ListingFilledDataSchema = z.object({
  listingId: z.string(),
  contractAddress: AddressSchema,
  tokenId: z.string(),
  seller: AddressSchema,
  buyer: AddressSchema,
  price: BigIntStringSchema,
});

export type ListingFilledData = z.infer<typeof ListingFilledDataSchema>;

// ============================================================================
// Trade Event Schemas
// ============================================================================

/**
 * NFT Purchased Event Data
 * Actual event: NFTSold(bytes32 listingId, address contractAddress, uint256 tokenId, address seller, address buyer, uint256 price)
 */
export const NFTPurchasedDataSchema = z.object({
  listingId: z.string(),
  contractAddress: AddressSchema,
  tokenId: z.string(),
  seller: AddressSchema,
  buyer: AddressSchema,
  price: BigIntStringSchema,
});

export type NFTPurchasedData = z.infer<typeof NFTPurchasedDataSchema>;

/**
 * Bundle Purchased Event Data
 */
export const BundlePurchasedDataSchema = z.object({
  bundleId: z.string(),
  items: z.array(
    z.object({
      collection: AddressSchema,
      tokenId: z.string(),
      amount: z.string(),
    })
  ),
  totalPrice: BigIntStringSchema,
  paymentToken: AddressSchema,
});

export type BundlePurchasedData = z.infer<typeof BundlePurchasedDataSchema>;

/**
 * Bundle Created Event Data
 */
export const BundleCreatedDataSchema = z.object({
  bundleId: z.string(),
  items: z.array(
    z.object({
      collection: AddressSchema,
      tokenId: z.string(),
      amount: z.string(),
    })
  ),
  price: BigIntStringSchema,
  paymentToken: AddressSchema,
  expiresAt: TimestampSchema.optional(),
});

export type BundleCreatedData = z.infer<typeof BundleCreatedDataSchema>;

// ============================================================================
// Mint Event Schemas
// ============================================================================

/**
 * NFT Minted Event Data
 */
export const NFTMintedDataSchema = z.object({
  tokenId: z.string(),
  recipient: AddressSchema,
  mintPrice: BigIntStringSchema.optional(),
  tokenUri: z.string().optional(),
  amount: z.number().default(1), // ERC1155
});

export type NFTMintedData = z.infer<typeof NFTMintedDataSchema>;

/**
 * Batch Minted Event Data
 */
export const BatchMintedDataSchema = z.object({
  tokenIds: z.array(z.string()),
  recipient: AddressSchema,
  mintPrice: BigIntStringSchema.optional(),
  count: z.number(),
});

export type BatchMintedData = z.infer<typeof BatchMintedDataSchema>;

// ============================================================================
// Collection Event Schemas
// ============================================================================

/**
 * Collection Created Event Data
 */
export const CollectionCreatedDataSchema = z.object({
  name: z.string(),
  symbol: z.string(),
  tokenType: z.enum(["ERC721", "ERC1155"]),
  maxSupply: z.string().optional(),
  royaltyFee: z.number().optional(),
  royaltyRecipient: AddressSchema.optional(),
});

export type CollectionCreatedData = z.infer<typeof CollectionCreatedDataSchema>;

// ============================================================================
// Schema Registry
// ============================================================================

/**
 * Map event types to their validation schemas
 *
 * Usage:
 * ```typescript
 * const schema = EVENT_SCHEMAS["auction_created"];
 * const validData = schema.parse(eventData);
 * ```
 */
export const EVENT_SCHEMAS = {
  // Auction events
  auction_created: AuctionCreatedDataSchema,
  bid_placed: BidPlacedDataSchema,
  auction_settled: AuctionSettledDataSchema,
  auction_cancelled: AuctionCancelledDataSchema,

  // Offer events
  offer_created: OfferCreatedDataSchema,
  offer_accepted: OfferAcceptedDataSchema,
  offer_cancelled: OfferCancelledDataSchema,

  // Listing events
  listing_created: ListingCreatedDataSchema,
  listing_cancelled: ListingCancelledDataSchema,
  listing_filled: ListingFilledDataSchema,

  // Trade events
  nft_purchased: NFTPurchasedDataSchema,
  bundle_purchased: BundlePurchasedDataSchema,

  // Bundle events
  bundle_created: BundleCreatedDataSchema,

  // Mint events
  nft_minted: NFTMintedDataSchema,
  batch_minted: BatchMintedDataSchema,

  // Collection events
  collection_created: CollectionCreatedDataSchema,
} as const;

export type EventType = keyof typeof EVENT_SCHEMAS;

/**
 * Validate event data against its schema
 *
 * @param eventType Event type
 * @param data Event data to validate
 * @returns Validated and typed data
 * @throws ZodError if validation fails
 *
 * @example
 * ```typescript
 * const validData = validateEventData("auction_created", rawData);
 * ```
 */
export function validateEventData<T extends EventType>(
  eventType: T,
  data: unknown
): any {
  const schema = EVENT_SCHEMAS[eventType];
  return schema.parse(data);
}

/**
 * Safe validation that returns result instead of throwing
 *
 * @param eventType Event type
 * @param data Event data to validate
 * @returns Success/failure result
 *
 * @example
 * ```typescript
 * const result = safeValidateEventData("auction_created", rawData);
 * if (result.success) {
 *   // Use validated data
 * } else {
 *   // Handle validation error
 * }
 * ```
 */
export function safeValidateEventData<T extends EventType>(
  eventType: T,
  data: unknown
): { success: true; data: any } | { success: false; error: z.ZodError } {
  const schema = EVENT_SCHEMAS[eventType];
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}
