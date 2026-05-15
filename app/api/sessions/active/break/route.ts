import { NextResponse } from "next/server"
import { db }           from "@/lib/db"
import { getAuth }      from "@/lib/auth"

export async function POST(req: Request) {
  const auth = await getAuth()
  if (!auth?.apiId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { action } = await req.json() as { action: "start" | "end" }

  const employee = await db.employee.findUnique({
    where:  { apiId: auth.apiId },
    select: { id: true, breakMinPerDay: true },
  })
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 })

  const session = await db.workSession.findFirst({
    where:   { employeeId: employee.id, clockOut: null },
    orderBy: { clockIn: "desc" },
  })
  if (!session) return NextResponse.json({ error: "No active session" }, { status: 404 })

  if (action === "start") {
    if (session.breakStartedAt) {
      return NextResponse.json({ error: "Already on break" }, { status: 400 })
    }
    const breakStartedAt = new Date()
    await db.workSession.update({
      where: { id: session.id },
      data:  { breakStartedAt },
    })
    return NextResponse.json({
      ok:            true,
      breakStartedAt: breakStartedAt.toISOString(),
      breakUsedSec:  session.breakUsedSec,
      breakMinPerDay: employee.breakMinPerDay,
    })
  }

  if (action === "end") {
    if (!session.breakStartedAt) {
      return NextResponse.json({ error: "Not on break" }, { status: 400 })
    }
    const elapsed        = Math.floor((Date.now() - session.breakStartedAt.getTime()) / 1000)
    const breakUsedSec   = session.breakUsedSec + elapsed
    await db.workSession.update({
      where: { id: session.id },
      data:  { breakStartedAt: null, breakUsedSec },
    })
    return NextResponse.json({
      ok:           true,
      breakUsedSec,
      breakMinPerDay: employee.breakMinPerDay,
    })
  }

  return NextResponse.json({ error: "action must be 'start' or 'end'" }, { status: 400 })
}
