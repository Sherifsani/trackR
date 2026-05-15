import { NextResponse } from "next/server"
import { db }           from "@/lib/db"
import { getAuth }      from "@/lib/auth"

export async function GET() {
  const auth = await getAuth()
  if (!auth?.apiId) return NextResponse.json({ session: null })

  const employee = await db.employee.findUnique({
    where:  { apiId: auth.apiId },
    select: { id: true, breakMinPerDay: true },
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
      breakStartedAt: session.breakStartedAt?.toISOString() ?? null,
      breakUsedSec:   session.breakUsedSec,
      breakMinPerDay: employee.breakMinPerDay,
    },
  })
}
