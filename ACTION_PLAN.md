# QUICK ACTION PLAN - PRIORITY FIXES

## Critical Bugs (Fix IMMEDIATELY - Breaks Core Functionality)

### BUG #1: Historical Events Missed (startBlock: "latest")
**File:** /home/user/zuno-marketplace-indexer/ponder.config.ts (Line 32)
**Current:** `startBlock: "latest"`
**Fix:** Change to `startBlock: 0` or specific block number
**Impact:** Currently misses ALL historical WETH deposits
**Effort:** 1 minute change

```typescript
// BEFORE (WRONG)
weth9: {
  abi: weth9Abi,
  startBlock: "latest",  // ❌ BUG
  ...
}

// AFTER (CORRECT)
weth9: {
  abi: weth9Abi,
  startBlock: 0,  // ✅ Capture all historical events
  ...
}
```

### BUG #2: Incomplete Event Tracking (Withdrawal/Transfer Missing)
**File:** /home/user/zuno-marketplace-indexer/src/index.ts (Line 4-8)
**Current:** Only handles Deposit events
**Fix:** Add Withdrawal and Transfer handlers
**Impact:** Balance calculations are WRONG
**Effort:** 30 minutes to implement all handlers

**Add After Deposit Handler:**
```typescript
ponder.on("weth9:Withdrawal", async ({ event, context }) => {
  await context.db
    .insert(account)
    .values({ address: event.args.src, balance: -event.args.wad })
    .onConflictDoUpdate((row) => ({ balance: row.balance - event.args.wad }));
});

ponder.on("weth9:Transfer", async ({ event, context }) => {
  // Update sender (decrease balance)
  await context.db
    .insert(account)
    .values({ address: event.args.src, balance: -event.args.wad })
    .onConflictDoUpdate((row) => ({ balance: row.balance - event.args.wad }));

  // Update receiver (increase balance)
  await context.db
    .insert(account)
    .values({ address: event.args.dst, balance: event.args.wad })
    .onConflictDoUpdate((row) => ({ balance: row.balance + event.args.wad }));
});
```

---

## Security Issues (Fix BEFORE Production)

### SEC #1: No API Authentication
**File:** /home/user/zuno-marketplace-indexer/src/api/index.ts (Line 6-12)
**Current:** All endpoints public, no auth
**Fix:** Add authentication middleware
**Impact:** Anyone can scrape all data
**Effort:** 2-4 hours

```typescript
import { bearerAuth } from 'hono/bearer-auth';

const apiKeyMiddleware = bearerAuth({ token: process.env.API_KEY! });

app.use('/graphql', apiKeyMiddleware);
app.use('/sql/*', apiKeyMiddleware);
```

### SEC #2: No Rate Limiting
**File:** /home/user/zuno-marketplace-indexer/src/api/index.ts
**Current:** Endpoints can be hammered
**Fix:** Add rate limiting middleware
**Impact:** Vulnerable to DoS attacks
**Effort:** 2 hours

```typescript
import { RateLimiter } from 'hono-rate-limiter';

const rateLimiter = new RateLimiter({
  windowMs: 60 * 1000,  // 1 minute window
  max: 100,             // Max 100 requests per minute
});

app.use('*', rateLimiter);
```

### SEC #3: SQL Endpoint Injection Risk
**File:** /home/user/zuno-marketplace-indexer/src/api/index.ts (Line 8)
**Current:** Raw SQL queries allowed
**Fix:** Either remove endpoint or add strict validation
**Impact:** SQL injection vulnerability
**Effort:** Recommend removing entirely

```typescript
// Remove this line entirely
// app.use("/sql/*", client({ db, schema }));

// Use only GraphQL for public API
app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));
```

### SEC #4: No CORS Configuration
**File:** /home/user/zuno-marketplace-indexer/src/api/index.ts
**Current:** All origins allowed (default)
**Fix:** Add CORS middleware
**Impact:** Security and integration issues
**Effort:** 30 minutes

```typescript
import { cors } from 'hono/cors';

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  allowMethods: ['GET', 'POST'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));
```

---

## Observability Issues (Add ASAP)

### OBS #1: No Error Handling
**File:** /home/user/zuno-marketplace-indexer/src/index.ts (Line 4-8)
**Current:** No try-catch, failures are silent
**Fix:** Add error handling and logging
**Impact:** Cannot debug production issues
**Effort:** 1-2 hours

```typescript
import { logger } from './utils/logger';  // Create this

ponder.on("weth9:Deposit", async ({ event, context }) => {
  try {
    await context.db
      .insert(account)
      .values({ address: event.args.dst, balance: event.args.wad })
      .onConflictDoUpdate((row) => ({ balance: row.balance + event.args.wad }));
  } catch (error) {
    logger.error("Failed to process Deposit event", {
      error,
      address: event.args.dst,
      amount: event.args.wad,
    });
    // Implement retry logic or dead-letter queue
    throw error;
  }
});
```

### OBS #2: No Logging
**File:** Create /home/user/zuno-marketplace-indexer/src/utils/logger.ts
**Current:** No logging whatsoever
**Fix:** Add structured logging
**Impact:** No visibility into production
**Effort:** 2-3 hours

```typescript
// Create src/utils/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});
```

---

## Code Quality Issues (Fix Soon)

### QA #1: Missing Schema Fields
**File:** /home/user/zuno-marketplace-indexer/ponder.schema.ts (Line 3-6)
**Current:** No chainId, no timestamps
**Fix:** Add missing fields
**Impact:** Cross-chain confusion
**Effort:** 30 minutes

```typescript
// BEFORE
export const account = onchainTable("account", (t) => ({
  address: t.hex().primaryKey(),
  balance: t.bigint().notNull(),
}));

// AFTER
export const account = onchainTable("account", (t) => ({
  id: t.text().primaryKey(),  // Composite: address-chainId
  address: t.hex().notNull(),
  chainId: t.integer().notNull(),
  balance: t.bigint().notNull(),
  updatedAt: t.bigint().notNull(),
  createdAt: t.bigint().notNull(),
}), (table) => ({
  addressChainIdx: index().on(table.address, table.chainId),
  chainIdx: index().on(table.chainId),
}));
```

### QA #2: Environment Validation
**File:** Create /home/user/zuno-marketplace-indexer/src/utils/config.ts
**Current:** No env validation
**Fix:** Validate required env vars at startup
**Impact:** Silent failures from bad config
**Effort:** 1 hour

```typescript
// Create src/utils/config.ts
export function validateEnv() {
  const required = [
    'PONDER_RPC_URL_1',
    'PONDER_RPC_URL_10',
    'PONDER_RPC_URL_137',
    'PONDER_RPC_URL_8453',
  ];

  for (const env of required) {
    if (!process.env[env]) {
      throw new Error(`Missing required environment variable: ${env}`);
    }
  }
}
```

### QA #3: Missing Documentation
**Files to Create:**
1. /home/user/zuno-marketplace-indexer/README.md - Setup guide
2. /home/user/zuno-marketplace-indexer/API.md - API documentation
3. /home/user/zuno-marketplace-indexer/ARCHITECTURE.md - Architecture docs

**Effort:** 3-4 hours

---

## Production Deployment Checklist

### Pre-Deployment
- [ ] Fix critical bugs (#1, #2)
- [ ] Implement API authentication
- [ ] Add rate limiting
- [ ] Add error handling and logging
- [ ] Validate environment variables
- [ ] Write README.md
- [ ] Setup monitoring/alerting

### Deployment
- [ ] Use PostgreSQL (not SQLite)
- [ ] Configure backups
- [ ] Setup CI/CD pipeline
- [ ] Configure environment variables
- [ ] Setup logging aggregation

### Post-Deployment
- [ ] Monitor indexing lag
- [ ] Monitor API response times
- [ ] Track error rates
- [ ] Verify data accuracy (compare with blockchain)
- [ ] Performance testing

---

## Estimated Timeline to Production

**Critical Fixes (Week 1):**
- Fix startBlock bug: 15 minutes
- Add event handlers (Withdrawal, Transfer): 2 hours
- Add error handling: 1 hour
- Add basic logging: 2 hours
- TOTAL: 5.25 hours

**Security (Week 2):**
- Add API authentication: 3 hours
- Add rate limiting: 2 hours
- Fix CORS: 30 minutes
- Remove/secure SQL endpoint: 1 hour
- TOTAL: 6.5 hours

**Quality (Week 3):**
- Add schema fields: 1 hour
- Add env validation: 1 hour
- Write documentation: 4 hours
- Add tests: 4 hours
- TOTAL: 10 hours

**Deployment & Monitoring (Week 4):**
- Setup CI/CD: 4 hours
- Setup monitoring: 2 hours
- Performance testing: 3 hours
- TOTAL: 9 hours

**Total Effort: ~30 hours (~1 week with full team)**

---

## File Locations for Quick Reference

Configuration:
- /home/user/zuno-marketplace-indexer/ponder.config.ts
- /home/user/zuno-marketplace-indexer/ponder.schema.ts
- /home/user/zuno-marketplace-indexer/package.json

Event Handlers:
- /home/user/zuno-marketplace-indexer/src/index.ts

API:
- /home/user/zuno-marketplace-indexer/src/api/index.ts

Smart Contract ABI:
- /home/user/zuno-marketplace-indexer/abis/weth9Abi.ts

Configuration Files:
- /home/user/zuno-marketplace-indexer/.env.example
- /home/user/zuno-marketplace-indexer/tsconfig.json
- /home/user/zuno-marketplace-indexer/.eslintrc.json

