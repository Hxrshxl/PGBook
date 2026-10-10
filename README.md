# PGBook

PG (paying-guest) management for owners in India: properties, rooms and beds, tenants, monthly rent with food charges and late fees, utility bill splitting, expenses and profit, receipts, WhatsApp reminders, complaints, staff logins with approvals, and analytics.

**Stack:** Next.js 15 (App Router) · React 19 · MongoDB / Mongoose · Tailwind CSS 4 · `jose` (JWT sessions in httpOnly cookies)

## Features

| Area | What it does |
| --- | --- |
| Properties | Several PGs under one account (Multi-PG); a property switcher filters every page; each property has its own UPI ID, due day, GSTIN, notice period and late-fee rule |
| Rooms & beds | Rooms with a bed count and suggested rent; free/full view; a tenant can only be placed in a room with a free bed |
| Tenants | Add / edit / move rooms / vacate (with move-out date) / restore / permanently delete; deposit, ID and emergency contact; recurring monthly charges such as food or laundry |
| Rent tracker | One dues record per tenant per month (rent + charges + utility share + late fee); record payments with date, method and reference; partial payments; undo a mistaken entry; adjust a month's rent or waive a late fee; apply late fees by each property's rule |
| Team & roles | Invite a manager, accountant or caretaker with their own login, limited to chosen properties; remove access instantly. Each role sees and does only what it needs (see `docs/ROLES_AND_DASHBOARDS.md`) |
| Approvals | Staff corrections above their limit (removing a payment, dues changes) go to the owner's inbox; nothing changes until the owner approves |
| Cash handover | Caretakers log cash they receive; it counts on the tenant's dues only after the owner or accountant confirms the handover |
| Expenses | Salaries, groceries, lease, repairs, bills… per property, with a monthly profit & loss |
| Utility splitter | Split a bill between any set of tenants; shares add up exactly to the paisa; deleting a bill removes its charges |
| Receipts | Printable / save-as-PDF receipts with payment breakdown and amount in words |
| Reminders | WhatsApp messages in English or Hindi with balance, due date and UPI ID |
| Complaints | Log, prioritise, track and resolve maintenance issues |
| Analytics | Collection rate, 6/12-month revenue, profit & loss, outstanding dues, occupancy from rooms and beds |
| Account | Profile, change password (signs out other devices) |

## Getting started

Requirements: Node.js 20.6+ and MongoDB (local, Docker, or MongoDB Atlas).

```bash
npm install
cp .env.example .env.local      # then edit the values
npm run seed                    # optional: demo account demo@pgbook.app / Demo@1234 with 18 months of sample data
                                # (staff logins manager@ / accountant@ / caretaker@pgbook.app, same password)
npm run dev                     # http://localhost:3000
```

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | yes | MongoDB connection string |
| `JWT_SECRET` | yes | Random string, **at least 32 characters**. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `NEXT_PUBLIC_SITE_URL` | production | Public URL, used for SEO metadata, robots.txt and the sitemap |
| `APP_TIME_ZONE` | no | Time zone for "today" on the server. Default `Asia/Kolkata` |

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server (build also runs ESLint) |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (money, dates, phone numbers, receipts text) |
| `npm run test:smoke` | End-to-end owner API test against a running server. **Use a throwaway database.** `BASE_URL=http://localhost:3000 npm run test:smoke` |
| `npm run test:admin` | End-to-end admin console test (2FA, approvals, redaction, lockout…). Needs `MONGODB_URI` set to the same **throwaway** database the server uses (name must contain `test`); it drops that database at the end |
| `npm run test:team` | End-to-end test of properties, rooms, staff roles and property scoping, approvals, cash handover, late fees, charges and expenses, plus the upgrade of an old single-PG account. Same **throwaway** database rules as `test:admin` |
| `npm run admin -- <command>` | Admin CLI for people with server access: `create`, `list`, `reset-2fa`, `reset-password`, `unlock` (see `scripts/admin.mjs`) |
| `npm run seed` | Reset the demo account with ~18 months of realistic sample data: two PGs (60 beds, and a 22-bed one that opened 8 months ago) with rooms, ~125 tenants moving in and out, food plans, late fees, ~1,200 monthly dues, ~120 utility bills, ~480 expenses, ~100 complaints, and a staff team with cash handovers and approval requests waiting. Same data every run, dated relative to today. Refuses to run with `NODE_ENV=production`. To load it into your own account: `npm run seed -- --email=you@example.com` (add `--keep-existing` to keep records you already have, or `--replace` to delete them first; `--with-staff` attaches the demo staff logins) |

## Deploying

Works on any Node host. The usual setup is **Vercel + MongoDB Atlas**:

1. Create an Atlas cluster, a database user, and allow your host's IPs.
2. Set `MONGODB_URI`, `JWT_SECRET` and `NEXT_PUBLIC_SITE_URL` in the host's environment settings.
3. Deploy. Point an uptime monitor at `GET /api/health`.
4. Turn on Atlas backups.

## Admin console (`/admin`)

The PGBook staff console. The full design is in [docs/ROLES_AND_DASHBOARDS.md](docs/ROLES_AND_DASHBOARDS.md).

**First Super Admin** — run on the server (or locally against your database):

```bash
npm run admin -- create --email=you@pgbook.in --name="Your Name"
```

It prints a temporary password. Sign in at `/admin/login`, set up an authenticator app (2FA is mandatory), then change the password under **My Account**. Add teammates from **Admin Team**: every invite, role change, disable and 2FA reset needs a **second** Super Admin to approve it, so create a second Super Admin with the CLI too.

| Screen | What it does |
| --- | --- |
| Overview | Owner and trial KPIs, platform usage (₹ totals hidden until ≥ 10 owners contribute), needs-attention queue, system health, live activity |
| Owners | Search and filter accounts. Detail page shows usage **counts** (never tenant names or amounts), activity (redacted), sign-ins. Actions: extend trial, sign out all sessions, suspend / reactivate — each needs a reason the owner can see |
| Approvals | Maker-checker queue. Nobody can approve their own request; approving needs a fresh 2FA code |
| Audit Log | Every sign-in, change and decision; filters; CSV export (needs 2FA, guarded against spreadsheet formula injection). Append-only |
| Admin Team | Roles: Super Admin, Billing Admin, Support Agent, Compliance Officer, Analyst |

Owners see everything PGBook staff did to their account under **Activity** in their dashboard.

## Security model

- Sessions are signed JWTs in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production). No token is readable by page JavaScript.
- `/dashboard` is protected by middleware; every API route re-checks the session and scopes every query to the signed-in user's organization.
- Mutating API requests from other origins are rejected (CSRF protection).
- API routes whitelist writable fields. Amounts paid and payment status are always derived on the server.
- Login, sign-up and password change are rate-limited (in-memory, per instance — use a shared store such as Redis if you run several instances).
- Changing your password signs out every other session.
- Security headers (HSTS, X-Frame-Options, nosniff, Referrer-Policy) are set in `next.config.mjs`.
- Owner and admin sessions are separate realms (different cookies and JWT audiences) — a token from one is rejected by the other.
- Admins: mandatory TOTP 2FA (codes can't be replayed), 8-hour sessions with a 30-minute idle timeout, lockout after 5 failures, re-verification for sensitive actions, `SameSite=Strict` cookie, and logout invalidates the token server-side.
- Every privileged action writes an append-only audit event; admin actions fail if the event can't be recorded.
- Permissions are checked in one place (`src/lib/policy.js`) for owners, staff and admins. Roles get explicit capability lists — there is no wildcard.
- Staff work inside the owner's organization: every query is scoped to the organization and to the properties the staff member may access. Removing a member signs them out everywhere at once; a suspended organization locks out its staff too.
- Maker–checker: staff money corrections above their limit become approval requests that only the owner can decide (and nobody can approve their own). Requests are re-validated when they run and expire after 72 hours.

## Project layout

```
src/
  app/            pages, API routes (app/api/**, app/api/admin/**), admin console (app/admin/**)
  lib/            db, auth, API wrappers (api.js, adminApi.js), policy, audit, approvals, billing, models, seed
  context/        auth, app data and admin providers
  views/          dashboard page components
  components/     UI components (components/admin for the console)
  utils/          shared helpers (used by both server and client) + tests
  middleware.js   edge redirects for /dashboard and /admin
scripts/          admin CLI and end-to-end tests
docs/             design documents
```
