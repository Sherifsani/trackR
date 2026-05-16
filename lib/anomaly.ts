import { db, Prisma } from "./db"
import type { ActivityEvent } from "./store"

interface AnomalyResult {
  stream: "security" | "wellbeing"
  signal: string
  severity: "low" | "medium" | "high"
  score: number
  message: string
  meta?: Record<string, unknown>
}

function zScore(value: number, mean: number, std: number): number {
  if (std === 0) return 0
  return Math.abs((value - mean) / std)
}

function severityFromZ(z: number): "low" | "medium" | "high" {
  if (z >= 3) return "high"
  if (z >= 2) return "medium"
  return "low"
}

// ── Security: tab-open velocity vs 30-day baseline ───────────────────────────

async function checkVelocityAnomaly(
  dbEmployeeId: string,
  events: ActivityEvent[],
): Promise<AnomalyResult | null> {
  const tabEvents = events.filter((e) => e.type === "tab_visit")
  if (tabEvents.length < 5) return null

  const timestamps = tabEvents.map((e) => e.ts).sort((a, b) => a - b)
  const windowMin  = (timestamps[timestamps.length - 1] - timestamps[0]) / 60_000
  if (windowMin < 0.5) return null

  const currentRate = tabEvents.length / windowMin

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000)
  const historicalSessions = await db.workSession.findMany({
    where: {
      employeeId: dbEmployeeId,
      clockIn:    { gte: thirtyDaysAgo },
      clockOut:   { not: null },
    },
    select: {
      clockIn:  true,
      clockOut: true,
      _count:   { select: { events: { where: { type: "tab_visit" } } } },
    },
  })

  const sessionRates: number[] = []
  for (const s of historicalSessions) {
    if (s._count.events < 5 || !s.clockOut) continue
    const durMin = (s.clockOut.getTime() - s.clockIn.getTime()) / 60_000
    if (durMin < 1) continue
    sessionRates.push(s._count.events / durMin)
  }

  if (sessionRates.length < 3) return null

  const mean = sessionRates.reduce((a, b) => a + b, 0) / sessionRates.length
  const std  = Math.sqrt(
    sessionRates.reduce((sum, r) => sum + (r - mean) ** 2, 0) / sessionRates.length,
  )

  const z = zScore(currentRate, mean, std)
  if (z < 2) return null

  return {
    stream:   "security",
    signal:   "velocity_anomaly",
    severity: severityFromZ(z),
    score:    Math.min(1, z / 5),
    message:  `Tab activity rate is ${currentRate.toFixed(1)}/min — ${z.toFixed(1)}σ above their ${mean.toFixed(1)}/min baseline`,
    meta:     { currentRate: Math.round(currentRate * 10) / 10, baselineMean: Math.round(mean * 10) / 10, zScore: Math.round(z * 10) / 10 },
  }
}

// ── Security: burst of near-instant tab switches ──────────────────────────────

function checkRapidContextSwitching(events: ActivityEvent[]): AnomalyResult | null {
  const tabEvents = events
    .filter((e) => e.type === "tab_visit" && typeof e.dwell === "number")
    .sort((a, b) => a.ts - b.ts)

  if (tabEvents.length < 10) return null

  const rapidCount = tabEvents.filter((e) => (e.dwell ?? 999) < 8).length
  const rapidRatio = rapidCount / tabEvents.length

  if (rapidRatio < 0.45) return null

  const severity: "low" | "medium" | "high" = rapidRatio > 0.7 ? "high" : rapidRatio > 0.55 ? "medium" : "low"

  return {
    stream:   "security",
    signal:   "rapid_context_switching",
    severity,
    score:    Math.min(1, rapidRatio),
    message:  `${Math.round(rapidRatio * 100)}% of tab visits lasted under 8s — possible erratic browsing or scripted navigation`,
    meta:     { rapidCount, totalCount: tabEvents.length, rapidRatio: Math.round(rapidRatio * 100) / 100 },
  }
}

// ── Wellbeing: activity outside normal working hours ─────────────────────────

function checkOffHours(events: ActivityEvent[]): AnomalyResult | null {
  if (events.length < 5) return null

  const offHours = events.filter((e) => {
    const hour = new Date(e.ts).getUTCHours()
    return hour < 6 || hour >= 22
  })

  const offRatio = offHours.length / events.length
  if (offRatio < 0.35) return null

  return {
    stream:   "wellbeing",
    signal:   "off_hours_work",
    severity: offRatio > 0.6 ? "high" : "medium",
    score:    Math.min(1, offRatio),
    message:  `${offHours.length} of ${events.length} events occurred outside normal hours (before 6am or after 10pm UTC)`,
    meta:     { offHoursCount: offHours.length, totalCount: events.length },
  }
}

// ── Wellbeing: average tab dwell too short across recent sessions ─────────────

async function checkContextSwitchingFatigue(
  dbEmployeeId: string,
): Promise<AnomalyResult | null> {
  const sessions = await db.workSession.findMany({
    where:   { employeeId: dbEmployeeId, clockOut: { not: null } },
    orderBy: { clockIn: "desc" },
    take:    5,
    select:  {
      events: {
        where:  { type: "tab_visit", dwellSec: { gt: 0 } },
        select: { dwellSec: true },
      },
    },
  })

  const avgDwells = sessions
    .map((s) => {
      if (!s.events.length) return null
      return s.events.reduce((sum, e) => sum + (e.dwellSec ?? 0), 0) / s.events.length
    })
    .filter((d): d is number => d !== null)

  if (avgDwells.length < 2) return null

  const overallAvg = avgDwells.reduce((a, b) => a + b, 0) / avgDwells.length
  if (overallAvg >= 45) return null

  const severity: "low" | "medium" | "high" = overallAvg < 15 ? "high" : overallAvg < 30 ? "medium" : "low"

  return {
    stream:   "wellbeing",
    signal:   "context_switching_fatigue",
    severity,
    score:    Math.max(0, 1 - overallAvg / 45),
    message:  `Average tab dwell is ${Math.round(overallAvg)}s across recent sessions — sustained focus blocks are absent`,
    meta:     { avgDwellSec: Math.round(overallAvg), sessionCount: avgDwells.length },
  }
}

// ── Wellbeing: productivity % declining over recent analyzed sessions ─────────

async function checkEngagementDecay(
  dbEmployeeId: string,
): Promise<AnomalyResult | null> {
  const sessions = await db.workSession.findMany({
    where: {
      employeeId: dbEmployeeId,
      clockOut:   { not: null },
      analysis:   { not: Prisma.JsonNull },
    },
    orderBy: { clockIn: "desc" },
    take:    10,
    select:  { analysis: true },
  })

  const scores = sessions
    .map((s) => {
      const a = s.analysis as { productive_pct?: number } | null
      return typeof a?.productive_pct === "number" ? a.productive_pct : null
    })
    .filter((p): p is number => p !== null)

  if (scores.length < 6) return null

  const half   = Math.floor(scores.length / 2)
  const recent = scores.slice(0, half)          // newer (desc order)
  const older  = scores.slice(half)             // older

  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
  const olderAvg  = older.reduce((a, b) => a + b, 0) / older.length
  const decline   = olderAvg - recentAvg

  if (decline < 10) return null

  const severity: "low" | "medium" | "high" = decline > 25 ? "high" : decline > 15 ? "medium" : "low"

  return {
    stream:   "wellbeing",
    signal:   "engagement_decay",
    severity,
    score:    Math.min(1, decline / 40),
    message:  `Productive time dropped from ${Math.round(olderAvg)}% to ${Math.round(recentAvg)}% over recent sessions (−${Math.round(decline)}pp)`,
    meta:     { recentAvgPct: Math.round(recentAvg), olderAvgPct: Math.round(olderAvg), declinePct: Math.round(decline) },
  }
}

// ── Persist flags ─────────────────────────────────────────────────────────────

async function persistFlags(
  dbEmployeeId: string,
  sessionId: string | null,
  flags: AnomalyResult[],
): Promise<void> {
  if (!flags.length) return

  await db.anomalyFlag.createMany({
    data: flags.map((f) => ({
      employeeId: dbEmployeeId,
      sessionId,
      stream:     f.stream,
      signal:     f.signal,
      severity:   f.severity,
      score:      f.score,
      message:    f.message,
      meta:       f.meta ? (f.meta as Prisma.InputJsonValue) : Prisma.JsonNull,
    })),
  })
}

// ── Public: run security analysis after each activity sync ────────────────────
// Called with apiId (extension token). Looks up DB employee internally.

export async function runSecurityAnalysis(
  apiId: string,
  sessionId: string | null,
  events: ActivityEvent[],
): Promise<void> {
  if (events.length < 3) return

  const emp = await db.employee.findUnique({ where: { apiId }, select: { id: true } })
  if (!emp) return

  const [velocity, rapidSwitch, offHours] = await Promise.all([
    checkVelocityAnomaly(emp.id, events),
    Promise.resolve(checkRapidContextSwitching(events)),
    Promise.resolve(checkOffHours(events)),
  ])

  const flags = [velocity, rapidSwitch, offHours].filter(Boolean) as AnomalyResult[]
  await persistFlags(emp.id, sessionId, flags)
}

// ── Public: run wellbeing analysis (call after clock-out or on demand) ────────

export async function runWellbeingAnalysis(dbEmployeeId: string): Promise<void> {
  const [fatigue, decay] = await Promise.all([
    checkContextSwitchingFatigue(dbEmployeeId),
    checkEngagementDecay(dbEmployeeId),
  ])

  const flags = [fatigue, decay].filter(Boolean) as AnomalyResult[]
  await persistFlags(dbEmployeeId, null, flags)
}
