/**
 * NFT Minted Handler
 * Handles single NFT minting events from collections
 */

import { getEventLogger } from "@/infrastructure/logging/event-logger";
import { normalizeAddress } from "@/shared/utils/helpers";
import {
  AccountRepository,
  EventRepository,
} from "@/repositories";
import {
  validateEventData,
  type NFTMintedData,
} from "@/shared/schemas/event.schemas";

const logger = getEventLogger();

/**
 * Minted event structure
 */
interface MintedEvent {
  to: `0x${string}`;
  tokenId: bigint;
  amount: bigint;
}

/**
 * Handle NFT minting event
 */
export async function handleNFTMinted({
  event,
  context,
}: {
  event: any;
  context: any;
}) {
  const args = event.args as MintedEvent;
  const contractAddress = event.log.address;

  logger.logEventStart(
    "Minted",
    contractAddress,
    event.block.number,
    event.transaction.hash
  );

  try {
    // Initialize repositories - v4.0 simplified
    const accountRepo = new AccountRepository({
      db: context.db,
      network: context.network,
    });
    const eventRepo = new EventRepository({
      db: context.db,
      network: context.network,
    });

    // Prepare event data
    const eventData: NFTMintedData = {
      tokenId: args.tokenId.toString(),
      recipient: args.to,
      amount: Number(args.amount),
    };

    // Validate with Zod schema
    const validatedData = validateEventData("nft_minted", eventData);

    // Create event record (source of truth) - v4.0 event-first approach
    const eventResult = await eventRepo.createEvent({
      eventType: "nft_minted",
      category: "mint",
      actor: args.to,
      collection: contractAddress,
      tokenId: args.tokenId.toString(),
      data: validatedData,
      contractName: "NFTCollection",
      event,
    });

    if (!eventResult.success) {
      throw new Error(`Failed to create event: ${eventResult.error?.message}`);
    }

    // Update basic account cache only - v4.0 simplified
    await Promise.all([
      accountRepo.getOrCreate(args.to, event.block.timestamp),
      accountRepo.incrementActivity(args.to, event.block.timestamp),
    ]);

    logger.logEventSuccess("Minted", {
      collection: contractAddress,
      tokenId: args.tokenId.toString(),
      to: args.to,
      amount: args.amount.toString(),
    });
  } catch (error) {
    logger.logEventError("Minted", error as Error, { args });
    throw error;
  }
}
