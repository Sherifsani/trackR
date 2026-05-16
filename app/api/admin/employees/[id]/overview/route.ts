import { NextRequest, NextResponse } from "next/server"
import { db }                        from "@/lib/db"
import { getAuth }                   from "@/lib/auth"
import { analyzePatterns }           from "@/lib/analyze"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuth()
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const [emp, sessions, anomalies, totalCount] = await Promise.all([
    db.employee.findUnique({
      where:  { id },
      select: { id: true, name: true, role: true, insightsSummary: true, insightsUpdatedAt: true },
    }),
    db.workSession.findMany({
      where:   { employeeId: id, clockOut: { not: null } },
      orderBy: { clockIn: "desc" },
      take:    15,
      include: { _count: { select: { events: true } } },
    }),
    db.anomalyFlag.findMany({
      where:   { employeeId: id, resolvedAt: null },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take:    20,
    }),
    db.workSession.count({ where: { employeeId: id } }),
  ])

  if (!emp) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const closed = sessions.filter((s) => s.clockOut)
  const totalDurSec = closed.reduce(
    (sum, s) => sum + Math.floor((s.clockOut!.getTime() - s.clockIn.getTime()) / 1000),
    0,
  )
  const avgSessionSec = closed.length > 0 ? Math.floor(totalDurSec / closed.length) : 0

  return NextResponse.json({
    employee:  { id: emp.id, name: emp.name, role: emp.role },
    insights:  emp.insightsSummary ?? null,
    updatedAt: emp.insightsUpdatedAt?.toISOString() ?? null,
    recentSessions: sessions.map((s) => ({
      id:          s.id,
      clockIn:     s.clockIn.toISOString(),
      clockOut:    s.clockOut?.toISOString() ?? null,
      durationSec: s.clockOut ? Math.floor((s.clockOut.getTime() - s.clockIn.getTime()) / 1000) : null,
      eventCount:  s._count.events,
      analysis:    s.analysis ?? null,
    })),
    anomalies: anomalies.map((a) => ({
      id:        a.id,
      stream:    a.stream,
      signal:    a.signal,
      severity:  a.severity,
      score:     a.score,
      message:   a.message,
      sessionId: a.sessionId,
      createdAt: a.createdAt.toISOString(),
    })),
    stats: { totalSessions: totalCount, avgSessionSec },
  })
}

// POST — trigger a fresh pattern analysis for this employee
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuth()
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    await analyzePatterns(id)
  } catch (err) {
    console.error("[trackR] Pattern analysis failed:", err)
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 })
  }

  const emp = await db.employee.findUnique({
    where:  { id },
    select: { insightsSummary: true, insightsUpdatedAt: true },
  })

  return NextResponse.json({
    insights:  emp?.insightsSummary ?? null,
    updatedAt: emp?.insightsUpdatedAt?.toISOString() ?? null,
  })
}
