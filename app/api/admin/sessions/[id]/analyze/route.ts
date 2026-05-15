import { NextRequest, NextResponse } from "next/server"
import { analyzeSession } from "@/lib/analyze"
import { getAuth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuth()
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    await analyzeSession(id)  // no-op if already analyzed
  } catch (err) {
    console.error("[trackR] Analysis failed:", err)
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 })
  }

  const session = await db.workSession.findUnique({
    where:  { id },
    select: { analysis: true, analyzedAt: true },
  })

  return NextResponse.json({
    analysis:   session?.analysis ?? null,
    analyzedAt: session?.analyzedAt?.toISOString() ?? null,
  })
}
