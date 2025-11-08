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
 */

import { ponder } from "ponder:registry";
import { wrapHandler } from "@/infrastructure/monitoring/handler-wrapper";
import { handleOfferCreated } from "./handlers/offer-created.handler";

/**
 * Register all offer event handlers
 */
export function registerOfferHandlers() {
  // ============================================================================
  // Offer Events - OfferManager Contract
  // ============================================================================

  // Offer Created - User creates an offer
  // Contract: offermanager_anvil (0x959922be3caee4b8cd9a407cc3ac1c251c2007b1)
  ponder.on(
    "offermanager_anvil:OfferCreated",
    wrapHandler("OfferCreated", handleOfferCreated)
  );

  // TODO: Add more offer event handlers when needed
  // ponder.on(
  //   "offermanager_anvil:OfferAccepted",
  //   wrapHandler("OfferAccepted", handleOfferAccepted)
  // );

  // ponder.on(
  //   "offermanager_anvil:OfferCancelled",
  //   wrapHandler("OfferCancelled", handleOfferCancelled)
  // );

  // ponder.on(
  //   "offermanager_anvil:OfferExpired",
  //   wrapHandler("OfferExpired", handleOfferExpired)
  // );
}