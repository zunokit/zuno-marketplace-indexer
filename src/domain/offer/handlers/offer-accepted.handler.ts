/**
 * Offer Accepted Handler - Senior Implementation v4.0
 *
 * Handles offer acceptance events in the Zuno NFT Marketplace.
 * Event-sourcing approach - stores event only, no projections.
 *
 * Event Structure:
 * - offerId: bytes32 - Unique offer identifier
 * - offerer: address - User who created the offer
 * acceptor: address - User who accepted the offer
 * collection: address - NFT collection address
 * tokenId: uint256 - Token ID (0 for collection offers)
 * amount: uint256 - Offer amount accepted
 *
 * When an offer is accepted, it represents a completed transaction:
 * - Offer creator receives payment
 * NFT/token transfer occurs
 * Offer status changes from 'active' to 'completed'
 */

import type { OfferAcceptedEvent } from "@/shared/types/events";
import { getEventLogger } from "@/infrastructure/logging/event-logger";
import { EventRepository, AccountRepository } from "@/repositories";
import {
  validateEventData,
  type OfferAcceptedData,
} from "@/shared/schemas/event.schemas";

const logger = getEventLogger();

/**
 * Handle Offer Acceptance - Senior Event-First Approach
 *
 * When an offer is accepted, we have a completed marketplace transaction.
 * This represents the final state change from offer to NFT ownership transfer.
 */
export async function handleOfferAccepted({
  event,
  context,
}: {
  event: any;
  context: any;
}) {
  const args = event.args as OfferAcceptedEvent;
  const contractAddress = event.log.address;

  logger.logEventStart(
    "OfferAccepted",
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

    // Prepare event data - Note: event has 'accepter' not 'acceptor'
    const eventData: OfferAcceptedData = {
      offerId: args.offerId,
      accepter: args.accepter,
      collection: args.collection,
      tokenId: args.tokenId?.toString() || "0",
      amount: args.amount.toString(),
    };

    // Validate with Zod schema
    const validatedData = validateEventData("offer_accepted", eventData);

    // Create event record (ONLY source of truth)
    const eventResult = await eventRepo.createEvent({
      eventType: "offer_accepted",
      category: "offer",
      actor: args.accepter, // Primary actor = offer accepter
      counterparty: undefined, // We don't have offerer in this event
      collection: args.collection,
      tokenId: args.tokenId?.toString() || "0",
      data: validatedData,
      contractName: "OfferManager",
      event,
    });

    if (!eventResult.success) {
      throw new Error(`Failed to create event: ${eventResult.error?.message}`);
    }

    // Update basic account cache for accepter
    await Promise.all([
      accountRepo.getOrCreate(args.accepter, event.block.timestamp),
      accountRepo.incrementActivity(args.accepter, event.block.timestamp),
    ]);

    logger.logEventSuccess("OfferAccepted", {
      offerId: args.offerId,
      accepter: args.accepter,
      collection: args.collection,
      tokenId: args.tokenId?.toString() || "0",
      amount: args.amount.toString(),
    });
    logger.logMetric("Offer Amount", args.amount, "wei");

  } catch (error) {
    logger.logEventError("OfferAccepted", error as Error, { args });
    throw error;
  }
}

/**
 * Senior Developer Notes:
 *
 * Business Logic Impact:
 * When offer is accepted:
 * 1. Offer is marked as completed (via events, not state)
 * 2. Payment flows from acceptor to offerer
 * 3. NFT ownership transfers from offerer to acceptor
 * 4. Offer marketplace stats updated via queries
 *
 * Query Examples:
 *
 * // Get all completed offers for a collection
 * SELECT * FROM event
 * WHERE collection = $1
 *   AND eventType = 'offer_accepted'
 * ORDER BY blockTimestamp DESC;
 *
 * // Get user's completed offers as acceptor
 * SELECT * FROM event
 * WHERE counterparty = $1
 *   AND eventType = 'offer_accepted'
 * ORDER BY blockTimestamp DESC;
 *
 * // Get user's completed offers as offerer
 * SELECT * FROM event
 * WHERE actor = $1
 *   AND eventType = 'offer_accepted'
 * ORDER BY blockTimestamp DESC;
 *
 * // Check if offer is still active (no accept/cancel events)
 * SELECT * FROM event
 * WHERE eventType = 'offer_created'
 *   AND JSON_EXTRACT(data, '$.offerId') = '$1'
 *   AND NOT EXISTS (
 *   SELECT 1 FROM event e2
 *   WHERE e2.eventType IN ('offer_accepted', 'offer_cancelled')
 *     AND JSON_EXTRACT(e2.data, '$.offerId') = JSON_EXTRACT(event.data, '$.offerId')
 * )
 *
 * This approach eliminates the need for complex offer management tables
 * and provides complete audit trail of all offer activities.
 */