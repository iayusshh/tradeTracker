# Trade Tracker (Next.js + Neon)

This app tracks two strategy classes with separate public views and a private admin console:

1. Positional options selling groups (multi-leg, entry/exit ledger, payoff chart)
2. Commodity trades (per-trade entry/exit ledger)

## What is implemented

1. Public pages
	- Home with public strategy buttons
	- Positional list and detail pages
	- Commodities list and detail pages
	- Left-side month -> week grouping with PnL totals
2. Admin pages
	- Email/password login
	- Dashboard for positional and commodity records
	- Create positional group / commodity trade
	- Add option legs and entry/exit executions
	- Add commodity entry/exit executions
3. Backend and data
	- Prisma schema for groups, legs, executions, commodities
	- Admin and public API routes
	- PnL recomputation after each mutation
	- Payoff chart data generation (expiry + target-date approximation)
4. Security
	- Cookie-based admin session
	- Route protection using Next.js proxy

## Setup

1. Install dependencies

```bash
npm install
```

2. Configure environment variables

```bash
cp .env.example .env
```

Required values:
- `DATABASE_URL` (Neon Postgres URL)
- `AUTH_SECRET` (random 32+ character secret)
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD_HASH`

Generate admin hash:

```bash
npm run hash-password -- "your-plain-password"
```

Paste output hash into `ADMIN_PASSWORD_HASH`.

3. Create database structure

```bash
npm run db:migrate -- --name init
```

4. Run the app

```bash
npm run dev
```

Open `http://localhost:3000`.

## Helpful scripts

- `npm run dev` - local development
- `npm run build` - production build check
- `npm run lint` - lint check
- `npm run db:generate` - prisma client generate
- `npm run db:migrate` - create/apply migration
- `npm run db:push` - push schema without migration files

## Live Price Integration (Fyers API)

This app integrates real-time market data from the Fyers API to fetch live option prices and commodity quotes.

### Getting Fyers API Credentials

#### Step 1: Create a Fyers Account
1. Go to [Fyers.in](https://fyers.in/) and sign up for a free account
2. Complete email verification and KYC requirements
3. Log in to your account

#### Step 2: Generate App Credentials
1. Visit the [Fyers Developer Dashboard](https://app.fyers.in/dashboard/apps)
   - If the link doesn't work, log into Fyers, navigate to **Settings** → **App** or **Developer** section
2. Create a new app:
   - Click **Create New App** or **Add App**
   - Enter an app name (e.g., "TradeTracker")
   - **Redirect URI**: Set to `http://localhost:8080/callback` (required for token refresh automation)
   - Select app type as appropriate
   - Accept terms and create
3. After creation, copy these four credentials:
   - **App ID** (also called Client ID)
   - **App Secret** (store securely — needed for token refresh)
   - **Redirect URI** (the URL you set in step 2)
   - **Access Token** (shown at creation time only — save it now)

#### Step 3: Configure Environment Variables
1. Open or create `.env` in the project root (or `.env.local` for development)
2. Add all four Fyers variables:

```env
FYERS_APP_ID=your_app_id_here
FYERS_SECRET_KEY=your_app_secret_here
FYERS_REDIRECT_URI=http://localhost:8080/callback
FYERS_ACCESS_TOKEN=your_access_token_here
```

3. Restart the development server:
```bash
npm run dev
```

**Important**: All four variables are needed:
- `FYERS_APP_ID` and `FYERS_ACCESS_TOKEN` for fetching live prices
- `FYERS_SECRET_KEY` and `FYERS_REDIRECT_URI` for automatic token refresh (24-hour cycle)

### Live Price Features

#### Commodity Trades
- **"Use live price" button**: On the commodity execution form, click this button to fetch the current market price from Fyers
- **Supported instruments**: Futures and Options on any commodity exchange (MCX, NCDEX, etc.)
- **How it works**: System searches for the commodity symbol (e.g., CRUDEOIL, GOLD) and returns the last traded price (LTP)

#### Positional Options (Multi-leg Groups)
- **Live P&L display**: Shows real-time P&L breakdown by option leg
- **Updates every 5 seconds**: When a positional group is marked as OPEN and has active legs
- **Supported underlyings** for automatic option chain fetching:
  - NIFTY
  - BANKNIFTY
  - FINNIFTY
  - MIDCPNIFTY
  - SENSEX
  - BANKEX
- **Automatic stop**: Live updates stop when a group is marked as CLOSED

### API Endpoints for Live Prices

#### Fetch Commodity Quote
**Endpoint**: `GET /api/quotes/commodities/[tradeId]`

Returns the last traded price (LTP) for a commodity trade:
```json
{
  "symbol": "CRUDEOIL",
  "exchange": "MCX",
  "ltp": 7845.50
}
```

#### Fetch Positional Option Prices
**Endpoint**: `GET /api/quotes/positional/[groupId]`

Returns a map of option leg IDs to their current market prices:
```json
{
  "leg-id-1": 45.25,
  "leg-id-2": 23.10
}
```

### Code Integration Points

#### Fetching Single Symbol LTP (Utility Function)
Location: `src/lib/fyers.ts` → `fetchSingleSymbolLtp(symbol, exchange)`

Example usage:
```typescript
import { fetchSingleSymbolLtp } from '@/lib/fyers';

const ltp = await fetchSingleSymbolLtp('CRUDEOIL', 'MCX');
console.log(ltp); // e.g., 7845.50
```

#### Fetching Option Chain (For Positional Groups)
Location: `src/lib/fyers.ts` → `fetchOptionChain(underlyingSymbol, expiry)`

Example:
```typescript
import { fetchOptionChain } from '@/lib/fyers';

const chain = await fetchOptionChain('NIFTY', new Date('2024-05-30'));
// Returns: { callChain: {...}, putChain: {...} }
```

#### Fetching Multiple Legs at Once
Location: `src/lib/fyers.ts` → `fetchLegLtps(legs[], underlyingSymbol)`

Example:
```typescript
import { fetchLegLtps } from '@/lib/fyers';

const legLtpMap = await fetchLegLtps(legs, 'NIFTY');
// Returns: { leg-id-1: 45.25, leg-id-2: 23.10 }
```

### Troubleshooting

#### "API Not Working" or Empty Prices
- **Check credentials**: Verify `FYERS_APP_ID` and `FYERS_ACCESS_TOKEN` are correctly set in `.env.local`
- **Restart server**: After updating `.env.local`, restart the development server (`npm run dev`)
- **Market hours**: Fyers API returns data only during market trading hours (9:15 AM - 3:30 PM IST on weekdays)

#### Invalid Symbol Error
- **Check symbol format**: Use the exact tradable symbol (e.g., `CRUDEOIL`, not `OIL`)
- **Verify exchange**: Ensure exchange matches the symbol (e.g., `MCX` for crude oil)
- **For options**: The underlying (e.g., NIFTY) must be one of the supported underlyings listed above

#### Rate Limiting
- Fyers API has rate limits (~100-200 requests/minute for most endpoints)
- The system caches results in memory and polls minimally to stay within limits
- For heavy backtesting, consider adding delays between requests

#### Token Expiration
- **Note**: Fyers access tokens regenerate every 24 hours automatically
- The system works seamlessly with new tokens as long as they're refreshed regularly
- You have two options:

**Option 1: Check & Refresh Manually (Every 24 Hours)**
```bash
python3 scripts/refresh-fyers-token.py
```
This opens an auth flow in your terminal:
1. Provides an auth URL for you to authorize the app
2. Gives you a redirect code
3. Automatically exchanges it for a new access token
4. Updates .env.local
5. Tells you to restart the server: `npm run dev`

**Option 2: Check Token Status (No Update)**
```bash
python3 scripts/refresh-fyers-token.py --check
```
Validates the current token using a quick API call.

**Option 3: Automated Refresh with Pre-Generated Auth Code (For CI/Cron)**
```bash
python3 scripts/refresh-fyers-token.py --auth <your_auth_code>
```
Use this in cron jobs or CI pipelines. First manually get an auth code, then schedule:
```bash
# Refresh every day at 3 AM
0 3 * * * cd /path/to/tradeTracker && python scripts/refresh-fyers-token.py --auth <your_code> >> logs/token-refresh.log 2>&1
```

**Before Automating:** The Python script uses `fyers_apiv3` library. Install it:
```bash
pip3 install fyers-apiv3
```

Or add to `requirements.txt` if using a production environment.

### Adding New Supported Underlyings

To add support for a new underlying symbol (e.g., NIFTY_MID100):

1. Open `src/lib/fyers.ts`
2. Find the `UNDERLYING_SYMBOLS` object
3. Add your symbol: `NIFTY_MID100: 'NIFTY_MID100'`
4. Restart the server

The system will automatically fetch option chains for the new underlying when positional groups use it.

## Notes

1. OI/IV modules are intentionally excluded in this phase.
2. Target-date payoff uses a time-decay approximation because IV inputs are not in scope yet.
3. For production accounting precision, consider moving monetary fields from `Float` to `Decimal` in Prisma.
4. Live pricing requires active Fyers API credentials; ensure they remain valid during production use.
