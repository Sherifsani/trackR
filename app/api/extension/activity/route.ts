import { NextRequest, NextResponse }                         from "next/server"
import { appendEvents, getEvents, getSummary, ActivityEvent } from "@/lib/store"
import { getAuth }                                            from "@/lib/auth"
import { runSecurityAnalysis }                                from "@/lib/anomaly"

interface ActivityPayload {
  employeeId: string
  sessionId?: string
  events: ActivityEvent[]
}

export async function POST(req: NextRequest) {
  // Extension uses Bearer token; web app uses JWT cookie
  const hasBearer = req.headers.get("Authorization")?.startsWith("Bearer ")
  const jwtAuth   = await getAuth()

  console.log("[trackR] POST /api/extension/activity - Bearer:", !!hasBearer, "JWT:", !!jwtAuth)

  if (!hasBearer && !jwtAuth) {
    console.log("[trackR] ✗ Unauthorized: no Bearer token or JWT")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: ActivityPayload
  try {
    body = await req.json()
  } catch {
    console.log("[trackR] ✗ Invalid JSON")
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { employeeId, sessionId, events } = body
  console.log("[trackR] Activity payload:", { employeeId, sessionId, eventCount: events?.length })

  if (!employeeId || !Array.isArray(events)) {
    console.log("[trackR] ✗ Missing employeeId or events array")
    return NextResponse.json({ error: "Missing employeeId or events" }, { status: 400 })
  }

  try {
    await appendEvents(employeeId, events, sessionId)
  } catch (err) {
    console.error("[trackR] ✗ appendEvents failed:", err)
    return NextResponse.json({ error: "Failed to store events" }, { status: 500 })
  }

  const tabVisitCount = events.filter(e => e.type === "tab_visit").length
  console.log(`[trackR] ✓ Stored ${events.length} events (${tabVisitCount} tab_visit) from ${employeeId}`)

  // Run security anomaly detection asynchronously — never blocks the response
  runSecurityAnalysis(employeeId, sessionId ?? null, events).catch(() => {})

  return NextResponse.json({ ok: true, received: events.length })
}

export async function GET(req: NextRequest) {
  const jwtAuth   = await getAuth()
  const hasBearer = req.headers.get("Authorization")?.startsWith("Bearer ")

  if (!jwtAuth && !hasBearer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const date       = searchParams.get("date") ?? undefined
  const mode       = searchParams.get("mode") ?? "events"
  const sinceParam = searchParams.get("since")
  const since      = sinceParam ? Number(sinceParam) : undefined
  const sessionId  = searchParams.get("sessionId") ?? undefined

  // JWT employees can only see their own data
  let employeeId: string | null
  if (jwtAuth?.role === "employee") {
    employeeId = jwtAuth.apiId ?? null
  } else {
    employeeId = searchParams.get("employeeId")
  }

  if (!employeeId) {
    return NextResponse.json({ error: "Missing employeeId" }, { status: 400 })
  }

  if (mode === "summary") {
    const summary = await getSummary(employeeId, { date, sessionId, since })
    return NextResponse.json(summary)
  }

  const events = await getEvents(employeeId, { date, since, sessionId })
  return NextResponse.json({ employeeId, events, total: events.length })
}
