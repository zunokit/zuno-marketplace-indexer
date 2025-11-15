# CLAUDE.md

This file provides comprehensive guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Zuno Marketplace Indexer** is an enterprise-grade blockchain event indexer for the Zuno NFT Marketplace, built on [Ponder](https://ponder.sh). It tracks and indexes marketplace events across multiple EVM chains (Ethereum, Polygon, Base, Arbitrum, etc.) in real-time using a sophisticated Domain-Driven Design architecture with event-sourcing principles.

**Key Technologies:**

- **Ponder 0.14.3** - Blockchain indexing framework
- **TypeScript 5.3** with strict mode and noUncheckedIndexedAccess
- **PostgreSQL** (via PGlite embedded or external)
- **Hono 4.5** - High-performance HTTP server
- **Viem 2.21** - Ethereum interactions
- **Zod 4.1** - Runtime type validation

## Commands

### Development

```bash
pnpm dev                 # Start development server with hot reload
pnpm start              # Start production server
pnpm serve              # Serve built indexer
```

### Build & Configuration

```bash
pnpm generate-config    # Fetch ABIs from Zuno API and generate ponder.config.ts
pnpm codegen            # Generate TypeScript types from schema
pnpm build              # Full build (generate-config + codegen)
```

### Code Quality

```bash
pnpm typecheck          # TypeScript type checking
pnpm lint               # ESLint (ponder preset)
```

### Database

```bash
pnpm db                 # Database management commands (Ponder CLI)
```

## Architecture Overview

### Domain-Driven Design Structure

The codebase follows strict DDD principles with clear domain boundaries:

```
src/
├── domain/              # Core business logic organized by domain
│   ├── auction/        # Auction lifecycle (create, bid, settle, cancel)
│   ├── bundle/         # Bundle creation, purchase, dissolution
│   ├── collection/     # NFT collection creation & minting
│   ├── offer/          # Offer creation, acceptance, cancellation
│   └── trading/        # Marketplace listings & purchases
├── repositories/       # Data access layer (Repository pattern)
│   ├── event.repository.ts      # Event sourcing
│   └── account.repository.ts    # User activity cache
├── infrastructure/     # Cross-cutting concerns
│   ├── external/       # External API clients (Zuno API)
│   │   └── zuno-api/   # Singleton client with caching
│   ├── logging/        # Event logging (EventLogger singleton)
│   └── monitoring/     # Error handling, metrics, handler wrapping
│       ├── error-handler.ts    # ErrorHandler singleton
│       ├── metrics.ts          # MetricsService singleton
│       └── handler-wrapper.ts  # Automatic retry & metrics
├── shared/            # Shared types, utilities, helpers
│   ├── base/         # Base classes (BaseRepository)
│   ├── schemas/      # Zod validation schemas
│   ├── types/        # TypeScript type definitions
│   └── utils/        # Helper functions
├── api/               # REST API endpoints (Hono)
│   ├── index.ts      # API server with middleware
│   └── middleware.ts # CORS, logging, rate limiting, auth
├── config/           # Configuration management
└── index.ts          # Main entry - registers all domain handlers
```

### Architectural Patterns

#### 1. Event-First Architecture (v4.0)
**Philosophy**: Events are the single source of truth
- Store event → Update cache → Derive stats via queries
- 83% reduction in schema complexity (12 tables → 2 tables)
- No data duplication, always accurate

#### 2. Singleton Pattern
Used for all services to ensure single instances:
```typescript
ErrorHandler.getInstance()
MetricsService.getInstance()
EventLogger.getInstance()
ZunoApiClientService.getInstance()
ConfigBuilderService.getInstance()
```

#### 3. Repository Pattern
- **BaseRepository** - Abstract CRUD operations
- Returns `Result<T>` type (no exceptions)
- All repositories extend this base class

#### 4. Handler Wrapper Pattern
Every event handler is automatically wrapped with:
- Automatic retry logic (3 attempts, exponential backoff)
- Metrics collection (processing time, success/failure counts)
- Error handling (centralized error logging)
- Context tracking (block, transaction, contract info)

#### 5. Result Type Pattern
No throwing errors - all operations return `Result<T>`:
```typescript
interface Result<T> {
  success: boolean;
  data?: T;
  error?: Error;
}

// Usage
const result = await repo.createEvent(data);
if (!result.success) {
  console.error(result.error);
  return;
}
// Use result.data safely
```

### Event Handler Pattern

**Every domain handler follows this Event-First structure:**

1. **Handler Registration** (`src/domain/{domain}/index.ts`)
   - Uses `ponder.on()` to register event listeners
   - Wraps handlers with `wrapHandler()` for automatic error handling, retry logic, and metrics

2. **Handler Implementation** (`src/domain/{domain}/handlers/*.handler.ts`)
   - **Event-First Pattern**: Store event first, then update projections
   - Validates event data with Zod schemas
   - Uses EventRepository as single source of truth
   - Updates aggregate caches (account)

**Example handler structure (v4.0):**

```typescript
export async function handleEventName({
  event,
  context,
}: {
  event: any;
  context: any;
}) {
  const args = event.args as EventType;

  // 1. Initialize repositories
  const eventRepo = new EventRepository({
    db: context.db,
    network: context.network,
  });
  const accountRepo = new AccountRepository({
    db: context.db,
    network: context.network,
  });

  // 2. Prepare and validate event data with Zod
  const eventData: EventDataType = {
    /* transform args to event data */
  };
  const validatedData = validateEventData("event_type", eventData);

  // 3. Store event (source of truth) - ALWAYS FIRST
  const eventResult = await eventRepo.createEvent({
    eventType: "event_name",
    category: "category", // auction | offer | listing | trade | mint | collection
    actor: args.actor,
    counterparty: args.counterparty, // optional
    collection: args.collection,
    tokenId: args.tokenId?.toString(),
    data: validatedData, // JSONB - validated event-specific data
    contractName: "ContractName",
    event,
  });

  if (!eventResult.success) {
    console.error("Failed to store event:", eventResult.error);
    return;
  }

  // 4. Update aggregate caches (account activity)
  await accountRepo.getOrCreate(args.actor, event.block.timestamp);
  await accountRepo.updateActivity(args.actor, event.block.timestamp);

  // Update counterparty if exists
  if (args.counterparty) {
    await accountRepo.getOrCreate(args.counterparty, event.block.timestamp);
    await accountRepo.updateActivity(args.counterparty, event.block.timestamp);
  }
}
```

## Database Schema

### Schema v4.0 - Event-First Architecture

**Philosophy**: Events are the ONLY source of truth
- All data queried from events in real-time
- No projections, no duplicates
- 83% reduction in schema complexity
- Perfect for activity feeds and real-time data

### Core Tables (2 Tables Only)

#### 1. `event` table - Single Source of Truth

**Location**: `ponder.schema.ts`

All blockchain events indexed in one table with flexible JSONB data field.

```typescript
{
  id: string;                    // tx_hash:log_index
  eventType: string;             // "auction_created", "nft_purchased", etc.
  category: string;              // "auction" | "offer" | "trade" | "mint" | "collection"
  actor: Address;                // Primary participant
  counterparty?: Address;        // Secondary participant (optional)
  collection?: Address;          // NFT collection address (optional)
  tokenId?: string;              // Token ID (optional)
  data: JSONB;                   // Flexible event-specific data (validated with Zod)
  contractAddress: Address;      // Emitting contract
  contractName?: string;         // Human-readable name
  blockNumber: bigint;
  blockTimestamp: bigint;
  transactionHash: Hash;
  logIndex: number;
  chainId: number;
  processedAt: bigint;
  version: string;               // Schema version
}
```

**Event Categories & Types:**
- **Auction**: `auction_created`, `bid_placed`, `auction_settled`, `auction_cancelled`
- **Offer**: `offer_created`, `offer_accepted`, `offer_cancelled`
- **Listing**: `listing_created`, `listing_cancelled`, `listing_filled`
- **Trade**: `nft_purchased`, `bundle_purchased`
- **Mint**: `nft_minted`, `batch_minted`
- **Collection**: `collection_created`

**Comprehensive Indexes** (for optimal query performance):
- Single field: `eventType`, `category`, `actor`, `counterparty`, `collection`, `timestamp`, `txHash`, `chainId`
- Composite: `actor+timestamp`, `collection+timestamp`, `category+eventType`, `collection+tokenId`

#### 2. `account` table - User Activity Cache

Minimal user data for quick profile lookups. Detailed stats calculated from events on-demand.

```typescript
{
  address: Address;              // Primary key (normalized lowercase)
  firstSeenAt: Timestamp;
  lastActiveAt: Timestamp;
  eventCount: number;            // Total events participated in
}
```

### Event Data Validation

**Location**: `src/shared/schemas/event.schemas.ts`

All event data is validated at runtime using Zod schemas:

```typescript
// Define schema for each event type
export const AuctionCreatedDataSchema = z.object({
  auctionId: AddressSchema,
  auctionType: z.enum(["english", "dutch"]),
  startPrice: BigIntStringSchema,
  reservePrice: BigIntStringSchema.optional(),
  duration: z.number(),
  // ... more fields
});

// Schema registry
export const EVENT_SCHEMAS = {
  auction_created: AuctionCreatedDataSchema,
  bid_placed: BidPlacedDataSchema,
  offer_created: OfferCreatedDataSchema,
  // ... all event types
};

// Usage in handlers
const validatedData = validateEventData("auction_created", rawData);
```

### Query Patterns

```typescript
// Get active auctions
const activeAuctions = await db
  .select()
  .from(schema.event)
  .where(e => e.eventType === 'auction_created')
  .execute();
// Filter out settled/cancelled via subsequent queries

// User's trading volume
const trades = await db
  .select()
  .from(schema.event)
  .where(e => e.actor === userAddress && e.category === 'trade')
  .execute();
const totalVolume = trades.reduce((sum, t) =>
  sum + BigInt(t.data.price), 0n
);

// Recent activity feed
const recentActivity = await db
  .select()
  .from(schema.event)
  .orderBy(e => e.blockTimestamp, 'desc')
  .limit(50)
  .execute();

// Collection activity
const collectionEvents = await db
  .select()
  .from(schema.event)
  .where(e => e.collection === collectionAddress)
  .orderBy(e => e.blockTimestamp, 'desc')
  .execute();
```

## API Layer

### REST API

**Location**: `src/api/index.ts`

**Framework**: Hono (high-performance, middleware-based)

**Base URL**: `http://localhost:42069`

**Endpoints**:
```
GET  /                     # API info
GET  /api/events          # Query events (source of truth)
                          # Params: page, limit, eventType, category, collection, actor
GET  /api/activity        # Real-time activity feed
                          # Params: limit, collection
```

### Middleware Chain

**Location**: `src/api/middleware.ts`

Applied in order:
1. **CORS** - Configurable origins (`CORS_ORIGINS` env var)
2. **Request Logging** - Hono logger
3. **Rate Limiting** - Per-IP (configurable: `RATE_LIMIT_WINDOW`, `RATE_LIMIT_MAX_REQUESTS`)
4. **Optional Authentication** - Bearer token or API key

**Security Features**:
```bash
# Environment variables
BEARER_TOKEN=secret123        # Bearer token authentication
API_KEY=api_key_123          # API key authentication (header or query)
CORS_ORIGINS=http://localhost:3000,https://example.com
RATE_LIMIT_WINDOW=60000      # 60 seconds
RATE_LIMIT_MAX_REQUESTS=100  # 100 requests per window
```

### GraphQL API

**Built-in Ponder feature** - Auto-generated from schema
**Endpoint**: `http://localhost:42069/graphql`

Automatically provides queries for all tables with filtering, sorting, and pagination.

## Dynamic Configuration System

### Configuration Generator

**Location**: `scripts/generate-config.ts`

**Workflow**:
1. Validate environment variables (`ZUNO_API_URL`, `ZUNO_API_KEY`)
2. Fetch data from Zuno API:
   - Networks (chains)
   - Contracts (marketplace contracts)
   - ABIs (contract interfaces)
3. Filter active contracts by verified status
4. Build chain configs from env vars (`PONDER_RPC_URL_{CHAIN_ID}`)
5. Build contract configs (single-chain or multi-chain support)
6. Generate TypeScript config file with proper formatting
7. Display summary and next steps

**Key Features**:
- Automatic network detection from environment
- Multi-chain contract support
- Batch ABI fetching (10 concurrent requests)
- TypeScript code generation
- Comprehensive error handling

### Environment Variables

```bash
# Required
ZUNO_API_URL=https://zuno-marketplace-abis.vercel.app/api
ZUNO_API_KEY=your_api_key

# Optional - uses PGlite embedded if not set
DATABASE_URL=postgresql://user:password@localhost:5432/ponder

# RPC URLs - Format: PONDER_RPC_URL_{CHAIN_ID}
PONDER_RPC_URL_31337=http://127.0.0.1:8545  # Anvil local
PONDER_RPC_URL_1=https://...                # Ethereum
PONDER_RPC_URL_137=https://...              # Polygon
PONDER_RPC_URL_8453=https://...             # Base

# Optional: WebSocket URLs for faster syncing
PONDER_WS_URL_1=wss://...

# API Security (all optional)
BEARER_TOKEN=secret123
API_KEY=api_key_123
CORS_ORIGINS=http://localhost:3000
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX_REQUESTS=100
```

## Event Registration Pattern

**Contract identifiers follow this pattern:**

```
{contractName}_{networkSlug}:{EventName}
```

Examples:

```typescript
ponder.on("erc721collectionfactory_anvil:ERC721CollectionCreated", handler);
ponder.on("advancedlistingmanager_ethereum:ListingCreated", handler);
ponder.on("englishauctionmanager_polygon:AuctionCreated", handler);
```

**To add new event handlers:**

1. Create handler in `src/domain/{domain}/handlers/{event-name}.handler.ts`
2. Register in `src/domain/{domain}/index.ts`:
   ```typescript
   import { wrapHandler } from "@/infrastructure/monitoring/handler-wrapper";

   export function register{Domain}Handlers() {
     ponder.on(
       "contract_network:EventName",
       wrapHandler("EventName", handleEventName)
     );
   }
   ```
3. Import and call `register{Domain}Handlers()` in `src/index.ts`

## Infrastructure Services

### Zuno API Client

**Location**: `src/infrastructure/external/zuno-api/client.ts`

**Pattern**: Singleton with caching

```typescript
const client = ZunoApiClientService.getInstance();

// Methods
await client.getNetworks()              // Fetch all networks
await client.getAllContracts()          // Fetch all contracts
await client.getAbiById(abiId)         // Fetch single ABI
await client.getAbisByIds(abiIds)      // Batch fetch ABIs (10 concurrent)
```

**Features**:
- 5-minute cache TTL
- 30-second timeout
- Batch fetching with controlled concurrency
- Automatic retry logic

### Error Handler

**Location**: `src/infrastructure/monitoring/error-handler.ts`

**Pattern**: Singleton

```typescript
const errorHandler = ErrorHandler.getInstance();

const result = await errorHandler.executeWithRetry(
  async () => { /* operation */ },
  { maxRetries: 3, backoff: 'exponential' }
);
```

**Features**:
- Exponential backoff retry
- Dead letter queue for failed events
- Comprehensive error logging

### Metrics Service

**Location**: `src/infrastructure/monitoring/metrics.ts`

**Pattern**: Singleton

```typescript
const metrics = MetricsService.getInstance();

// Record metrics
metrics.recordCounter(MetricNames.EVENTS_PROCESSED);
metrics.recordGauge(MetricNames.CURRENT_BLOCK, blockNumber);
metrics.recordHistogram(MetricNames.EVENT_PROCESSING_TIME, duration);
```

**Predefined Metrics**:
- `EVENTS_PROCESSED` - Total events processed (counter)
- `EVENTS_FAILED` - Total events failed (counter)
- `EVENT_PROCESSING_TIME` - Processing duration (histogram)
- `CURRENT_BLOCK` - Current sync block (gauge)
- `DB_OPERATIONS` - Database operations (counter)

### Event Logger

**Location**: `src/infrastructure/logging/event-logger.ts`

**Pattern**: Singleton with structured logging

```typescript
const logger = EventLogger.getInstance();

// Logging methods
logger.logEventStart(eventName, address, block, tx);
logger.logEventSuccess(eventName, details);
logger.logEventError(eventName, error, context);
logger.logMetric(metricName, value, unit);
```

**Output formatting**:
- 🔍/→ for event start
- ✅/✓ for success
- ❌ for errors
- ⚠️ for warnings
- 📊 for metrics

## Common Patterns & Conventions

### 1. ID Generation Patterns

**Location**: `src/shared/utils/helpers.ts`

```typescript
// Transaction-scoped
generateEventLogId(txHash, logIndex)  // "0x123...:5"

// Chain-scoped
generateCollectionId(chainId, address)  // "1:0xabc..."

// Composite
generateTokenId(chainId, collection, tokenId)  // "1:0xabc...:123"
```

### 2. Address Normalization

**Convention**: All addresses stored lowercase

```typescript
import { normalizeAddress } from "@/shared/utils/helpers";

const addr = normalizeAddress("0xABC..."); // "0xabc..."
```

### 3. BigInt Serialization

**Pattern**: Convert BigInt to string for JSON

```typescript
import { serializeBigInts } from "@/shared/utils/helpers";

const response = serializeBigInts({
  price: 1000000000000000000n,  // Converts to "1000000000000000000"
  nested: { amount: 500n }       // Deep conversion
});
```

### 4. Type Safety

- **Strict TypeScript**: All code uses strict mode with `noUncheckedIndexedAccess`
- **Event Types**: Define event arg interfaces for each handler
  ```typescript
  interface ListingCreatedArgs {
    listingId: `0x${string}`;
    seller: `0x${string}`;
    collection: `0x${string}`;
    tokenId: bigint;
    price: bigint;
  }
  ```
- **Result Pattern**: Repositories return `Result<T>` instead of throwing
- **Zod Validation**: Runtime validation for all event data

### 5. Minting Events

**Important**: Minting events (`Minted`, `BatchMinted`) are emitted from **individual collection contracts**, not from factories. This requires dynamic contract registration.

**Current Approach** (manual):
```typescript
// After collection creation, manually add to ponder.config.ts
ponder.on(
  "YOUR_COLLECTION_ADDRESS:Minted",
  wrapHandler("Minted", handleNFTMinted)
);
```

**Recommended Approach** (dynamic):
Use Ponder's dynamic contract indexing to automatically track new collections as they're created.

## Ponder-Specific Concepts

1. **Schema Definition** (`ponder.schema.ts`):
   - Uses `onchainTable()` for all tables
   - Tables are immutable once created (can only add fields, not modify)
   - Migrations require database reset in development

2. **Context Object**:
   - `context.db` - Database client (Drizzle ORM)
   - `context.network` - Current network info (chainId, name)
   - `context.contracts` - Contract addresses and ABIs

3. **Event Object**:
   - `event.args` - Decoded event arguments (typed via ABI)
   - `event.block` - Block data (number, timestamp, hash)
   - `event.transaction` - Transaction data (hash, from, to, value)
   - `event.log` - Log data (address, logIndex, topics)

4. **GraphQL API**: Automatically generated from schema at `/graphql`

5. **Hot Reload**: In dev mode, changes to handlers trigger re-processing from last synced block

## Multi-Chain Support

The indexer automatically detects and indexes all configured chains based on environment variables. Each chain has:

- Unique chain ID (e.g., 1 for Ethereum, 137 for Polygon)
- Network name used in contract identifiers (e.g., `ethereum`, `polygon`, `anvil`)
- All entities include `chainId` field for filtering

**Chain-specific queries:**

```typescript
// Get events from specific chain
const polygonEvents = await db
  .select()
  .from(schema.event)
  .where(e => e.chainId === 137)
  .execute();
```

## Development Workflow

1. **Start local Anvil** (optional, for local testing):
   ```bash
   anvil --chain-id 31337
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your values
   ```

3. **Generate config from Zuno API**:
   ```bash
   pnpm generate-config
   ```

4. **Start indexer**:
   ```bash
   pnpm dev
   ```

5. **Test APIs**:
   - GraphQL: http://localhost:42069/graphql
   - REST: http://localhost:42069/api/events
   - Activity: http://localhost:42069/api/activity

6. **Type checking during development**:
   ```bash
   pnpm typecheck
   ```

## Troubleshooting

- **"Table not found" errors**: Run `pnpm build` to regenerate types after schema changes
- **Configuration issues**: Ensure `ZUNO_API_URL` and `ZUNO_API_KEY` are set, run `pnpm generate-config`
- **RPC errors**: Check `PONDER_RPC_URL_{CHAIN_ID}` environment variables
- **Handler errors**: Check metrics and error logs, failed events are stored for manual recovery
- **Type mismatches**: Ensure event arg interfaces match actual event signatures in contracts
- **Rate limiting**: Adjust `RATE_LIMIT_WINDOW` and `RATE_LIMIT_MAX_REQUESTS` env vars
- **Database connection**: If using external PostgreSQL, verify `DATABASE_URL` format

## Important Notes

### Security
- **Never commit `.env.local`** - Contains sensitive API keys and RPC URLs
- **Use authentication** - Set `BEARER_TOKEN` or `API_KEY` for production
- **Configure CORS** - Set `CORS_ORIGINS` for production deployments
- **Rate limiting** - Always enabled by default

### Schema
- **Schema is immutable in production** - Plan schema changes carefully
- **Event data is JSONB** - Flexible but validate with Zod schemas
- **All handlers are wrapped automatically** - Don't add your own try/catch unless necessary

### Best Practices
- **Use `normalizeAddress()`** for all addresses before storage
- **BigInt values** must be converted to strings: `amount.toString()`
- **Always validate event data** with Zod schemas before storage
- **Store event FIRST** - then update caches and projections
- **Use Result type** - Never throw errors from repositories
- **Follow ID patterns** - Use helper functions for consistent ID generation
- **Test with multiple chains** - Verify chainId filtering works correctly

## Testing

**Current Status**: No test files in codebase

**Recommendations for future testing**:
- Unit tests for repositories (mock database)
- Integration tests for event handlers (mock blockchain events)
- API endpoint tests (Hono test utilities)
- E2E tests with local Anvil chain

## Code Examples

### Complete Handler Example

```typescript
// src/domain/trading/handlers/listing-created.handler.ts
import { EventRepository } from "@/repositories/event.repository";
import { AccountRepository } from "@/repositories/account.repository";
import { validateEventData } from "@/shared/schemas/event.schemas";
import { normalizeAddress } from "@/shared/utils/helpers";

interface ListingCreatedArgs {
  listingId: `0x${string}`;
  seller: `0x${string}`;
  collection: `0x${string}`;
  tokenId: bigint;
  price: bigint;
  expiration: bigint;
}

export async function handleListingCreated({
  event,
  context,
}: {
  event: any;
  context: any;
}) {
  const args = event.args as ListingCreatedArgs;

  // Initialize repositories
  const eventRepo = new EventRepository({
    db: context.db,
    network: context.network,
  });
  const accountRepo = new AccountRepository({
    db: context.db,
    network: context.network,
  });

  // Prepare event data
  const eventData = {
    listingId: normalizeAddress(args.listingId),
    seller: normalizeAddress(args.seller),
    collection: normalizeAddress(args.collection),
    tokenId: args.tokenId.toString(),
    price: args.price.toString(),
    expiration: args.expiration.toString(),
  };

  // Validate with Zod
  const validatedData = validateEventData("listing_created", eventData);

  // Store event (source of truth)
  const eventResult = await eventRepo.createEvent({
    eventType: "listing_created",
    category: "listing",
    actor: normalizeAddress(args.seller),
    collection: normalizeAddress(args.collection),
    tokenId: args.tokenId.toString(),
    data: validatedData,
    contractName: "AdvancedListingManager",
    event,
  });

  if (!eventResult.success) {
    console.error("Failed to store listing event:", eventResult.error);
    return;
  }

  // Update account activity
  await accountRepo.getOrCreate(
    normalizeAddress(args.seller),
    event.block.timestamp
  );
  await accountRepo.updateActivity(
    normalizeAddress(args.seller),
    event.block.timestamp
  );
}
```

### Complete Handler Registration

```typescript
// src/domain/trading/index.ts
import { ponder } from "@/ponder";
import { wrapHandler } from "@/infrastructure/monitoring/handler-wrapper";
import { handleListingCreated } from "./handlers/listing-created.handler";
import { handleListingCancelled } from "./handlers/listing-cancelled.handler";
import { handleListingFilled } from "./handlers/listing-filled.handler";

export function registerTradingHandlers() {
  ponder.on(
    "advancedlistingmanager_ethereum:ListingCreated",
    wrapHandler("ListingCreated", handleListingCreated)
  );

  ponder.on(
    "advancedlistingmanager_ethereum:ListingCancelled",
    wrapHandler("ListingCancelled", handleListingCancelled)
  );

  ponder.on(
    "advancedlistingmanager_ethereum:ListingFilled",
    wrapHandler("ListingFilled", handleListingFilled)
  );
}
```

## Architecture Benefits

### Event-First Architecture
✅ **83% reduction** in schema complexity (12 tables → 2 tables)
✅ **No data duplication** - single source of truth
✅ **Real-time accuracy** - always up-to-date
✅ **Flexible queries** - filter by any dimension
✅ **Easier maintenance** - simple, clean, effective
✅ **Complete audit trail** - full history preserved
✅ **Schema flexibility** - add new event types without migrations

### Domain-Driven Design
✅ **Clear boundaries** - each domain is independent
✅ **Separation of concerns** - infrastructure separate from business logic
✅ **Testability** - isolated domain logic
✅ **Scalability** - easy to add new domains

### Type Safety & Validation
✅ **Compile-time safety** - TypeScript strict mode
✅ **Runtime validation** - Zod schemas
✅ **No silent failures** - Result type pattern
✅ **Database type safety** - Generated from schema

---

**Version**: 4.0.0 - Event-First Architecture with Domain-Driven Design
**Last Updated**: 2025-11-15
