import { db } from "./db"

const PRODUCTIVE = new Set(["development", "design", "meetings", "docs", "pm", "research", "comms"])

export interface WorkPatterns {
  sessionCount:       number
  avgProductivePct:   number
  peakHours:          Array<{ hour: number; productiveSec: number }>
  fatigueProfile:     { earlyPct: number; midPct: number; latePct: number }
  avgContextSwitches: number
  avgFocusDepthSec:   number
  avgWarmupMin:       number
  dayOfWeek:          Array<{ day: number; productivePct: number; count: number }>
  trend:              "improving" | "stable" | "declining"
}

export async function computePatterns(employeeId: string, days = 30): Promise<WorkPatterns> {
  const since = new Date(Date.now() - days * 86_400_000)

  const sessions = await db.workSession.findMany({
    where: {
      employeeId,
      clockIn:  { gte: since },
      clockOut: { not: null },
    },
    include: {
      events: {
        where:   { type: "tab_visit" },
        select:  { category: true, dwellSec: true, occurredAt: true, domain: true },
        orderBy: { occurredAt: "asc" },
      },
    },
    orderBy: { clockIn: "asc" },
  })

  const empty: WorkPatterns = {
    sessionCount: 0, avgProductivePct: 0, peakHours: [],
    fatigueProfile: { earlyPct: 0, midPct: 0, latePct: 0 },
    avgContextSwitches: 0, avgFocusDepthSec: 0, avgWarmupMin: 0,
    dayOfWeek: [], trend: "stable",
  }
  if (sessions.length === 0) return empty

  const hourBuckets: Record<number, number> = {}
  const dowBuckets:  Record<number, { prod: number; total: number }> = {}
  for (let h = 0; h < 24; h++) hourBuckets[h] = 0

  let earlySum = 0, midSum = 0, lateSum = 0, earlyN = 0, midN = 0, lateN = 0
  let switchRateSum = 0, switchRateN = 0
  let focusDwellSum = 0, focusEventN = 0
  let warmupSec = 0, warmupN = 0
  let allProdSec = 0, allTotalSec = 0
  const sessionPcts: number[] = []

  for (const session of sessions) {
    const { events, clockIn, clockOut } = session
    if (!events.length) continue
    const durationSec = Math.floor((clockOut!.getTime() - clockIn.getTime()) / 1000)
    if (durationSec < 300) continue

    const dow = clockIn.getDay()
    if (!dowBuckets[dow]) dowBuckets[dow] = { prod: 0, total: 0 }

    let sessProd = 0, sessTotal = 0
    const third = durationSec / 3
    const thirds = [{ p: 0, t: 0 }, { p: 0, t: 0 }, { p: 0, t: 0 }]

    for (const ev of events) {
      const dwell = ev.dwellSec ?? 0
      const isProd = PRODUCTIVE.has(ev.category ?? "")
      const offset = (ev.occurredAt.getTime() - clockIn.getTime()) / 1000
      const bi = Math.min(2, Math.floor(offset / third))

      sessTotal += dwell
      thirds[bi].t += dwell

      if (isProd) {
        sessProd += dwell
        hourBuckets[ev.occurredAt.getHours()] += dwell
        thirds[bi].p += dwell
        focusDwellSum += dwell
        focusEventN++
      }
    }

    allProdSec  += sessProd
    allTotalSec += sessTotal
    dowBuckets[dow].prod  += sessProd
    dowBuckets[dow].total += sessTotal
    sessionPcts.push(sessTotal > 0 ? (sessProd / sessTotal) * 100 : 0)

    for (let i = 0; i < 3; i++) {
      if (thirds[i].t > 0) {
        const p = (thirds[i].p / thirds[i].t) * 100
        if (i === 0) { earlySum += p; earlyN++ }
        if (i === 1) { midSum   += p; midN++   }
        if (i === 2) { lateSum  += p; lateN++  }
      }
    }

    // Context switch rate (domain changes per productive hour)
    const prodEvs = events.filter(ev => PRODUCTIVE.has(ev.category ?? ""))
    if (prodEvs.length > 1) {
      let sw = 0
      for (let i = 1; i < prodEvs.length; i++) {
        if (prodEvs[i].domain !== prodEvs[i - 1].domain) sw++
      }
      const prodHrs = sessProd / 3600
      if (prodHrs > 0) { switchRateSum += sw / prodHrs; switchRateN++ }
    }

    // Warm-up time (minutes until first productive event)
    const first = events.find(ev => PRODUCTIVE.has(ev.category ?? ""))
    if (first) {
      const w = (first.occurredAt.getTime() - clockIn.getTime()) / 1000
      if (w >= 0 && w < 7200) { warmupSec += w; warmupN++ }
    }
  }

  // Trend: compare second half of sessions vs first half
  let trend: "improving" | "stable" | "declining" = "stable"
  if (sessionPcts.length >= 4) {
    const half   = Math.floor(sessionPcts.length / 2)
    const recent = sessionPcts.slice(-half).reduce((a, b) => a + b, 0) / half
    const prior  = sessionPcts.slice(0, half).reduce((a, b) => a + b, 0) / half
    const delta  = recent - prior
    trend = delta > 5 ? "improving" : delta < -5 ? "declining" : "stable"
  }

  const peakHours = Object.entries(hourBuckets)
    .map(([h, sec]) => ({ hour: parseInt(h), productiveSec: sec }))
    .filter(h => h.productiveSec > 0)
    .sort((a, b) => b.productiveSec - a.productiveSec)
    .slice(0, 12)

  const dayOfWeek = Object.entries(dowBuckets).map(([day, { prod, total }]) => ({
    day:           parseInt(day),
    productivePct: total > 0 ? Math.round((prod / total) * 100) : 0,
    count:         sessions.filter(s => s.clockIn.getDay() === parseInt(day)).length,
  })).sort((a, b) => a.day - b.day)

  return {
    sessionCount:       sessions.length,
    avgProductivePct:   allTotalSec > 0 ? Math.round((allProdSec / allTotalSec) * 100) : 0,
    peakHours,
    fatigueProfile: {
      earlyPct: earlyN > 0 ? Math.round(earlySum / earlyN) : 0,
      midPct:   midN   > 0 ? Math.round(midSum   / midN)   : 0,
      latePct:  lateN  > 0 ? Math.round(lateSum  / lateN)  : 0,
    },
    avgContextSwitches: switchRateN > 0 ? Math.round(switchRateSum / switchRateN) : 0,
    avgFocusDepthSec:   focusEventN > 0 ? Math.round(focusDwellSum / focusEventN) : 0,
    avgWarmupMin:       warmupN     > 0 ? Math.round(warmupSec / warmupN / 60)    : 0,
    dayOfWeek,
    trend,
  }
}
