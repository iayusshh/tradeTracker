@AGENTS.md

# TradeTracker — Project Guide

A public trade journal with a private admin desk. Tracks positional option-selling strategies and commodity trades. Visitors can browse P&L, payoff charts, and timelines; the admin manages all entries via the desk console.

## Stack

- **Framework**: Next.js (App Router) — read `node_modules/next/dist/docs/` for any API you're unsure about
- **Database**: PostgreSQL via Prisma (`src/lib/db.ts`)
- **Auth**: JWT sessions via `jose` + bcrypt password hashing (`src/lib/auth.ts`)
- **Live prices**: Fyers option chain API (`src/lib/fyers.ts`)
- **Styling**: Tailwind CSS

## Route layout

| Path | Access | Purpose |
|---|---|---|
| `/` | Public | Home with links to all sections |
| `/(public)/positional` | Public | List all positional groups |
| `/(public)/positional/[groupId]` | Public | Group detail with payoff chart |
| `/(public)/commodities` | Public | List all commodity trades |
| `/(public)/commodities/[tradeId]` | Public | Commodity trade detail |
| `/desk` | Auth-gated | Admin dashboard (overview of all trades) |
| `/desk/login` | Public | Admin sign-in |
| `/desk/positional/new` | Auth-gated | Create positional group |
| `/desk/positional/[groupId]` | Auth-gated | Manage legs, executions, status |
| `/desk/commodities/new` | Auth-gated | Create commodity trade |
| `/desk/commodities/[tradeId]` | Auth-gated | Manage commodity executions, status |
| `/api/admin/*` | Auth-gated | CRUD APIs for all admin operations |
| `/api/public/*` | Public | Read-only APIs for public pages |
| `/api/quotes/positional/[groupId]` | Public | Live LTP map from Fyers (polled by client) |

Routes under `/admin/*` redirect permanently to `/desk/*` (`next.config.ts`).

## Auth

Protection runs in the middleware (`src/proxy.ts`). It guards `/desk/*` and `/api/admin/*`.

- `/desk/login` and `/api/admin/login` + `/api/admin/logout` are excluded from protection.
- Sessions are JWT tokens stored in an `HttpOnly` cookie (`tt_admin_session`), valid for 7 days.
- Credentials come from env: `AUTH_SECRET`, `ADMIN_EMAIL`, and either `ADMIN_PASSWORD_HASH` (bcrypt) or `ADMIN_PASSWORD` (plain — dev only).
- `validateAdminCredentials`, `createSessionToken`, `verifySessionToken`, `getCurrentSession` are all in `src/lib/auth.ts`.

## Database models (Prisma)

### PositionalTradeGroup
Multi-leg option strategy. Fields: `id`, `title`, `underlyingSymbol`, `startedAt`, `targetDate?`, `status` (OPEN/CLOSED), `notes?`, cached `realizedPnl`/`unrealizedPnl`/`totalPnl`.

### OptionLeg
Belongs to a group. Fields: `optionType` (CALL/PUT), `side` (BUY/SELL), `strike`, `expiry`, `quantity`, `lotSize`, `isActive`.

### OptionExecution
Belongs to a leg. Fields: `kind` (ENTRY/EXIT/ADJUSTMENT), `executedAt`, `optionPrice`, `quantity`, `underlyingLtp`, `fees?`, `notes?`.

### CommodityTrade
Fields: `title?`, `symbol`, `direction` (LONG/SHORT), `startedAt`, `status`, `notes?`, cached P&L fields.

### CommodityExecution
Belongs to a trade. Fields: `kind`, `executedAt`, `price`, `quantity`, `underlyingLtp`, `fees?`, `notes?`.

## Math (`src/lib/math/`)

### `pnl.ts`
- `computeOptionLegSnapshot(leg, liveMarkPrice?)` → `LegSnapshot` — averageEntryPrice, markPrice, openQuantity, realizedPnl, unrealizedPnl, totalPnl.
- `computePositionalGroupPnl(legs[])` → `PnlBreakdown` — aggregates across all legs.
- `computeCommodityTradePnl(trade)` → `PnlBreakdown`.
- Both respect ENTRY/EXIT/ADJUSTMENT cash flows with correct directionality.

### `payoff.ts`
- `buildPayoffSeries({ legs, targetDate?, currentPrice })` → `PayoffOutput` — generates a price grid and calculates `expiryPnl` (intrinsic only) and `targetPnl` (intrinsic + estimated remaining time value using sqrt-of-time decay) at each price point. Also returns `breakevens[]`.

## Live pricing (`src/lib/fyers.ts`)

- `fetchOptionChain(underlyingSymbol, expiry)` — fetches the full option chain from Fyers (`https://api-t1.fyers.in/data/options-chain-v3`).
- `fetchLegLtps(legs[], underlyingSymbol)` — batches legs by expiry, calls `fetchOptionChain` once per unique expiry, returns a `legId → ltp` map.
- Supported underlyings: NIFTY, BANKNIFTY, FINNIFTY, MIDCPNIFTY, SENSEX, BANKEX. Add new entries to `UNDERLYING_SYMBOL` in that file.
- Requires env: `FYERS_APP_ID`, `FYERS_ACCESS_TOKEN`.

## Live P&L component (`src/components/LivePositionalPnl.tsx`)

Client component. Polls `/api/quotes/positional/[groupId]` every 5 seconds when the group is OPEN and has open legs. Renders a per-leg breakdown table with live LTPs and an aggregate P&L summary. Stops polling for CLOSED groups.

## Server utilities

- `src/lib/server/trade-service.ts` — `getPositionalOverview()`, `getCommodityOverview()`, `buildMonthWeekBuckets()` for timeline navigation.
- `src/lib/server/timeline.ts` — `monthKeyFromDate`, `weekKeyFromDate`, `monthLabelFromDate`, `weekLabelFromDate`.
- `src/lib/format.ts` — `formatInr(value)`, `formatCompact(value)`, `pnlColor(value)`, `statusBadgeClass(status)`.

## Admin components (`src/components/admin/`)

| Component | Purpose |
|---|---|
| `CommodityTradeForm` | Create/edit commodity trade metadata |
| `PositionalGroupForm` | Create/edit positional group metadata |
| `AddOptionLegForm` | Add a new leg to a group |
| `AddOptionExecutionForm` | Add ENTRY/EXIT/ADJUSTMENT to a leg |
| `AddCommodityExecutionForm` | Add execution to a commodity trade |
| `EditableLegsList` | Inline leg management with payoff chart on the desk detail page |
| `ToggleStatusButton` | PATCH status (OPEN ↔ CLOSED) on group or trade |
| `LoginForm` | Admin sign-in form |
| `LogoutButton` | Calls `/api/admin/logout` and redirects |

## Key env variables

```
DATABASE_URL=
AUTH_SECRET=
ADMIN_EMAIL=
ADMIN_PASSWORD_HASH=   # bcrypt hash (preferred)
ADMIN_PASSWORD=        # plain text (dev only)
FYERS_APP_ID=
FYERS_ACCESS_TOKEN=
```
