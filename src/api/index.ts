/**
 * Zuno Marketplace Indexer API - Event-First v3.0
 *
 * Event-based API - all data derived from events
 * Real-time queries with proper event filtering
 *
 * Security Features:
 * - Bearer token or API key authentication
 * - Rate limiting per IP
 * - Configurable CORS origins
 *
 * @version 3.0.0
 */

import { db } from "ponder:api";
import schema from "ponder:schema";
import { eq, and, desc } from "ponder";
import { Hono } from "hono";
import { logger } from "hono/logger";
import {
  corsMiddleware,
  rateLimitMiddleware,
  optionalAuthMiddleware,
} from "./middleware";
import { serializeBigInts } from "@/shared/utils/helpers";

const app = new Hono();

// ============================================================================
// Global Middleware
// ============================================================================

// CORS with configurable origins from env
app.use("*", corsMiddleware());

// Request logging
app.use("*", logger());

// Rate limiting
app.use("*", rateLimitMiddleware());

// Optional authentication (only if API_KEY or BEARER_TOKEN is set)
app.use("*", optionalAuthMiddleware());


// ============================================================================
// Health & Info Routes
// ============================================================================

app.get("/", (c) => {
  return c.json({
    name: "Zuno Marketplace Indexer",
    version: "3.0.0 - Event-First Architecture",
    description: "Event-first indexer for Zuno NFT Marketplace",
    architecture: "Event Sourcing with real-time queries",
    schema: "Events + Accounts (2 core tables)",
    endpoints: {
      graphql: "/graphql",
      rest: {
        events: "/api/events (source of truth - all data via event queries)",
        activity: "/api/activity (real-time feed)",
      },
    },
  });
});

// ============================================================================
// REST API Routes - Event-First Implementation
// ============================================================================

/**
 * Get events - source of truth with filtering
 * This is the primary endpoint for all marketplace data
 */
app.get("/api/events", async (c) => {
  try {
    const page = parseInt(c.req.query("page") || "1");
    const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);
    const offset = (page - 1) * limit;
    const eventType = c.req.query("eventType");
    const category = c.req.query("category");
    const collection = c.req.query("collection");
    const actor = c.req.query("actor");

    // Build WHERE conditions for database-level filtering
    const conditions = [];
    if (eventType) {
      conditions.push(eq(schema.event.eventType, eventType));
    }
    if (category) {
      conditions.push(eq(schema.event.category, category));
    }
    if (collection) {
      conditions.push(eq(schema.event.collection, collection.toLowerCase() as `0x${string}`));
    }
    if (actor) {
      conditions.push(eq(schema.event.actor, actor.toLowerCase() as `0x${string}`));
    }

    // Query with proper drizzle operators
    const baseQuery = db.select().from(schema.event);
    const filteredQuery = conditions.length > 0 
      ? baseQuery.where(and(...conditions))
      : baseQuery;
    
    const events = await filteredQuery
      .orderBy(desc(schema.event.blockTimestamp))
      .limit(limit)
      .offset(offset);

    return c.json(serializeBigInts({
      success: true,
      data: events,
      pagination: { page, limit },
      note: "All marketplace data can be queried by filtering events. Use eventType, category, collection, or actor parameters to get specific data.",
    }));
  } catch (error) {
    console.error('Events API error:', error);
    return c.json({ error: "Failed to fetch events" }, 500);
  }
});

/**
 * Get real-time activity feed
 * Latest marketplace activity across all domains
 */
app.get("/api/activity", async (c) => {
  try {
    const limit = Math.min(parseInt(c.req.query("limit") || "50"), 100);
    const collection = c.req.query("collection");

    const baseQuery = db.select().from(schema.event);
    const filteredQuery = collection 
      ? baseQuery.where(eq(schema.event.collection, collection.toLowerCase() as `0x${string}`))
      : baseQuery;

    const activities = await filteredQuery
      .orderBy(desc(schema.event.blockTimestamp))
      .limit(limit);

    return c.json(serializeBigInts({
      success: true,
      data: activities,
    }));
  } catch (error) {
    console.error('Activity API error:', error);
    return c.json({ error: "Failed to fetch activity" }, 500);
  }
});

// ============================================================================
// GraphQL Integration
// ============================================================================

// GraphQL endpoint
app.get("/graphql", (c) => {
  return c.text("GraphQL endpoint available at /graphql (POST)");
});

// ============================================================================
// Export
// ============================================================================

export default app;
