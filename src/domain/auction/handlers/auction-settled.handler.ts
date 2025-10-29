/**
 * Auction Settled Handler
 * Handles auction settlement events - when auction ends with a winner
 *
 * Event Flow (v3.0):
 * 1. Validate event data with Zod schema
 * 2. Store event in event table (source of truth)
 * 3. Update account aggregates (projection)
 * 4. Create trade record (projection from event)
 *
 * @module domain/auction/handlers/auction-settled
 */

import { getEventLogger } from "@/infrastructure/logging/event-logger";
import { normalizeAddress } from "@/shared/utils/helpers";
import {
  AccountRepository,
  EventRepository,
} from "@/repositories";
import {
  validateEventData,
  type AuctionSettledData,
} from "@/shared/schemas/event.schemas";

const logger = getEventLogger();

interface AuctionSettledEvent {
  auctionId: `0x${string}`;
  nftContract: `0x${string}`;
  tokenId: bigint;
  seller: `0x${string}`;
  winner: `0x${string}`;
  finalPrice: bigint;
}

/**
 * Handle Auction Settled Event
 *
 * **New Architecture:**
 * - No dedicated `auction` table - event table is source of truth
 * - Query auction state by filtering events
 * - Settled auctions = auction_created events WITH auction_settled events
 *
 * @param event Ponder event object
 * @param context Ponder context object
 */
export async function handleAuctionSettled({
  event,
  context,
}: {
  event: any;
  context: any;
}) {
  const args = event.args as AuctionSettledEvent;
  const contractAddress = event.log.address;

  logger.logEventStart(
    "AuctionSettled",
    contractAddress,
    event.block.number,
    event.transaction.hash
  );

  try {
    // Initialize repositories
    const accountRepo = new AccountRepository({
      db: context.db,
      network: context.network,
    });
    const eventRepo = new EventRepository({
      db: context.db,
      network: context.network,
    });

    // Prepare event data
    const eventData: AuctionSettledData = {
      auctionId: args.auctionId,
      winner: args.winner,
      finalPrice: args.finalPrice.toString(),
      totalBids: 0, // Could be calculated from previous bid events
    };

    // Validate with Zod schema
    const validatedData = validateEventData("auction_settled", eventData);

    // Create event record (source of truth) - v4.0 event-first approach
    const eventResult = await eventRepo.createEvent({
      eventType: "auction_settled",
      category: "auction",
      actor: args.winner,
      counterparty: args.seller,
      collection: args.nftContract,
      tokenId: args.tokenId.toString(),
      data: validatedData,
      contractName: "AuctionManager",
      event,
    });

    if (!eventResult.success) {
      throw new Error(`Failed to create event: ${eventResult.error?.message}`);
    }

    // Update basic account cache only - v4.0 simplified approach
    await Promise.all([
      accountRepo.getOrCreate(args.winner, event.block.timestamp),
      accountRepo.getOrCreate(args.seller, event.block.timestamp),
      accountRepo.incrementActivity(args.winner, event.block.timestamp),
      accountRepo.incrementActivity(args.seller, event.block.timestamp),
    ]);

    logger.logEventSuccess("AuctionSettled", {
      auctionId: args.auctionId,
      winner: args.winner,
      seller: args.seller,
      finalPrice: args.finalPrice.toString(),
    });
  } catch (error) {
    logger.logEventError("AuctionSettled", error as Error, {
      args,
      contractAddress,
    });
    throw error;
  }
}
