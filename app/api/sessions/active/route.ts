import { NextRequest, NextResponse } from "next/server"
import { db }                        from "@/lib/db"
import { getAuth }                   from "@/lib/auth"

export async function GET(req: NextRequest) {
  const auth = await getAuth()

  // Extension service worker can't send cookies — accept Bearer + ?employeeId instead
  const hasBearer = req.headers.get("Authorization")?.startsWith("Bearer ")
  const apiId = auth?.apiId ?? (hasBearer ? req.nextUrl.searchParams.get("employeeId") : null)

  if (!apiId) return NextResponse.json({ session: null })

  const employee = await db.employee.findUnique({
    where:  { apiId },
    select: { id: true, breakMinPerDay: true, workHoursPerDay: true, hourlyRate: true, overtimeMultiplier: true },
  })
  if (!employee) return NextResponse.json({ session: null })

  const session = await db.workSession.findFirst({
    where:   { employeeId: employee.id, clockOut: null },
    orderBy: { clockIn: "desc" },
  })
  if (!session) return NextResponse.json({ session: null })

  return NextResponse.json({
    session: {
      id:             session.id,
      clockIn:        session.clockIn.toISOString(),
      durationSec:    Math.floor((Date.now() - session.clockIn.getTime()) / 1000),
      breakStartedAt:     session.breakStartedAt?.toISOString() ?? null,
      breakUsedSec:       session.breakUsedSec,
      breakMinPerDay:     employee.breakMinPerDay,
      workHoursPerDay:    employee.workHoursPerDay,
      hourlyRate:         employee.hourlyRate ? Number(employee.hourlyRate) : null,
      overtimeMultiplier: employee.overtimeMultiplier,
    },
  })
}
