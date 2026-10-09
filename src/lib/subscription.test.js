import { describe, expect, it } from 'vitest'
import { billingState, billingNotice, planBlocker, limitsFor, GRACE_DAYS, RETENTION_DAYS } from './subscription.js'
import { planPrice, monthlyValue, limitSummary } from './plans.js'
import { gstBreakup, financialYear } from '../utils/gst.js'
import { createZip, readZip, crc32 } from './zip.js'
import { toCsv } from './csv.js'
import { sniffImage } from './files.js'

const DAY = 86400000
const now = new Date('2026-10-09T10:00:00Z')
const at = days => new Date(now.getTime() + days * DAY)

describe('billingState', () => {
  it('trial is writable until it ends, then read-only with 90 days of retention', () => {
    const trialing = billingState({ plan: 'trial', trialEndsAt: at(5) }, now)
    expect(trialing).toMatchObject({ status: 'trialing', readOnly: false, daysLeft: 5 })
    const expired = billingState({ plan: 'trial', trialEndsAt: at(-1) }, now)
    expect(expired).toMatchObject({ status: 'trial_expired', readOnly: true })
    expect(expired.retentionUntil.getTime()).toBe(at(-1).getTime() + RETENTION_DAYS * DAY)
  })

  it('accounts from before trialEndsAt existed use createdAt + 14 days', () => {
    expect(billingState({ plan: 'trial', createdAt: at(-20) }, now).status).toBe('trial_expired')
    expect(billingState({ plan: 'trial', createdAt: at(-3) }, now).status).toBe('trialing')
  })

  it('a paid plan without a billing record is active (granted by PGBook)', () => {
    expect(billingState({ plan: 'multi' }, now)).toMatchObject({ status: 'active', readOnly: false })
  })

  it('past due keeps full access for the grace period, then read-only', () => {
    const recent = billingState({ plan: 'pro', billing: { status: 'past_due', pastDueSince: at(-3) } }, now)
    expect(recent).toMatchObject({ status: 'past_due', readOnly: false, daysLeft: GRACE_DAYS - 3 })
    const old = billingState({ plan: 'pro', billing: { status: 'past_due', pastDueSince: at(-GRACE_DAYS - 1) } }, now)
    expect(old).toMatchObject({ status: 'unpaid', readOnly: true })
  })

  it('halted subscriptions are read-only straight away', () => {
    expect(billingState({ plan: 'pro', billing: { status: 'halted', haltedAt: at(-1) } }, now)).toMatchObject({ status: 'unpaid', readOnly: true })
  })

  it('a cancellation keeps access until the paid period ends', () => {
    const b = { status: 'active', cancelAtPeriodEnd: true, currentPeriodEnd: at(10) }
    expect(billingState({ plan: 'pro', billing: b }, now)).toMatchObject({ status: 'cancelling', readOnly: false, daysLeft: 10 })
    expect(billingState({ plan: 'pro', billing: { ...b, currentPeriodEnd: at(-1) } }, now)).toMatchObject({ status: 'ended', readOnly: true })
    expect(billingState({ plan: 'pro', billing: { status: 'cancelled', currentPeriodEnd: at(-2) } }, now).status).toBe('ended')
  })

  it('only tells staff to ask the owner', () => {
    const s = billingState({ plan: 'trial', trialEndsAt: at(-1) }, now)
    expect(billingNotice(s, { isOwner: false }).text).toMatch(/Ask the owner/)
    expect(billingNotice(s, { isOwner: true }).text).toMatch(/Choose a plan/)
    expect(billingNotice(billingState({ plan: 'pro' }, now), { isOwner: true })).toBeNull()
  })
})

describe('plans and limits', () => {
  it('prices include GST; yearly is 12 × the yearly monthly price', () => {
    expect(planPrice('pro', 'monthly')).toBe(499)
    expect(planPrice('pro', 'yearly')).toBe(399 * 12)
    expect(monthlyValue('multi', 'yearly')).toBe(799)
  })
  it('limits follow the plan; the trial includes everything', () => {
    expect(limitsFor(billingState({ plan: 'starter' }, now))).toEqual({ tenants: 10, properties: 1, staff: 0 })
    expect(limitsFor(billingState({ plan: 'trial', trialEndsAt: at(3) }, now)).properties).toBe(5)
    expect(limitSummary('multi')).toMatch(/Unlimited tenants/)
  })
  it('explains why a smaller plan cannot be chosen', () => {
    expect(planBlocker('pro', { tenants: 20, properties: 2, staff: 0 })).toMatch(/2 properties/)
    expect(planBlocker('starter', { tenants: 5, properties: 1, staff: 1 })).toMatch(/no staff logins/)
    expect(planBlocker('multi', { tenants: 500, properties: 5, staff: 10 })).toBeNull()
  })
})

describe('GST', () => {
  it('splits an inclusive price into CGST + SGST within the state', () => {
    const t = gstBreakup(499, { sellerGstin: '29ABCDE1234F1Z5', sellerState: '29', buyerState: '29' })
    expect(t).toEqual({ taxable: 422.88, cgst: 38.06, sgst: 38.06, igst: 0, rate: 18, total: 499 })
  })
  it('uses IGST across states and adds up exactly', () => {
    const t = gstBreakup(9588, { sellerGstin: '29ABCDE1234F1Z5', sellerState: '29', buyerState: '27' })
    expect(t.igst + t.taxable).toBeCloseTo(9588, 2)
    expect(t.cgst).toBe(0)
  })
  it('charges no GST when the seller is not registered', () => {
    expect(gstBreakup(249, { sellerGstin: '', sellerState: '29', buyerState: '29' })).toMatchObject({ taxable: 249, rate: 0 })
  })
  it('financial year runs April to March (IST)', () => {
    expect(financialYear('2026-10-09T00:00:00Z')).toBe('2026-27')
    expect(financialYear('2027-03-31T12:00:00Z')).toBe('2026-27')
    expect(financialYear('2027-03-31T19:00:00Z')).toBe('2027-28') // already 1 April in India
  })
})

describe('export files', () => {
  it('zip round-trips contents and computes standard CRC-32', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xCBF43926)
    const zip = createZip([{ name: 'a.csv', content: 'x,y\n1,2' }, { name: 'नाम.txt', content: 'हिंदी' }])
    expect(zip.subarray(0, 2).toString()).toBe('PK')
    expect(readZip(zip)).toEqual([{ name: 'a.csv', content: 'x,y\n1,2' }, { name: 'नाम.txt', content: 'हिंदी' }])
  })
  it('csv quotes commas/quotes and neutralises formulas', () => {
    const csv = toCsv([{ a: 'Sharma, Ravi', b: '=HYPERLINK("x")', c: -500 }], [['A', r => r.a], ['B', r => r.b], ['C', r => r.c]])
    expect(csv).toBe('﻿A,B,C\r\n"Sharma, Ravi","\'=HYPERLINK(""x"")",-500\r\n')
  })
})

describe('upload checks', () => {
  it('recognises images by their bytes, not their name', () => {
    expect(sniffImage(Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]))).toBe('image/jpeg')
    expect(sniffImage(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))).toBe('image/png')
    expect(sniffImage(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp')
    expect(sniffImage(Buffer.from('<svg onload=alert(1)>'))).toBeNull()
  })
})
