import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAuth } from "@/lib/auth"

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("")
}

function startOfDayUTC(d: Date) {
  const r = new Date(d)
  r.setUTCHours(0, 0, 0, 0)
  return r
}

function startOfWeekUTC(d: Date) {
  const r = new Date(d)
  const day = r.getUTCDay()
  r.setUTCDate(r.getUTCDate() - day)
  r.setUTCHours(0, 0, 0, 0)
  return r
}

function fmtHours(totalSec: number) {
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  return `${h}h ${m.toString().padStart(2, "0")}m`
}

export async function GET() {
  const auth = await getAuth()
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now       = new Date()
  const todayStart = startOfDayUTC(now)
  const weekStart  = startOfWeekUTC(now)

  const employees = await db.employee.findMany({
    include: {
      sessions: {
        where:   { clockIn: { gte: weekStart } },
        orderBy: { clockIn: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  // Enrich active sessions with live break usage
  const openSessionIds = employees
    .flatMap((e) => e.sessions)
    .filter((s) => !s.clockOut)
    .map((s) => s.id)

  type LiveBreak = { id: string; breakUsedSec: number; breakStartedAt: Date | null }
  const liveBreaks: Record<string, LiveBreak> = {}
  if (openSessionIds.length) {
    const live = await db.workSession.findMany({
      where:  { id: { in: openSessionIds } },
      select: { id: true, breakUsedSec: true, breakStartedAt: true },
    })
    for (const s of live) liveBreaks[s.id] = s
  }

  const result = employees.map((emp) => {
    const todaySessions = emp.sessions.filter((s) => s.clockIn >= todayStart)
    const openSession   = todaySessions.find((s) => !s.clockOut) ?? null

    let todaySec = 0
    for (const s of todaySessions) {
      const end = s.clockOut ?? now
      todaySec += (end.getTime() - s.clockIn.getTime()) / 1000
    }

    let weekSec = 0
    for (const s of emp.sessions) {
      const end = s.clockOut ?? now
      weekSec += (end.getTime() - s.clockIn.getTime()) / 1000
    }

    let status: "active" | "clocked-out" | "absent"
    let clockInTime = "—"

    if (openSession) {
      status = "active"
      clockInTime = openSession.clockIn.toLocaleTimeString("en-US", {
        hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC",
      })
    } else if (todaySessions.length > 0) {
      status = "clocked-out"
      clockInTime = todaySessions[0].clockIn.toLocaleTimeString("en-US", {
        hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC",
      })
    } else {
      status = "absent"
    }

    const liveBreakSec = openSession
      ? (() => {
          const lb = liveBreaks[openSession.id]
          if (!lb) return 0
          return lb.breakStartedAt
            ? lb.breakUsedSec + Math.floor((now.getTime() - lb.breakStartedAt.getTime()) / 1000)
            : lb.breakUsedSec
        })()
      : 0

    // Net today seconds = gross minus all break time in today's sessions
    const todayBreakSec = todaySessions.reduce((sum, s) => {
      if (openSession && s.id === openSession.id) return sum + liveBreakSec
      return sum + s.breakUsedSec
    }, 0)
    const todayNetSec = Math.max(0, todaySec - todayBreakSec)

    return {
      id:               emp.id,
      apiId:            emp.apiId,
      name:             emp.name,
      initials:         initials(emp.name),
      role:             emp.role ?? "",
      status,
      clockIn:          clockInTime,
      hours:            fmtHours(todaySec),
      weekHours:        Math.round((weekSec / 3600) * 100) / 100,
      hourlyRate:         emp.hourlyRate ? Number(emp.hourlyRate) : 0,
      breakMinPerDay:     emp.breakMinPerDay,
      workHoursPerDay:    emp.workHoursPerDay,
      overtimeMultiplier: emp.overtimeMultiplier,
      kpiDescription:     emp.kpiDescription,
      bankVerified:       emp.bankVerified,
      accountName:      emp.accountName,
      sessionId:        openSession?.id ?? null,
      todayNetSec,
      // Break overage data for active employees
      onBreak:          openSession ? !!liveBreaks[openSession.id]?.breakStartedAt : false,
      breakUsedSec:     liveBreakSec,
    }
  })

  return NextResponse.json({ employees: result })
}
