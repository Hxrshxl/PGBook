// Creates (or resets) a demo account with ~18 months of realistic history:
// a 60-bed PG in Bengaluru with tenants moving in and out, pro-rated first
// months, monthly utility bills split between residents, payments with
// different habits (on time, late, in instalments, defaulters), deposit
// adjustments on move-out, and a steady stream of complaints.
//
//   npm run seed                                   → resets demo@pgbook.app / Demo@1234
//   npm run seed -- --email=you@example.com        → loads it into YOUR existing (empty) account
//   npm run seed -- --email=you@example.com --keep-existing
//                                                  → adds the sample data next to records you already have
//   npm run seed -- --email=you@example.com --replace
//                                                  → wipes that account's tenants, dues, bills and
//                                                    complaints first, then loads the sample data
//
// With --email, your name, login and password are kept, and only settings you haven't
// filled in yet (address, UPI ID, total beds…) get sample values.
// The data is generated from a fixed random seed relative to today's date, so every
// run looks the same and current.
// Refuses to run with NODE_ENV=production unless --force is passed.
import mongoose from 'mongoose'
import User from './models/User.js'
import Tenant from './models/Tenant.js'
import Payment from './models/Payment.js'
import UtilityBill from './models/UtilityBill.js'
import Complaint from './models/Complaint.js'
import { getPrevMonth, splitAmount, roundMoney, todayISO, formatMonth } from '../utils/helpers.js'

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

await mongoose.connect(process.env.MONGODB_URI)
await Promise.all([User, Tenant, Payment, UtilityBill, Complaint].map(m => m.syncIndexes()))

const OWNED = [Tenant, Payment, UtilityBill, Complaint]
let targetUser = null
if (!IS_DEMO) {
  targetUser = await User.findOne({ email: TARGET_EMAIL })
  if (!targetUser) {
    console.error(`No account found for ${TARGET_EMAIL}. Sign up in the app first, then run this again.`)
    await mongoose.disconnect()
    process.exit(1)
  }
  const existingRecords = (await Promise.all(OWNED.map(m => m.countDocuments({ userId: targetUser._id })))).reduce((a, b) => a + b, 0)
  if (existingRecords > 0 && !REPLACE && !KEEP_EXISTING) {
    console.error(`${TARGET_EMAIL} already has ${existingRecords} records. Re-run with --keep-existing to add sample data alongside them, or --replace to DELETE them first.`)
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

const MONTHS = [M0]
while (MONTHS.length < HISTORY_MONTHS) MONTHS.unshift(getPrevMonth(MONTHS[0]))
const monthsAgo = month => MONTHS.length - 1 - MONTHS.indexOf(month)

// ── The building: 30 rooms, 60 beds ───────────────────────────

const ROOM_TYPES = {
  single: { beds: 1, rent: [15000, 16500] },
  double: { beds: 2, rent: [10500, 12000] },
  triple: { beds: 3, rent: [8000, 9000] },
}
const rooms = [
  ...Array.from({ length: 6 }, (_, i) => ({ name: `A-${101 + i}`, type: 'single' })),
  ...Array.from({ length: 6 }, (_, i) => ({ name: `A-${107 + i}`, type: 'double' })),
  ...Array.from({ length: 12 }, (_, i) => ({ name: `B-${201 + i}`, type: 'double' })),
  ...Array.from({ length: 6 }, (_, i) => ({ name: `C-${301 + i}`, type: 'triple' })),
].map(room => {
  const [min, max] = ROOM_TYPES[room.type].rent
  return { ...room, rent: Math.round(int(min, max) / 500) * 500 }
})
const beds = rooms.flatMap(room => Array.from({ length: ROOM_TYPES[room.type].beds }, () => ({ room, tenant: null, freedIn: null })))
const TOTAL_BEDS = beds.length

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

const userId = targetUser?._id ?? new mongoose.Types.ObjectId()
const tenants = []

function newTenant(bed, moveInDate) {
  let first, last
  do { first = pick(FIRST_NAMES); last = pick(LAST_NAMES) } while (usedNames.has(`${first} ${last}`))
  usedNames.add(`${first} ${last}`)
  const rentAmount = bed.room.rent + pick([0, 0, 0, 500, -500])
  const tenant = {
    _id: new mongoose.Types.ObjectId(),
    userId,
    name: `${first} ${last}`,
    phone: uniquePhone(),
    email: chance(0.7) ? `${first}.${last}${int(1, 99)}@example.com`.toLowerCase() : '',
    room: bed.room.name,
    rentAmount,
    depositAmount: bed.room.type === 'triple' ? rentAmount : rentAmount * 2,
    moveInDate,
    moveOutDate: null,
    status: 'active',
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

// People already living there when the history starts.
for (const bed of beds) {
  if (!chance(0.8)) continue
  let month = MONTHS[0]
  for (let i = int(1, 20); i > 0; i--) month = getPrevMonth(month)
  newTenant(bed, dateIn(month, int(1, 28)))
}

for (const month of MONTHS) {
  const isCurrent = month === M0
  const lastDay = lastDayOf(month)

  // Move-outs (never someone who moved in this same month)
  for (const bed of beds) {
    const t = bed.tenant
    if (!t || monthOf(t.moveInDate) === month) continue
    if (chance(isCurrent ? 0.02 : 0.055)) {
      t.moveOutDate = dateIn(month, int(1, Math.min(lastDay, 28)))
      t.status = 'vacated'
      bed.tenant = null
      bed.freedIn = month
    }
  }

  // Move-ins, refilling towards a target occupancy (beds freed this month stay empty until next month)
  const target = Math.round(TOTAL_BEDS * (isCurrent ? 0.86 : 0.8 + rand() * 0.15))
  let occupied = beds.filter(b => b.tenant).length
  const maxMoveIns = isCurrent ? 2 : 8
  let moved = 0
  for (const bed of shuffle(beds.filter(b => !b.tenant && b.freedIn !== month))) {
    if (occupied >= target || moved >= maxMoveIns) break
    newTenant(bed, dateIn(month, int(1, Math.min(lastDay, 28))))
    occupied++
    moved++
  }
}

const presentIn = (t, month) => monthOf(t.moveInDate) <= month && (!t.moveOutDate || monthOf(t.moveOutDate) >= month)

// ── Utility bills ─────────────────────────────────────────────

const bills = []
const shareByKey = new Map() // `${tenantId}:${month}` → total utility share

function addBill(month, type, totalAmount, note, day) {
  const present = tenants.filter(t => presentIn(t, month))
  if (!present.length) return
  const shares = splitAmount(totalAmount, present.length)
  const allocations = present.map((t, i) => ({ tenantId: t._id, amount: shares[i] }))
  for (const a of allocations) {
    const key = `${a.tenantId}:${month}`
    shareByKey.set(key, roundMoney((shareByKey.get(key) ?? 0) + a.amount))
  }
  const created = at(dateIn(month, Math.min(day, lastDayOf(month))), 11, int(0, 59))
  bills.push({
    userId, month, type, totalAmount: roundMoney(totalAmount), perTenantAmount: shares[0],
    tenantCount: present.length, splitMethod: 'equal', note, allocations, createdAt: created, updatedAt: created,
  })
}

for (const month of MONTHS) {
  const mm = Number(month.slice(5))
  const headcount = tenants.filter(t => presentIn(t, month)).length
  addBill(month, 'internet', 5899, 'ACT Fibernet 300 Mbps', 1)
  if (month === M0) continue // the rest of this month's bills haven't arrived yet

  const perHead = [3, 4, 5, 6].includes(mm) ? int(650, 820) : [7, 8, 9, 10].includes(mm) ? int(450, 560) : int(380, 480)
  const units = Math.round((headcount * perHead) / 8.5)
  addBill(month, 'electricity', headcount * perHead + int(0, 99) + int(0, 99) / 100, `BESCOM · ${units.toLocaleString('en-IN')} units`, int(3, 6))
  addBill(month, 'water', int(3200, 4800) + ([4, 5].includes(mm) ? 2400 : 0), [4, 5].includes(mm) ? 'BWSSB + 2 water tankers' : 'BWSSB', int(4, 8))
  addBill(month, 'gas', int(36, 48) * 100, `${int(4, 5)} commercial cylinders (kitchen)`, int(2, 10))
  if (mm % 3 === 0) addBill(month, 'maintenance', 2400, 'Quarterly pest control', int(10, 20))
  if (chance(0.3)) {
    addBill(month, 'maintenance', int(12, 45) * 100,
      pick(['Water pump repair', 'Geyser replacement — 2nd floor', 'Common area painting', 'RO filter service', 'Terrace waterproofing patch', 'Washing machine repair']),
      int(8, 25))
  }
}

// ── Dues and payments ─────────────────────────────────────────

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

const payments = []
for (const t of tenants) {
  for (const month of MONTHS) {
    if (!presentIn(t, month)) continue
    let rentAmount = t.rentAmount
    let notes = ''
    const inDay = Number(t.moveInDate.slice(8))
    if (monthOf(t.moveInDate) === month && inDay > 10) {
      const dim = daysIn(month)
      rentAmount = Math.round((t.rentAmount * (dim - inDay + 1)) / dim)
      notes = `Pro-rated from ${inDay} ${formatMonth(month).split(' ')[0]}`
    } else if (t.moveOutDate && monthOf(t.moveOutDate) === month) {
      notes = 'Final month'
    }
    const utilityShare = shareByKey.get(`${t._id}:${month}`) ?? 0
    const total = roundMoney(rentAmount + utilityShare)
    const transactions = plannedPayments(t, month, total)
    const createdAt = monthOf(t.moveInDate) === month ? at(t.moveInDate, 9) : at(dateIn(month, 1), 0, 5)
    const lastTx = transactions.reduce((latest, tx) => (!latest || tx.createdAt > latest ? tx.createdAt : latest), null)
    payments.push({
      userId, tenantId: t._id, month, rentAmount, utilityShare, notes, transactions,
      createdAt, updatedAt: lastTx ?? createdAt,
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
for (const month of MONTHS) {
  const isCurrent = month === M0
  const present = tenants.filter(t => presentIn(t, month))
  const count = isCurrent ? int(3, 5) : int(3, 6)
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
      userId, tenantId: t._id, tenantName: t.name, room: t.room, category, description, priority, status,
      ownerNotes, resolvedAt, createdAt, updatedAt,
    })
  }
}

// ── Write to the database ─────────────────────────────────────

const SAMPLE_SETTINGS = {
  pgName: 'Sunrise PG',
  address: '14, 3rd Cross, Indiranagar, Bengaluru — 560038',
  ownerName: 'Rajesh Kumar',
  phone: '9876543210',
  upiId: 'sunrisepg@okicici',
  logoText: 'Sunrise PG',
  totalBeds: TOTAL_BEDS,
  rentDueDay: 5,
}

if (IS_DEMO) {
  const existing = await User.findOne({ email: DEMO_EMAIL })
  if (existing) {
    await Promise.all(OWNED.map(m => m.deleteMany({ userId: existing._id })))
    await existing.deleteOne()
  }
  await User.create({
    _id: userId,
    name: 'Rajesh Kumar',
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    pgSettings: SAMPLE_SETTINGS,
    createdAt: at(dateIn(MONTHS[0], 1), 9),
  })
} else {
  if (REPLACE) await Promise.all(OWNED.map(m => m.deleteMany({ userId })))
  // Keep everything the owner already set; fill only empty settings. Bed count must match the sample building.
  const existingSettings = targetUser.pgSettings?.toObject?.() ?? {}
  for (const [key, value] of Object.entries(SAMPLE_SETTINGS)) {
    if (key === 'totalBeds' || existingSettings[key] === undefined || existingSettings[key] === '' || existingSettings[key] === 0) {
      targetUser.set(`pgSettings.${key}`, value)
    }
  }
  if (!existingSettings.ownerName) targetUser.set('pgSettings.ownerName', targetUser.name)
  await targetUser.save()
}

// timestamps: false keeps the historical createdAt / updatedAt set above.
// insertMany still validates, so the Payment model derives amountPaid, paidDate and status.
await Tenant.insertMany(tenants.map(({ habit: _habit, ...t }) => ({
  ...t,
  createdAt: at(t.moveInDate, 9),
  updatedAt: t.moveOutDate ? at(t.moveOutDate, 18) : at(t.moveInDate, 9),
})), { timestamps: false })
await UtilityBill.insertMany(bills, { timestamps: false })
await Payment.insertMany(payments, { timestamps: false })
await Complaint.insertMany(complaints, { timestamps: false })

// ── Summary ───────────────────────────────────────────────────

const saved = await Payment.find({ userId }).lean()
const current = saved.filter(p => p.month === M0)
const outstanding = saved.reduce((s, p) => s + Math.max(0, p.rentAmount + p.utilityShare - p.amountPaid), 0)
const active = tenants.filter(t => t.status === 'active').length
const byStatus = s => current.filter(p => p.status === s).length

console.log('\n✓ Sample data ready')
console.log(`  Login        : ${IS_DEMO ? `${DEMO_EMAIL} / ${DEMO_PASSWORD}` : `${TARGET_EMAIL} (your existing password)`}`)
console.log(`  History      : ${formatMonth(MONTHS[0])} → ${formatMonth(M0)} (${MONTHS.length} months)`)
console.log(`  Beds         : ${TOTAL_BEDS} in ${rooms.length} rooms, ${active} occupied`)
console.log(`  Tenants      : ${tenants.length} total (${active} active, ${tenants.length - active} vacated)`)
console.log(`  Dues records : ${saved.length} with ${saved.reduce((s, p) => s + p.transactions.length, 0)} payments received`)
console.log(`  This month   : ${byStatus('paid')} paid, ${byStatus('partial')} partial, ${byStatus('pending')} pending`)
console.log(`  Outstanding  : ₹${Math.round(outstanding).toLocaleString('en-IN')} across all months`)
console.log(`  Utility bills: ${bills.length}`)
console.log(`  Complaints   : ${complaints.length} (${complaints.filter(c => c.status !== 'resolved').length} open or in progress)\n`)
await mongoose.disconnect()
