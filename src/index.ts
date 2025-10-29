/**
 * Zuno Marketplace Event Handlers Registry - Senior Refactor v4.0
 * Pure Event-Sourcing Architecture with Domain-Driven Design
 *
 * @version 4.0.0
 * @architecture Event-First + Domain-Driven Design
 * @schema Pure event sourcing - no projections
 * @author Senior Developer Refactor
 */

import { registerCollectionHandlers } from "@/domain/collection";
import { registerTradingHandlers } from "@/domain/trading";
import { registerAuctionHandlers } from "@/domain/auction";
import { registerOfferHandlers } from "@/domain/offer";

import { getEventLogger } from "@/infrastructure/logging/event-logger";
import { getMetrics } from "@/infrastructure/monitoring/metrics";
import { getErrorHandler } from "@/infrastructure/monitoring/error-handler";

const logger = getEventLogger();
const metrics = getMetrics();
const errorHandler = getErrorHandler();

// Register all domain event handlers
registerCollectionHandlers();
registerTradingHandlers();
registerAuctionHandlers();
registerOfferHandlers(); // New offer domain handlers

// ============================================================================
// Development Monitoring
// ============================================================================

// Print metrics report every 5 minutes (development only)
if (process.env.NODE_ENV !== "production") {
  setInterval(() => {
    metrics.printReport();

    const failedCount = errorHandler.getFailedEventsCount();
    if (failedCount > 0) {
      console.log(`⚠️  WARNING: ${failedCount} events failed and need retry`);
    }
  }, 5 * 60 * 1000);
}
