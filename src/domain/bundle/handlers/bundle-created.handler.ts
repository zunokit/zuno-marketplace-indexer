/**
 * Bundle Created Handler - Senior Implementation v4.0
 *
 * Handles bundle creation events in the Zuno Bundle Manager.
 * Event-sourcing approach - stores event only, no projections.
 *
 * Event Structure:
 * bundleId: bytes32 - Unique bundle identifier
 * creator: address - Bundle creator address
 * bundleType: string - Type of bundle
 * bundleSize: number - Number of tokens in bundle
 * tokenIds: address[] - Array of token identifiers
 * totalPrice: uint256 - Total bundle price (sum of all token prices)
 * metadata: object - Bundle metadata (name, description, image, etc.)
 *
 * When a bundle is created:
 * 1. Bundle is marked as available for purchase
 * 2. All tokens remain in user's wallet
 * 3. Bundle can be purchased as a single unit
 * 4. Bundle can be dissolved if needed
 */

import type { BundleCreatedEvent } from "@/shared/types/events";
import { getEventLogger } from "@/infrastructure/logging/event-logger";
import { EventRepository, AccountRepository } from "@/repositories";
import {
  validateEventData,
  type BundleCreatedData,
} from "@/shared/schemas/event.schemas";

const logger = getEventLogger();

/**
 * Handle Bundle Creation - Senior Event-First Approach
 *
 * When a bundle is created, users can bundle multiple NFTs for batch operations.
 * This enables batch operations while maintaining complete audit trail.
 *
 * Bundle states:
 * - **Created** → Available for purchase
 * **Purchased** → NFTs transferred
 * **Dissolved** → Bundle returned to creator

 * Query Examples:
 *
 * Get active bundles for a user:
 * SELECT * FROM event
 * WHERE eventType = 'bundle_created'
 *   AND JSON_EXTRACT(data, '$.creator') = '$1'
 *   AND NOT EXISTS (
 *     SELECT 1 FROM event e2
 *     WHERE e2.eventType IN ('bundle_purchased', 'bundle_dissolved', 'bundle_cancelled')
 *       AND JSON_EXTRACT(e2.data, '$.bundleId') = JSON_EXTRACT(event.data, '$.bundleId')
 *   )
 * ORDER BY blockTimestamp DESC;
 *
 * Get bundle composition:
 * SELECT data->>'tokenIds' as tokenIds,
 *   data->'bundleSize' as tokenCount
 * FROM event
 * WHERE eventType = 'bundle_created'
 *   AND JSON_EXTRACT(data, '$.bundleId') = '$1'
 *   AND JSON_EXTRACT(data->'bundleType') = 'nft' OR JSON_EXTRACT(data, 'bundleType') = 'erc1155'
 *   ORDER BY JSON_EXTRACT(data->bundleSize') DESC
   LIMIT 10;
 *
 * This eliminates the need for complex bundle management tables
 * and provides complete audit trail of all bundle activities.
 */