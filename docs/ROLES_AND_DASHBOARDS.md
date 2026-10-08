# PGBook — Roles, Permissions & Dashboards Design

Status: **Phases 1 and 3 built** (see §14); other phases are a design proposal · Covers: SuperAdmin (platform), PG Owner (+ staff), Tenant
Numbers in wireframes are illustrative.

---

## 0. TL;DR

PGBook has three separate worlds, and every design decision follows from keeping them separate:

| World | Who | What they own | Login |
| --- | --- | --- | --- |
| **Platform** | PGBook staff — SuperAdmin and narrower admin roles | Plans, billing, platform settings, the owners' *accounts* | `admin.` area, email + password + mandatory 2FA |
| **Organization** | PG Owner and their staff (Manager, Accountant, Caretaker) | Their properties, rooms, residents, rent ledger — **the business data** | Email + password (today's login) |
| **Resident** | Tenants, current and former | Their own profile, their own dues/receipts, their own requests | Phone OTP via invite link — no password, no app install |

The five rules that make this more than a generic admin panel:

1. **The owner owns the business data.** SuperAdmin manages *accounts*, not *ledgers*. Admin sees counts, not rupees, and only enters an owner's data in a consented, time-boxed, logged support session.
2. **Money records are append-only.** Nobody — owner, staff, or SuperAdmin — silently edits a payment. Corrections are new entries with a reason.
3. **Approvals flow in every direction.** Tenant → owner (payment claims, move-out notices), staff → owner (refunds, waivers), admin → owner (support access), admin → admin (maker-checker for the dangerous stuff).
4. **PGBook never touches rent money.** Tenants pay the owner's UPI ID directly. This keeps PGBook out of RBI payment-aggregator licensing and makes "who collected what" unambiguous.
5. **Every privileged action leaves an immutable audit event**, visible to the people it affects.

---

## 1. Where the system is today

### 1.1 Entities and relationships (current code)

```
User (owner) ─┬─ pgSettings (embedded: ONE property per account)
              ├─< Tenant ─┬─< Payment (one per tenant per month) ─< transactions[]
              │           └─< Complaint
              └─< UtilityBill ─< allocations[] ──> Tenant
```

- **One role exists:** the owner. There is no admin, no staff, and tenants are *records*, not users.
- `User.plan` exists but nothing enforces it. There is no trial logic, no subscription, no audit log.
- Everything is scoped by `userId` (= the owner). That is the hook the org model will build on.

### 1.2 Promises on the public site that the roles must deliver

| Promise (landing page / FAQ / pricing) | Today | What delivers it |
| --- | --- | --- |
| "Tenant portal is a web app — tenants click the link you share" | Tenants can't log in | Resident realm, invite links, phone OTP |
| "Let tenants self-register via a link you share" | — | Property join link → owner approval |
| "Tenants raise maintenance issues from their portal" | Owner logs them | Tenant-created complaints |
| "Receipts … downloadable by tenants" (HRA claims) | Owner prints | Resident receipts, also for *former* tenants |
| Starter ≤ 10 tenants · Pro ≤ 50 tenants, 1 PG · Multi-PG ≤ 5 properties | `plan` unused, single PG | Subscription + plan limits + `Property` entity |
| "14-day free trial, no credit card" | — | Trial state machine |
| "Full export (CSV + PDFs) on cancellation; nothing deleted for 90 days" | No export | Export job + retention scheduler (§9.1) |
| "Separate monthly food charge per tenant" | — | Recurring charges on a tenancy |
| "GST-ready, add your GSTIN" | — | `Property.gstin` on receipts |
| "Split by occupancy if rooms differ" | Equal split only | Split method on utility bills |
| "Every month PGBook auto-generates dues" / reminders "on due date" | Manual buttons | Scheduled jobs |
| Multi-PG: "custom branding", "dedicated support", "consolidated reports" | — | Plan-gated features, support tickets in admin |

---

## 2. Design principles (and why)

1. **Three realms, three sessions.** Separate cookies and JWT audiences (`aud: admin | org | resident`) so a token from one realm can never be replayed in another. An admin is never also an owner on the same login.
2. **Data roles under India's DPDP Act 2023.** The PG owner collects tenant data for their business, so they are effectively the *data fiduciary*. PGBook processes it on their behalf. PGBook is the fiduciary for the owners' own account and billing data. Consequence: **SuperAdmin cannot browse tenant personal data at will** — only via owner-consented support access or an approved, logged break-glass. *(Confirm the final legal framing with counsel.)*
3. **Admin sees aggregates, not the owner's business.** Admin dashboards show counts per owner (tenants, beds, dues created) and platform-wide totals, never a specific owner's rupee amounts outside a support session.
4. **Ledger integrity.** Payment entries, deposit settlements and dues adjustments are never edited in place: they are reversed/adjusted with a reason. SuperAdmin has **no** write path into ledgers at all.
5. **Least privilege, scoped.** Every permission is `(capability, scope)`. Scope = platform, organization, property set, or "self".
6. **Soft before hard.** Destructive actions go through suspension or soft-delete plus a grace period before anything is permanently removed.
7. **Never hold operations hostage.** Plan limits and unpaid subscriptions block *growth* (adding tenants, new properties), never *running the PG* (recording a payment, issuing a receipt, exporting data).
8. **No money custody.** Rent goes tenant → owner via UPI. PGBook only records it. Platform subscription billing (owner → PGBook) is the only money PGBook receives.
9. **Fraud-aware by default.** The most valuable thing to steal in this product is *where rent gets paid*. Changing a payout UPI ID is treated as a high-risk action (§5, §7.5).

---

## 3. Actors and role hierarchy

```
PLATFORM (PGBook staff)                     ORGANIZATION (one per owner account)        RESIDENT
├─ Super Admin        (2–3 founders)        ├─ Owner        (account holder, exactly 1) ├─ Invited      (link sent)
├─ Billing Admin      (money in/out)        ├─ Manager      (runs ops, assigned PGs)    ├─ Pending      (self-registered, awaiting owner)
├─ Support Agent      (helps owners)        ├─ Accountant   (rent, bills, expenses)     ├─ Active       (living there)
├─ Compliance Officer (DPDP, legal)         └─ Caretaker    (on-site warden)            ├─ On notice    (move-out date set)
└─ Analyst            (read-only, no PII)                                               └─ Former       (moved out, read-only)
```

Why split platform roles even for a small team: the Super Admin should not be the only control. Splitting roles makes "two people must agree" possible for the dangerous actions, and a support hire never needs billing or compliance powers.

Why staff roles: real PGs are run by a caretaker on site while the owner is elsewhere. Today the owner must share their password, which destroys accountability. The **Caretaker collects cash** — that single fact drives the "cash handover" approval in §9.4.

Resident states matter because access changes with them. For example, a *former* tenant keeps read-only access to their receipts for HRA/tax claims, but loses access to notices and requests.

---

## 4. Target data model

### 4.1 New and changed entities

| Entity | Purpose | Key fields |
| --- | --- | --- |
| `PlatformAdmin` | PGBook staff login (separate from owners) | email, name, role, totpSecret (encrypted), status, lastLoginAt |
| `Organization` | The owner's business. Today's `User` becomes its account holder | ownerUserId, name, status, plan, limits |
| `Membership` | Staff belonging to an org | orgId, userId, role, propertyIds[], permissionsOverride |
| `Property` | A PG building (moves out of `pgSettings`) | orgId, name, address, city, gstin, payoutUpiId, rules (notice days, due day, late fee), branding |
| `Room` / `Bed` | Physical inventory → real occupancy and vacancy | propertyId, name, floor, sharing, defaultRent / roomId, label, status |
| `Resident` | The **person** (logs in by phone) | phone, name, email, verifiedAt, consents[] |
| `Tenancy` | A stay at a PG (today's `Tenant`) | orgId, propertyId, bedId, residentId?, rent, deposit, recurringCharges[], moveIn, noticeDate, moveOut, status |
| `RentDue` | Today's `Payment` — dues per tenancy per month | + `transactions[].source` (owner/staff/claim/gateway), `adjustments[]` with reason |
| `PaymentClaim` | Tenant says "I paid" | tenancyId, rentDueId, amount, utr, screenshot, status, reviewedBy |
| `CashHandover` | Caretaker's cash collections awaiting confirmation | collectedBy, entries[], status, confirmedBy |
| `DepositSettlement` | Move-out accounting | tenancyId, deposit, deductions[] (reason, photo), refund, status, tenantResponse |
| `ResidentRequest` | Move-out notice, room change, guest stay, profile change | type, payload, status, decidedBy |
| `Notice` | Announcements to residents | propertyId, title, body, requiresAck, acks[] |
| `Expense` | Owner's costs (salaries, groceries, repairs) → real P&L | propertyId, category, amount, date |
| `Subscription` / `Invoice` | Owner → PGBook billing | orgId, plan, status, period, gatewayIds / number, GST breakup, pdf |
| `ApprovalRequest` | Maker-checker for any realm | type, realm, requestedBy, payload, reason, status, decidedBy, expiresAt |
| `AuditEvent` | Immutable "who did what" | actor (realm, id, role, onBehalfOf), action, target, before/after, reason, ip, at |
| `SupportSession` | Admin access to an org's data | adminId, orgId, scope (read/write), reason, ticketId, consentBy, startsAt, endsAt |
| `DataRequest` | DPDP requests (access / correction / erasure) | subject, type, status, dueAt, handledBy |
| `FeatureFlag`, `Plan`, `PlatformSetting`, `Announcement`, `SupportTicket` | Platform configuration and ops | — |

### 4.2 Relationships

```
Organization ─┬─< Membership >── User (owner / staff login)
              ├─< Property ─┬─< Room ─< Bed
              │             ├─< Notice
              │             └─< Expense
              ├─< Tenancy >── Resident (person, phone login)      Tenancy ── Bed
              │      ├─< RentDue ─< transactions[]  ◀── PaymentClaim / CashHandover (on approval)
              │      ├─< ResidentRequest
              │      ├─< Complaint
              │      └── DepositSettlement
              ├─< UtilityBill ─< allocations[] ──> Tenancy
              └── Subscription ─< Invoice

PlatformAdmin ──< SupportSession >── Organization
Everyone ──< AuditEvent      ApprovalRequest (any realm)
```

A `Resident` can have many `Tenancy` records across different owners over the years. Each owner sees **only their own** tenancy, never the others (see §11, "won't build").

---

## 5. Confirmation and approval framework

One consistent ladder, used by all three dashboards:

| Level | Pattern | Use when | Examples |
| --- | --- | --- | --- |
| **L0** | Just do it (undo toast where sensible) | Viewing, drafting, easily reversible | Filter, mark notification read, save a draft notice |
| **L1** | Confirm dialog stating the consequence | Reversible but visible to others | Vacate tenant, delete a utility bill, send 20 reminders, remove a staff member |
| **L2** | Confirm + **reason required** (stored in audit) | Changes money or someone else's access | Remove a payment entry, waive a late fee, adjust dues, extend a trial, suspend an account |
| **L3** | **Step-up auth** (re-enter password / OTP) + type the name | Irreversible, or a fraud vector | Permanently delete tenant or property, export all data, **change payout UPI ID**, change login email, disable 2FA, transfer ownership, admin support session with write access |
| **L4** | **Approval** by a different person (maker-checker) | Exceeds the actor's authority, or is platform-wide | Staff deposit refund → owner; tenant payment claim → owner; grant admin role → 2nd Super Admin; refund > ₹5,000 → Super Admin; break-glass → Compliance |

Rules for L4 approvals:
- The requester can never approve their own request, and a Super Admin is no exception.
- The approver sees the exact payload ("Refund ₹12,000 to Asha Rao, reason: …") and the current state. The action **re-validates at execution time**, so a stale approval can't apply to changed data.
- Requests expire (72 h by default). Both the request and the decision become audit events.

---

## 6. SuperAdmin (Platform)

### 6.1 Who they manage

- **Owner accounts and organizations:** lifecycle, plan, trial, suspension, deletion.
- **PGBook's own team:** admin users, roles, 2FA, sessions.
- **The commercial layer:** plans, prices, coupons, invoices, refunds, failed renewals.
- **Platform policy:** feature flags, plan limits, message templates, legal document versions, maintenance mode.
- **Trust, safety and compliance:** suspicious accounts, DPDP requests, retention and deletion, incident log.
- **Residents:** *not* managed directly. Admin only acts on a resident for a privacy request or abuse report.

### 6.2 What they can see

| Data | Visibility for SuperAdmin |
| --- | --- |
| Owner account (name, email, phone, plan, status, login history, staff list) | **Full** |
| Org usage (properties, beds, # tenants, # dues, # payments recorded, logins, feature adoption) | **Counts only** |
| Owner's rupee amounts (rent, collections, expenses) | **Hidden**, except in a support session |
| Platform totals (MRR, rent volume recorded, occupancy) | **Aggregated**, buckets of at least 10 orgs |
| Resident personal data (name, phone, ID, documents) | **Masked** (`98•••••210`); full only via support session or break-glass |
| ID documents (Aadhaar etc.) | **Never** in bulk. Aadhaar is stored masked (last 4 digits) everywhere |
| Passwords, OTPs, 2FA secrets, payment card data | **Never** (not stored, or encrypted and unreadable) |
| Audit log | **Full**, read-only. Nobody can edit or delete it |

### 6.3 What they can control

| Area | Controls |
| --- | --- |
| Owner lifecycle | Extend trial, change plan, apply credit, cancel, suspend, reactivate, force logout, send password reset, reset 2FA, schedule or cancel deletion, legal hold |
| Billing | Plans and prices, coupons, invoices, refunds, dunning rules, GST settings |
| Platform | Feature flags (per org / plan / % rollout), plan limits, message templates, announcements banner, maintenance mode, legal doc versions (forces re-acceptance) |
| Security | Admin team and roles, IP allowlist, session policy, block abusive signups, rate-limit overrides |
| Compliance | DPDP request handling, data exports for an org, retention schedule, incident records |
| Support | Tickets, support-session requests, internal notes |

### 6.4 Dashboard information architecture

```
Command Center · Approvals (n) · Owners · Properties · Residents 🔒 · Revenue · Support ·
Communications · Trust & Safety · Compliance · Audit Log · System · Admin Team
```

**Command Center:**

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ PGBook Admin   [⌘K owner name, email, phone, invoice #, ticket #]     🔔 4   Asha · SA │
├───────────────┬──────────────────────────────────────────────────────────────────────┤
│ Command Center│ MRR ₹4.82L ▲6%   Paying orgs 912   Trials 143 (21 end ≤ 3 days)       │
│ Approvals  (4)│ Trial→paid 31%   Churn 2.1%/mo   Beds managed 38,400 · Occupancy 87%  │
│ Owners        ├─────────────────────────────────┬────────────────────────────────────┤
│ Properties    │ NEEDS ATTENTION                 │ PLATFORM HEALTH                    │
│ Residents  🔒 │ ● 4 approvals waiting on you    │ API p95 220 ms · 5xx 0.1%          │
│ Revenue       │ ● 7 failed renewals (₹3,493)    │ Monthly dues job ✓ 1 Oct 00:05     │
│ Support    (9)│ ● 12 orgs at plan limit (upsell)│ WhatsApp ✓ · SMS ⚠ slow · Email ✓  │
│ Comms         │ ● 2 data requests due in 5 days │ Backup ✓ 03:00 · Queue depth 0     │
│ Trust & Safety│ ● 1 payout-UPI change flagged   │                                    │
│ Compliance    ├─────────────────────────────────┴────────────────────────────────────┤
│ Audit Log     │ MRR, 12 months ▁▂▂▃▄▄▅▅▆▆▇█    Signups ▇ vs conversions ▆ (weekly)     │
│ System        │ Live: ✚ Kumar PG signed up · ⬆ Sai Stays → Multi-PG · ✖ Om PG cancelled│
│ Admin Team    │                                                                      │
└───────────────┴──────────────────────────────────────────────────────────────────────┘
```

**Screens:**

| Screen | What's on it | Key actions (level) |
| --- | --- | --- |
| **Command Center** | MRR/ARR, paying orgs, trials ending, trial→paid conversion, churn, beds managed, platform occupancy, resident-portal activation %, needs-attention queue, health strip, live activity | Jump to item |
| **Approvals** | Requests *I can approve* / *I raised* / history. Each shows payload, requester, reason, expiry | Approve / reject with comment (L4) |
| **Owners** list | Search/filter: plan, status, city, signup date, last active, usage vs limit, health score, MRR band | Bulk export list (L2) |
| **Owner detail** (the most-used screen) | Header: plan, status, health score, last active. Tabs: *Overview* (usage vs limits, adoption), *Billing* (subscription, invoices, credits), *Properties*, *Team*, *Activity* (audit metadata, not amounts), *Support* (tickets, sessions, notes), *Security* (sessions, 2FA, logins), *Data* (exports, deletion, legal hold) | See §6.5 |
| **Properties** | All PGs: city, beds, occupancy, verification badge, flags | Verify property (L1), unverify (L2) |
| **Residents 🔒** | **No browsable list.** Purpose-bound lookup by exact phone, with a reason (ticket # or DPDP #). Results masked | Lookup (L2), reveal (support session / break-glass) |
| **Revenue** | Plans and prices, subscriptions, invoices (GST), failed payments and dunning, refunds, coupons, cohort MRR, plan mix | Change price (L4), refund ≤ ₹5k (L2) / > ₹5k (L4), create coupon (L2) |
| **Support** | Tickets with SLA, support-session log, canned replies | Request support session (owner consent) |
| **Communications** | Announcement to owners (in-app banner / email), WhatsApp/SMS template library, delivery logs | Send to segment (L2), send to all owners (L4) |
| **Trust & Safety** | Signals: disposable-email signups, many failed logins, payout-UPI changes, duplicate UTRs across claims, mass tenant deletions, abuse reports from residents | Suspend (L2), block domain/IP (L2) |
| **Compliance** | DPDP requests with statutory deadlines, retention/deletion queue, legal holds, consent/legal-doc versions, incident log | Fulfil request (L3), legal hold on/off (L4 to remove) |
| **Audit Log** | Filter by actor / realm / action / target / time; export | Export (L3) |
| **System** | Job runs (dues, reminders, trial expiry, dunning, purge), integrations (Razorpay, SMS, WhatsApp, email), feature flags, plan limits, maintenance mode | Toggle flag (L2), maintenance mode (L4), rotate integration keys (L4) |
| **Admin Team** | Admins, roles, 2FA status, sessions, IP allowlist | Invite admin / change role (L4), revoke session (L2) |

### 6.5 SuperAdmin actions on an owner account

| Action | Level | Notes |
| --- | --- | --- |
| View account, usage, billing | L0 | Logged as an audit event (who looked at whose account) |
| Extend trial ≤ 14 days | L2 | Support Agent allowed. Longer → Billing Admin |
| Change plan / apply credit | L2 | Pro-rated, owner emailed |
| Refund | L2 ≤ ₹5,000 · L4 above | Billing Admin makes, Super Admin approves |
| Force logout all sessions | L2 | Bumps `tokenVersion` (already built) |
| Send password-reset link | L1 | Admin never sets or sees a password |
| Reset owner's 2FA | L3 + identity check | Account-takeover vector; owner notified on all channels |
| Suspend (login disabled, data intact) | L2 | Residents keep read-only receipts. Owner emailed with the reason |
| Reactivate | L1 | |
| Support session — read-only | Owner consent | ≤ 60 min, banner shown, every page view logged |
| Support session — write | Owner consent + L3 | Each change attributed "PGBook Support (name) on behalf of owner" |
| Break-glass (owner unreachable, legal/security emergency) | L4 (Compliance approves) | Owner notified afterwards, with a full log |
| Export the org's data | L3 | Normally the *owner* exports. Admin export only for legal requests |
| Schedule deletion | L3 | Follows the 90-day promise (§9.1) |
| Delete immediately (skip grace) | L4 | Only for legal or abuse cases |
| Place / remove legal hold | L2 / L4 | A hold blocks deletion |

### 6.6 Securing the admin console

- Separate route group (`/admin`, `/api/admin`), separate cookie (`SameSite=Strict`, 8 h max, 30 min idle), JWT `aud: "admin"`.
- **2FA mandatory** (TOTP now, passkeys later). No 2FA → no access.
- Optional IP allowlist; new-device login emails to the admin.
- Step-up re-auth within the last 5 minutes for L3 actions.
- Rate limits stricter than for owners. Admin accounts lock after repeated failures.
- No self-service signup for admins. Each one is invited through an L4 approval.

### 6.7 What SuperAdmin must NOT be able to do

- Edit or delete any owner's payments, dues, deposits or tenant records.
- Message residents on an owner's behalf.
- See passwords, OTPs, 2FA secrets or full ID numbers.
- Read resident personal data without consent or an approved break-glass.
- Edit or delete audit events, including their own.
- Approve their own requests.

---

## 7. PG Owner (Organization)

### 7.1 Who they manage

Properties → rooms → beds · residents and their tenancies · rent, deposits, utilities, food and other recurring charges · expenses · complaints and requests · notices and house rules · **staff** · their PGBook subscription.

### 7.2 What they can see

- **Everything in their organization**, across all properties (Multi-PG gets a property switcher plus an "All properties" view).
- Full resident details *for their own tenancies only*, never a resident's stays at other PGs.
- Their staff's actions (activity log), support sessions on their account (who from PGBook looked, when, what).
- Their own subscription, invoices, plan usage.

### 7.3 Dashboard information architecture

```
[Property ▾ All properties]  Overview · Approvals (n) · Rooms & Beds · Residents · Rent & Payments ·
Deposits · Utilities · Expenses · Receipts · Reminders · Complaints · Requests · Notices ·
Reports · Team · Activity · Subscription · Settings
```

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ PGBook   [Sunrise PG ▾]                                 🔔 6   Rajesh (Owner) ▾       │
├───────────────┬──────────────────────────────────────────────────────────────────────┤
│ Overview      │ Collected Oct ₹3,58,218 · Due ₹2,47,681 · Occupancy 53/60 · Deposits held│
│ Approvals  (5)│ ₹9.4L · P&L Oct +₹1.12L (collections − expenses)  · Plan: Pro 53/50 ⚠    │
│ Rooms & Beds  ├─────────────────────────────────┬────────────────────────────────────┤
│ Residents     │ NEEDS YOUR APPROVAL             │ THIS WEEK                          │
│ Rent          │ ● 3 payment claims (₹31,500)    │ 2 move-ins · 1 move-out (A-111)    │
│ Deposits      │ ● 1 move-out notice — Priya     │ 7 beds free → 3 single, 4 shared   │
│ Utilities     │ ● Cash handover ₹18,000 — Ravi  │ 4 complaints open (1 past SLA)     │
│ Expenses      │ ● Refund ₹12,000 drafted by Mgr │ Electricity bill not added yet     │
│ …             │ ● 1 KYC to review               │                                    │
└───────────────┴─────────────────────────────────┴────────────────────────────────────┘
```

**Screens that are new or change meaningfully:**

| Screen | Purpose |
| --- | --- |
| **Approvals inbox** | One place for everything waiting on the owner: payment claims, cash handovers, move-out notices, KYC reviews, guest stays, room changes, staff-drafted refunds/waivers, PGBook support-access requests |
| **Rooms & Beds** | Bed grid (occupied / free / notice-period), vacancy forecast from move-out dates, rent per room type |
| **Residents** | Today's roster plus portal status (invited / active), KYC status, recurring charges (food), notice period |
| **Rent & Payments** | Today's tracker plus late-fee rules and a source tag on every entry (owner / staff / tenant claim / cash handover) |
| **Deposits** | Deposits held, settlements in progress, refunds due |
| **Expenses** | Salaries, groceries, repairs, so Reports shows profit, not just collections |
| **Team** | Invite staff, assign role and properties, see their activity |
| **Activity** | Org audit log: who changed what, including PGBook support sessions |
| **Subscription** | Plan, usage vs limits, invoices (GST), upgrade, cancel, **export all data** |

### 7.4 Staff roles inside an organization

| Capability | Owner | Manager | Accountant | Caretaker |
| --- | :-: | :-: | :-: | :-: |
| View residents (name, room, phone) | ✅ | ✅ | ✅ | ✅ |
| View KYC documents / ID numbers | ✅ | ✅ | — | — |
| Add / edit residents, vacate | ✅ | ✅ | — | — |
| Permanently delete resident | ✅ (L3) | — | — | — |
| Record payment (UPI/bank) | ✅ | ✅ | ✅ | — |
| Record cash received | ✅ | ✅ | ✅ | ⏳ via cash handover |
| Approve payment claims | ✅ | ✅ | ✅ | — |
| Remove a payment entry | ✅ (L2) | ⏳ owner | ⏳ owner | — |
| Adjust dues / waive late fee | ✅ (L2) | ✅ ≤ limit, ⏳ above | ⏳ owner | — |
| Deposit settlement & refund | ✅ | ✏️ draft → ⏳ owner | ✏️ draft → ⏳ owner | ✏️ inspection notes |
| Utility bills, expenses | ✅ | ✅ | ✅ | — |
| Complaints (assign, update) | ✅ | ✅ | — | ✅ |
| Notices to residents | ✅ | ✅ | — | ✅ |
| Reports & exports | ✅ (export all: L3) | 👁 reports | 👁 financial | — |
| Team management | ✅ | — | — | — |
| Property settings, **payout UPI ID** | ✅ (UPI: L3) | — | — | — |
| Subscription & billing | ✅ | — | — | — |

✅ allowed · ⏳ needs owner approval · ✏️ can draft · 👁 view only · — no access. Managers and Accountants only see their assigned properties.

### 7.5 Owner actions that need confirmation or approval

| Action | Level | Why |
| --- | --- | --- |
| Record payment | L0 + undo | Common. Undo creates a reversal entry, not a deletion |
| Remove a payment entry | L2 | Money. Reason stays in history |
| Adjust a month's dues / waive late fee | L2 | Money |
| Vacate resident | L1 | Reversible (restore) |
| Permanently delete resident (+ dues, complaints) | L3 | Irreversible. Blocked while unpaid dues or deposit are unsettled |
| Send reminders to n residents | L1 with message preview | Visible to residents |
| Publish notice to all residents | L1 | Visible to everyone |
| Approve deposit settlement | L2 | Money leaves the owner |
| **Change payout UPI ID / bank details** | L3 + 24 h hold, cancellable from email/SMS | #1 fraud vector: a stolen session would redirect all rent |
| Change login email, disable 2FA | L3 | Account takeover |
| Invite staff / change role | L1 / L2 | Grants access |
| Remove staff | L1 | Sessions revoked immediately |
| Delete property | L3 (type the name) | Only with zero active tenancies |
| Export all data | L3 | Bulk personal data |
| Cancel subscription | L2 | Shows what read-only mode means plus the 90-day promise |
| Delete account | L3 + 7-day cooling-off | §9.1 |
| Approve PGBook support access | Owner's own decision | Read-only by default; write is a separate tick |

---

## 8. Tenant (Resident)

### 8.1 Who they manage

Only themselves: their profile, emergency contact, documents, payments they report, their requests and complaints.

### 8.2 What they can see

| Data | Visibility |
| --- | --- |
| Their own dues, payments, receipts (all months, PDF download) | ✅ |
| Their tenancy: room, bed, move-in date, rent breakdown (rent + food + utilities), deposit held, agreement, notice period | ✅ |
| Utility bill they were charged for (total, split, their share) | ✅ (not who else was charged) |
| Notices, house rules, food menu for their property | ✅ |
| Their complaints and requests with full timeline | ✅ |
| Roommates | First names only, and only if both opt in |
| Other residents' data, owner's finances, staff notes | ❌ |
| Former stays at other PGs | Their own history only (their own data) |

### 8.3 Tenant app (mobile-first web app, no install)

Bottom navigation: **Home · Pay · Requests · Complaints · Me**

```
┌───────────────────────────────┐
│ Sunrise PG · Room B-204       │
│ Hi Priya 👋                   │
│ ┌───────────────────────────┐ │
│ │ October rent due ₹11,607  │ │
│ │ Due by 5 Oct · 4 days left│ │
│ │ [ Pay via UPI ]           │ │  ← upi://pay?pa=<owner UPI>&am=11607&tn=Rent Oct B-204
│ │ Already paid? Tell us ›   │ │  ← creates a PaymentClaim
│ └───────────────────────────┘ │
│ 📢 Water off Sun 10–2 (ack ✓) │
│ 🔧 Geyser — In progress       │
│ ───────────────────────────── │
│ Home  Pay  Requests  🔧  Me    │
└───────────────────────────────┘
```

| Screen | What the tenant does |
| --- | --- |
| **Home** | Amount due, due date, pay via UPI deep link, "I've paid" claim, latest notices, complaint status |
| **Pay** | Month-by-month dues and payments, download receipts (HRA), claim status (pending/approved/rejected + reason) |
| **Requests** | Give move-out notice (shows earliest date per notice period and deposit implications), room change, overnight guest, profile changes |
| **Complaints** | Raise with category, photos and "OK to enter my room when I'm out"; track the timeline; confirm fixed or reopen; rate |
| **Me** | Profile, emergency contact, KYC upload and status, deposit statement, agreement, house rules (acknowledged version), notification and language preferences (EN/हिंदी), privacy (download my data, request deletion, consents) |

### 8.4 Tenant actions and confirmations

| Action | Level | What happens next |
| --- | --- | --- |
| Report a payment ("I've paid") | L1 (confirm amount and UTR) | → owner approval. Duplicate UTR is auto-flagged |
| Give move-out notice | L1 with notice-period and deposit summary | → owner acknowledges. Can withdraw until acknowledged |
| Request room change / guest stay | L1 | → owner approves or rejects with reason |
| Raise complaint | L0 | → owner/caretaker. Can withdraw while still *open* |
| Confirm complaint fixed / reopen | L0 | Auto-closes 72 h after "resolved" if no response |
| Accept / dispute deposit settlement | L1 | Dispute keeps it open with the tenant's comment |
| Update phone number | OTP on new number | It's their login |
| Update KYC document | L0 | → owner/manager re-review |
| Request data deletion | L2 | Explains that the owner may have to keep financial records by law |

### 8.5 What a tenant can never do

Mark their own dues as paid · edit amounts · see other residents · delete a complaint after work has started · access the PG after becoming *former*, except for read-only receipts and settlement.

---

## 9. Cross-role workflows

### 9.1 Subscription lifecycle (owner ↔ platform)

```
signup ─▶ TRIALING (14 d) ─▶ ACTIVE ─▶ PAST_DUE (retries D+1, D+3, D+7; full access + banner)
              │                ▲  │            │
              │ trial ends     │  │ cancel     ▼ 14 days unpaid
              ▼                │  ▼          READ_ONLY ◀────────────┐
          READ_ONLY ───pay─────┘ CANCELLED ──▶ (view + export only)  │
          (view + export,        │                                   │
           residents keep        └─ 90 days ─▶ DELETION_SCHEDULED ─▶ DELETED
           receipts)                (emails at D-30, D-7, D-1;   (billing invoices kept as tax law requires)
                                     reactivation possible)
```

Plan limits: adding tenant #51 on Pro shows "Upgrade to Multi-PG". Recording payments, receipts and exports **never** block.

### 9.2 Resident onboarding

```
Owner adds tenancy ──┐                         Resident opens property join link
                     ▼                                         │
               INVITED (link via WhatsApp, single-use, 7 d) ◀──┴─▶ PENDING (owner approves)
                     ▼
     Phone OTP ─▶ consent screen (privacy notice, house rules) ─▶ profile + KYC upload
                     ▼
     KYC review by owner/manager ─▶ ACTIVE  (or "changes requested" → back to resident)
```

The portal is optional: an owner can run everything without residents ever activating, exactly as today.

### 9.3 Payment claim (tenant → owner)

```
Tenant "I've paid" (amount, date, UTR, screenshot) ─▶ PENDING ─▶ notify owner/accountant
   ├─ approve ─▶ transaction created (source: claim, approvedBy) ─▶ receipt available to tenant
   ├─ reject (reason) ─▶ tenant notified
   └─ 48 h no action ─▶ reminder to owner
Duplicate UTR or amount > balance ─▶ flagged for the reviewer
```

### 9.4 Cash handover (caretaker → owner)

The caretaker records cash per resident → a **pending** entry, not yet on the ledger → at handover, the owner or accountant confirms the total received → entries post to the ledger with `collectedBy` and `confirmedBy`. Any mismatch is recorded with a reason.

### 9.5 Move-out and deposit settlement

```
Notice (tenant or owner) ─▶ ON NOTICE (earliest date = notice + property notice days)
   ─▶ move-out day: caretaker inspection checklist (+ photos)
   ─▶ settlement draft: deposit − unpaid dues − damages (itemized) − notice shortfall
   ─▶ owner approves (L2) ─▶ shared with tenant ─▶ accept │ dispute (comment, stays open)
   ─▶ refund recorded (UTR) ─▶ tenancy CLOSED ─▶ resident becomes FORMER
```

PGBook does not arbitrate disputes. It keeps an honest record both sides can see.

### 9.6 Complaint lifecycle

`OPEN → ACKNOWLEDGED → ASSIGNED (caretaker) → IN PROGRESS → RESOLVED → CLOSED` (tenant confirms, or auto-close after 72 h). Reopen is allowed within 7 days.
SLA by priority: high 24 h · medium 72 h · low 7 days. A breach notifies the owner.

### 9.7 Support access (admin ↔ owner)

```
Agent (from ticket #) requests: scope read|write, ≤ 60 min, reason
   ─▶ owner gets in-app + email request ─▶ approve │ deny
   ─▶ SESSION (banner for the agent, every page view and change logged, auto-expires)
   ─▶ owner sees the session in Activity
Break-glass (owner unreachable + legal/security emergency): Compliance approval (L4) ─▶ owner notified afterwards
```

### 9.8 Granting an admin role

Super Admin A invites, choosing role and reason → Super Admin B approves → invitee must enrol 2FA before first access → audit events throughout.

---

## 10. Permission matrix (summary)

| Capability | SA | Billing | Support | Compl. | Analyst | Owner | Mgr | Acct | Caretaker | Tenant |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| Platform KPIs (aggregated) | ✅ | ✅ | 👁 | 👁 | ✅ | — | — | — | — | — |
| Owner accounts list/detail | ✅ | 👁 | ✅ | 👁 | 🔢 | self | — | — | — | — |
| Extend trial | ✅ | ✅ | ≤14d | — | — | — | — | — | — | — |
| Change plan | ✅ | ✅ | — | — | — | own plan | — | — | — | — |
| Refund ≤ ₹5,000 / above | ✅ / ⏳ | ✅ / ⏳ | — | — | — | — | — | — | — | — |
| Suspend / reactivate org | ✅ | ✅ | ⏳ | ✅ | — | — | — | — | — | — |
| Support session | ✋ | — | ✋ | ✋ | — | grants | — | — | — | — |
| Resident PII | ✋ | — | ✋ | ✋/⏳ | — | ✅ | ✅ | 🔒 | 🔒 | self |
| Rent ledger write | — | — | — | — | — | ✅ | ✅ | ✅ | ⏳ cash | claim |
| Remove payment entry | — | — | — | — | — | L2 | ⏳ | ⏳ | — | — |
| Deposit settlement | — | — | — | — | — | ✅ | ✏️ | ✏️ | ✏️ | accept/dispute |
| Complaints | — | — | 👁 meta | — | 🔢 | ✅ | ✅ | — | ✅ | own |
| Notices | — | — | — | — | — | ✅ | ✅ | — | ✅ | read/ack |
| Payout UPI ID | — | — | — | — | — | L3 | — | — | — | — |
| Export all data | ⏳ | — | — | ✅ L3 | — | L3 | — | — | — | own data |
| Feature flags / settings | ✅ (some ⏳) | — | — | — | — | — | — | — | — | — |
| Admin team | ⏳ | — | — | — | — | — | — | — | — | — |
| Audit log | ✅ | 👁 billing | 👁 | ✅ | — | own org | — | — | — | — |

✅ allowed · 👁 view · 🔢 counts only · 🔒 masked · ✋ owner-consented session · ⏳ approval required · ✏️ draft · — none

---

## 11. Deliberately NOT building

- **A shared "tenant blacklist" or defaulter database across owners.** It's often requested in this market, but it's a privacy and defamation liability. One owner's view of a resident never leaks to another.
- **PGBook collecting rent and paying owners out.** That would make PGBook a payment aggregator under RBI rules. UPI direct to the owner (today's approach) avoids it.
- **Admin "edit any record" god-mode.** Support writes happen only inside consented, attributed sessions.
- **Storing full Aadhaar numbers.** Masked (last 4) only. Documents are encrypted with access logged.

---

## 12. Notifications

| Event | Owner/staff | Tenant | Admin |
| --- | --- | --- | --- |
| Payment claim submitted / decided | In-app + WhatsApp | In-app + WhatsApp | — |
| Dues generated / due tomorrow / overdue | Digest | WhatsApp/SMS | — |
| Complaint created / SLA breach / resolved | In-app (+ WhatsApp on high) | In-app | — |
| Move-out notice / settlement ready | In-app + email | In-app + WhatsApp | — |
| Payout UPI changed | Email + SMS (cancel link) | — | Trust & Safety signal |
| Support access requested / used | In-app + email | — | Ticket |
| Trial ending / renewal failed / read-only | Email + in-app | — | Revenue queue |
| Approval waiting / decided | In-app | In-app | In-app |

---

## 13. Mapping onto the current codebase

| Need | Where it goes |
| --- | --- |
| Realms | `pgbook_session` (org, exists), new `pgbook_admin`, `pgbook_resident`. `aud` claim in `src/lib/auth.js`. Middleware matchers for `/admin` and `/t`. |
| Permission checks | New `src/lib/policy.js` (`can(actor, capability, target)`). Extend `route()` in `src/lib/api.js` with `{ realm, permission }` and resolve the actor's org and property scope there. |
| Org scoping | Treat today's `userId` as `orgId` in phase 1. Rename and add `propertyId` in the property migration. |
| Audit | `audit(actor, action, target, { before, after, reason })` helper. `AuditEvent` has no update/delete routes. |
| Approvals | `ApprovalRequest` + a handler registry: `APPROVALS[type] = { authorize, execute }`, re-validated at execution. |
| Scheduled jobs | `/api/cron/*` (dues generation, reminders, trial expiry, dunning, retention purge) behind a secret header, run by Vercel Cron or a worker. |
| Migration | One `Property` per owner from `pgSettings`. Backfill `Room`/`Bed` from distinct `tenant.room` values. `Tenant` → `Tenancy`. `Payment` → `RentDue` (alias the model to avoid churn). |
| Ledger integrity | Replace "delete transaction" with a reversal entry plus reason (the API already requires an approval-ready shape). |

---

## 14. Phased roadmap

| Phase | Scope | Size |
| --- | --- | --- |
| **1. Foundation + SuperAdmin core** ✅ *built* | Policy layer, AuditEvent, ApprovalRequest, admin realm with mandatory 2FA, Command Center (from existing data), Owners list/detail, suspend/reactivate/force-logout/extend-trial, Audit Log, Admin Team. Owner gets an Activity page. | L |
| **2. Plans & billing** | Subscription model, trial lifecycle, plan limits, Razorpay subscriptions, GST invoices, dunning, read-only mode, export + 90-day retention, admin Revenue screens | L |
| **3. Properties & team** ✅ *built* | Property and Room models (beds are a room's capacity rather than separate records) with a lazy, per-account migration of old single-PG accounts; property switcher; staff invites (single-use link, 7 days), Manager / Accountant / Caretaker roles with per-property access; owner Approvals inbox (dues changes, payment removal); cash handover; expenses with profit & loss; late-fee rules; recurring charges such as food. Manager direct-change limit: ₹1,000 per month's dues. | L |
| **4. Resident portal** | Phone OTP realm, invites and join links, payment claims, tenant complaints with photos, receipts download, notices, requests, move-out and deposit settlement | XL |
| **5. Compliance & scale** | DPDP request tooling, consent versions, support sessions with consent, break-glass, announcements, feature flags, Trust & Safety signals, WhatsApp Business API automation | L |

Phase 1 is buildable right now with no external accounts. Phases 2 and 4 need providers (below).

---

## 15. Decisions needed

1. ~~**Multi-property now or later?**~~ Built in Phase 3.
2. **Tenant login:** phone OTP needs an SMS/WhatsApp provider (e.g. MSG91, Gupshup, Twilio). Recommended: WhatsApp OTP with SMS fallback.
3. **Rent payments:** keep UPI-direct to owner (recommended) vs collecting through PGBook (regulatory burden).
4. **Subscription billing provider and GST registration** (Razorpay Subscriptions is the usual choice in India).
5. ~~**Staff roles at launch?**~~ All three built in Phase 3.
6. **Thresholds:** refund approval limit (₹5,000 proposed), manager waiver limit, notice period default, complaint SLAs.
7. **Legal:** privacy policy, terms, DPA with owners, retention periods — needs counsel before tenant data flows through a resident portal.
