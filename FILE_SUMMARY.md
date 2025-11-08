# FILE SUMMARY & KEY CODE SNIPPETS

## Absolute File Paths

All source files in the repository:

1. /home/user/zuno-marketplace-indexer/abis/weth9Abi.ts
2. /home/user/zuno-marketplace-indexer/src/index.ts
3. /home/user/zuno-marketplace-indexer/src/api/index.ts
4. /home/user/zuno-marketplace-indexer/ponder.config.ts
5. /home/user/zuno-marketplace-indexer/ponder.schema.ts
6. /home/user/zuno-marketplace-indexer/ponder-env.d.ts
7. /home/user/zuno-marketplace-indexer/package.json
8. /home/user/zuno-marketplace-indexer/tsconfig.json
9. /home/user/zuno-marketplace-indexer/.eslintrc.json
10. /home/user/zuno-marketplace-indexer/.env.example
11. /home/user/zuno-marketplace-indexer/.gitignore

## Configuration Files

### 1. ponder.config.ts (Blockchain Configuration)
Location: /home/user/zuno-marketplace-indexer/ponder.config.ts

Purpose: Defines blockchain networks, contract addresses, and ABIs to index

Key Issue: startBlock: "latest" misses all historical events

Chains Configured:
- Ethereum (id: 1)
- Base (id: 8453)
- Optimism (id: 10)
- Polygon (id: 137)

WETH9 Addresses:
- Mainnet: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
- Base: 0x4200000000000000000000000000000000000006
- Optimism: 0x4200000000000000000000000000000000000006
- Polygon: 0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619

### 2. ponder.schema.ts (Database Schema)
Location: /home/user/zuno-marketplace-indexer/ponder.schema.ts

Purpose: Defines database table structures

Current Tables:
- account (address: hex PK, balance: bigint)

Missing:
- No chainId field (cross-chain isolation issue)
- No timestamps (no audit trail)
- No transaction history
- No transfer tracking

### 3. package.json (Project Metadata)
Location: /home/user/zuno-marketplace-indexer/package.json

Scripts:
- ponder dev: Development server
- ponder start: Production server
- ponder db: Database management
- ponder codegen: Code generation
- ponder serve: Serve API
- eslint . : Lint code
- tsc: Type check

Dependencies:
- ponder ^0.14.3 (Core indexer)
- hono ^4.5.0 (Web framework)
- viem ^2.21.3 (Ethereum utilities)

### 4. .env.example (Environment Template)
Location: /home/user/zuno-marketplace-indexer/.env.example

Required Variables:
```
PONDER_RPC_URL_1=           # Ethereum mainnet
PONDER_RPC_URL_10=          # Optimism
PONDER_RPC_URL_137=         # Polygon
PONDER_RPC_URL_8453=        # Base
DATABASE_URL=               # PostgreSQL (optional)
```

## Source Code Files

### 1. Event Handlers (src/index.ts)
Location: /home/user/zuno-marketplace-indexer/src/index.ts

Current Implementation (10 lines):
```typescript
import { ponder } from "ponder:registry";
import { account } from "ponder:schema";

ponder.on("weth9:Deposit", async ({ event, context }) => {
  await context.db
    .insert(account)
    .values({ address: event.args.dst, balance: event.args.wad })
    .onConflictDoUpdate((row) => ({ balance: row.balance + event.args.wad }));
});
```

Issues:
- Only Deposit events tracked
- Missing Withdrawal handler
- Missing Transfer handler
- No error handling
- No logging

### 2. API Routes (src/api/index.ts)
Location: /home/user/zuno-marketplace-indexer/src/api/index.ts

Current Implementation (13 lines):
```typescript
import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { client, graphql } from "ponder";

const app = new Hono();

app.use("/sql/*", client({ db, schema }));
app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

export default app;
```

Endpoints:
- GET|POST /sql/* - SQL queries (NO AUTH)
- GET|POST / - GraphQL (NO AUTH)
- GET|POST /graphql - GraphQL (NO AUTH)

Missing:
- Authentication middleware
- Rate limiting middleware
- Error handling middleware
- Logging middleware
- CORS configuration

### 3. Smart Contract ABI (abis/weth9Abi.ts)
Location: /home/user/zuno-marketplace-indexer/abis/weth9Abi.ts

Size: 153 lines

Events Defined:
- Deposit(address indexed dst, uint256 wad)
- Withdrawal(address indexed src, uint256 wad)
- Transfer(address indexed src, address indexed dst, uint256 wad)
- Approval(address indexed src, address indexed guy, uint256 wad)

Note: Only Deposit is currently listened to

Functions:
- deposit() - payable
- withdraw(uint256 wad)
- transfer(address dst, uint256 wad)
- transferFrom(address src, address dst, uint256 wad)
- approve(address guy, uint256 wad)
- balanceOf(address)
- allowance(address, address)

### 4. TypeScript Configuration (tsconfig.json)
Location: /home/user/zuno-marketplace-indexer/tsconfig.json

Settings:
- strict: true (✅ Good)
- noUncheckedIndexedAccess: true (✅ Good)
- target: ES2022
- module: ESNext
- skipLibCheck: true

### 5. ESLint Configuration (.eslintrc.json)
Location: /home/user/zuno-marketplace-indexer/.eslintrc.json

Configuration:
```json
{
  "extends": "ponder"
}
```

Uses Ponder's ESLint preset (derived from Airbnb + TypeScript)

## Dependency Analysis

### Direct Dependencies
```
ponder@0.14.3        - Core indexing framework
  ├─ Provides: Event handlers, database schema, API server
  ├─ Includes: GraphQL server, SQL client
  └─ Uses: @opentelemetry/api, @envelop/*, @electric-sql/pglite

hono@4.5.0          - Web framework (lightweight)
  ├─ Used for: Express-like routing
  ├─ Size: ~15KB
  └─ Status: Production-ready

viem@2.21.3         - Ethereum utilities (transitive dependency)
  ├─ Used for: Blockchain interactions
  └─ Included via: ponder
```

### Development Dependencies
```
typescript@5.3.2    - Type checking
eslint@8.54.0       - Code linting
@types/node@20.10.0 - Node.js types
```

## Git History

Commits in Current Branch:
1. 7fd8360 - Merge pull request #1
2. 70569a0 - Major Refactor (3626 lines deleted!)
3. 25ab63b - Update README (full marketplace version)
4. 0ea1df5 - Initial commit

## Lines of Code Analysis

Project Statistics:
- Total TypeScript files: 4
- Total lines of code: ~500 LOC
- Event handlers: 10 lines
- API routes: 13 lines
- Schema definition: 6 lines
- ABI definition: 153 lines
- Configuration: ~80 lines

Previous Version (Before Refactor):
- Total lines deleted: 3,626
- Lost functionality: Marketplace, NFT, logging, error handling
- Configuration system: 400+ lines
- Event handlers: 300+ lines
- Services/utilities: 400+ lines

