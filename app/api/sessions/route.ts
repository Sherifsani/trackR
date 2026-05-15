import { NextRequest, NextResponse } from "next/server"
import { clockIn } from "@/lib/store"
import { getAuth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  const auth = await getAuth()
  if (!auth) return NextResponse.json({ sessions: [] })

  let employeeDbId: string

  if (auth.role === "admin") {
    const { searchParams } = new URL(req.url)
    const eid = searchParams.get("employeeId")
    if (!eid) return NextResponse.json({ sessions: [] })
    employeeDbId = eid
  } else if (auth.role === "employee") {
    employeeDbId = auth.sub
  } else {
    return NextResponse.json({ sessions: [] })
  }

  const rows = await db.workSession.findMany({
    where:   { employeeId: employeeDbId },
    orderBy: { clockIn: "desc" },
    take:    200,
    select: {
      id: true, clockIn: true, clockOut: true, approved: true,
      analysis: true, analyzedAt: true,
      _count: { select: { events: true } },
    },
  })

  return NextResponse.json({
    sessions: rows.map((s) => ({
      id:          s.id,
      clockIn:     s.clockIn.toISOString(),
      clockOut:    s.clockOut?.toISOString() ?? null,
      approved:    s.approved,
      eventCount:  s._count.events,
      durationSec: s.clockOut
        ? Math.floor((s.clockOut.getTime() - s.clockIn.getTime()) / 1000)
        : null,
      analysis:    s.analysis ?? null,
      analyzedAt:  s.analyzedAt?.toISOString() ?? null,
    })),
  })
}

export async function POST(req: NextRequest) {
  const jwtAuth     = await getAuth()
  const hasBearer   = req.headers.get("Authorization")?.startsWith("Bearer ")

  if (!jwtAuth && !hasBearer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))

  const employeeId: string | undefined =
    jwtAuth?.role === "employee" && jwtAuth.apiId
      ? jwtAuth.apiId
      : body?.employeeId

  if (!employeeId) {
    return NextResponse.json({ error: "Missing employeeId" }, { status: 400 })
  }

  const { sessionId, clockIn: clockInDate } = await clockIn(employeeId)
  return NextResponse.json({ sessionId, clockIn: clockInDate.toISOString() })
}
