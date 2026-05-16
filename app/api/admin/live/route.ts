import { NextResponse } from "next/server"
import { db }          from "@/lib/db"
import { getAuth }     from "@/lib/auth"

// Returns the latest tab activity for every currently-clocked-in employee.
// Admin page polls this every 8 s to show inline "currently viewing" status.

export async function GET() {
  const auth = await getAuth()
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Find all open sessions
  const openSessions = await db.workSession.findMany({
    where:   { clockOut: null },
    select:  {
      id:         true,
      employeeId: true,
      breakStartedAt: true,
      breakUsedSec:   true,
      employee:   { select: { id: true, apiId: true, breakMinPerDay: true } },
    },
  })

  if (!openSessions.length) {
    return NextResponse.json({ employees: [] })
  }

  // For each session grab their latest tab_visit event in the last 10 minutes
  const cutoff = new Date(Date.now() - 10 * 60_000)

  const results = await Promise.all(
    openSessions.map(async (s) => {
      const latest = await db.activityEvent.findFirst({
        where: {
          sessionId: s.id,
          type:      "tab_visit",
          occurredAt: { gte: cutoff },
        },
        orderBy: { occurredAt: "desc" },
        select:  { domain: true, category: true, title: true, occurredAt: true },
      })

      const nowBreakSec = s.breakStartedAt
        ? s.breakUsedSec + Math.floor((Date.now() - s.breakStartedAt.getTime()) / 1000)
        : s.breakUsedSec

      return {
        employeeId:     s.employee.id,
        apiId:          s.employee.apiId,
        onBreak:        !!s.breakStartedAt,
        breakUsedSec:   nowBreakSec,
        breakLimitSec:  s.employee.breakMinPerDay * 60,
        domain:         latest?.domain   ?? null,
        category:       latest?.category ?? null,
        title:          latest?.title    ?? null,
        ts:             latest?.occurredAt.getTime() ?? null,
      }
    }),
  )

  return NextResponse.json({ employees: results })
}
