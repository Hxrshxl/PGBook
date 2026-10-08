// Creates (or resets) a demo account with ~18 months of realistic history:
// two PGs in Bengaluru (a 60-bed one and a 22-bed one that opened 8 months
// ago) with rooms and beds, tenants moving in and out, pro-rated first months,
// food plans, utility bills split between residents, payments with different
// habits (on time, late with late fees, in instalments, defaulters), running
// expenses for profit & loss, a staff team (manager, accountant, caretaker)
// with cash handovers and approval requests, and a steady stream of complaints.
//
//   npm run seed                                   → resets demo@pgbook.app / Demo@1234 (with staff logins)
//   npm run seed -- --email=you@example.com        → loads it into YOUR existing (empty) account
//   npm run seed -- --email=you@example.com --keep-existing
//                                                  → adds the sample data next to records you already have
//   npm run seed -- --email=you@example.com --replace
//                                                  → wipes that account's tenants, dues, bills, complaints,
//                                                    rooms, expenses and properties first, then loads the sample data
//   add --with-staff to also give that account the demo staff logins
//
// With --email, your name, login and password are kept. Your first property gets the
// bigger sample building (only empty settings get sample values); the second building
// is added as a new property.
// The data is generated from a fixed random seed relative to today's date, so every
// run looks the same and current.
// Refuses to run with NODE_ENV=production unless --force is passed.
import mongoose from 'mongoose'
import User from './models/User.js'
import Tenant from './models/Tenant.js'
import Payment from './models/Payment.js'
import UtilityBill from './models/UtilityBill.js'
import Complaint from './models/Complaint.js'
import Property from './models/Property.js'
import Room from './models/Room.js'
import Expense from './models/Expense.js'
import CashCollection from './models/CashCollection.js'
import Membership from './models/Membership.js'
import ApprovalRequest, { APPROVAL_TTL_MS } from './models/ApprovalRequest.js'
import {
  calcLateFee, formatCurrency, formatDate, formatMonth, getBalance, getPrevMonth, PAYMENT_METHOD_LABELS, roundMoney, splitAmount, todayISO,
} from '../utils/helpers.js'

const DEMO_EMAIL = 'demo@pgbook.app'
const DEMO_PASSWORD = 'Demo@1234'
const TZ = 'Asia/Kolkata'
const HISTORY_MONTHS = 18

if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
  console.error('Refusing to seed with NODE_ENV=production (pass --force to override).')
  process.exit(1)
}
if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not set. Copy .env.example to .env.local first.')
  process.exit(1)
}

// ── Which account gets the data ───────────────────────────────

const emailArg = process.argv.find(a => a.startsWith('--email='))?.slice('--email='.length).trim().toLowerCase()
const REPLACE = process.argv.includes('--replace')
const KEEP_EXISTING = process.argv.includes('--keep-existing')
const TARGET_EMAIL = emailArg || DEMO_EMAIL
const IS_DEMO = TARGET_EMAIL === DEMO_EMAIL
const WITH_STAFF = IS_DEMO || process.argv.includes('--with-staff')

const STAFF = [
  { key: 'manager',    name: 'Priya Nair',   email: 'manager@pgbook.app',    role: 'manager' },
  { key: 'accountant', name: 'Arun Mehta',   email: 'accountant@pgbook.app', role: 'accountant' },
  { key: 'caretaker',  name: 'Suresh Gowda', email: 'caretaker@pgbook.app',  role: 'caretaker', onlyMain: true },
]

await mongoose.connect(process.env.MONGODB_URI)
const MODELS = [User, Tenant, Payment, UtilityBill, Complaint, Property, Room, Expense, CashCollection, Membership, ApprovalRequest]
await Promise.all(MODELS.map(m => m.syncIndexes()))

const BY_USER = [Tenant, Payment, UtilityBill, Complaint]       // org field: userId
const BY_ORG = [Property, Room, Expense, CashCollection]          // org field: orgId
let targetUser = null
if (!IS_DEMO) {
  targetUser = await User.findOne({ email: TARGET_EMAIL })
  if (!targetUser) {
    console.error(`No account found for ${TARGET_EMAIL}. Sign up in the app first, then run this again.`)
    await mongoose.disconnect()
    process.exit(1)
  }
  if (targetUser.kind === 'staff') {
    console.error(`${TARGET_EMAIL} is a staff login, not an owner account.`)
    await mongoose.disconnect()
    process.exit(1)
  }
  const existingRecords = (await Promise.all([
    ...BY_USER.map(m => m.countDocuments({ userId: targetUser._id })),
    Expense.countDocuments({ orgId: targetUser._id }),
  ])).reduce((a, b) => a + b, 0)
  if (existingRecords > 0 && !REPLACE && !KEEP_EXISTING) {
    console.error(`${TARGET_EMAIL} already has ${existingRecords} records. Re-run with --keep-existing to add sample data alongside them, or --replace to DELETE them first.`)
    await mongoose.disconnect()
    process.exit(1)
  }
}
if (WITH_STAFF) {
  const clash = await User.findOne({ email: { $in: STAFF.map(s => s.email) }, kind: { $ne: 'staff' } }).select('email')
  if (clash) {
    console.error(`${clash.email} is an owner account, so it can't be used as a demo staff login.`)
    await mongoose.disconnect()
    process.exit(1)
  }
}

// ── Deterministic randomness ──────────────────────────────────

function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20240401)
const int = (min, max) => min + Math.floor(rand() * (max - min + 1))
const pick = list => list[Math.floor(rand() * list.length)]
const chance = p => rand() < p
function weighted(options) {
  const total = Object.values(options).reduce((a, b) => a + b, 0)
  let r = rand() * total
  for (const [key, weight] of Object.entries(options)) {
    if ((r -= weight) < 0) return key
  }
  return Object.keys(options)[0]
}
function shuffle(list) {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
const digits = n => Array.from({ length: n }, () => int(0, 9)).join('')
const letters = n => Array.from({ length: n }, () => String.fromCharCode(65 + int(0, 25))).join('')
const oid = () => new mongoose.Types.ObjectId()

// ── Dates ─────────────────────────────────────────────────────

const TODAY = todayISO(TZ)
const M0 = TODAY.slice(0, 7)
const TODAY_DAY = Number(TODAY.slice(8))
const NOW = new Date()
const pad = n => String(n).padStart(2, '0')
const daysIn = month => { const [y, m] = month.split('-').map(Number); return new Date(y, m, 0).getDate() }
const dateIn = (month, day) => `${month}-${pad(Math.max(1, Math.min(day, daysIn(month))))}`
const at = (isoDate, hour = 10, minute = 0) => new Date(`${isoDate}T${pad(hour)}:${pad(minute)}:00+05:30`)
const lastDayOf = month => (month === M0 ? TODAY_DAY : daysIn(month))
const monthOf = isoDate => isoDate.slice(0, 7)
const addDays = (isoDate, n) => new Date(Date.parse(`${isoDate}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
const notFuture = isoDate => (isoDate > TODAY ? TODAY : isoDate)

const MONTHS = [M0]
while (MONTHS.length < HISTORY_MONTHS) MONTHS.unshift(getPrevMonth(MONTHS[0]))
const monthsAgo = month => MONTHS.length - 1 - MONTHS.indexOf(month)

// ── The buildings ─────────────────────────────────────────────

const ROOM_TYPES = {
  single: { beds: 1 },
  double: { beds: 2 },
  triple: { beds: 3 },
}
const roomSet = (specs) => specs.flatMap(([prefix, start, count, type, min, max]) =>
  Array.from({ length: count }, (_, i) => ({ name: `${prefix}${start + i}`, type, rent: Math.round(int(min, max) / 500) * 500 })))

const BUILDINGS = [
  {
    key: 'main',
    property: {
      name: 'Sunrise PG — Indiranagar', address: '14, 3rd Cross, Indiranagar, Bengaluru — 560038', city: 'Bengaluru',
      phone: '9876543210', ownerName: 'Rajesh Kumar', upiId: 'sunrisepg@okicici', logoText: 'Sunrise PG', gstin: '29ABCPK1234F1Z5',
      rentDueDay: 5, noticePeriodDays: 30, lateFee: { enabled: true, graceDays: 5, type: 'perDay', amount: 50, maxAmount: 500 },
    },
    rooms: roomSet([
      ['A-', 101, 6, 'single', 15000, 16500],
      ['A-', 107, 6, 'double', 10500, 12000],
      ['B-', 201, 12, 'double', 10500, 12000],
      ['C-', 301, 6, 'triple', 8000, 9000],
    ]),
    opensMonthsAgo: null, // already running when the history starts
    food: { label: 'Food (3 meals)', amount: 3500, share: 0.7 },
    internet: [5899, 'ACT Fibernet 300 Mbps', 'ACT Fibernet'],
    lease: [240000, 'Building lease — M. Krishnappa'],
    salaries: [['Ramesh (cook)', 17000], ['Kitchen helper — Manju', 10000], ['Lakshmi (housekeeping)', 12000], ['Mahesh (housekeeping)', 12000], ['Night guard — Bahadur', 14000]],
    propertyTax: 42000,
    complaintsPerMonth: [3, 6],
  },
  {
    key: 'second',
    property: {
      name: 'Sunrise PG — Koramangala', address: '22, 5th Block, Koramangala, Bengaluru — 560095', city: 'Bengaluru',
      phone: '9876501234', ownerName: 'Rajesh Kumar', upiId: 'sunrisekoramangala@okhdfcbank', logoText: 'Sunrise PG Koramangala', gstin: '',
      rentDueDay: 1, noticePeriodDays: 30, lateFee: { enabled: true, graceDays: 3, type: 'flat', amount: 300, maxAmount: 0 },
    },
    rooms: roomSet([
      ['K-', 101, 4, 'single', 16500, 17500],
      ['K-', 201, 6, 'double', 12000, 13000],
      ['K-', 301, 2, 'triple', 9000, 10000],
    ]),
    opensMonthsAgo: 8,
    food: { label: 'Food (breakfast + dinner)', amount: 3000, share: 0.6 },
    internet: [3999, 'Airtel Xstream 200 Mbps', 'Airtel'],
    lease: [110000, 'Building lease — S. Rao'],
    salaries: [['Anitha (cook)', 15000], ['Ravi (housekeeping)', 11000]],
    propertyTax: 18000,
    complaintsPerMonth: [1, 3],
  },
]
// With --email (and without --replace), reuse the account's first property for the big building
// and an earlier sample "Koramangala" property, so re-running doesn't pile up properties.
if (targetUser && !REPLACE) {
  BUILDINGS[0].reuse = (await Property.findOne({ orgId: targetUser._id, status: 'active' }).sort({ createdAt: 1 }).select('_id'))?._id
  for (const b of BUILDINGS.slice(1)) {
    b.reuse = (await Property.findOne({ orgId: targetUser._id, name: b.property.name, status: 'active' }).select('_id'))?._id
  }
}
for (const b of BUILDINGS) {
  b.propertyId = b.reuse ?? oid()
  b.beds = b.rooms.flatMap(room => Array.from({ length: ROOM_TYPES[room.type].beds }, () => ({ room, tenant: null, freedIn: null })))
  b.totalBeds = b.beds.length
  b.openMonth = b.opensMonthsAgo ? MONTHS[MONTHS.length - 1 - b.opensMonthsAgo] : null
  b.runs = month => !b.openMonth || month >= b.openMonth
}
const MAIN = BUILDINGS[0]

// ── People ────────────────────────────────────────────────────

const FIRST_NAMES = [
  'Aarav', 'Aditi', 'Akash', 'Ananya', 'Arjun', 'Bhavna', 'Chetan', 'Deepika', 'Dev', 'Divya', 'Farhan', 'Gauri',
  'Harsh', 'Ishaan', 'Isha', 'Jatin', 'Kavya', 'Karthik', 'Lakshmi', 'Manish', 'Meera', 'Mohit', 'Neha', 'Nikhil',
  'Pooja', 'Pranav', 'Priya', 'Rahul', 'Rakesh', 'Ritu', 'Rohan', 'Sahil', 'Sanjana', 'Shreya', 'Siddharth', 'Sneha',
  'Suresh', 'Tanvi', 'Tarun', 'Uday', 'Varun', 'Vidya', 'Vikram', 'Yash', 'Zoya', 'Abhishek', 'Ayesha', 'Gaurav',
  'Kiran', 'Lokesh', 'Nandini', 'Omkar', 'Pallavi', 'Riya', 'Sameer', 'Swati', 'Tejas', 'Vaishnavi', 'Imran', 'Joseph',
]
const LAST_NAMES = [
  'Sharma', 'Verma', 'Iyer', 'Reddy', 'Nair', 'Patel', 'Gupta', 'Rao', 'Menon', 'Kulkarni', 'Joshi', 'Singh',
  'Das', 'Mukherjee', 'Pillai', 'Shetty', 'Hegde', 'Chopra', 'Malhotra', 'Bhat', 'Desai', 'Kapoor', 'Mishra', 'Naidu',
  'Saxena', 'Agarwal', 'Banerjee', 'Fernandes', 'Khan', 'Thomas', 'Chauhan', 'Gowda', 'Kamath', 'Pandey', 'Varghese',
]
const PARENT_NAMES = ['Ramesh', 'Sunita', 'Prakash', 'Lata', 'Mahesh', 'Geeta', 'Ravi', 'Shobha', 'Anil', 'Usha', 'Vijay', 'Kamala']
const TENANT_NOTES = [
  'Works at Infosys, Electronic City', 'Student at Christ University', 'Vegetarian — no egg in meals',
  'Bike: KA-03-HM-4821', 'Night shift — late entry permitted', 'Works at Wipro, Sarjapur Road',
  'Company: Flipkart, Bellandur', 'MBA intern — 6 month stay planned', 'Prefers lower bunk',
  'Works at Accenture, Whitefield', 'Car parked in visitor slot with permission', 'Jain food',
]

const usedNames = new Set()
const usedPhones = new Set()
function uniquePhone() {
  let phone
  do phone = pick(['6', '7', '8', '9']) + digits(9)
  while (usedPhones.has(phone))
  usedPhones.add(phone)
  return phone
}
function idDocument() {
  const type = weighted({ aadhaar: 60, pan: 14, dl: 10, passport: 8, voter: 8 })
  const number = {
    aadhaar: `XXXX-XXXX-${digits(4)}`,
    pan: `${letters(5)}${digits(4)}${letters(1)}`,
    dl: `KA${pad(int(1, 70))}-${int(2010, 2022)}${digits(7)}`,
    passport: `${letters(1)}${digits(7)}`,
    voter: `${letters(3)}${digits(7)}`,
  }[type]
  return { idType: type, idNumber: number }
}

const userId = targetUser?._id ?? oid()
const tenants = []

function newTenant(building, bed, moveInDate) {
  let first, last
  do { first = pick(FIRST_NAMES); last = pick(LAST_NAMES) } while (usedNames.has(`${first} ${last}`))
  usedNames.add(`${first} ${last}`)
  const rentAmount = bed.room.rent + pick([0, 0, 0, 500, -500])
  const recurringCharges = []
  if (chance(building.food.share)) recurringCharges.push({ label: building.food.label, amount: building.food.amount })
  if (chance(0.2)) recurringCharges.push({ label: 'Laundry', amount: 500 })
  const tenant = {
    _id: oid(),
    userId,
    building,
    name: `${first} ${last}`,
    phone: uniquePhone(),
    email: chance(0.7) ? `${first}.${last}${int(1, 99)}@example.com`.toLowerCase() : '',
    room: bed.room.name,
    roomRef: bed.room,
    rentAmount,
    depositAmount: bed.room.type === 'triple' ? rentAmount : rentAmount * 2,
    moveInDate,
    moveOutDate: null,
    status: 'active',
    recurringCharges,
    ...idDocument(),
    emergencyContact: {
      name: `${pick(PARENT_NAMES)} ${last}`,
      phone: uniquePhone(),
      relation: pick(['Father', 'Mother', 'Father', 'Mother', 'Brother', 'Sister', 'Uncle', 'Spouse']),
    },
    notes: chance(0.35) ? pick(TENANT_NOTES) : '',
    // Payment habit — used only by this script
    habit: weighted({ punctual: 55, late: 25, instalments: 12, defaulter: 8 }),
  }
  bed.tenant = tenant
  tenants.push(tenant)
  return tenant
}

// ── Simulate occupancy month by month ─────────────────────────

for (const b of BUILDINGS) {
  // People already living there when the history starts.
  if (!b.openMonth) {
    for (const bed of b.beds) {
      if (!chance(0.8)) continue
      let month = MONTHS[0]
      for (let i = int(1, 20); i > 0; i--) month = getPrevMonth(month)
      newTenant(b, bed, dateIn(month, int(1, 28)))
    }
  }

  for (const month of MONTHS) {
    if (!b.runs(month)) continue
    const isCurrent = month === M0
    const lastDay = lastDayOf(month)
    const sinceOpen = b.openMonth ? MONTHS.indexOf(month) - MONTHS.indexOf(b.openMonth) : 99

    // Move-outs (never someone who moved in this same month)
    for (const bed of b.beds) {
      const t = bed.tenant
      if (!t || monthOf(t.moveInDate) === month) continue
      if (chance(isCurrent ? 0.02 : 0.055)) {
        t.moveOutDate = dateIn(month, int(1, Math.min(lastDay, 28)))
        t.status = 'vacated'
        bed.tenant = null
        bed.freedIn = month
      }
    }

    // Move-ins, refilling towards a target occupancy (a new building fills up over its first months)
    const share = sinceOpen === 0 ? 0.35 : sinceOpen === 1 ? 0.6 : sinceOpen === 2 ? 0.75 : isCurrent ? 0.86 : 0.8 + rand() * 0.15
    const target = Math.round(b.totalBeds * share)
    let occupied = b.beds.filter(x => x.tenant).length
    const maxMoveIns = isCurrent ? 2 : sinceOpen <= 2 ? 10 : 8
    let moved = 0
    for (const bed of shuffle(b.beds.filter(x => !x.tenant && x.freedIn !== month))) {
      if (occupied >= target || moved >= maxMoveIns) break
      newTenant(b, bed, dateIn(month, int(1, Math.min(lastDay, 28))))
      occupied++
      moved++
    }
  }
}

const presentIn = (t, month) => monthOf(t.moveInDate) <= month && (!t.moveOutDate || monthOf(t.moveOutDate) >= month)

// ── Utility bills (split between residents; the owner pays the supplier) ──

const bills = []
const expenses = []
const shareByKey = new Map() // `${tenantId}:${month}` → total utility share
const OWNER_ACTOR = { id: userId, name: targetUser?.name ?? 'Rajesh Kumar', role: 'owner' }

function addExpense(b, isoDate, category, amount, paidTo, method, note = '', recordedBy = null) {
  if (isoDate > TODAY) return
  expenses.push({
    orgId: userId, propertyId: b.propertyId, date: isoDate, category, amount: roundMoney(amount), paidTo, method, note,
    recordedBy: recordedBy ?? OWNER_ACTOR, createdAt: at(isoDate, int(9, 20), int(0, 59)),
  })
}

const BILL_EXPENSE = {
  electricity: ['utilities', 'BESCOM'], water: ['utilities', 'BWSSB'], gas: ['utilities', 'Indane Gas agency'],
  maintenance: ['maintenance', null], internet: ['internet', null], other: ['other', null],
}
function addBill(b, month, type, totalAmount, note, day, supplier) {
  const present = tenants.filter(t => t.building === b && presentIn(t, month))
  if (!present.length) return
  const shares = splitAmount(totalAmount, present.length)
  const allocations = present.map((t, i) => ({ tenantId: t._id, amount: shares[i] }))
  for (const a of allocations) {
    const key = `${a.tenantId}:${month}`
    shareByKey.set(key, roundMoney((shareByKey.get(key) ?? 0) + a.amount))
  }
  const billDate = dateIn(month, Math.min(day, lastDayOf(month)))
  const created = at(billDate, 11, int(0, 59))
  bills.push({
    userId, propertyId: b.propertyId, month, type, totalAmount: roundMoney(totalAmount), perTenantAmount: shares[0],
    tenantCount: present.length, splitMethod: 'equal', note, allocations, createdAt: created, updatedAt: created,
  })
  const [category, paidTo] = BILL_EXPENSE[type]
  addExpense(b, notFuture(addDays(billDate, int(0, 4))), category, totalAmount, supplier ?? paidTo ?? note, type === 'maintenance' ? 'cash' : 'bank', note)
}

for (const b of BUILDINGS) {
  for (const month of MONTHS) {
    if (!b.runs(month)) continue
    const mm = Number(month.slice(5))
    const headcount = tenants.filter(t => t.building === b && presentIn(t, month)).length
    addBill(b, month, 'internet', b.internet[0], b.internet[1], 1, b.internet[2])
    if (month === M0) continue // the rest of this month's bills haven't arrived yet

    const perHead = [3, 4, 5, 6].includes(mm) ? int(650, 820) : [7, 8, 9, 10].includes(mm) ? int(450, 560) : int(380, 480)
    const units = Math.round((headcount * perHead) / 8.5)
    addBill(b, month, 'electricity', headcount * perHead + int(0, 99) + int(0, 99) / 100, `BESCOM · ${units.toLocaleString('en-IN')} units`, int(3, 6))
    const waterBase = b === MAIN ? int(3200, 4800) : int(1400, 2200)
    addBill(b, month, 'water', waterBase + ([4, 5].includes(mm) ? (b === MAIN ? 2400 : 1200) : 0), [4, 5].includes(mm) ? 'BWSSB + water tankers' : 'BWSSB', int(4, 8))
    addBill(b, month, 'gas', (b === MAIN ? int(36, 48) : int(16, 22)) * 100, `${b === MAIN ? int(4, 5) : 2} commercial cylinders (kitchen)`, int(2, 10))
    if (mm % 3 === 0) addBill(b, month, 'maintenance', b === MAIN ? 2400 : 1500, 'Quarterly pest control', int(10, 20), 'Pest control service')
    if (chance(0.3)) {
      const job = pick(['Water pump repair', 'Geyser replacement — 2nd floor', 'Common area painting', 'RO filter service', 'Terrace waterproofing patch', 'Washing machine repair'])
      addBill(b, month, 'maintenance', int(12, 45) * 100, job, int(8, 25), job)
    }
  }
}

// ── Dues, payments and late fees ──────────────────────────────

const METHOD_WEIGHTS = { upi: 68, cash: 14, bank: 14, card: 4 }
function receipt(amount, isoDate, method = weighted(METHOD_WEIGHTS), note) {
  const auto = {
    upi: chance(0.45) ? `UPI ref ${digits(12)}` : '',
    bank: `NEFT ${letters(4)}${digits(9)}`,
    cash: chance(0.2) ? 'Collected at office' : '',
    card: '',
    other: '',
  }[method]
  return { amount: roundMoney(amount), date: isoDate, method, note: note ?? auto, createdAt: at(isoDate, int(8, 21), int(0, 59)) }
}
const roundTo500 = (n, total) => Math.min(total - 100, Math.max(500, Math.round(n / 500) * 500))

/** Picks a day in [from, to] of `month` that is not in the future, or null. */
function dayIn(month, from, to) {
  const max = Math.min(to, lastDayOf(month))
  return from > max ? null : int(from, max)
}

function plannedPayments(t, month, total) {
  const age = monthsAgo(month)
  const txns = []
  const pay = (amount, month_, day, method, note) => { if (day !== null) txns.push(receipt(amount, dateIn(month_, day), method, note)) }

  // First month: paid at move-in
  if (monthOf(t.moveInDate) === month) {
    pay(total, month, Number(t.moveInDate.slice(8)), weighted({ upi: 60, bank: 30, cash: 10 }), 'Paid at move-in')
    return txns
  }

  // Final month: often settled from the security deposit
  if (t.moveOutDate && monthOf(t.moveOutDate) === month) {
    const outDay = Number(t.moveOutDate.slice(8))
    const roll = rand()
    if (roll < 0.35) pay(total, month, outDay, 'other', 'Adjusted from security deposit')
    else if (roll < 0.45) pay(roundTo500(total * 0.6, total), month, Math.min(outDay, 5), undefined, 'Part payment before move-out')
    else pay(total, month, Math.min(outDay, int(1, 6)))
    return txns
  }

  const habit = t.habit
  if (age >= 2) {
    if (habit === 'punctual') pay(total, month, int(1, 5))
    else if (habit === 'late') pay(total, month, int(6, 18))
    else if (habit === 'instalments') {
      const first = roundTo500(total * 0.6, total)
      pay(first, month, int(2, 7))
      pay(total - first, month, int(14, 22))
    } else if (chance(0.85)) pay(total, month, int(10, 26))
    else pay(roundTo500(total * (0.5 + rand() * 0.3), total), month, int(10, 20))
    return txns
  }

  if (age === 1) {
    if (habit === 'punctual') pay(total, month, int(1, 5))
    else if (habit === 'late') {
      if (chance(0.2)) pay(total, M0, dayIn(M0, 1, 5)) // paid at the start of this month
      else pay(total, month, int(6, 20))
    } else if (habit === 'instalments') {
      const first = roundTo500(total * 0.6, total)
      pay(first, month, int(2, 7))
      if (chance(0.75)) pay(total - first, month, int(14, 22))
    } else {
      const roll = rand()
      if (roll < 0.3) pay(total, month, int(20, 28))
      else if (roll < 0.7) pay(roundTo500(total * (0.4 + rand() * 0.3), total), month, int(12, 25))
    }
    return txns
  }

  // Current month — only payments up to today
  if (habit === 'punctual' && chance(0.88)) pay(total, month, dayIn(month, 1, 5))
  else if (habit === 'late' && chance(0.35)) pay(total, month, dayIn(month, 6, 12))
  else if (habit === 'instalments' && chance(0.6)) pay(roundTo500(total * 0.6, total), month, dayIn(month, 2, 7))
  else if (habit === 'defaulter' && chance(0.15)) pay(roundTo500(total * 0.4, total), month, dayIn(month, 3, 9))
  return txns
}

/** The date the dues were paid in full, or null if they still aren't. */
function paidOffOn(transactions, total) {
  let sum = 0
  for (const tx of [...transactions].sort((a, b) => a.date.localeCompare(b.date))) {
    sum = roundMoney(sum + tx.amount)
    if (sum >= total) return tx.date
  }
  return null
}

const payments = []
for (const t of tenants) {
  const b = t.building
  const rule = b.property.lateFee
  for (const month of MONTHS) {
    if (!presentIn(t, month)) continue
    let rentAmount = t.rentAmount
    let notes = ''
    const inDay = Number(t.moveInDate.slice(8))
    const firstMonth = monthOf(t.moveInDate) === month
    const finalMonth = t.moveOutDate && monthOf(t.moveOutDate) === month
    if (firstMonth && inDay > 10) {
      const dim = daysIn(month)
      rentAmount = Math.round((t.rentAmount * (dim - inDay + 1)) / dim)
      notes = `Pro-rated from ${inDay} ${formatMonth(month).split(' ')[0]}`
    } else if (finalMonth) {
      notes = 'Final month'
    }
    const utilityShare = shareByKey.get(`${t._id}:${month}`) ?? 0
    const extraCharges = t.recurringCharges.map(c => ({ ...c }))
    const base = roundMoney(rentAmount + utilityShare + extraCharges.reduce((s, c) => s + c.amount, 0))
    const transactions = plannedPayments(t, month, base)

    // Late fee under the property's rule: charged when the dues were cleared after the grace period
    // (or are still unpaid today). About a quarter get waived as a goodwill gesture.
    let lateFee = 0
    let waivedFee = 0
    if (!firstMonth && !finalMonth) {
      const clearedOn = paidOffOn(transactions, base)
      const fee = calcLateFee(rule, { month, dueDay: b.property.rentDueDay, today: clearedOn ?? TODAY, unpaid: 1 })
      if (fee > 0) {
        if (clearedOn && chance(0.25)) {
          waivedFee = fee
          notes = notes ? `${notes} · Late fee waived` : 'Late fee waived'
        } else {
          lateFee = fee
          if (clearedOn) {
            const last = transactions.reduce((latest, tx) => (!latest || tx.date >= latest.date ? tx : latest), null)
            last.amount = roundMoney(last.amount + fee) // paid along with the rent
          }
        }
      }
    }

    const createdAt = firstMonth ? at(t.moveInDate, 9) : at(dateIn(month, 1), 0, 5)
    const lastTx = transactions.reduce((latest, tx) => (!latest || tx.createdAt > latest ? tx.createdAt : latest), null)
    payments.push({
      _id: oid(), userId, propertyId: b.propertyId, tenantId: t._id, tenant: t, month, rentAmount, utilityShare, extraCharges, lateFee,
      waivedFee, notes, transactions, createdAt, updatedAt: lastTx ?? createdAt,
    })
  }
}

// ── Complaints ────────────────────────────────────────────────

const COMPLAINTS = {
  wifi: [
    ['WiFi keeps disconnecting every few minutes in the evening.', 'medium'],
    ['Internet is very slow on the 2nd floor — video calls keep dropping.', 'high'],
    ['WiFi router in the corridor shows a red light since morning.', 'high'],
    ['Cannot connect my laptop to the WiFi, phone works fine.', 'low'],
  ],
  plumbing: [
    ['Bathroom tap is leaking continuously.', 'medium'],
    ['No hot water from the geyser since yesterday.', 'high'],
    ['Washroom drain is blocked and water is collecting.', 'high'],
    ['Flush tank is not working properly.', 'medium'],
  ],
  electrical: [
    ['Tube light in the room is flickering.', 'low'],
    ['Power socket near the bed is not working.', 'medium'],
    ['Ceiling fan makes a loud noise at full speed.', 'low'],
    ['MCB trips whenever the iron is used.', 'high'],
  ],
  cleaning: [
    ['Room was not cleaned for the last two days.', 'medium'],
    ['Dustbin on our floor is overflowing.', 'medium'],
    ['Common washroom needs a deep clean.', 'medium'],
    ['Saw cockroaches in the pantry area.', 'high'],
  ],
  furniture: [
    ['Study chair armrest is broken.', 'low'],
    ['Cupboard lock is jammed.', 'medium'],
    ['Bed frame creaks badly at night.', 'low'],
    ['Curtain rod has come off the wall.', 'low'],
  ],
  noise: [
    ['Loud music from the next room after 11 PM.', 'medium'],
    ['Construction noise next door from 7 AM.', 'low'],
  ],
  security: [
    ['Main gate was left open late at night.', 'high'],
    ['CCTV camera near the entrance seems to be off.', 'medium'],
  ],
  other: [
    ['Need a duplicate key for my room.', 'low'],
    ['Drinking water dispenser is empty most evenings.', 'medium'],
    ['Dinner quality has dropped this week.', 'medium'],
    ['Bike parking is always full, no space after 8 PM.', 'low'],
  ],
}
const RESOLUTIONS = {
  wifi: ['Router restarted and firmware updated.', 'ISP technician replaced the cable.', 'Added a mesh extender on the floor.'],
  plumbing: ['Plumber replaced the washer.', 'Geyser heating element replaced.', 'Drain cleared by plumber.'],
  electrical: ['Electrician replaced the choke.', 'Socket rewired.', 'Fan bearing replaced.'],
  cleaning: ['Housekeeping schedule fixed — daily cleaning resumed.', 'Extra dustbin added on the floor.', 'Pest control done.'],
  furniture: ['Carpenter repaired it.', 'Lock replaced.', 'Replaced with a new one.'],
  noise: ['Spoke to the residents; quiet hours after 10:30 PM reminded.', 'Raised with the neighbour, resolved.'],
  security: ['Night guard briefed; gate locked at 11 PM.', 'CCTV DVR restarted and checked.'],
  other: ['Arranged as requested.', 'Spoke with the cook; menu revised.', 'Water dispenser refilled twice a day now.'],
}
const IN_PROGRESS_NOTES = ['Technician scheduled for tomorrow.', 'Waiting for the spare part.', 'Vendor informed, visiting this week.', '']
const CATEGORY_WEIGHTS = { wifi: 20, plumbing: 20, electrical: 15, cleaning: 15, furniture: 10, noise: 7, security: 5, other: 8 }

const complaints = []
for (const b of BUILDINGS) {
  for (const month of MONTHS) {
    if (!b.runs(month)) continue
    const present = tenants.filter(t => t.building === b && presentIn(t, month))
    const count = int(...b.complaintsPerMonth)
    for (let i = 0; i < count && present.length; i++) {
      const t = pick(present)
      const from = monthOf(t.moveInDate) === month ? Number(t.moveInDate.slice(8)) : 1
      const to = t.moveOutDate && monthOf(t.moveOutDate) === month ? Number(t.moveOutDate.slice(8)) : lastDayOf(month)
      const day = dayIn(month, from, to)
      if (day === null) continue
      let createdAt = at(dateIn(month, day), int(7, 22), int(0, 59))
      if (createdAt > NOW) createdAt = new Date(NOW.getTime() - int(1, 6) * 3600000)

      const category = weighted(CATEGORY_WEIGHTS)
      const [description, priority] = pick(COMPLAINTS[category])
      const ageDays = (NOW - createdAt) / 86400000
      const status = ageDays > 12
        ? (chance(0.96) ? 'resolved' : 'open')
        : weighted({ open: 40, 'in-progress': 35, resolved: 25 })

      let resolvedAt = null
      let ownerNotes = ''
      let updatedAt = createdAt
      if (status === 'resolved') {
        resolvedAt = new Date(Math.min(NOW.getTime(), createdAt.getTime() + int(3, 120) * 3600000))
        ownerNotes = pick(RESOLUTIONS[category])
        updatedAt = resolvedAt
      } else if (status === 'in-progress') {
        ownerNotes = pick(IN_PROGRESS_NOTES)
        updatedAt = new Date(Math.min(NOW.getTime(), createdAt.getTime() + int(1, 20) * 3600000))
      }
      complaints.push({
        userId, propertyId: b.propertyId, tenantId: t._id, tenantName: t.name, room: t.room, category, description, priority, status,
        ownerNotes, resolvedAt, createdAt, updatedAt,
      })
    }
  }
}

// ── Staff (demo logins) ───────────────────────────────────────

const staff = Object.fromEntries(STAFF.map(s => [s.key, { ...s, id: oid() }]))
const staffActor = key => ({ id: staff[key].id, name: staff[key].name, role: staff[key].role })
const staffSince = MONTHS[Math.max(0, MONTHS.length - 11)] // joined ~10 months ago

// ── Running costs (profit & loss) ─────────────────────────────

const GROCERY_VENDORS = [
  ['Metro Cash & Carry', 0.45, 'bank', 1],
  ['Nandini milk (monthly)', 0.12, 'upi', 1],
  ['Sharma Kirana', 0.08, 'upi', 1],
  ['Vegetable vendor — KR Market', 0.35, 'cash', 4],
]
for (const b of BUILDINGS) {
  for (const month of MONTHS) {
    if (!b.runs(month)) continue
    const mm = Number(month.slice(5))
    const staffEra = WITH_STAFF && month >= staffSince
    const byAccountant = staffEra ? staffActor('accountant') : null
    const byManager = staffEra ? staffActor('manager') : null
    const present = tenants.filter(t => t.building === b && presentIn(t, month))
    const eating = present.filter(t => t.recurringCharges.some(c => c.label === b.food.label)).length

    addExpense(b, dateIn(month, int(1, 3)), 'rent', b.lease[0], b.lease[1], 'bank', `Lease for ${formatMonth(month)}`, byAccountant)
    for (const [who, amount] of b.salaries) {
      addExpense(b, dateIn(month, int(1, 4)), 'salary', amount, who, pick(['bank', 'upi', 'cash']), `Salary for ${formatMonth(getPrevMonth(month))}`, byAccountant)
    }
    const groceries = eating * int(1750, 2050)
    for (const [vendor, share, method, times] of GROCERY_VENDORS) {
      for (let i = 0; i < times; i++) {
        addExpense(b, dateIn(month, times === 1 ? int(1, 6) : 2 + i * 7 + int(0, 2)), 'groceries', Math.round((groceries * share) / times), vendor, method, '', byManager)
      }
    }
    addExpense(b, dateIn(month, int(5, 12)), 'cleaning', int(22, 40) * 100, 'DMart — cleaning supplies', 'card', 'Phenyl, detergent, garbage bags', byManager)
    if (chance(0.3)) {
      addExpense(b, dateIn(month, int(8, 26)), 'maintenance', int(15, 80) * 100, pick(['Plumber — Venkatesh', 'Electrician — Mohan', 'Carpenter — Ibrahim']), 'cash',
        pick(['Bathroom fittings', 'Wiring in corridor', 'Door hinges and locks', 'Ceiling fan regulators']), byManager)
    }
    if (chance(0.2)) {
      addExpense(b, dateIn(month, int(6, 24)), 'supplies', int(40, 150) * 100, pick(['Bedsheets & pillow covers', 'Mattresses (2)', 'Kitchen utensils', 'Water purifier cartridge']), 'upi', '', byManager)
    }
    if (mm === 4) addExpense(b, dateIn(month, int(10, 25)), 'taxes', b.propertyTax, 'BBMP property tax', 'bank', `FY ${month.slice(0, 4)}–${Number(month.slice(2, 4)) + 1}`)
    if (b.property.gstin && mm % 3 === 1) addExpense(b, dateIn(month, int(15, 20)), 'taxes', 2500, 'CA fees — GST filing', 'upi', 'Quarterly return', byAccountant)
  }
}

// ── Cash handovers and approval requests (needs staff) ────────

const cashCollections = []
const approvals = []
if (WITH_STAFF) {
  const caretaker = staffActor('caretaker')
  const owner = () => OWNER_ACTOR
  const accountant = staffActor('accountant')

  // Recent cash in the main building was collected by the caretaker and confirmed later.
  for (const p of payments) {
    if (p.propertyId !== MAIN.propertyId || p.month < staffSince) continue
    for (const tx of p.transactions) {
      if (tx.method !== 'cash' || !chance(0.6)) continue
      tx.recordedBy = caretaker
      tx.note = `Collected by ${caretaker.name}${tx.note ? ` · ${tx.note}` : ''}`
      const decidedAt = new Date(Math.min(NOW.getTime() - 3600000, at(addDays(tx.date, int(0, 2)), int(17, 21)).getTime()))
      cashCollections.push({
        orgId: userId, propertyId: p.propertyId, paymentId: p._id, tenantId: p.tenantId, tenantName: p.tenant.name, room: p.tenant.room, month: p.month,
        amount: tx.amount, date: tx.date, note: '', collectedBy: caretaker, status: 'confirmed',
        decidedBy: chance(0.5) ? owner() : accountant, decidedAt, createdAt: tx.createdAt, updatedAt: decidedAt,
      })
    }
  }

  const current = payments.filter(p => p.month === M0 && p.propertyId === MAIN.propertyId && p.tenant.status === 'active')
  const unpaid = shuffle(current.filter(p => p.transactions.length === 0))

  // Cash waiting for the owner or accountant to confirm.
  for (const p of unpaid.slice(0, 3)) {
    const total = roundMoney(p.rentAmount + p.utilityShare + p.extraCharges.reduce((s, c) => s + c.amount, 0) + p.lateFee)
    const amount = chance(0.6) ? total : roundTo500(total * 0.5, total)
    const date = notFuture(addDays(TODAY, -int(0, 2)))
    const createdAt = new Date(Math.min(NOW.getTime() - int(1, 5) * 3600000, at(date, int(9, 20)).getTime()))
    cashCollections.push({
      orgId: userId, propertyId: p.propertyId, paymentId: p._id, tenantId: p.tenantId, tenantName: p.tenant.name, room: p.tenant.room, month: p.month,
      amount, date, note: pick(['Paid at the gate', 'Gave cash in the morning', '']), collectedBy: caretaker, status: 'pending',
      createdAt, updatedAt: createdAt,
    })
  }
  // One handover that didn't add up.
  const rejectedFrom = payments.find(p => p.propertyId === MAIN.propertyId && monthsAgo(p.month) === 2 && p.transactions.some(tx => tx.method === 'cash'))
  if (rejectedFrom) {
    const decidedAt = at(dateIn(rejectedFrom.month, 20), 19)
    cashCollections.push({
      orgId: userId, propertyId: rejectedFrom.propertyId, paymentId: rejectedFrom._id, tenantId: rejectedFrom.tenantId,
      tenantName: rejectedFrom.tenant.name, room: rejectedFrom.tenant.room, month: rejectedFrom.month,
      amount: 2000, date: dateIn(rejectedFrom.month, 18), note: 'Part payment', collectedBy: caretaker, status: 'rejected',
      decidedBy: owner(), decidedAt, decisionNote: 'Logged twice — already recorded as the cash payment on the same day.',
      createdAt: at(dateIn(rejectedFrom.month, 18), 20), updatedAt: decidedAt,
    })
  }

  const approval = ({ type, payment, payload, summary, reason, by, createdAt, status = 'pending', decidedBy, decisionNote = '', decidedAt = null }) => approvals.push({
    type, realm: 'org', orgId: userId, payload: { ...payload, key: type === 'org.dues.adjust' ? `dues:${payment._id}` : `tx:${payload.txId}` },
    summary, reason, status, requestedBy: { realm: 'org', ...by }, decidedBy: decidedBy ? { realm: 'org', ...decidedBy } : undefined,
    decisionNote, decidedAt, executedAt: status === 'approved' ? decidedAt : null,
    expiresAt: new Date(createdAt.getTime() + APPROVAL_TTL_MS), createdAt, updatedAt: decidedAt ?? createdAt,
  })

  // Waiting: the accountant asks for a discount (accountants can't change money on their own).
  const discountFor = unpaid[3]
  if (discountFor) {
    const to = discountFor.rentAmount - 1500
    approval({
      type: 'org.dues.adjust', payment: discountFor,
      payload: { paymentId: discountFor._id.toString(), changes: { rentAmount: to } },
      summary: `${discountFor.tenant.name} — ${formatMonth(M0)}: rent ${formatCurrency(discountFor.rentAmount)} → ${formatCurrency(to)}`,
      reason: 'Geyser in the room was not working for 12 days — agreed ₹1,500 off this month.',
      by: staffActor('accountant'), createdAt: new Date(NOW.getTime() - 5 * 3600000),
    })
  }
  // Waiting: the manager asks to remove a payment recorded against the wrong month.
  const wrongEntry = payments.find(p => p.propertyId === MAIN.propertyId && monthsAgo(p.month) === 1 && p.transactions.length >= 2 && p.tenantId !== discountFor?.tenantId)
  if (wrongEntry) {
    const tx = wrongEntry.transactions[wrongEntry.transactions.length - 1]
    tx._id = oid()
    approval({
      type: 'org.payment.removeEntry', payment: wrongEntry,
      payload: { paymentId: wrongEntry._id.toString(), txId: tx._id.toString() },
      summary: `Remove ${formatCurrency(tx.amount)} (${PAYMENT_METHOD_LABELS[tx.method]}, ${formatDate(tx.date)}) from ${wrongEntry.tenant.name} — ${formatMonth(wrongEntry.month)}`,
      reason: 'Tenant says this UPI transfer was for their friend in K-block, not their own rent. Checking with the bank statement.',
      by: staffActor('manager'), createdAt: new Date(NOW.getTime() - 26 * 3600000),
    })
  }
  // Decided earlier: a waived late fee (approved) and a discount that was turned down.
  const waived = payments.find(p => p.waivedFee > 0 && monthsAgo(p.month) >= 1 && monthsAgo(p.month) <= 3)
  if (waived) {
    const createdAt = at(dateIn(waived.month, 24), 11)
    approval({
      type: 'org.dues.adjust', payment: waived,
      payload: { paymentId: waived._id.toString(), changes: { lateFee: 0 } },
      summary: `${waived.tenant.name} — ${formatMonth(waived.month)}: late fee ${formatCurrency(waived.waivedFee)} → ${formatCurrency(0)}`,
      reason: 'Salary credited late this month — first delay in a year.',
      by: staffActor('accountant'), createdAt,
      status: 'approved', decidedBy: OWNER_ACTOR, decisionNote: 'OK, one-time.', decidedAt: new Date(createdAt.getTime() + 3 * 3600000),
    })
  }
  const refused = payments.find(p => p.propertyId === MAIN.propertyId && monthsAgo(p.month) === 2 && p !== waived)
  if (refused) {
    const createdAt = at(dateIn(refused.month, 12), 16)
    approval({
      type: 'org.dues.adjust', payment: refused,
      payload: { paymentId: refused._id.toString(), changes: { rentAmount: refused.rentAmount - 2500 } },
      summary: `${refused.tenant.name} — ${formatMonth(refused.month)}: rent ${formatCurrency(refused.rentAmount)} → ${formatCurrency(refused.rentAmount - 2500)}`,
      reason: 'Tenant was travelling for 10 days and asked for a reduction.',
      by: staffActor('manager'), createdAt,
      status: 'rejected', decidedBy: OWNER_ACTOR, decisionNote: 'Rent is for the bed, not days present — no discount for travel.', decidedAt: new Date(createdAt.getTime() + 20 * 3600000),
    })
  }
}

// ── Write to the database ─────────────────────────────────────

/** Removes an organization's business data (and, for the demo, its staff logins). */
async function wipeOrg(orgId, { removeTeam }) {
  await Promise.all([
    ...BY_USER.map(m => m.deleteMany({ userId: orgId })),
    ...BY_ORG.map(m => m.deleteMany({ orgId })),
    ApprovalRequest.deleteMany({ realm: 'org', orgId }),
  ])
  if (removeTeam) {
    const members = await Membership.find({ orgId }).select('userId')
    await User.deleteMany({ _id: { $in: members.map(m => m.userId).filter(Boolean) }, kind: 'staff' })
    await Membership.deleteMany({ orgId })
  }
}

const historyStart = at(dateIn(MONTHS[0], 1), 9)
let owner
if (IS_DEMO) {
  const existing = await User.findOne({ email: DEMO_EMAIL })
  if (existing) {
    await wipeOrg(existing._id, { removeTeam: true })
    await existing.deleteOne()
  }
  owner = await User.create({
    _id: userId, kind: 'owner', orgVersion: 1, plan: 'multi', name: 'Rajesh Kumar', email: DEMO_EMAIL, password: DEMO_PASSWORD,
    createdAt: historyStart,
  })
} else {
  owner = targetUser
  if (REPLACE) await wipeOrg(userId, { removeTeam: false })
}
// Properties: an account's existing first property keeps its name; only empty settings get sample values.
if (MAIN.reuse) {
  const mainProperty = await Property.findById(MAIN.reuse)
  for (const [key, value] of Object.entries({ ...MAIN.property, ownerName: owner.name })) {
    if (key === 'name' || key === 'lateFee') continue
    if (mainProperty[key] === undefined || mainProperty[key] === '' || mainProperty[key] === null) mainProperty.set(key, value)
  }
  if (!mainProperty.lateFee?.enabled) mainProperty.set('lateFee', MAIN.property.lateFee)
  await mainProperty.save()
} else {
  const pg = targetUser?.pgSettings ?? {}
  await Property.create({
    _id: MAIN.propertyId, orgId: userId, ...MAIN.property,
    ...(targetUser ? { name: pg.pgName || MAIN.property.name, ownerName: pg.ownerName || owner.name, upiId: pg.upiId || MAIN.property.upiId } : {}),
    createdAt: historyStart,
  })
}
for (const b of BUILDINGS.slice(1)) {
  if (!b.reuse) await Property.create({ _id: b.propertyId, orgId: userId, ...b.property, ownerName: owner.name, createdAt: at(dateIn(b.openMonth, 1), 9) })
}

// Rooms (reusing rooms of the same name that already exist).
for (const b of BUILDINGS) {
  for (const room of b.rooms) {
    const capacity = ROOM_TYPES[room.type].beds
    const existing = await Room.findOne({ propertyId: b.propertyId, name: room.name, status: 'active' })
    if (existing) {
      if (existing.capacity < capacity) await Room.updateOne({ _id: existing._id }, { $set: { capacity } })
      room._id = existing._id
    } else {
      room._id = (await Room.create({
        orgId: userId, propertyId: b.propertyId, name: room.name, floor: room.name.split('-')[1][0], // A-204 → floor 2
        capacity, rent: room.rent, notes: room.type === 'single' ? 'Attached bathroom' : '',
        createdAt: b.openMonth ? at(dateIn(b.openMonth, 1), 9) : historyStart,
      }))._id
    }
  }
}

// timestamps: false keeps the historical createdAt / updatedAt set above.
// insertMany still validates, so the Payment model derives amountPaid, paidDate and status.
await Tenant.insertMany(tenants.map(({ habit: _h, building, roomRef, ...t }) => ({
  ...t,
  propertyId: building.propertyId,
  roomId: roomRef._id,
  createdAt: at(t.moveInDate, 9),
  updatedAt: t.moveOutDate ? at(t.moveOutDate, 18) : at(t.moveInDate, 9),
})), { timestamps: false })
await UtilityBill.insertMany(bills, { timestamps: false })
await Payment.insertMany(payments.map(({ tenant: _t, waivedFee: _w, ...p }) => p), { timestamps: false })
await Complaint.insertMany(complaints, { timestamps: false })
await Expense.insertMany(expenses.map(e => ({ ...e, updatedAt: e.createdAt })), { timestamps: false })

if (WITH_STAFF) {
  const old = await User.find({ email: { $in: STAFF.map(s => s.email) }, kind: 'staff' }).select('_id')
  await Membership.deleteMany({ $or: [{ userId: { $in: old.map(u => u._id) } }, { email: { $in: STAFF.map(s => s.email) } }] })
  await User.deleteMany({ _id: { $in: old.map(u => u._id) } })
  const joined = at(dateIn(staffSince, 2), 11)
  for (const s of Object.values(staff)) {
    // create() so the password is hashed by the model.
    await User.create({ _id: s.id, kind: 'staff', orgVersion: 1, name: s.name, email: s.email, password: DEMO_PASSWORD, createdAt: joined })
    await Membership.create({
      orgId: userId, userId: s.id, name: s.name, email: s.email, role: s.role, status: 'active',
      propertyIds: s.onlyMain ? [MAIN.propertyId] : [], invitedBy: owner.name, joinedAt: joined, createdAt: joined,
    })
  }
  await CashCollection.insertMany(cashCollections, { timestamps: false })
  await ApprovalRequest.insertMany(approvals, { timestamps: false })
}

// ── Summary ───────────────────────────────────────────────────

const saved = await Payment.find({ userId, propertyId: { $in: BUILDINGS.map(b => b.propertyId) } }).lean()
console.log('\n✓ Sample data ready')
console.log(`  Login        : ${IS_DEMO ? `${DEMO_EMAIL} / ${DEMO_PASSWORD}` : `${TARGET_EMAIL} (your existing password)`}`)
if (WITH_STAFF) console.log(`  Staff logins : ${STAFF.map(s => s.email).join(', ')} (password ${DEMO_PASSWORD})`)
console.log(`  History      : ${formatMonth(MONTHS[0])} → ${formatMonth(M0)} (${MONTHS.length} months)`)
for (const b of BUILDINGS) {
  const own = tenants.filter(t => t.building === b)
  const active = own.filter(t => t.status === 'active').length
  const current = saved.filter(p => String(p.propertyId) === String(b.propertyId) && p.month === M0)
  const byStatus = s => current.filter(p => p.status === s).length
  const spent = expenses.filter(e => e.propertyId === b.propertyId).reduce((s, e) => s + e.amount, 0)
  console.log(`  ${b.property.name}`)
  console.log(`    Beds       : ${b.totalBeds} in ${b.rooms.length} rooms, ${active} occupied${b.openMonth ? ` (opened ${formatMonth(b.openMonth)})` : ''}`)
  console.log(`    Tenants    : ${own.length} total (${active} active, ${own.length - active} vacated)`)
  console.log(`    This month : ${byStatus('paid')} paid, ${byStatus('partial')} partial, ${byStatus('pending')} pending`)
  console.log(`    Expenses   : ₹${Math.round(spent).toLocaleString('en-IN')} over the period`)
}
const outstanding = saved.reduce((s, p) => s + getBalance(p), 0)
console.log(`  Dues records : ${saved.length} with ${saved.reduce((s, p) => s + p.transactions.length, 0)} payments received, ₹${Math.round(outstanding).toLocaleString('en-IN')} outstanding`)
console.log(`  Late fees    : ₹${Math.round(saved.reduce((s, p) => s + (p.lateFee ?? 0), 0)).toLocaleString('en-IN')} charged`)
console.log(`  Utility bills: ${bills.length} · Expenses: ${expenses.length} · Complaints: ${complaints.length} (${complaints.filter(c => c.status !== 'resolved').length} open or in progress)`)
if (WITH_STAFF) {
  console.log(`  Approvals    : ${approvals.filter(a => a.status === 'pending').length} waiting · cash handovers: ${cashCollections.filter(c => c.status === 'pending').length} waiting`)
}
console.log('')
await mongoose.disconnect()
