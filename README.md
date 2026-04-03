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

## Notes

1. OI/IV modules are intentionally excluded in this phase.
2. Target-date payoff uses a time-decay approximation because IV inputs are not in scope yet.
3. For production accounting precision, consider moving monetary fields from `Float` to `Decimal` in Prisma.
