/**
 * Listing Cancelled Handler
 * Handles NFT listing cancellation events
 *
 * Event Flow (v3.0):
 * 1. Validate event data with Zod schema
 * 2. Store event in event table (source of truth)
 * 3. Update account aggregate (projection)
 *
 * @module domain/trading/handlers/listing-cancelled
 */

import type { NFTUnlistedEvent } from "@/shared/types/events";
import { getEventLogger } from "@/infrastructure/logging/event-logger";
import { AccountRepository, EventRepository } from "@/repositories";
import {
  validateEventData,
  type ListingCancelledData,
} from "@/shared/schemas/event.schemas";

const logger = getEventLogger();

/**
 * Handle listing cancellation
 */
export async function handleListingCancelled({
  event,
  context,
}: {
  event: any;
  context: any;
}) {
  const args = event.args as NFTUnlistedEvent;
  const contractAddress = event.log.address;

  logger.logEventStart(
    "NFTUnlisted",
    contractAddress,
    event.block.number,
    event.transaction.hash
  );

  try {
    const accountRepo = new AccountRepository({
      db: context.db,
      network: context.network,
    });
    const eventRepo = new EventRepository({
      db: context.db,
      network: context.network,
    });

    // Prepare event data - matches actual ListingCancelled event structure
    const eventData: ListingCancelledData = {
      listingId: args.listingId,
      contractAddress: args.contractAddress,
      tokenId: args.tokenId.toString(),
      seller: args.seller,
    };

    // Validate with Zod schema
    const validatedData = validateEventData("listing_cancelled", eventData);

    // Create event record (source of truth) - v4.0 event-first
    const eventResult = await eventRepo.createEvent({
      eventType: "listing_cancelled",
      category: "listing",
      actor: args.seller,
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
      accountRepo.incrementActivity(args.seller, event.block.timestamp),
    ]);

    logger.logEventSuccess("ListingCancelled", {
      listingId: args.listingId,
      seller: args.seller,
      contractAddress: args.contractAddress,
      tokenId: args.tokenId.toString(),
    });
  } catch (error) {
    logger.logEventError("NFTUnlisted", error as Error, { args });
    throw error;
  }
}
