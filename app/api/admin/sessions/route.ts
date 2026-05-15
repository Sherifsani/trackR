import { NextResponse } from "next/server"
import { getAuth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  const auth = await getAuth()
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rows = await db.workSession.findMany({
    orderBy: { clockIn: "desc" },
    take:    500,
    include: {
      employee: { select: { id: true, name: true, apiId: true, role: true } },
      _count:   { select: { events: true } },
    },
  })

  return NextResponse.json({
    sessions: rows.map((s) => ({
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
    })),
  })
}
