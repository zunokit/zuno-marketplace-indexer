/**
 * Repository Index - Senior Refactor v4.0
 *
 * Simplified repositories - only Event and Account needed
 * All other data accessed via event queries
 *
 * @module repositories
 */

export { AccountRepository, type AccountEntity } from "./account.repository";
export {
  EventRepository,
  type EventEntity,
  type EventData,
  type EventCategory,
  type EventFilters,
} from "./event.repository";

// Re-export base repository for custom repositories
export {
  BaseRepository,
  type DatabaseContext,
  type BaseEntity,
} from "@/shared/base/base.repository";

/**
 * Senior Developer Notes:
 *
 * Only 2 repositories needed:
 * 1. EventRepository - Store all marketplace events
 * 2. AccountRepository - Basic user cache for performance
 *
 * All collection, token, and trade data accessed via event queries.
 * This ensures:
 * - Single source of truth
 * - Real-time accuracy
 * - No data duplication
 * - Simplified maintenance
 */
