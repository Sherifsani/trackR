export const PLANS = {
  starter: {
    id:           "starter",
    name:         "Starter",
    priceNgn:     5_000,
    priceKobo:    500_000,
    maxEmployees: 5,
    description:  "Up to 5 employees",
    features:     ["Session tracking", "AI session analysis", "Anomaly detection", "KPI expectations"],
  },
  growth: {
    id:           "growth",
    name:         "Growth",
    priceNgn:     15_000,
    priceKobo:    1_500_000,
    maxEmployees: 20,
    description:  "Up to 20 employees",
    features:     ["Everything in Starter", "30-day pattern insights", "CSV export", "Squad payroll disbursement"],
  },
  scale: {
    id:           "scale",
    name:         "Scale",
    priceNgn:     30_000,
    priceKobo:    3_000_000,
    maxEmployees: null,
    description:  "Unlimited employees",
    features:     ["Everything in Growth", "Unlimited team size", "Priority support"],
  },
} as const

export type PlanId = keyof typeof PLANS

export function getPlan(id: string) {
  return PLANS[id as PlanId] ?? null
}
