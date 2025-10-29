/**
 * ERC721 Collection Created Handler
 */

import type { ERC721CollectionCreatedEvent } from "@/shared/types/events";
import { getEventLogger } from "@/infrastructure/logging/event-logger";
import { normalizeAddress } from "@/shared/utils/helpers";
import { AccountRepository, EventRepository } from "@/repositories";
import {
  validateEventData,
  type CollectionCreatedData,
} from "@/shared/schemas/event.schemas";

const logger = getEventLogger();

/**
 * Handle ERC721 collection creation
 */
export async function handleERC721Created({
  event,
  context,
}: {
  event: any;
  context: any;
}) {
  console.log("ERC721CollectionCreated", event);
  console.log("context", context);
  const args = event.args as ERC721CollectionCreatedEvent;
  const contractAddress = event.log.address;

  logger.logEventStart(
    "ERC721CollectionCreated",
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

    // Prepare event data - v4.0 event-first approach
    // Note: Event only has collectionAddress and creator
    const eventData: CollectionCreatedData = {
      name: "ERC721 Collection", // Default - could be fetched via RPC
      symbol: "ERC721", // Default - could be fetched via RPC
      tokenType: "ERC721",
      maxSupply: undefined,
    };

    // Validate with Zod schema
    const validatedData = validateEventData("collection_created", eventData);

    // Create event record (source of truth) - v4.0 event-first
    const eventResult = await eventRepo.createEvent({
      eventType: "collection_created",
      category: "collection",
      actor: args.creator,
      collection: args.collectionAddress,
      data: validatedData,
      contractName: "ERC721CollectionFactory",
      event,
    });

    if (!eventResult.success) {
      throw new Error(`Failed to create event: ${eventResult.error?.message}`);
    }

    // Update basic account cache only - v4.0 simplified
    await Promise.all([
      accountRepo.getOrCreate(args.creator, event.block.timestamp),
      accountRepo.incrementActivity(args.creator, event.block.timestamp),
    ]);

    logger.logEventSuccess("ERC721CollectionCreated", {
      collection: args.collectionAddress,
      creator: args.creator,
    });
  } catch (error) {
    logger.logEventError("ERC721CollectionCreated", error as Error, { args });
    throw error;
  }
}
