/**
 * Offer Expired Handler
 *
 * Handles offer expiration events in the Zuno NFT Marketplace.
 * Event-sourcing approach - stores event only, no projections.
 *
 * Event Structure:
 * - offerId: bytes32 - Unique offer identifier
 * - offerer: address - User who created the expired offer
 */

import { getEventLogger } from "@/infrastructure/logging/event-logger";
import { EventRepository, AccountRepository } from "@/repositories";
import {
  validateEventData,
  type OfferExpiredData,
} from "@/shared/schemas/event.schemas";

const logger = getEventLogger();

interface OfferExpiredEventArgs {
  offerId: `0x${string}`;
  offerer: `0x${string}`;
}

/**
 * Handle Offer Expired Event
 *
 * When an offer expires naturally (reaches expiration time without being accepted).
 * Different from cancellation - this is automatic, not user-initiated.
 */
export async function handleOfferExpired({
  event,
  context,
}: {
  event: any;
  context: any;
}) {
  const args = event.args as OfferExpiredEventArgs;
  const contractAddress = event.log.address;

  logger.logEventStart(
    "OfferExpired",
    contractAddress,
    event.block.number,
    event.transaction.hash
  );

  try {
    const eventRepo = new EventRepository({
      db: context.db,
      network: context.network,
    });
    const accountRepo = new AccountRepository({
      db: context.db,
      network: context.network,
    });

    const eventData: OfferExpiredData = {
      offerId: args.offerId,
      offerer: args.offerer,
    };

    const validatedData = validateEventData("offer_expired", eventData);

    const eventResult = await eventRepo.createEvent({
      eventType: "offer_expired",
      category: "offer",
      actor: args.offerer,
      collection: undefined,
      tokenId: undefined,
      data: validatedData,
      contractName: "OfferManager",
      event,
    });

    if (!eventResult.success) {
      throw new Error(`Failed to create event: ${eventResult.error?.message}`);
    }

    await Promise.all([
      accountRepo.getOrCreate(args.offerer, event.block.timestamp),
      accountRepo.incrementActivity(args.offerer, event.block.timestamp),
    ]);

    logger.logEventSuccess("OfferExpired", {
      offerId: args.offerId,
      offerer: args.offerer,
    });
  } catch (error) {
    logger.logEventError("OfferExpired", error as Error, { args });
    throw error;
  }
}
