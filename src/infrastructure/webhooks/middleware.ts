/**
 * Webhook Middleware for Event Handlers
 * Wraps event handlers to trigger webhooks after successful event processing
 */

import { webhookClient, type WebhookPayload } from './client';
import { webhookConfig } from './config';
import { getEventLogger } from '../logging/event-logger';

const logger = getEventLogger();

/**
 * Event handler type from Ponder
 */
type EventHandler = (params: { event: any; context: any }) => Promise<void>;

/**
 * Event name mapping for webhook events
 */
const EVENT_NAME_MAP: Record<string, string> = {
  ERC721CollectionCreated: 'collection_created',
  ERC1155CollectionCreated: 'collection_created',
  NFTMinted: 'nft_minted',
  BatchMinted: 'batch_minted',
  NFTListed: 'nft_listed',
  NFTBought: 'nft_bought',
  ListingCancelled: 'listing_cancelled',
  AuctionCreated: 'auction_created',
  BidPlaced: 'bid_placed',
  AuctionSettled: 'auction_settled',
  OfferMade: 'offer_made',
  OfferAccepted: 'offer_accepted',
  OfferCancelled: 'offer_cancelled',
};

/**
 * Map event name to webhook event name
 */
function mapEventName(eventName: string): string {
  return EVENT_NAME_MAP[eventName] || eventName.toLowerCase();
}

/**
 * Wrap event handler with webhook trigger
 */
export function withWebhookTrigger(
  eventName: string,
  handler: EventHandler
): EventHandler {
  return async ({ event, context }) => {
    // Execute original handler first
    await handler({ event, context });

    // After successful event storage, trigger webhook
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
            },
          };

          // Send webhook (fire and forget)
          webhookClient
            .sendWebhook(payload)
            .then((result) => {
              if (result.success) {
                logger.debug(`Webhook delivered for ${webhookEventName}`, {
                  attempts: result.attempts,
                  statusCode: result.statusCode,
                });
              } else {
                logger.error(
                  `Webhook failed for ${webhookEventName} after ${result.attempts} attempts`,
                  {
                    error: result.error,
                  }
                );
              }
            })
            .catch((error) => {
              logger.error(`Webhook error for ${webhookEventName}`, {
                error: error.message,
              });
            });
        } catch (error) {
          // Don't let webhook errors break event processing
          logger.error(`Error triggering webhook for ${webhookEventName}`, {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }
  };
}

/**
 * Apply webhook middleware to multiple handlers
 */
export function applyWebhookMiddleware(
  handlers: Record<string, EventHandler>
): Record<string, EventHandler> {
  const wrappedHandlers: Record<string, EventHandler> = {};

  for (const [eventName, handler] of Object.entries(handlers)) {
    wrappedHandlers[eventName] = withWebhookTrigger(eventName, handler);
  }

  return wrappedHandlers;
}
