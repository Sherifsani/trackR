import { NextRequest, NextResponse } from "next/server"
import { clockOut } from "@/lib/store"
import { analyzeSession } from "@/lib/analyze"
import { getAuth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const jwtAuth   = await getAuth()
  const hasBearer = req.headers.get("Authorization")?.startsWith("Bearer ")

  if (!jwtAuth && !hasBearer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "Missing session id" }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))

  if (body.approve) {
    await db.workSession.update({ where: { id }, data: { approved: true } })
  } else {
    await clockOut(id)
    // Fire analysis in background — don't block the clock-out response
    void analyzeSession(id).catch((err) =>
      console.error("[trackR] Post-clockout analysis failed:", err)
    )
  }

  return NextResponse.json({ ok: true })
}
