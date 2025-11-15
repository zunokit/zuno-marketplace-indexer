# CLAUDE.md - AI Assistant Guide for Zuno Marketplace Indexer

## Project Overview

This is a **Ponder-based blockchain indexer** for tracking WETH9 (Wrapped Ethereum) contract events across multiple EVM-compatible chains. The project indexes deposit, withdrawal, and transfer events from WETH9 contracts and provides GraphQL and SQL APIs for querying the indexed data.

### Purpose
- Index WETH9 contract events across Ethereum mainnet, Base, Optimism, and Polygon
- Track account balances and update them based on blockchain events
- Provide real-time and historical data access via GraphQL and SQL endpoints

### Key Technologies
- **Ponder v0.14.3**: Blockchain indexing framework
- **Hono v4.5.0**: Web framework for API routing
- **Viem v2.21.3**: TypeScript Ethereum library for ABI handling
- **TypeScript 5.3.2**: Type-safe development
- **Database**: PostgreSQL (production) or SQLite (development)
- **Node.js**: >=18.14 required

---

## Directory Structure

```
zuno-marketplace-indexer/
├── abis/                      # Contract ABIs
│   └── weth9Abi.ts           # WETH9 contract ABI definition
├── src/
│   ├── index.ts              # Event handlers (indexing logic)
│   └── api/
│       └── index.ts          # API endpoints (GraphQL + SQL client)
├── ponder.config.ts          # Chain and contract configuration
├── ponder.schema.ts          # Database schema definitions
├── ponder-env.d.ts           # Ponder type definitions
├── tsconfig.json             # TypeScript configuration
├── .eslintrc.json            # ESLint configuration (extends ponder)
├── .env.example              # Environment variable template
├── .gitignore                # Git ignore rules
├── package.json              # Dependencies and scripts
└── pnpm-lock.yaml            # Locked dependencies
```

### Generated Directories (Git Ignored)
- `/generated/` - Auto-generated types and code from Ponder
- `/.ponder/` - Ponder runtime cache and database files

---

## Core Architecture

### 1. Configuration Layer (`ponder.config.ts`)

**Location**: `ponder.config.ts`

**Purpose**: Defines chains, RPC endpoints, and contracts to index.

**Key Patterns**:
- Multi-chain support with chain-specific RPC URLs from environment variables
- Contract addresses vary per chain
- `ordering: "multichain"` enables indexing across multiple chains
- `startBlock: "latest"` begins indexing from the current block (adjust for historical indexing)

**Environment Variables Required**:
```bash
PONDER_RPC_URL_1      # Ethereum Mainnet
PONDER_RPC_URL_10     # Optimism
PONDER_RPC_URL_137    # Polygon
PONDER_RPC_URL_8453   # Base
DATABASE_URL          # Optional: Postgres connection string
```

### 2. Schema Layer (`ponder.schema.ts`)

**Location**: `ponder.schema.ts`

**Purpose**: Defines database tables using Ponder's `onchainTable` API.

**Current Schema**:
```typescript
export const account = onchainTable("account", (t) => ({
  address: t.hex().primaryKey(),
  balance: t.bigint().notNull(),
}));
```

**Key Patterns**:
- Use `onchainTable` for blockchain-related data
- Primary keys typically use `.primaryKey()`
- Use `t.hex()` for Ethereum addresses
- Use `t.bigint()` for token amounts (avoids precision loss)
- Add `.notNull()` for required fields

**When Adding New Tables**:
1. Export table definitions from `ponder.schema.ts`
2. Import them in `src/index.ts` for use in event handlers
3. Run `pnpm codegen` to generate TypeScript types
4. Tables are automatically created/migrated by Ponder

### 3. Indexing Layer (`src/index.ts`)

**Location**: `src/index.ts`

**Purpose**: Contains event handlers that process blockchain events and update the database.

**Current Implementation**:
```typescript
ponder.on("weth9:Deposit", async ({ event, context }) => {
  await context.db
    .insert(account)
    .values({ address: event.args.dst, balance: event.args.wad })
    .onConflictDoUpdate((row) => ({ balance: row.balance + event.args.wad }));
});
```

**Key Patterns**:

1. **Event Handler Naming**: `"contractName:EventName"`
   - Contract name from `ponder.config.ts`
   - Event name from ABI

2. **Context Object**:
   - `event.args`: Event parameters (typed from ABI)
   - `event.log`: Raw log data (address, blockNumber, etc.)
   - `event.block`: Block information
   - `event.transaction`: Transaction details
   - `context.db`: Database query builder
   - `context.network`: Current network info

3. **Database Operations**:
   - `.insert()`: Create new records
   - `.update()`: Modify existing records
   - `.delete()`: Remove records
   - `.onConflictDoUpdate()`: Upsert pattern for handling duplicates
   - All operations return promises (use `await`)

4. **BigInt Handling**:
   - Event args with `uint256` types are `bigint` in TypeScript
   - Perform arithmetic directly: `row.balance + event.args.wad`
   - No need for BigNumber libraries

**When Adding New Event Handlers**:
1. Add ABI to `/abis/` directory (export as `const` with `as const` assertion)
2. Import ABI in `ponder.config.ts`
3. Add contract configuration with chain addresses
4. Create event handler in `src/index.ts`
5. Update schema if new tables are needed
6. Run `pnpm codegen` to regenerate types

### 4. API Layer (`src/api/index.ts`)

**Location**: `src/api/index.ts`

**Purpose**: Exposes indexed data via GraphQL and SQL client endpoints using Hono.

**Current Implementation**:
```typescript
const app = new Hono();

app.use("/sql/*", client({ db, schema }));     // SQL client UI
app.use("/", graphql({ db, schema }));         // GraphQL endpoint
app.use("/graphql", graphql({ db, schema }));  // Alternative GraphQL path

export default app;
```

**Endpoints**:
- `GET /` - GraphQL playground
- `POST /graphql` - GraphQL queries
- `GET /sql/*` - SQL client interface (for direct database queries)

**When Extending the API**:
1. Import Hono and create route handlers
2. Use `context.db` for custom database queries
3. Return JSON responses
4. Example custom endpoint:
   ```typescript
   app.get("/accounts/:address", async (c) => {
     const address = c.req.param("address");
     const account = await c.db.select().from(schema.account).where(...);
     return c.json(account);
   });
   ```

---

## Development Workflows

### Package Manager
**ALWAYS use `pnpm`** - not npm or yarn. The lockfile is `pnpm-lock.yaml`.

### Common Commands

```bash
# Development (auto-reload on changes)
pnpm dev

# Production start
pnpm start

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Code generation (run after schema/config changes)
pnpm codegen

# Database operations
pnpm db         # Ponder database CLI
```

### Development Workflow

1. **Start Development Server**:
   ```bash
   pnpm dev
   ```
   - Starts Ponder indexer
   - Watches for file changes
   - Serves API at `http://localhost:42069`

2. **After Schema Changes**:
   ```bash
   pnpm codegen
   ```
   - Regenerates TypeScript types
   - Updates `/generated/` directory
   - Restart dev server to apply changes

3. **Before Committing**:
   ```bash
   pnpm typecheck  # Check for type errors
   pnpm lint       # Check for linting issues
   ```

### Environment Setup

1. **Copy environment template**:
   ```bash
   cp .env.example .env.local
   ```

2. **Configure RPC URLs**:
   - Get API keys from Alchemy, Infura, or other providers
   - Fill in `PONDER_RPC_URL_*` variables
   - Optionally set `DATABASE_URL` for PostgreSQL

3. **Database Choice**:
   - **SQLite** (default): No `DATABASE_URL` needed, file-based DB
   - **PostgreSQL** (production): Set `DATABASE_URL=postgresql://user:pass@host:port/db`

---

## Code Conventions

### TypeScript

1. **Strict Mode**: Project uses `strict: true` in tsconfig
   - All types must be explicit or inferable
   - No implicit `any` types

2. **Module System**: ESNext modules with bundler resolution
   - Use `import`/`export` (not `require`)
   - File extensions omitted in imports

3. **Ponder Imports**:
   - `ponder:registry` - Core Ponder functions
   - `ponder:schema` - Database schema exports
   - `ponder:api` - API utilities

### File Naming

- **Lowercase with extensions**: `weth9Abi.ts`, `index.ts`
- **ABIs**: Descriptive name + `Abi.ts` suffix
- **No barrel exports**: Direct imports preferred

### ABI Conventions

```typescript
// Export as const with as const assertion for type inference
export const contractNameAbi = [
  // ... ABI definition
] as const;
```

### Event Handler Conventions

```typescript
// Pattern: ponder.on("contract:Event", async ({ event, context }) => { ... })
ponder.on("weth9:Deposit", async ({ event, context }) => {
  // 1. Destructure what you need
  const { dst, wad } = event.args;

  // 2. Database operation with proper error handling
  await context.db
    .insert(account)
    .values({ address: dst, balance: wad })
    .onConflictDoUpdate((row) => ({
      balance: row.balance + wad
    }));
});
```

### Database Conventions

1. **Table Naming**: Lowercase, singular (e.g., `account`, not `accounts`)
2. **Primary Keys**: Use `.primaryKey()` method
3. **Address Fields**: Use `t.hex()` type
4. **Amount Fields**: Use `t.bigint()` for token amounts
5. **Required Fields**: Add `.notNull()`
6. **Indexes**: Add for frequently queried fields (Ponder handles this)

---

## Common Tasks for AI Assistants

### Adding a New Contract to Index

1. **Obtain the Contract ABI**:
   - Export as TypeScript constant in `/abis/newContractAbi.ts`
   - Use `as const` assertion

2. **Update `ponder.config.ts`**:
   ```typescript
   import { newContractAbi } from "./abis/newContractAbi";

   export default createConfig({
     // ... existing config
     contracts: {
       // ... existing contracts
       newContract: {
         abi: newContractAbi,
         startBlock: 12345678,  // Choose appropriate start block
         chain: {
           mainnet: { address: "0x..." },
           // Add other chains as needed
         },
       },
     },
   });
   ```

3. **Update Schema** (if new tables needed):
   ```typescript
   // ponder.schema.ts
   export const newTable = onchainTable("newTable", (t) => ({
     id: t.text().primaryKey(),
     // ... other fields
   }));
   ```

4. **Add Event Handlers**:
   ```typescript
   // src/index.ts
   import { newTable } from "ponder:schema";

   ponder.on("newContract:EventName", async ({ event, context }) => {
     // Handle event
   });
   ```

5. **Regenerate Types**:
   ```bash
   pnpm codegen
   ```

### Adding a New API Endpoint

```typescript
// src/api/index.ts
app.get("/custom-endpoint", async (c) => {
  const data = await db.select().from(schema.account);
  return c.json(data);
});
```

### Debugging Event Handlers

1. **Use `console.log`** - Ponder captures console output:
   ```typescript
   ponder.on("weth9:Deposit", async ({ event, context }) => {
     console.log("Deposit event:", event.args);
   });
   ```

2. **Check Event Data**:
   - `event.args` - Parsed event parameters
   - `event.log.blockNumber` - Block number
   - `event.transaction.hash` - Transaction hash

3. **Database Debugging**:
   - Access SQLite file in `/.ponder/sqlite/`
   - Use SQL client at `/sql/*` endpoint during development

### Updating Dependencies

```bash
# Check for outdated packages
pnpm outdated

# Update specific package
pnpm update ponder

# Update all packages
pnpm update
```

### Handling Migration from SQLite to PostgreSQL

1. **Set `DATABASE_URL`** in environment
2. **Restart Ponder** - it will auto-create tables
3. **Re-index** - Ponder will re-process events into new database

---

## Testing Guidelines

Currently, this project does not have a test suite. When adding tests:

1. **Use Ponder's Testing Utilities** (when available)
2. **Test Event Handlers**:
   - Mock event data
   - Verify database state changes
   - Test edge cases (zero amounts, duplicate events)

3. **Test API Endpoints**:
   - Use Hono's testing utilities
   - Verify response formats
   - Test error handling

---

## Performance Considerations

### Indexing Performance

1. **RPC Endpoints**:
   - Use premium RPC providers (Alchemy, Infura)
   - WebSocket endpoints (`PONDER_WS_URL_*`) are faster than HTTP
   - Rate limits can slow indexing

2. **Start Block Selection**:
   - `"latest"` - Only index new events (fastest)
   - Specific block number - Index historical data (slower)
   - Consider chain-specific start blocks

3. **Database Choice**:
   - **SQLite**: Fast for development, single file
   - **PostgreSQL**: Better for production, concurrent queries

### Query Performance

1. **GraphQL Queries**:
   - Automatically optimized by Ponder
   - Avoid deeply nested queries

2. **Database Indexes**:
   - Ponder auto-indexes primary keys
   - Add custom indexes for frequently queried fields

---

## Security Considerations

### RPC Keys
- **Never commit** `.env` files with RPC keys
- Use `.env.local` for local development
- Use environment variables in production

### Database Access
- SQL client endpoint (`/sql/*`) should be **disabled in production**
- Consider authentication for GraphQL endpoint in production

### Smart Contract Addresses
- **Verify** contract addresses in `ponder.config.ts`
- Double-check chain IDs match intended networks

---

## Deployment

### Environment Variables
Ensure all required variables are set:
- `PONDER_RPC_URL_*` for each chain
- `DATABASE_URL` for PostgreSQL (production)
- Optional: `PORT` for custom API port

### Production Checklist
1. Use PostgreSQL, not SQLite
2. Set appropriate `startBlock` values (avoid re-indexing entire chain)
3. Disable SQL client endpoint
4. Use production RPC endpoints with high rate limits
5. Run `pnpm typecheck` and `pnpm lint` before deploying
6. Monitor indexer logs for errors

### Starting in Production
```bash
pnpm start
```

---

## Common Issues and Solutions

### Issue: "Cannot find module 'ponder:schema'"
**Solution**: Run `pnpm codegen` to generate types.

### Issue: RPC rate limits exceeded
**Solution**:
- Upgrade RPC provider plan
- Reduce number of chains indexed simultaneously
- Use WebSocket endpoints

### Issue: Database schema out of sync
**Solution**:
- Delete `/.ponder/` directory
- Restart indexer (will re-index from `startBlock`)

### Issue: Event not being indexed
**Check**:
1. Event name matches ABI exactly (case-sensitive)
2. Contract address is correct for the chain
3. Start block is before the event occurred
4. RPC endpoint is responding

---

## Additional Resources

- **Ponder Docs**: https://ponder.sh/docs
- **Hono Docs**: https://hono.dev/
- **Viem Docs**: https://viem.sh/

---

## AI Assistant Best Practices

1. **Always run `pnpm codegen`** after modifying schemas or config
2. **Use `pnpm typecheck`** before suggesting code changes
3. **Preserve existing patterns** (naming, structure, conventions)
4. **Test locally** with `pnpm dev` when possible
5. **Never commit** environment files or generated directories
6. **Follow BigInt conventions** - no external BigNumber libraries needed
7. **Use descriptive commit messages** following conventional commits format
8. **Check git branch** before committing (should be `claude/claude-md-*`)

---

## Current State Summary

**Last Updated**: 2025-11-15

**Indexed Contracts**:
- WETH9 (Mainnet, Base, Optimism, Polygon)

**Events Tracked**:
- Deposit

**Database Tables**:
- `account` (address, balance)

**API Endpoints**:
- GraphQL: `/` and `/graphql`
- SQL Client: `/sql/*`

**Status**: Basic indexer setup complete. Ready for expansion with additional contracts and events.
