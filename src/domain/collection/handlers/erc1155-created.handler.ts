/**
 * ERC1155 Collection Created Handler
 * Handles ERC1155 collection creation events
 *
 * Event Flow (v3.0):
 * 1. Validate event data with Zod schema
 * 2. Store event in event table (source of truth)
 * 3. Create collection record (projection)
 * 4. Update account aggregate (projection)
 *
 * @module domain/collection/handlers/erc1155-created
 */

import type { ERC1155CollectionCreatedEvent } from "@/shared/types/events";
import { getEventLogger } from "@/infrastructure/logging/event-logger";
import { normalizeAddress } from "@/shared/utils/helpers";
import { AccountRepository, EventRepository } from "@/repositories";
import {
  validateEventData,
  type CollectionCreatedData,
} from "@/shared/schemas/event.schemas";

const logger = getEventLogger();

/**
 * Handle ERC1155 collection creation
 */
export async function handleERC1155Created({
  event,
  context,
}: {
  event: any;
  context: any;
}) {
  const args = event.args as ERC1155CollectionCreatedEvent;
  const contractAddress = event.log.address;

  logger.logEventStart(
    "ERC1155CollectionCreated",
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
    const eventData: CollectionCreatedData = {
      name: "ERC1155 Collection", // Default name for ERC1155
      symbol: "ERC1155",
      tokenType: "ERC1155",
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
      contractName: "ERC1155CollectionFactory",
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

    logger.logEventSuccess("ERC1155CollectionCreated", {
      collection: args.collectionAddress,
      creator: args.creator,
    });
  } catch (error) {
    logger.logEventError("ERC1155CollectionCreated", error as Error, { args });
    throw error;
  }
}
