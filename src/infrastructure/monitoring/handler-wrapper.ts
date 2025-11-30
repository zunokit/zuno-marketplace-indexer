/**
 * Handler Wrapper
 * Wraps event handlers with error handling, retry logic, metrics, and webhooks
 */

import type { ErrorContext } from "@/infrastructure/monitoring/error-handler";
import { getErrorHandler } from "@/infrastructure/monitoring/error-handler";
import { getEventLogger } from "@/infrastructure/logging/event-logger";
import { getFileLogger } from "@/infrastructure/logging/file-logger";
import { getMetrics, MetricNames } from "@/infrastructure/monitoring/metrics";
import { webhookClient, type WebhookPayload } from "@/infrastructure/webhooks/client";
import { webhookConfig } from "@/infrastructure/webhooks/config";

const errorHandler = getErrorHandler();
const logger = getEventLogger();
const fileLogger = getFileLogger();
const metrics = getMetrics();

/**
 * Event name mapping for webhook events
 */
const EVENT_NAME_MAP: Record<string, string> = {
  ERC721CollectionCreated: 'collection.created',
  ERC1155CollectionCreated: 'collection.created',
  NFTMinted: 'collection.minted',
  BatchMinted: 'collection.batch_minted',
  NFTListed: 'nft.listed',
  NFTBought: 'nft.bought',
  ListingCancelled: 'listing.cancelled',
  AuctionCreated: 'auction.created',
  BidPlaced: 'bid.placed',
  AuctionSettled: 'auction.settled',
  OfferMade: 'offer.made',
  OfferAccepted: 'offer.accepted',
  OfferCancelled: 'offer.cancelled',
};

/**
 * Map event name to webhook event name
 */
function mapEventName(eventName: string): string {
  return EVENT_NAME_MAP[eventName] || eventName.toLowerCase();
}

export type EventHandler<TEvent = any, TContext = any> = (args: {
  event: TEvent;
  context: TContext;
}) => Promise<void>;

/**
 * Wrap handler with error handling, retry logic, and metrics
 */
export function wrapHandler<TEvent = any, TContext = any>(
  eventName: string,
  handler: EventHandler<TEvent, TContext>
): EventHandler<TEvent, TContext> {
  return async ({ event, context }: { event: any; context: any }) => {
    const startTime = Date.now();
    const blockNumber = event.block.number;
    const transactionHash = event.transaction.hash;

    // Log raw event to file
    fileLogger.logRawEvent(eventName, event, context);

    // Build error context
    const errorContext: ErrorContext = {
      eventName,
      blockNumber,
      transactionHash,
      attempt: 1,
      contractAddress: event.log.address,
      logIndex: event.log.logIndex,
    };

    try {
      fileLogger.logEvent(eventName, "START", {
        blockNumber: blockNumber?.toString(),
        txHash: transactionHash,
        args: event.args,
      });

      // Execute handler with retry logic
      const result = await errorHandler.withRetry(
        () => handler({ event, context }),
        errorContext,
        {
          maxRetries: 3,
          retryDelayMs: 1000,
          backoffMultiplier: 2,
        }
      );

      const processingTime = Date.now() - startTime;

      if (result.success) {
        // Log success to file
        fileLogger.logEvent(eventName, "SUCCESS", {
          processingTime: `${processingTime}ms`,
          blockNumber: blockNumber?.toString(),
        });

        // Record success metrics
        metrics.increment(MetricNames.EVENTS_PROCESSED);
        metrics.histogram(MetricNames.EVENT_PROCESSING_TIME, processingTime);
        metrics.gauge(MetricNames.CURRENT_BLOCK, Number(blockNumber));

        logger.logMetric(`${eventName} Processing Time`, processingTime, "ms");

        // Trigger webhook after successful event processing
        if (webhookConfig.enabled) {
          const webhookEventName = mapEventName(eventName);

          if (webhookClient.shouldTriggerWebhook(webhookEventName)) {
            try {
              const payload: WebhookPayload = {
                event: webhookEventName,
                chainId: context.network.chainId,
                timestamp: event.block.timestamp,
                data: {
                  ...event.args,
                  blockNumber: event.block.number,
                  txHash: event.transaction.hash,
                  logIndex: event.log.logIndex,
                  contractAddress: event.log.address,
                },
              };

              // Send webhook (fire and forget)
              webhookClient
                .sendWebhook(payload)
                .then((webhookResult) => {
                  if (webhookResult.success) {
                    logger.logInfo("Webhook", `Delivered for ${webhookEventName}`, {
                      attempts: webhookResult.attempts,
                      statusCode: webhookResult.statusCode,
                    });
                  } else {
                    logger.logEventError(
                      "Webhook",
                      new Error(`Failed for ${webhookEventName} after ${webhookResult.attempts} attempts`),
                      { error: webhookResult.error }
                    );
                  }
                })
                .catch((err) => {
                  logger.logEventError("Webhook", err instanceof Error ? err : new Error(String(err)), {
                    event: webhookEventName,
                  });
                });
            } catch (error) {
              // Don't let webhook errors break event processing
              logger.logEventError(
                "Webhook",
                error instanceof Error ? error : new Error('Unknown error'),
                { event: webhookEventName }
              );
            }
          }
        }
      } else {
        // Log error to file
        fileLogger.logError(eventName, result.error, errorContext);

        // Record failure metrics
        metrics.increment(MetricNames.EVENTS_FAILED);
        metrics.gauge(
          `${eventName}.failed_count`,
          metrics.getCounter(MetricNames.EVENTS_FAILED)
        );

        logger.logEventError(eventName, result.error, errorContext);
      }
    } catch (error) {
      // Unexpected error (shouldn't happen with error handler, but just in case)
      const processingTime = Date.now() - startTime;

      // Log error to file
      fileLogger.logError(eventName, error as Error, errorContext);

      metrics.increment(MetricNames.EVENTS_FAILED);
      logger.logEventError(eventName, error as Error, errorContext);

      // Log to event log repository for debugging
      console.error(
        `[HandlerWrapper] Unexpected error in ${eventName}:`,
        error
      );
    }
  };
}

/**
 * Batch wrap multiple handlers
 */
export function wrapHandlers<T extends Record<string, EventHandler>>(
  handlers: T
): T {
  const wrapped: any = {};

  for (const [name, handler] of Object.entries(handlers)) {
    wrapped[name] = wrapHandler(name, handler);
  }

  return wrapped;
}

/**
 * Create monitored handler (simpler version without retry)
 */
export function monitoredHandler<TEvent = any, TContext = any>(
  eventName: string,
  handler: EventHandler<TEvent, TContext>
): EventHandler<TEvent, TContext> {
  return async ({ event, context }: { event: any; context: any }) => {
    const startTime = Date.now();

    try {
      await handler({ event, context });

      const processingTime = Date.now() - startTime;
      metrics.increment(MetricNames.EVENTS_PROCESSED);
      metrics.histogram(MetricNames.EVENT_PROCESSING_TIME, processingTime);
    } catch (error) {
      const processingTime = Date.now() - startTime;
      metrics.increment(MetricNames.EVENTS_FAILED);

      logger.logEventError(eventName, error as Error, {
        eventName,
        blockNumber: event.block.number,
        transactionHash: event.transaction.hash,
        attempt: 1,
        processingTime,
      });

      throw error; // Re-throw to let Ponder handle it
    }
  };
}
