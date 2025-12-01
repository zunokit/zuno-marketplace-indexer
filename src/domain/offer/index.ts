/**
 * Offer Domain
 *
 * Handles offer-related events in the Zuno NFT Marketplace.
 * Supports NFT offers, collection offers, and trait-based offers.
 *
 * Event Types:
 * - offer_created: User creates an offer for NFT/collection
 * - offer_accepted: Offer is accepted by collection owner
 * - offer_cancelled: Offer is cancelled by offerer
 * - offer_expired: Offer expires naturally
 * - collection_offer_filled: Collection offer was fulfilled
 * - trait_offer_filled: Trait-based offer was fulfilled
 */

import { ponder } from "ponder:registry";
import { wrapHandler } from "@/infrastructure/monitoring/handler-wrapper";
import { handleOfferCreated } from "./handlers/offer-created.handler";
import { handleOfferAccepted } from "./handlers/offer-accepted.handler";
import { handleOfferCancelled } from "./handlers/offer-cancelled.handler";
import { handleOfferExpired } from "./handlers/offer-expired.handler";
import { handleCollectionOfferFilled } from "./handlers/collection-offer-filled.handler";
import { handleTraitOfferFilled } from "./handlers/trait-offer-filled.handler";

/**
 * Register all offer event handlers
 */
export function registerOfferHandlers() {
  // ============================================================================
  // Offer Events - OfferManager Contract
  // ============================================================================

  // Offer Created - User creates an offer
  ponder.on(
    "offermanager_anvil:OfferCreated",
    wrapHandler("OfferCreated", handleOfferCreated)
  );

  // Offer Accepted - Offer is accepted by owner
  ponder.on(
    "offermanager_anvil:OfferAccepted",
    wrapHandler("OfferAccepted", handleOfferAccepted)
  );

  // Offer Cancelled - Offer is cancelled by offerer
  ponder.on(
    "offermanager_anvil:OfferCancelled",
    wrapHandler("OfferCancelled", handleOfferCancelled)
  );

  // Offer Expired - Offer expired naturally (dedicated handler)
  ponder.on(
    "offermanager_anvil:OfferExpired",
    wrapHandler("OfferExpired", handleOfferExpired)
  );

  // Collection Offer Filled - Collection offer was fulfilled (dedicated handler)
  ponder.on(
    "offermanager_anvil:CollectionOfferFilled",
    wrapHandler("CollectionOfferFilled", handleCollectionOfferFilled)
  );

  // Trait Offer Filled - Trait-based offer was fulfilled (dedicated handler)
  ponder.on(
    "offermanager_anvil:TraitOfferFilled",
    wrapHandler("TraitOfferFilled", handleTraitOfferFilled)
  );
}