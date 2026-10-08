// Plans as advertised on the pricing page. Limits are enforced from Phase 2 (billing).
export const TRIAL_DAYS = 14

export const PLANS = {
  trial:   { label: 'Free trial', monthlyPrice: 0,   maxTenants: 50,       maxProperties: 1 },
  starter: { label: 'Starter',    monthlyPrice: 249, maxTenants: 10,       maxProperties: 1 },
  pro:     { label: 'Pro',        monthlyPrice: 499, maxTenants: 50,       maxProperties: 1 },
  multi:   { label: 'Multi-PG',   monthlyPrice: 999, maxTenants: Infinity, maxProperties: 5 },
}

export const PLAN_IDS = Object.keys(PLANS)
export const PAID_PLAN_IDS = PLAN_IDS.filter(id => PLANS[id].monthlyPrice > 0)
