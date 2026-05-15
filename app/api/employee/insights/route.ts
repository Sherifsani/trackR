import { NextResponse } from "next/server"
import { db }          from "@/lib/db"
import { getAuth }     from "@/lib/auth"

export async function GET() {
  const auth = await getAuth()
  if (!auth || auth.role !== "employee") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const emp = await db.employee.findUnique({
    where:  { id: auth.sub },
    select: { insightsSummary: true, insightsUpdatedAt: true },
  })
  if (!emp) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({
    insights:  emp.insightsSummary   ?? null,
    updatedAt: emp.insightsUpdatedAt?.toISOString() ?? null,
  })
}
