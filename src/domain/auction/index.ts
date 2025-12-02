/**
 * Auction Domain
 * Handles NFT auction events
 */

import { ponder } from "ponder:registry";
import { wrapHandler } from "@/infrastructure/monitoring/handler-wrapper";
import { handleAuctionCreated } from "./handlers/auction-created.handler";
import { handleAuctionSettled } from "./handlers/auction-settled.handler";
import { handleBidPlaced } from "./handlers/bid-placed.handler";

/**
 * Register all auction event handlers
 */
export function registerAuctionHandlers() {
  // ============================================================================
  // AdvancedListingManager Auction Events
  // ============================================================================
  ponder.on(
    "advancedlistingmanager_anvil:AuctionCreated",
    wrapHandler("AuctionCreated", handleAuctionCreated)
  );

  // ============================================================================
  // AuctionFactory Events
  // ============================================================================
  ponder.on(
    "auctionfactory_anvil:AuctionCreatedViaFactory",
    wrapHandler("AuctionCreatedViaFactory", handleAuctionCreated)
  );

  // ============================================================================
  // English Auction Implementation Events
  // ============================================================================
  ponder.on(
    "englishauctionimplementation_anvil:AuctionCreated",
    wrapHandler("EnglishAuctionCreated", handleAuctionCreated)
  );

  ponder.on(
    "englishauctionimplementation_anvil:BidPlaced",
    wrapHandler("BidPlaced", handleBidPlaced)
  );

  ponder.on(
    "englishauctionimplementation_anvil:AuctionSettled",
    wrapHandler("AuctionSettled", handleAuctionSettled)
  );

  ponder.on(
    "englishauctionimplementation_anvil:AuctionCancelled",
    wrapHandler("AuctionCancelled", handleAuctionSettled)
  );

  // ============================================================================
  // Dutch Auction Implementation Events
  // ============================================================================
  ponder.on(
    "dutchauctionimplementation_anvil:AuctionCreated",
    wrapHandler("DutchAuctionCreated", handleAuctionCreated)
  );

  ponder.on(
    "dutchauctionimplementation_anvil:DutchAuctionPurchase",
    wrapHandler("DutchAuctionPurchase", handleAuctionSettled)
  );

  ponder.on(
    "dutchauctionimplementation_anvil:AuctionSettled",
    wrapHandler("DutchAuctionSettled", handleAuctionSettled)
  );

  ponder.on(
    "dutchauctionimplementation_anvil:AuctionCancelled",
    wrapHandler("DutchAuctionCancelled", handleAuctionSettled)
  );
}
