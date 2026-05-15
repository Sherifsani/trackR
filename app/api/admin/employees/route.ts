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

    return {
      id:            emp.id,
      apiId:         emp.apiId,
      name:          emp.name,
      initials:      initials(emp.name),
      role:          emp.role ?? "",
      status,
      clockIn:       clockInTime,
      hours:         fmtHours(todaySec),
      weekHours:     Math.round((weekSec / 3600) * 100) / 100,
      hourlyRate:    emp.hourlyRate ? Number(emp.hourlyRate) : 0,
      breakMinPerDay: emp.breakMinPerDay,
      bankVerified:  emp.bankVerified,
      accountName:   emp.accountName,
      sessionId:     openSession?.id ?? null,
    }
  })

  return NextResponse.json({ employees: result })
}
