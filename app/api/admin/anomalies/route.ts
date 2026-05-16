import { NextRequest, NextResponse } from "next/server"
import { db }                        from "@/lib/db"
import { getAuth }                   from "@/lib/auth"

// GET  /api/admin/anomalies         — list unresolved flags (optionally ?employeeId=)
// PATCH /api/admin/anomalies        — resolve a flag { id }

export async function GET(req: NextRequest) {
  const auth = await getAuth()
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get("employeeId") ?? undefined

  const flags = await db.anomalyFlag.findMany({
    where: {
      resolvedAt: null,
      ...(employeeId ? { employeeId } : {}),
    },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    take:    100,
    include: {
      employee: { select: { id: true, name: true, role: true } },
    },
  })

  return NextResponse.json({
    flags: flags.map((f) => ({
      id:         f.id,
      stream:     f.stream,
      signal:     f.signal,
      severity:   f.severity,
      score:      f.score,
      message:    f.message,
      meta:       f.meta,
      sessionId:  f.sessionId,
      createdAt:  f.createdAt.toISOString(),
      employee: {
        id:   f.employee.id,
        name: f.employee.name,
        role: f.employee.role,
      },
    })),
  })
}

export async function PATCH(req: NextRequest) {
  const auth = await getAuth()
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await req.json() as { id?: string }
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  await db.anomalyFlag.update({
    where: { id },
    data:  { resolvedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
