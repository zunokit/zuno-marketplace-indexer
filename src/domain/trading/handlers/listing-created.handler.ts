/**
 * Listing Created Handler
 * Handles NFT listing creation events
 */

import type { NFTListedEvent } from "@/shared/types/events";
import { getEventLogger } from "@/infrastructure/logging/event-logger";
import { detectTokenTypeWithCache } from "@/shared/utils/token-detector";
import { AccountRepository, EventRepository } from "@/repositories";
import {
  validateEventData,
  type ListingCreatedData,
} from "@/shared/schemas/event.schemas";

const logger = getEventLogger();

/**
 * Handle NFT listing creation
 */
export async function handleListingCreated({
  event,
  context,
}: {
  event: any;
  context: any;
}) {
  const args = event.args as NFTListedEvent;
  const contractAddress = event.log.address;

  logger.logEventStart(
    "NFTListed",
    contractAddress,
    event.block.number,
    event.transaction.hash
  );

  try {
    const accountRepo = new AccountRepository({
      db: context.db,
      network: context.network, // May be undefined, repository will use default
    });
    const eventRepo = new EventRepository({
      db: context.db,
      network: context.network, // May be undefined, repository will use default
    });

    // Prepare event data - matches actual NFTListed event structure
    const eventData: ListingCreatedData = {
      listingId: args.listingId,
      contractAddress: args.contractAddress,
      tokenId: args.tokenId.toString(),
      seller: args.seller,
      price: args.price.toString(),
    };

    // Validate with Zod schema
    const validatedData = validateEventData("listing_created", eventData);

    // Create event record (source of truth) - v4.0 event-first
    const eventResult = await eventRepo.createEvent({
      eventType: "listing_created",
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

    logger.logEventSuccess("NFTListed", {
      listingId: args.listingId,
      seller: args.seller,
      contractAddress: args.contractAddress,
      tokenId: args.tokenId.toString(),
      price: args.price.toString(),
    });
  } catch (error) {
    logger.logEventError("NFTListed", error as Error, { args });
    throw error;
  }
}
