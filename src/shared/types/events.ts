/**
 * Event Type Definitions
 * Type-safe event arguments for all marketplace events
 */

import type { Address, Hash } from "./index";

// ============================================================================
// Collection Events
// ============================================================================

export interface ERC721CollectionCreatedEvent {
  collectionAddress: Address;
  creator: Address;
  // Note: name, symbol, maxSupply are not emitted in the actual event
  // They would need to be fetched from the contract if needed
}

export interface ERC1155CollectionCreatedEvent {
  collectionAddress: Address;
  creator: Address;
  uri: string;
}

// ============================================================================
// NFT Transfer Events
// ============================================================================

export interface TransferEvent {
  from: Address;
  to: Address;
  tokenId: bigint;
}

export interface TransferSingleEvent {
  operator: Address;
  from: Address;
  to: Address;
  id: bigint;
  value: bigint;
}

export interface TransferBatchEvent {
  operator: Address;
  from: Address;
  to: Address;
  ids: bigint[];
  values: bigint[];
}

// ============================================================================
// Marketplace Trading Events
// ============================================================================

// NFTExchange Events
export interface NFTListedEvent {
  listingId: Hash; // bytes32
  contractAddress: Address; // NFT contract address
  tokenId: bigint;
  seller: Address;
  price: bigint;
}

export interface NFTUnlistedEvent {
  listingId: Hash;
  contractAddress: Address;
  tokenId: bigint;
  seller: Address;
}

export interface NFTPurchasedEvent {
  listingId: Hash; // bytes32
  contractAddress: Address; // NFT contract address
  tokenId: bigint;
  seller: Address;
  buyer: Address;
  price: bigint;
}

export interface OrderFulfilledEvent {
  orderHash: Hash;
  buyer: Address;
  seller: Address;
  nftContract: Address;
  tokenId: bigint;
  price: bigint;
  paymentToken: Address;
}

export interface OrderCreatedEvent {
  orderHash: Hash;
  maker: Address;
  taker: Address;
  nftContract: Address;
  tokenId: bigint;
  price: bigint;
}

// ============================================================================
// Auction Events
// ============================================================================

export interface AuctionCreatedEvent {
  auctionId: Hash | bigint;
  nftContract: Address;
  tokenId: bigint;
  seller: Address;
  startingPrice: bigint;
  reservePrice?: bigint;
  duration?: bigint;
  startTime?: bigint;
  endTime: bigint;
}

export interface BidPlacedEvent {
  auctionId: bigint | Hash;
  bidder: Address;
  bidAmount: bigint;
  timestamp?: bigint;
}

export interface AuctionFinalizedEvent {
  auctionId: Hash | bigint;
  winner: Address;
  finalPrice: bigint;
}

export interface AuctionEndedEvent {
  auctionId: bigint;
  winner: Address;
  winningBid: bigint;
  settled: boolean;
}

export interface AuctionCancelledEvent {
  auctionId: bigint;
  seller: Address;
}

export interface AuctionSettledEvent {
  auctionId: Hash;
  winner: Address;
  seller: Address;
  finalPrice: bigint;
  protocolFee: bigint;
  royaltiesEarned: bigint;
  collection: Address;
  tokenId: bigint;
  auctionType: string;
}

// ============================================================================
// Offer Events
// ============================================================================

export interface OfferCreatedEvent {
  offerId: Hash;
  offerer: Address;
  collection: Address;
  tokenId: bigint;
  amount: bigint;
  offerType: number; // enum OfferManager.OfferType (0=NFT, 1=Collection, 2=Trait)
}

export interface OfferAcceptedEvent {
  offerId: Hash;
  accepter: Address; // Note: contract emits "accepter" not "acceptor"
  collection: Address;
  tokenId: bigint;
  amount: bigint;
}

export interface OfferCancelledEvent {
  offerId: Hash;
  offerer: Address;
  reason: string;
}

export interface OfferMadeEvent {
  offerId: Hash;
  nftContract: Address;
  tokenId: bigint;
  offerer: Address;
  offerAmount: bigint;
  paymentToken: Address;
  expirationTime: bigint;
}

// ============================================================================
// Order Events
// ============================================================================

export interface OrderCancelledEvent {
  orderHash: Hash;
  maker: Address;
}

// ============================================================================
// Fee & Royalty Events
// ============================================================================

export interface RoyaltyPaidEvent {
  nftContract: Address;
  tokenId: bigint;
  recipient: Address;
  amount: bigint;
}

export interface PlatformFeeUpdatedEvent {
  newFeePercentage: bigint;
  updatedBy: Address;
}

// ============================================================================
// Bundle Events
// ============================================================================

export interface BundleCreatedEvent {
  bundleId: Hash; // bytes32 bundle ID
  creator: Address; // Bundle creator
  bundleType: string; // Type of bundle (nft/erc1155)
  tokenIds: Address[]; // Token identifiers (address array)
  bundleSize: number; // Number of tokens in bundle
  totalPrice: bigint; // Total price in wei
  metadata: object; // Bundle metadata (name, description, images, etc.)
  timestamp: bigint; // Creation timestamp
}

export interface BundlePurchasedEvent {
  bundleId: Hash; // Bundle ID
  buyer: Address; // Bundle buyer
  seller: Address; // Bundle seller
  totalPrice: bigint; // Total bundle price
  paymentToken: Address; // Payment token address
  bundleType: string; // Bundle type
  bundleSize: number; // Token count
  timestamp: bigint; // Timestamp
}

export interface BundleDissolvedEvent {
  bundleId: Hash; // Bundle ID
  creator: Address; // Bundle creator
  reason: string; // Dissolution reason
  timestamp: bigint; // Dissolution timestamp
}

export interface BundleUpdatedEvent {
  bundleId: Hash; // Bundle ID
  creator: Address; // Bundle creator
  updates: object; // Changed fields
  timestamp: bigint; // Update timestamp
}

// ============================================================================
// Event Union Type
// ============================================================================

export type MarketplaceEvent =
  | { type: "ERC721CollectionCreated"; args: ERC721CollectionCreatedEvent }
  | { type: "ERC1155CollectionCreated"; args: ERC1155CollectionCreatedEvent }
  | { type: "Transfer"; args: TransferEvent }
  | { type: "TransferSingle"; args: TransferSingleEvent }
  | { type: "TransferBatch"; args: TransferBatchEvent }
  | { type: "NFTListed"; args: NFTListedEvent }
  | { type: "NFTUnlisted"; args: NFTUnlistedEvent }
  | { type: "NFTPurchased"; args: NFTPurchasedEvent }
  | { type: "OrderFulfilled"; args: OrderFulfilledEvent }
  | { type: "OrderCreated"; args: OrderCreatedEvent }
  | { type: "OrderCancelled"; args: OrderCancelledEvent }
  | { type: "AuctionCreated"; args: AuctionCreatedEvent }
  | { type: "BidPlaced"; args: BidPlacedEvent }
  | { type: "AuctionFinalized"; args: AuctionFinalizedEvent }
  | { type: "AuctionEnded"; args: AuctionEndedEvent }
  | { type: "AuctionCancelled"; args: AuctionCancelledEvent }
  | { type: "AuctionSettled"; args: AuctionSettledEvent }
  | { type: "OfferCreated"; args: OfferCreatedEvent }
  | { type: "OfferMade"; args: OfferMadeEvent }
  | { type: "OfferAccepted"; args: OfferAcceptedEvent }
  | { type: "OfferCancelled"; args: OfferCancelledEvent }
  | { type: "RoyaltyPaid"; args: RoyaltyPaidEvent }
  | { type: "PlatformFeeUpdated"; args: PlatformFeeUpdatedEvent }
  | { type: "BundleCreated"; args: BundleCreatedEvent }
  | { type: "BundlePurchased"; args: BundlePurchasedEvent }
  | { type: "BundleDissolved"; args: BundleDissolvedEvent }
  | { type: "BundleUpdated"; args: BundleUpdatedEvent };

// ============================================================================
// Event Handler Context
// ============================================================================

export interface EventContext<TEvent> {
  event: {
    args: TEvent;
    block: {
      number: bigint;
      timestamp: bigint;
      hash: Hash;
    };
    transaction: {
      hash: Hash;
      from: Address;
      to: Address | null;
      value?: bigint;
      transactionIndex: number;
    };
    log: {
      address: Address;
      logIndex: number;
      topics: string[];
    };
  };
  network: {
    chainId: number;
    name: string;
  };
  db: any;
}
