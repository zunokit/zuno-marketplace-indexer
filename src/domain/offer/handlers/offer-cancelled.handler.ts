/**
 * Offer Cancelled Handler - Senior Implementation v4.0
 *
 * Handles offer cancellation events in the Zuno NFT Marketplace.
 * Event-sourcing approach - stores event only, no projections.
 *
 * Event Structure:
 * - offerId: bytes32 - Unique offer identifier
 * offerer: address - User who cancelled the offer
 * reason: string - Cancellation reason
 * timestamp: uint256 - Cancellation timestamp
 *
 * When offer is cancelled:
 * 1. Offer marked as cancelled via events (no state table updates)
 * 2. User can no longer accept the cancelled offer
 * 3. Other bids on the same NFT remain active (if any)
 * 4. Offer marketplace stats updated via queries
 *
 * Reason codes might include:
 * - "User cancelled" - User cancelled their offer
 * - "Expired" - Offer expired naturally
 * - "Admin cancelled" - Admin cancelled offer
 * - "Invalidated" - Offer cancelled due to invalid parameters
 */

import type { OfferCancelledEvent } from "@/shared/types/events";
import { getEventLogger } from "@/infrastructure/logging/event-logger";
import { EventRepository, AccountRepository } from "@/repositories";
import {
  validateEventData,
  type OfferCancelledData,
} from "@/shared/schemas/event.schemas";

const logger = getEventLogger();

/**
 * Handle Offer Cancellation - Senior Event-First Approach
 *
 * When an offer is cancelled, we remove it from active consideration.
 * The offer status is determined via event filtering.
 *
 * This is a completion event - when offer is cancelled, it's permanently cancelled.
 */
export async function handleOfferCancelled({
  event,
  context,
}: {
  event: any;
  context: any;
}) {
  const args = event.args as OfferCancelledEvent;
  const contractAddress = event.log.address;

  logger.logEventStart(
    "OfferCancelled",
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

    // Prepare event data
    const eventData: OfferCancelledData = {
      offerId: args.offerId,
      offerer: args.offerer,
      reason: args.reason,
    };

    // Validate with Zod schema
    const validatedData = validateEventData("offer_cancelled", eventData);

    // Create event record (source of truth)
    const eventResult = await eventRepo.createEvent({
      eventType: "offer_cancelled",
      category: "offer",
      actor: args.offerer, // Primary actor = offer creator
      collection: undefined, // Not applicable for offer cancellation
      tokenId: undefined, // Not applicable for offer cancellation
      data: validatedData,
      contractName: "OfferManager",
      event,
    });

    if (!eventResult.success) {
      throw new Error(`Failed to create event: ${eventResult.error?.message}`);
    }

    // Update offerer account cache
    await Promise.all([
      accountRepo.getOrCreate(args.offerer, event.block.timestamp),
      accountRepo.incrementActivity(args.offerer, event.block.timestamp),
    ]);

    logger.logEventSuccess("OfferCancelled", {
      offerId: args.offerId,
      offerer: args.offerer,
      reason: args.reason || "Unknown",
    });

  } catch (error) {
    logger.logEventError("OfferCancelled", error as Error, { args });
    throw error;
  }
}

/**
 * Senior Developer Notes:
 *
 * Query Examples for Cancelled Offers:
 *
 * Get user's cancelled offers:
 * SELECT * FROM event
 * WHERE eventType = 'offer_cancelled'
 *   AND actor = $1
 * ORDER BY blockTimestamp DESC;
 *
 * Get still-active offers for a collection:
 * SELECT * FROM event
 * WHERE collection = $1
 *   AND eventType IN ('offer_created', 'offer_accepted', 'offer_cancelled', 'offer_expired')
 *   AND NOT EXISTS (
 *     SELECT 1 FROM event e2
 *     WHERE e2.eventType IN ('offer_accepted', 'offer_cancelled')
 *       AND JSON_EXTRACT(e2.data, '$.offerId') = JSON_EXTRACT(event.data, '$.offerId')
 *   )
 * ORDER BY blockTimestamp DESC;
 *
 * Get cancellation reasons:
 * SELECT reason, COUNT(*) as count
 * FROM event
 * WHERE eventType = 'offer_cancelled'
 * GROUP BY reason
 * ORDER BY count DESC;
 *
 * This eliminates the need for complex offer management tables
 * and provides complete audit trail of all offer activities.
 */