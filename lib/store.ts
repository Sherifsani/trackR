import { db, Prisma } from "./db"

export interface ActivityEvent {
  type: string
  url?: string
  domain?: string
  title?: string
  category?: string
  dwell?: number // seconds
  ts: number // epoch ms
  [key: string]: unknown
}

export interface DaySummary {
  totalSec: number
  categories: Record<string, number>
  topDomains: Array<{ domain: string; dwell: number }>
  eventCount: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dayBounds(date?: string): { gte: Date; lt: Date } {
  const day = date ?? new Date().toISOString().slice(0, 10)
  const gte = new Date(`${day}T00:00:00.000Z`)
  const lt = new Date(gte.getTime() + 86_400_000)
  return { gte, lt }
}

function toEvent(row: {
  type: string
  domain: string | null
  title: string | null
  category: string | null
  dwellSec: number | null
  occurredAt: Date
  meta: unknown
}): ActivityEvent {
  const extra = (
    row.meta && typeof row.meta === "object" ? row.meta : {}
  ) as Record<string, unknown>
  return {
    ...extra,
    type: row.type,
    domain: row.domain ?? undefined,
    title: row.title ?? undefined,
    category: row.category ?? undefined,
    dwell: row.dwellSec ?? undefined,
    ts: row.occurredAt.getTime(),
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

async function ensureEmployee(apiId: string) {
  return db.employee.upsert({
    where: { apiId },
    update: {},
    create: { apiId, name: apiId },
  })
}

export async function clockIn(
  apiId: string
): Promise<{ sessionId: string; clockIn: Date }> {
  const employee = await ensureEmployee(apiId)

  // Return the existing open session rather than creating a duplicate
  const existing = await db.workSession.findFirst({
    where: { employeeId: employee.id, clockOut: null },
    orderBy: { clockIn: "desc" },
  })
  if (existing) return { sessionId: existing.id, clockIn: existing.clockIn }

  const session = await db.workSession.create({
    data: { employeeId: employee.id },
  })
  return { sessionId: session.id, clockIn: session.clockIn }
}

export async function clockOut(sessionId: string): Promise<void> {
  const session = await db.workSession.findUnique({ where: { id: sessionId } })
  const now = new Date()

  // If employee clocked out while on break, finalize the break duration
  const breakUsedSec = session?.breakStartedAt
    ? session.breakUsedSec +
      Math.floor((now.getTime() - session.breakStartedAt.getTime()) / 1000)
    : (session?.breakUsedSec ?? 0)

  await db.workSession.update({
    where: { id: sessionId },
    data: { clockOut: now, breakStartedAt: null, breakUsedSec },
  })
}

export async function appendEvents(
  apiId: string,
  events: ActivityEvent[],
  sessionId?: string
): Promise<void> {
  if (!events.length) {
    console.log(`[trackR] appendEvents: no events for ${apiId}`)
    return
  }

  await ensureEmployee(apiId)

  const data = events.map((ev) => {
    const { type, url, domain, title, category, dwell, ts, ...rest } = ev
    return {
      employeeId: apiId,
      sessionId: sessionId ?? null,
      type,
      domain: domain ?? null,
      title: title ?? null,
      category: category ?? null,
      dwellSec: typeof dwell === "number" ? dwell : null,
      occurredAt: new Date(ts),
      meta: Object.keys(rest).length ? { ...rest, url } : Prisma.JsonNull,
    }
  })

  await db.activityEvent.createMany({ data })

  const tabVisits = data.filter((d) => d.type === "tab_visit").length
  const otherEvents = data.length - tabVisits
  console.log(
    `[trackR] Stored ${tabVisits} tab_visit + ${otherEvents} other events for ${apiId}`
  )
}

export async function getEvents(
  apiId: string,
  opts: { date?: string; since?: number; sessionId?: string } = {}
): Promise<ActivityEvent[]> {
  const { gte, lt } = dayBounds(opts.date)

  const where: Record<string, unknown> = { employeeId: apiId }

  if (opts.sessionId) {
    // Primary filter is sessionId. When `since` is also provided, include events
    // that were synced before the extension received the sessionId (those land with
    // sessionId = null but have the correct occurredAt timestamp).
    if (opts.since) {
      where.OR = [
        { sessionId: opts.sessionId },
        { sessionId: null, occurredAt: { gte: new Date(opts.since) } },
      ]
    } else {
      where.sessionId = opts.sessionId
    }
  } else {
    where.occurredAt = opts.since ? { gte: new Date(opts.since) } : { gte, lt }
  }

  const rows = await db.activityEvent.findMany({
    where,
    orderBy: { occurredAt: "asc" },
    select: {
      type: true,
      domain: true,
      title: true,
      category: true,
      dwellSec: true,
      occurredAt: true,
      meta: true,
    },
  })

  return rows.map(toEvent)
}

export async function getSummary(
  apiId: string,
  opts: { date?: string; sessionId?: string; since?: number } = {}
): Promise<DaySummary> {
  const bounds = dayBounds(opts.date)

  // When scoping by sessionId use the session as the only bound — day bounds
  // would drop events that crossed UTC midnight. Also include events that were
  // synced before the extension received the sessionId (those have sessionId = null
  // but a correct occurredAt timestamp).
  const sessionScope: Record<string, unknown> = opts.sessionId
    ? opts.since
      ? {
          OR: [
            { sessionId: opts.sessionId },
            { sessionId: null, occurredAt: { gte: new Date(opts.since) } },
          ],
        }
      : { sessionId: opts.sessionId }
    : { occurredAt: bounds }

  const baseWhere: Record<string, unknown> = {
    employeeId: apiId,
    type: "tab_visit",
    ...sessionScope,
  }

  const [catGroups, domainGroups, eventCount] = await Promise.all([
    db.activityEvent.groupBy({
      by: ["category"],
      where: { ...baseWhere, dwellSec: { gt: 0 } },
      _sum: { dwellSec: true },
    }),
    db.activityEvent.groupBy({
      by: ["domain"],
      where: { ...baseWhere, domain: { not: null } },
      _sum: { dwellSec: true },
      orderBy: { _sum: { dwellSec: "desc" } },
      take: 10, // Increased from 5 to show more sites
    }),
    db.activityEvent.count({ where: baseWhere }),
  ])

  const categories: Record<string, number> = {}
  let totalSec = 0

  for (const g of catGroups as Array<{
    category: string | null
    _sum: { dwellSec: number | null }
  }>) {
    const sec = g._sum.dwellSec ?? 0
    categories[g.category ?? "other"] = sec
    totalSec += sec
  }

  const topDomains = (
    domainGroups as Array<{
      domain: string | null
      _sum: { dwellSec: number | null }
    }>
  )
    .filter((g) => g.domain)
    .map((g) => ({ domain: g.domain!, dwell: g._sum.dwellSec ?? 0 }))

  return { totalSec, categories, topDomains, eventCount }
}
