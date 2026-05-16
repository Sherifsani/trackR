import { NextRequest, NextResponse } from "next/server"
import { getAuth }                   from "@/lib/auth"
import { db }                        from "@/lib/db"

function fmtDuration(sec: number | null): string {
  if (sec === null) return ""
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h ? `${h}h ${m}m` : `${m}m`
}

function toCSV(rows: object[]): string {
  if (!rows.length) return ""
  const keys = Object.keys(rows[0])
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v)
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const header = keys.join(",")
  const body   = rows.map((r) => keys.map((k) => escape((r as Record<string, unknown>)[k])).join(",")).join("\n")
  return `${header}\n${body}`
}

export async function GET(req: NextRequest) {
  const auth = await getAuth()
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const from       = searchParams.get("from")
  const to         = searchParams.get("to")
  const employeeId = searchParams.get("employeeId") ?? undefined
  const format     = searchParams.get("format")   // "csv" → download

  const where: Record<string, unknown> = {}
  if (employeeId) where.employeeId = employeeId
  if (from || to) {
    const range: Record<string, Date> = {}
    if (from) range.gte = new Date(from)
    if (to)   range.lte = new Date(new Date(to).getTime() + 86_399_999) // include full end day
    where.clockIn = range
  }

  const rows = await db.workSession.findMany({
    where,
    orderBy: { clockIn: "desc" },
    take:    500,
    include: {
      employee: { select: { id: true, name: true, apiId: true, role: true } },
      _count:   { select: { events: true } },
    },
  })

  const sessions = rows.map((s) => ({
    id:          s.id,
    clockIn:     s.clockIn.toISOString(),
    clockOut:    s.clockOut?.toISOString() ?? null,
    approved:    s.approved,
    analysis:    s.analysis ?? null,
    analyzedAt:  s.analyzedAt?.toISOString() ?? null,
    eventCount:  s._count.events,
    durationSec: s.clockOut
      ? Math.floor((s.clockOut.getTime() - s.clockIn.getTime()) / 1000)
      : null,
    employee: {
      id:    s.employee.id,
      name:  s.employee.name,
      apiId: s.employee.apiId,
      role:  s.employee.role,
    },
  }))

  if (format === "csv") {
    const csvRows = sessions.map((s) => ({
      employee:    s.employee.name,
      role:        s.employee.role ?? "",
      clock_in:    s.clockIn,
      clock_out:   s.clockOut ?? "",
      duration:    fmtDuration(s.durationSec),
      events:      s.eventCount,
      approved:    s.approved ? "yes" : "no",
      analyzed:    s.analysis ? "yes" : "no",
      score:       s.analysis ? (s.analysis as { score?: number })?.score ?? "" : "",
    }))

    return new NextResponse(toCSV(csvRows), {
      headers: {
        "Content-Type":        "text/csv",
        "Content-Disposition": `attachment; filename="sessions-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  }

  return NextResponse.json({ sessions })
}
