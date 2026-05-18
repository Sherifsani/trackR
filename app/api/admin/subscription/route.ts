import { NextResponse } from "next/server"
import { db }           from "@/lib/db"
import { getAuth }      from "@/lib/auth"

export async function GET() {
  const auth = await getAuth()
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const sub = await db.subscription.findUnique({ where: { adminId: auth.sub } })

  if (!sub) {
    return NextResponse.json({ subscription: null })
  }

  const now          = new Date()
  const isActive     = sub.status === "active" && sub.currentPeriodEnd > now
  const daysLeft     = Math.max(0, Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / 86_400_000))

  if (sub.status === "active" && !isActive) {
    await db.subscription.update({ where: { id: sub.id }, data: { status: "expired" } })
  }

  return NextResponse.json({
    subscription: {
      plan:              sub.plan,
      status:            isActive ? "active" : "expired",
      currentPeriodEnd:  sub.currentPeriodEnd.toISOString(),
      daysLeft,
    },
  })
}
