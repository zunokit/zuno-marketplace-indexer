/**
 * Offer Created Handler - Senior Implementation v4.0
 *
 * Handles offer creation events in the Zuno NFT Marketplace.
 * Event-sourcing approach - stores event only, no projections.
 *
 * Event Structure:
 * - offerId: bytes32 - Unique offer identifier
 * - offerer: address - User making the offer
 * - collection: address - NFT collection address
 * - tokenId: uint256 - Token ID (0 for collection offers)
 * - amount: uint256 - Offer amount in wei
 * - offerType: uint8 - Type of offer (NFT, Collection, Trait)
 */

import type { OfferCreatedEvent } from "@/shared/types/events";
import { getEventLogger } from "@/infrastructure/logging/event-logger";
import { EventRepository, AccountRepository } from "@/repositories";
import {
  validateEventData,
  type OfferCreatedData,
} from "@/shared/schemas/event.schemas";

const logger = getEventLogger();

/**
 * Handle Offer Creation - Senior Event-First Approach
 *
 * Only stores the event. No complex projections or aggregates.
 * All offer-related data calculated via queries when needed.
 */
export async function handleOfferCreated({
  event,
  context,
}: {
  event: any;
  context: any;
}) {
  const args = event.args as OfferCreatedEvent;
  const contractAddress = event.log.address;

  logger.logEventStart(
    "OfferCreated",
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

    // Prepare event data - offerType is uint8 enum value
    const eventData: OfferCreatedData = {
      offerId: args.offerId,
      offerer: args.offerer,
      collection: args.collection,
      tokenId: args.tokenId?.toString() || "0",
      amount: args.amount.toString(),
      offerType: Number(args.offerType),
    };

    // Validate with Zod schema
    const validatedData = validateEventData("offer_created", eventData);

    // Create event record (ONLY source of truth)
    const eventResult = await eventRepo.createEvent({
      eventType: "offer_created",
      category: "offer",
      actor: args.offerer, // Primary actor = offer creator
      collection: args.collection,
      tokenId: args.tokenId?.toString() || "0",
      data: validatedData,
      contractName: "OfferManager",
      event,
    });

    if (!eventResult.success) {
      throw new Error(`Failed to create event: ${eventResult.error?.message}`);
    }

    // Update basic account cache (firstSeen, lastActive, eventCount)
    await Promise.all([
      accountRepo.getOrCreate(args.offerer, event.block.timestamp),
      accountRepo.incrementActivity(args.offerer, event.block.timestamp),
    ]);

    logger.logEventSuccess("OfferCreated", {
      offerId: args.offerId,
      offerer: args.offerer,
      collection: args.collection,
      tokenId: args.tokenId?.toString() || "0",
      amount: args.amount.toString(),
      offerType: args.offerType,
    });
    logger.logMetric("Offer Amount", args.amount, "wei");

  } catch (error) {
    logger.logEventError("OfferCreated", error as Error, { args });
    throw error;
  }
}

/**
 * Senior Developer Notes:
 *
 * Why this approach is superior:
 * 1. Single responsibility - only stores event
 * 2. No data duplication - event is source of truth
 * 3. Faster processing - no aggregate updates
 * 4. Simpler codebase - easier to maintain
 * 5. Real-time accuracy - stats always current
 * 6. Flexible queries - derive any offer metric
 *
 * Query Examples for Offer Analytics:
 *
 * // Get user's active offers
 * SELECT * FROM event
 * WHERE actor = $1
 *   AND eventType = 'offer_created'
 *   AND NOT EXISTS (
 *     SELECT 1 FROM event e2
 *     WHERE e2.eventType IN ('offer_accepted', 'offer_cancelled')
 *       AND JSON_EXTRACT(e2.data, '$.offerId') = JSON_EXTRACT(event.data, '$.offerId')
 *   )
 *
 * // Get collection offers
 * SELECT * FROM event
 * WHERE collection = $1
 *   AND eventType = 'offer_created'
 *   AND JSON_EXTRACT(data, '$.offerType') = 'Collection'
 *
 * // Get offers for specific token
 * SELECT * FROM event
 * WHERE collection = $1 AND tokenId = $2
 *   AND eventType = 'offer_created'
 *   AND JSON_EXTRACT(data, '$.offerType') = 'NFT'
 *
 * This eliminates the need for complex offer management tables
 * and provides complete audit trail of all offer activities.
 */