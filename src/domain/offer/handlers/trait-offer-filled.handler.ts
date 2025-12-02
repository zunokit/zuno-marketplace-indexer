/**
 * Trait Offer Filled Handler
 *
 * Handles trait-based offer fill events in the Zuno NFT Marketplace.
 * Trait offers allow users to make offers on NFTs with specific traits.
 *
 * Event Structure:
 * - offerId: bytes32 - Unique offer identifier
 * - seller: address - NFT owner who filled the offer
 * - tokenId: uint256 - Token ID used to fill the offer
 * - amount: uint256 - Offer amount paid
 * - offerType: uint8 - Type of offer (trait offer)
 */

import { getEventLogger } from "@/infrastructure/logging/event-logger";
import { EventRepository, AccountRepository } from "@/repositories";
import {
  validateEventData,
  type TraitOfferFilledData,
} from "@/shared/schemas/event.schemas";

const logger = getEventLogger();

interface TraitOfferFilledEventArgs {
  offerId: `0x${string}`;
  seller: `0x${string}`;
  tokenId: bigint;
  amount: bigint;
  offerType: number;
}

/**
 * Handle Trait Offer Filled Event
 *
 * When a trait-based offer is filled by an NFT owner.
 * The seller provides an NFT matching the required traits.
 */
export async function handleTraitOfferFilled({
  event,
  context,
}: {
  event: any;
  context: any;
}) {
  const args = event.args as TraitOfferFilledEventArgs;
  const contractAddress = event.log.address;

  logger.logEventStart(
    "TraitOfferFilled",
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

    const eventData: TraitOfferFilledData = {
      offerId: args.offerId,
      seller: args.seller,
      tokenId: args.tokenId.toString(),
      amount: args.amount.toString(),
      offerType: args.offerType,
    };

    const validatedData = validateEventData("trait_offer_filled", eventData);

    const eventResult = await eventRepo.createEvent({
      eventType: "trait_offer_filled",
      category: "offer",
      actor: args.seller,
      collection: undefined, // Collection not in event args
      tokenId: args.tokenId.toString(),
      data: validatedData,
      contractName: "OfferManager",
      event,
    });

    if (!eventResult.success) {
      throw new Error(`Failed to create event: ${eventResult.error?.message}`);
    }

    await Promise.all([
      accountRepo.getOrCreate(args.seller, event.block.timestamp),
      accountRepo.incrementActivity(args.seller, event.block.timestamp),
    ]);

    logger.logEventSuccess("TraitOfferFilled", {
      offerId: args.offerId,
      seller: args.seller,
      tokenId: args.tokenId.toString(),
      amount: args.amount.toString(),
    });
  } catch (error) {
    logger.logEventError("TraitOfferFilled", error as Error, { args });
    throw error;
  }
}
