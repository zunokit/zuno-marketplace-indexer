/**
 * API Middleware
 * Security and rate limiting middleware for Hono API
 */

import type { Context, Next } from "hono";
import { cors } from "hono/cors";

// ============================================================================
// Environment Configuration
// ============================================================================

const API_KEY = process.env.API_KEY || "";
const BEARER_TOKEN = process.env.BEARER_TOKEN || "";
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(",").map(o => o.trim()) || ["*"];
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW || "60000"); // 1 minute
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100");

// ============================================================================
// Rate Limiting
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

/**
 * Rate Limiting Middleware
 * Limits requests per IP address
 */
export function rateLimitMiddleware() {
  return async (c: Context, next: Next) => {
    const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
    const now = Date.now();

    const entry = rateLimitStore.get(ip);

    if (entry && now < entry.resetTime) {
      if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
        return c.json({
          error: "Rate limit exceeded",
          message: `Too many requests. Try again in ${Math.ceil((entry.resetTime - now) / 1000)} seconds`,
          limit: RATE_LIMIT_MAX_REQUESTS,
          window: RATE_LIMIT_WINDOW,
        }, 429);
      }
      entry.count++;
    } else {
      rateLimitStore.set(ip, {
        count: 1,
        resetTime: now + RATE_LIMIT_WINDOW,
      });
    }

    await next();
  };
}

// ============================================================================
// Authentication Middleware
// ============================================================================

/**
 * Authentication Middleware
 * Supports both Bearer token and API key authentication
 *
 * Usage:
 * - Bearer Token: Authorization: Bearer YOUR_TOKEN
 * - API Key: X-API-Key: YOUR_KEY or api_key query parameter
 */
export function authMiddleware() {
  return async (c: Context, next: Next) => {
    // If no auth configured, skip authentication
    if (!API_KEY && !BEARER_TOKEN) {
      await next();
      return;
    }

    // Check Bearer Token
    const authHeader = c.req.header("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      if (BEARER_TOKEN && token === BEARER_TOKEN) {
        await next();
        return;
      }
    }

    // Check API Key in header
    const apiKeyHeader = c.req.header("x-api-key");
    if (apiKeyHeader && API_KEY && apiKeyHeader === API_KEY) {
      await next();
      return;
    }

    // Check API Key in query parameter
    const apiKeyQuery = c.req.query("api_key");
    if (apiKeyQuery && API_KEY && apiKeyQuery === API_KEY) {
      await next();
      return;
    }

    // Authentication failed
    return c.json({
      error: "Unauthorized",
      message: "Valid authentication required. Provide Bearer token or API key.",
    }, 401);
  };
}

// ============================================================================
// CORS Middleware
// ============================================================================

/**
 * CORS Middleware with configurable origins
 */
export function corsMiddleware() {
  return cors({
    origin: CORS_ORIGINS,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-API-Key"],
    exposeHeaders: ["Content-Length", "X-Request-Id"],
    maxAge: 86400, // 24 hours
    credentials: true,
  });
}

/**
 * Public routes that don't require authentication
 */
export const PUBLIC_ROUTES = [
  "/",
  "/graphql",
];

/**
 * Check if a route is public
 */
export function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some(route => path === route || path.startsWith(route));
}

/**
 * Optional authentication middleware
 * Only enforces auth if API_KEY or BEARER_TOKEN is set
 */
export function optionalAuthMiddleware() {
  return async (c: Context, next: Next) => {
    const path = c.req.path;

    // Skip auth for public routes
    if (isPublicRoute(path)) {
      await next();
      return;
    }

    // If no auth configured, allow all requests
    if (!API_KEY && !BEARER_TOKEN) {
      await next();
      return;
    }

    // Otherwise, require authentication
    return authMiddleware()(c, next);
  };
}
