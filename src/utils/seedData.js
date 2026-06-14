// Generates month string relative to today
function m(monthsAgo) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - monthsAgo)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const M0 = m(0) // current month
const M1 = m(1) // last month
const M2 = m(2) // 2 months ago

const tenants = [
  { id: 'st1', name: 'Ravi Sharma',    phone: '9876543210', email: 'ravi@example.com',    room: 'A-204', rentAmount: 12000, moveInDate: '2024-01-15', moveOutDate: null, status: 'active', idType: 'aadhaar',  idNumber: 'XXXX-XXXX-1234', emergencyContact: { name: 'Suresh Sharma',   phone: '9876543211', relation: 'Father'  }, createdAt: '2024-01-15T00:00:00Z' },
  { id: 'st2', name: 'Priya Menon',    phone: '9876543220', email: 'priya@example.com',   room: 'B-102', rentAmount: 10500, moveInDate: '2024-03-01', moveOutDate: null, status: 'active', idType: 'passport', idNumber: 'P1234567',       emergencyContact: { name: 'Radha Menon',    phone: '9876543221', relation: 'Mother'  }, createdAt: '2024-03-01T00:00:00Z' },
  { id: 'st3', name: 'Aakash Patel',   phone: '9876543230', email: '',                    room: 'A-301', rentAmount: 11000, moveInDate: '2024-06-10', moveOutDate: null, status: 'active', idType: 'aadhaar',  idNumber: 'XXXX-XXXX-5678', emergencyContact: { name: 'Rajesh Patel',   phone: '9876543231', relation: 'Father'  }, createdAt: '2024-06-10T00:00:00Z' },
  { id: 'st4', name: 'Sneha Iyer',     phone: '9876543240', email: 'sneha@example.com',   room: 'C-102', rentAmount: 9500,  moveInDate: '2024-08-20', moveOutDate: null, status: 'active', idType: 'dl',       idNumber: 'DL-1234567',     emergencyContact: { name: 'Krishna Iyer',  phone: '9876543241', relation: 'Brother' }, createdAt: '2024-08-20T00:00:00Z' },
  { id: 'st5', name: 'Vikram Nair',    phone: '9876543250', email: 'vikram@example.com',  room: 'B-103', rentAmount: 10000, moveInDate: '2024-09-05', moveOutDate: null, status: 'active', idType: 'aadhaar',  idNumber: 'XXXX-XXXX-9012', emergencyContact: { name: 'Anitha Nair',   phone: '9876543251', relation: 'Mother'  }, createdAt: '2024-09-05T00:00:00Z' },
  { id: 'st6', name: 'Kavitha Reddy',  phone: '9876543260', email: 'kavitha@example.com', room: 'A-102', rentAmount: 10000, moveInDate: '2025-01-10', moveOutDate: null, status: 'active', idType: 'aadhaar',  idNumber: 'XXXX-XXXX-3456', emergencyContact: { name: 'Ramesh Reddy',  phone: '9876543261', relation: 'Husband' }, createdAt: '2025-01-10T00:00:00Z' },
  { id: 'st7', name: 'Mohammed Ali',   phone: '9876543270', email: '',                    room: 'C-201', rentAmount: 11500, moveInDate: '2025-02-15', moveOutDate: null, status: 'active', idType: 'aadhaar',  idNumber: 'XXXX-XXXX-7890', emergencyContact: { name: 'Ahmed Ali',     phone: '9876543271', relation: 'Father'  }, createdAt: '2025-02-15T00:00:00Z' },
  { id: 'st8', name: 'Deepika Sharma', phone: '9876543280', email: 'deepika@example.com', room: 'B-201', rentAmount: 9000,  moveInDate: '2025-04-01', moveOutDate: null, status: 'active', idType: 'passport', idNumber: 'P7654321',       emergencyContact: { name: 'Pradeep Sharma',phone: '9876543281', relation: 'Husband' }, createdAt: '2025-04-01T00:00:00Z' },
]

// M0: 6 paid, 1 partial (Aakash), 1 pending (Deepika)
const paymentsM0 = [
  { id: 'sp01', tenantId: 'st1', month: M0, rentAmount: 12000, utilityShare: 0, amountPaid: 12000, status: 'paid',    paidDate: M0 + '-03', notes: '',                              createdAt: M0 + '-03T09:00:00Z' },
  { id: 'sp02', tenantId: 'st2', month: M0, rentAmount: 10500, utilityShare: 0, amountPaid: 10500, status: 'paid',    paidDate: M0 + '-04', notes: '',                              createdAt: M0 + '-04T10:00:00Z' },
  { id: 'sp03', tenantId: 'st3', month: M0, rentAmount: 11000, utilityShare: 0, amountPaid: 5000,  status: 'partial', paidDate: M0 + '-12', notes: 'Partial. Rest by 20th.',        createdAt: M0 + '-12T14:30:00Z' },
  { id: 'sp04', tenantId: 'st4', month: M0, rentAmount: 9500,  utilityShare: 0, amountPaid: 9500,  status: 'paid',    paidDate: M0 + '-05', notes: '',                              createdAt: M0 + '-05T11:00:00Z' },
  { id: 'sp05', tenantId: 'st5', month: M0, rentAmount: 10000, utilityShare: 0, amountPaid: 10000, status: 'paid',    paidDate: M0 + '-06', notes: '',                              createdAt: M0 + '-06T09:30:00Z' },
  { id: 'sp06', tenantId: 'st6', month: M0, rentAmount: 10000, utilityShare: 0, amountPaid: 10000, status: 'paid',    paidDate: M0 + '-07', notes: '',                              createdAt: M0 + '-07T08:00:00Z' },
  { id: 'sp07', tenantId: 'st7', month: M0, rentAmount: 11500, utilityShare: 0, amountPaid: 11500, status: 'paid',    paidDate: M0 + '-08', notes: '',                              createdAt: M0 + '-08T10:00:00Z' },
  { id: 'sp08', tenantId: 'st8', month: M0, rentAmount: 9000,  utilityShare: 0, amountPaid: 0,     status: 'pending', paidDate: null,       notes: '',                              createdAt: M0 + '-01T00:00:00Z' },
]

// M1: all paid with utility share of ₹1,100 each
const paymentsM1 = [
  { id: 'sp09', tenantId: 'st1', month: M1, rentAmount: 12000, utilityShare: 1100, amountPaid: 13100, status: 'paid', paidDate: M1 + '-04', notes: '', createdAt: M1 + '-04T09:00:00Z' },
  { id: 'sp10', tenantId: 'st2', month: M1, rentAmount: 10500, utilityShare: 1100, amountPaid: 11600, status: 'paid', paidDate: M1 + '-03', notes: '', createdAt: M1 + '-03T10:00:00Z' },
  { id: 'sp11', tenantId: 'st3', month: M1, rentAmount: 11000, utilityShare: 1100, amountPaid: 12100, status: 'paid', paidDate: M1 + '-05', notes: '', createdAt: M1 + '-05T11:00:00Z' },
  { id: 'sp12', tenantId: 'st4', month: M1, rentAmount: 9500,  utilityShare: 1100, amountPaid: 10600, status: 'paid', paidDate: M1 + '-04', notes: '', createdAt: M1 + '-04T12:00:00Z' },
  { id: 'sp13', tenantId: 'st5', month: M1, rentAmount: 10000, utilityShare: 1100, amountPaid: 11100, status: 'paid', paidDate: M1 + '-06', notes: '', createdAt: M1 + '-06T09:00:00Z' },
  { id: 'sp14', tenantId: 'st6', month: M1, rentAmount: 10000, utilityShare: 1100, amountPaid: 11100, status: 'paid', paidDate: M1 + '-05', notes: '', createdAt: M1 + '-05T08:00:00Z' },
  { id: 'sp15', tenantId: 'st7', month: M1, rentAmount: 11500, utilityShare: 1100, amountPaid: 12600, status: 'paid', paidDate: M1 + '-07', notes: '', createdAt: M1 + '-07T10:00:00Z' },
  { id: 'sp16', tenantId: 'st8', month: M1, rentAmount: 9000,  utilityShare: 1100, amountPaid: 10100, status: 'paid', paidDate: M1 + '-08', notes: '', createdAt: M1 + '-08T11:00:00Z' },
]

// M2: all paid with utility share of ₹900 each
const paymentsM2 = [
  { id: 'sp17', tenantId: 'st1', month: M2, rentAmount: 12000, utilityShare: 900, amountPaid: 12900, status: 'paid', paidDate: M2 + '-03', notes: '', createdAt: M2 + '-03T09:00:00Z' },
  { id: 'sp18', tenantId: 'st2', month: M2, rentAmount: 10500, utilityShare: 900, amountPaid: 11400, status: 'paid', paidDate: M2 + '-04', notes: '', createdAt: M2 + '-04T10:00:00Z' },
  { id: 'sp19', tenantId: 'st3', month: M2, rentAmount: 11000, utilityShare: 900, amountPaid: 11900, status: 'paid', paidDate: M2 + '-05', notes: '', createdAt: M2 + '-05T11:00:00Z' },
  { id: 'sp20', tenantId: 'st4', month: M2, rentAmount: 9500,  utilityShare: 900, amountPaid: 10400, status: 'paid', paidDate: M2 + '-03', notes: '', createdAt: M2 + '-03T12:00:00Z' },
  { id: 'sp21', tenantId: 'st5', month: M2, rentAmount: 10000, utilityShare: 900, amountPaid: 10900, status: 'paid', paidDate: M2 + '-06', notes: '', createdAt: M2 + '-06T09:00:00Z' },
  { id: 'sp22', tenantId: 'st6', month: M2, rentAmount: 10000, utilityShare: 900, amountPaid: 10900, status: 'paid', paidDate: M2 + '-04', notes: '', createdAt: M2 + '-04T08:00:00Z' },
  { id: 'sp23', tenantId: 'st7', month: M2, rentAmount: 11500, utilityShare: 900, amountPaid: 12400, status: 'paid', paidDate: M2 + '-07', notes: '', createdAt: M2 + '-07T10:00:00Z' },
  { id: 'sp24', tenantId: 'st8', month: M2, rentAmount: 9000,  utilityShare: 900, amountPaid: 9900,  status: 'paid', paidDate: M2 + '-05', notes: '', createdAt: M2 + '-05T11:00:00Z' },
]

const utilityBills = [
  { id: 'sub1', month: M1, type: 'electricity', totalAmount: 8800, splitMethod: 'equal', tenantCount: 8, perTenantAmount: 1100, createdAt: M1 + '-02T10:00:00Z' },
  { id: 'sub2', month: M2, type: 'electricity', totalAmount: 7200, splitMethod: 'equal', tenantCount: 8, perTenantAmount:  900, createdAt: M2 + '-02T10:00:00Z' },
]

const complaints = [
  {
    id: 'sc1',
    tenantId: 'st4', tenantName: 'Sneha Iyer', room: 'C-102',
    category: 'plumbing',
    description: 'Water heater not working since last week. Hot water is needed in mornings.',
    status: 'open', priority: 'high',
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    resolvedAt: null, ownerNotes: '',
  },
  {
    id: 'sc2',
    tenantId: 'st3', tenantName: 'Aakash Patel', room: 'A-301',
    category: 'wifi',
    description: 'WiFi keeps disconnecting in room. Speed is very slow throughout the day.',
    status: 'in-progress', priority: 'medium',
    createdAt: new Date(Date.now() - 26 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 14 * 3600000).toISOString(),
    resolvedAt: null, ownerNotes: 'Called ISP, technician visiting tomorrow.',
  },
  {
    id: 'sc3',
    tenantId: 'st1', tenantName: 'Ravi Sharma', room: 'A-204',
    category: 'furniture',
    description: 'Ceiling fan making loud noise at night. Hard to sleep.',
    status: 'resolved', priority: 'low',
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    resolvedAt: new Date(Date.now() - 86400000).toISOString(),
    ownerNotes: 'Replaced fan bearing. Issue resolved.',
  },
  {
    id: 'sc4',
    tenantId: 'st6', tenantName: 'Kavitha Reddy', room: 'A-102',
    category: 'electrical',
    description: 'Power socket near bed not working. Need it for charging.',
    status: 'open', priority: 'medium',
    createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    resolvedAt: null, ownerNotes: '',
  },
]

export const seedData = {
  tenants,
  payments: [...paymentsM0, ...paymentsM1, ...paymentsM2],
  utilityBills,
  complaints,
  pgSettings: {
    pgName: 'Sunrise PG',
    address: '42, 3rd Cross, Koramangala, Bangalore - 560034',
    ownerName: '',
    phone: '',
    upiId: 'sunrisepg@upi',
    logoText: 'PGBook',
  },
}
