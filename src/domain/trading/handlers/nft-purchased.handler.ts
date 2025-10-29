/**
 * NFT Purchased Handler - Senior Refactor v4.0
 *
 * Simplified event-first handler - only stores event
 * All stats calculated via queries when needed
 */

import type { NFTPurchasedEvent } from "@/shared/types/events";
import { getEventLogger } from "@/infrastructure/logging/event-logger";
import { EventRepository, AccountRepository } from "@/repositories";
import {
  validateEventData,
  type NFTPurchasedData,
} from "@/shared/schemas/event.schemas";

const logger = getEventLogger();

/**
 * Handle NFT purchase/sale - Simplified Senior Approach
 *
 * Only stores the event. No projections, no aggregates.
 * Everything else calculated via queries.
 */
export async function handleNFTPurchased({
  event,
  context,
}: {
  event: any;
  context: any;
}) {
  const args = event.args as NFTPurchasedEvent;
  const contractAddress = event.log.address;

  logger.logEventStart(
    "NFTPurchased",
    contractAddress,
    event.block.number,
    event.transaction.hash
  );

  try {
    // Initialize only required repositories
    const eventRepo = new EventRepository({
      db: context.db,
      network: context.network,
    });
    const accountRepo = new AccountRepository({
      db: context.db,
      network: context.network,
    });

    // Prepare event data - matches actual NFTSold event structure
    const eventData: NFTPurchasedData = {
      listingId: args.listingId,
      contractAddress: args.contractAddress,
      tokenId: args.tokenId.toString(),
      seller: args.seller,
      buyer: args.buyer,
      price: args.price.toString(),
    };

    // Validate with Zod schema
    const validatedData = validateEventData("nft_purchased", eventData);

    // Create event record (ONLY source of truth) - v4.0 event-first
    const eventResult = await eventRepo.createEvent({
      eventType: "nft_purchased",
      category: "trade",
      actor: args.seller, // Primary actor = seller
      counterparty: args.buyer, // Secondary actor = buyer
      collection: args.contractAddress,
      tokenId: args.tokenId.toString(),
      data: validatedData,
      contractName: "NFTExchange",
      event,
    });

    if (!eventResult.success) {
      throw new Error(`Failed to create event: ${eventResult.error?.message}`);
    }

    // Update basic account cache only - v4.0 simplified
    await Promise.all([
      accountRepo.getOrCreate(args.seller, event.block.timestamp),
      accountRepo.getOrCreate(args.buyer, event.block.timestamp),
      accountRepo.incrementActivity(args.seller, event.block.timestamp),
      accountRepo.incrementActivity(args.buyer, event.block.timestamp),
    ]);

    logger.logEventSuccess("NFTSold", {
      listingId: args.listingId,
      seller: args.seller,
      buyer: args.buyer,
      contractAddress: args.contractAddress,
      tokenId: args.tokenId.toString(),
      price: args.price.toString(),
    });
    logger.logMetric("Trade Volume", args.price, "wei");

  } catch (error) {
    logger.logEventError("NFTPurchased", error as Error, { args });
    throw error;
  }
}

/**
 * Senior Developer Notes:
 *
 * Why this is better:
 * 1. Single responsibility - only stores event
 * 2. No data duplication - event is source of truth
 * 3. Faster processing - no aggregate updates
 * 4. Simpler codebase - easier to maintain
 * 5. Real-time accuracy - stats always current
 *
 * Query Examples instead of aggregates:
 *
 * // Get collection stats
 * SELECT
 *   COUNT(*) as totalTrades,
 *   SUM(data->>'price') as totalVolume,
 *   MAX(blockTimestamp) as lastTrade
 * FROM event
 * WHERE collection = $1 AND category = 'trade'
 *
 * // Get user trading stats
 * SELECT
 *   COUNT(*) as trades,
 *   SUM(data->>'price') as volume
 * FROM event
 * WHERE actor = $1 AND category = 'trade'
 *
 * // Floor price = lowest active listing
 * SELECT MIN(data->>'price') as floorPrice
 * FROM event
 * WHERE collection = $1
 *   AND eventType = 'listing_created'
 *   AND NOT EXISTS (
 *     SELECT 1 FROM event e2
 *     WHERE e2.eventType = 'listing_filled'
 *       AND JSON_EXTRACT(e2.data, '$.listingId') = JSON_EXTRACT(event.data, '$.listingId')
 *   )
 */
