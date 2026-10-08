import { describe, expect, it } from 'vitest'
import {
  splitAmount, calcPaymentStatus, getBalance, getTotalDue, roundMoney, isValidMonth, isValidDate,
  getPrevMonth, getNextMonth, getMonthRange, isBillableMonth, toWhatsAppNumber, isValidPhone, getPaymentEntries,
} from './helpers.js'
import { numberToWords } from './numberToWords.js'
import { generateReminderMessage } from './generateReminderMessage.js'

describe('splitAmount', () => {
  it('splits evenly when divisible', () => {
    expect(splitAmount(9000, 3)).toEqual([3000, 3000, 3000])
  })
  it('always adds up to the exact total, to the paisa', () => {
    for (const [total, n] of [[100, 3], [8800, 7], [1234.57, 9], [1, 3], [0.05, 4]]) {
      const shares = splitAmount(total, n)
      expect(shares).toHaveLength(n)
      expect(Math.round(shares.reduce((a, b) => a + b, 0) * 100)).toBe(Math.round(total * 100))
      expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(0.01 + 1e-9)
    }
  })
  it('returns no shares for zero people', () => {
    expect(splitAmount(100, 0)).toEqual([])
  })
})

describe('payment status & balance', () => {
  it('derives status from amount paid', () => {
    expect(calcPaymentStatus(0, 1000)).toBe('pending')
    expect(calcPaymentStatus(400, 1000)).toBe('partial')
    expect(calcPaymentStatus(1000, 1000)).toBe('paid')
    expect(calcPaymentStatus(0.1 + 0.2, 0.3)).toBe('paid') // float noise
  })
  it('never reports a negative balance', () => {
    expect(getBalance({ rentAmount: 1000, utilityShare: 0, amountPaid: 1500 })).toBe(0)
    expect(getBalance({ rentAmount: 1000, utilityShare: 333.33, amountPaid: 500 })).toBe(833.33)
  })
  it('totals rent and utilities', () => {
    expect(getTotalDue({ rentAmount: 1000, utilityShare: 0.1 + 0.2 })).toBe(1000.3)
    expect(roundMoney('12.345')).toBe(12.35)
  })
  it('shows legacy payments as a single entry', () => {
    expect(getPaymentEntries({ id: 'p1', amountPaid: 500, paidDate: '2026-01-02', transactions: [] })).toHaveLength(1)
    expect(getPaymentEntries({ id: 'p1', amountPaid: 0, transactions: [] })).toHaveLength(0)
  })
})

describe('months & dates', () => {
  it('validates formats', () => {
    expect(isValidMonth('2026-10')).toBe(true)
    expect(isValidMonth('2026-13')).toBe(false)
    expect(isValidMonth('banana')).toBe(false)
    expect(isValidDate('2026-02-28')).toBe(true)
    expect(isValidDate('2026-02-30')).toBe(false)
  })
  it('steps across year boundaries', () => {
    expect(getPrevMonth('2026-01')).toBe('2025-12')
    expect(getNextMonth('2025-12')).toBe('2026-01')
    expect(getMonthRange(3, '2026-02')).toEqual(['2025-12', '2026-01', '2026-02'])
  })
  it('bills tenants only from their move-in month', () => {
    expect(isBillableMonth('2026-10-15', '2026-10')).toBe(true)
    expect(isBillableMonth('2026-11-01', '2026-10')).toBe(false)
    expect(isBillableMonth('', '2026-10')).toBe(true)
  })
})

describe('phone numbers', () => {
  it('normalises Indian numbers for WhatsApp without double prefixes', () => {
    expect(toWhatsAppNumber('9876543210')).toBe('919876543210')
    expect(toWhatsAppNumber('+91 98765 43210')).toBe('919876543210')
    expect(toWhatsAppNumber('09876543210')).toBe('919876543210')
    expect(toWhatsAppNumber('919876543210')).toBe('919876543210')
  })
  it('validates length', () => {
    expect(isValidPhone('98765')).toBe(false)
    expect(isValidPhone('+91-98765-43210')).toBe(true)
  })
})

describe('numberToWords', () => {
  it('uses the Indian numbering system', () => {
    expect(numberToWords(0)).toBe('Zero Rupees Only')
    expect(numberToWords(12500)).toBe('Twelve Thousand Five Hundred Rupees Only')
    expect(numberToWords(1500000)).toBe('Fifteen Lakh Rupees Only')
  })
  it('includes paise', () => {
    expect(numberToWords(101.5)).toBe('One Hundred One Rupees and Fifty Paise Only')
  })
})

describe('generateReminderMessage', () => {
  const tenant = { name: 'Ravi', room: 'A-1', rentAmount: 10000 }
  const settings = { pgName: 'Sunrise PG', upiId: 'sun@upi', rentDueDay: 5 }
  it('includes the month even before dues exist', () => {
    const msg = generateReminderMessage(tenant, null, settings, 'en', '2026-10')
    expect(msg).toContain('October 2026')
    expect(msg).toContain('₹10,000')
    expect(msg).toContain('sun@upi')
  })
  it('omits the UPI line when no UPI ID is set', () => {
    const msg = generateReminderMessage(tenant, null, { pgName: 'X' }, 'en', '2026-10')
    expect(msg).not.toContain('UPI')
  })
})
