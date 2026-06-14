import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) { console.error('MONGODB_URI not set'); process.exit(1) }

// ── Minimal inline schemas (avoid ESM/CJS issues with the model files) ──

const UserSchema = new mongoose.Schema({
  name: String, email: { type: String, unique: true },
  password: String,
  pgSettings: {
    pgName: String, address: String, ownerName: String,
    phone: String, upiId: String, logoText: String,
  },
}, { timestamps: true })

const TenantSchema = new mongoose.Schema({
  userId: mongoose.Types.ObjectId,
  name: String, phone: String, email: String,
  room: String, rentAmount: Number,
  moveInDate: String, moveOutDate: String,
  status: { type: String, default: 'active' },
  idType: String, idNumber: String,
  emergencyContact: { name: String, phone: String, relation: String },
}, { timestamps: true })

const PaymentSchema = new mongoose.Schema({
  userId: mongoose.Types.ObjectId, tenantId: mongoose.Types.ObjectId,
  month: String, rentAmount: Number, utilityShare: Number,
  amountPaid: Number, status: String, paidDate: String, notes: String,
}, { timestamps: true })

const UtilityBillSchema = new mongoose.Schema({
  userId: mongoose.Types.ObjectId, month: String,
  type: String, totalAmount: Number, perTenantAmount: Number, tenantCount: Number,
}, { timestamps: true })

const ComplaintSchema = new mongoose.Schema({
  userId: mongoose.Types.ObjectId, tenantId: mongoose.Types.ObjectId,
  tenantName: String, room: String, category: String,
  description: String, priority: String, status: String,
  ownerNotes: String, resolvedAt: Date,
}, { timestamps: true })

const User      = mongoose.models.User      ?? mongoose.model('User',      UserSchema)
const Tenant    = mongoose.models.Tenant    ?? mongoose.model('Tenant',    TenantSchema)
const Payment   = mongoose.models.Payment   ?? mongoose.model('Payment',   PaymentSchema)
const UtilBill  = mongoose.models.UtilityBill ?? mongoose.model('UtilityBill', UtilityBillSchema)
const Complaint = mongoose.models.Complaint ?? mongoose.model('Complaint', ComplaintSchema)

await mongoose.connect(MONGODB_URI)
console.log('Connected to MongoDB')

// ── Wipe existing seed data ──
const existing = await User.findOne({ email: 'demo@pgbook.app' })
if (existing) {
  await Promise.all([
    Tenant.deleteMany({ userId: existing._id }),
    Payment.deleteMany({ userId: existing._id }),
    UtilBill.deleteMany({ userId: existing._id }),
    Complaint.deleteMany({ userId: existing._id }),
    User.deleteOne({ _id: existing._id }),
  ])
}

// ── Create demo owner ──
const hashed = await bcrypt.hash('Demo@1234', 12)
const owner = await User.create({
  name: 'Rajesh Kumar',
  email: 'demo@pgbook.app',
  password: hashed,
  pgSettings: {
    pgName: 'Sunrise PG',
    address: '14, 3rd Cross, Indiranagar, Bengaluru — 560038',
    ownerName: 'Rajesh Kumar',
    phone: '9876543210',
    upiId: 'rajesh.kumar@upi',
    logoText: 'Sunrise PG',
  },
})

const uid = owner._id

// ── Tenants ──
const tenantDefs = [
  { name: 'Ravi Sharma',   phone: '9001234567', email: 'ravi@example.com',   room: 'A-101', rentAmount: 12000, moveInDate: '2024-01-10', idType: 'Aadhaar', idNumber: 'XXXX-XXXX-1234' },
  { name: 'Priya Menon',   phone: '9001234568', email: 'priya@example.com',  room: 'B-204', rentAmount: 10500, moveInDate: '2024-02-15', idType: 'Passport', idNumber: 'T1234567' },
  { name: 'Aakash Patel',  phone: '9001234569', email: 'aakash@example.com', room: 'A-301', rentAmount: 11000, moveInDate: '2024-01-01', idType: 'Driving License', idNumber: 'DL-0420110012345' },
  { name: 'Sneha Iyer',    phone: '9001234570', email: 'sneha@example.com',  room: 'C-102', rentAmount: 9500,  moveInDate: '2024-03-01', idType: 'Aadhaar', idNumber: 'XXXX-XXXX-5678' },
  { name: 'Vikram Nair',   phone: '9001234571', email: 'vikram@example.com', room: 'B-103', rentAmount: 10000, moveInDate: '2024-01-20', idType: 'PAN Card', idNumber: 'ABCDE1234F' },
  { name: 'Anjali Singh',  phone: '9001234572', email: 'anjali@example.com', room: 'A-202', rentAmount: 11500, moveInDate: '2024-04-01', idType: 'Aadhaar', idNumber: 'XXXX-XXXX-9012' },
  { name: 'Karan Mehta',   phone: '9001234573', email: 'karan@example.com',  room: 'C-201', rentAmount: 9000,  moveInDate: '2024-05-01', idType: 'Aadhaar', idNumber: 'XXXX-XXXX-3456' },
  { name: 'Deepa Rao',     phone: '9001234574', email: 'deepa@example.com',  room: 'B-301', rentAmount: 10000, moveInDate: '2024-02-01', idType: 'Voter ID', idNumber: 'KAR/10/001/000001' },
]

const tenants = await Tenant.insertMany(tenantDefs.map(t => ({ ...t, userId: uid, status: 'active' })))

// ── Helper ──
function monthStr(monthsAgo) {
  const d = new Date()
  d.setMonth(d.getMonth() - monthsAgo)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ── Payments — last 3 months ──
const payments = []
for (const t of tenants) {
  // 2 months ago: paid
  payments.push({ userId: uid, tenantId: t._id, month: monthStr(2), rentAmount: t.rentAmount, utilityShare: 0, amountPaid: t.rentAmount, status: 'paid', paidDate: monthStr(2) + '-05', notes: '' })
  // 1 month ago: paid
  payments.push({ userId: uid, tenantId: t._id, month: monthStr(1), rentAmount: t.rentAmount, utilityShare: 0, amountPaid: t.rentAmount, status: 'paid', paidDate: monthStr(1) + '-03', notes: '' })
  // Current month: varied statuses
  const rand = Math.random()
  if (t.name === 'Aakash Patel') {
    payments.push({ userId: uid, tenantId: t._id, month: monthStr(0), rentAmount: t.rentAmount, utilityShare: 0, amountPaid: 0, status: 'pending', paidDate: null, notes: '' })
  } else if (t.name === 'Sneha Iyer') {
    payments.push({ userId: uid, tenantId: t._id, month: monthStr(0), rentAmount: t.rentAmount, utilityShare: 0, amountPaid: 5000, status: 'partial', paidDate: null, notes: 'Paid partial, rest by 20th' })
  } else {
    payments.push({ userId: uid, tenantId: t._id, month: monthStr(0), rentAmount: t.rentAmount, utilityShare: 0, amountPaid: t.rentAmount, status: 'paid', paidDate: monthStr(0) + '-02', notes: '' })
  }
}
await Payment.insertMany(payments)

// ── Utility bills ──
await UtilBill.insertMany([
  { userId: uid, month: monthStr(2), type: 'electricity', totalAmount: 6400, perTenantAmount: 800, tenantCount: 8 },
  { userId: uid, month: monthStr(1), type: 'electricity', totalAmount: 7200, perTenantAmount: 900, tenantCount: 8 },
  { userId: uid, month: monthStr(1), type: 'water',       totalAmount: 2400, perTenantAmount: 300, tenantCount: 8 },
])

// ── Complaints ──
const [ravi, priya, aakash, sneha] = tenants
await Complaint.insertMany([
  { userId: uid, tenantId: sneha._id,   tenantName: sneha.name,   room: sneha.room,   category: 'plumbing',    description: 'Water heater is not working since yesterday evening.',         priority: 'high',   status: 'open',        ownerNotes: '' },
  { userId: uid, tenantId: aakash._id,  tenantName: aakash.name,  room: aakash.room,  category: 'wifi',        description: 'WiFi disconnects every few hours on the 3rd floor.',           priority: 'medium', status: 'in-progress', ownerNotes: 'ISP technician visiting Thursday.' },
  { userId: uid, tenantId: ravi._id,    tenantName: ravi.name,    room: ravi.room,    category: 'furniture',   description: 'Study chair has a broken armrest.',                              priority: 'low',    status: 'open',        ownerNotes: '' },
  { userId: uid, tenantId: priya._id,   tenantName: priya.name,   room: priya.room,   category: 'electrical',  description: 'Ceiling fan makes a rattling noise when on full speed.',        priority: 'medium', status: 'resolved',    ownerNotes: 'Replaced fan blade. Resolved.', resolvedAt: new Date() },
])

console.log(`\n✓ Seed complete!`)
console.log(`  Owner email : demo@pgbook.app`)
console.log(`  Password    : Demo@1234`)
console.log(`  Tenants     : ${tenants.length}`)
console.log(`  Payments    : ${payments.length}`)
await mongoose.disconnect()
