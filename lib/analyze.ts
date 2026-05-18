import { GoogleGenerativeAI } from "@google/generative-ai"
import { db } from "./db"
import { computePatterns } from "./insights"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

function buildKpiSection(kpiDescription: string | null): string {
  if (!kpiDescription?.trim()) return ""
  return `\nAdmin-defined KPI expectations for this employee:\n${kpiDescription.trim()}\n\nAssess whether this session met or fell short of each expectation stated above. Reference them explicitly in your concerns or highlights, and factor KPI compliance into the score.`
}

function buildPrompt(
  employeeName: string,
  clockIn: Date,
  clockOut: Date | null,
  events: Array<{ category: string | null; domain: string | null; dwellSec: number | null }>,
  kpiDescription: string | null,
): string {
  const durationSec = clockOut
    ? Math.floor((clockOut.getTime() - clockIn.getTime()) / 1000)
    : null

  const toHM = (sec: number) =>
    `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`

  const fmt = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })

  const sessionStr = `${fmt(clockIn)} – ${clockOut ? fmt(clockOut) : "ongoing"} (${durationSec ? toHM(durationSec) : "ongoing"})`

  const catTotals: Record<string, number> = {}
  for (const ev of events) {
    const cat = ev.category ?? "other"
    catTotals[cat] = (catTotals[cat] ?? 0) + (ev.dwellSec ?? 0)
  }
  const totalTracked = Object.values(catTotals).reduce((a, b) => a + b, 0)

  const catLines = Object.entries(catTotals)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, sec]) => {
      const pct = totalTracked ? Math.round((sec / totalTracked) * 100) : 0
      return `  ${cat}: ${Math.floor(sec / 60)}m (${pct}%)`
    })
    .join("\n")

  const domainTotals: Record<string, number> = {}
  for (const ev of events) {
    if (ev.domain) domainTotals[ev.domain] = (domainTotals[ev.domain] ?? 0) + (ev.dwellSec ?? 0)
  }
  const domainLines = Object.entries(domainTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([domain, sec]) => `  ${domain}: ${Math.floor(sec / 60)}m`)
    .join("\n")

  const kpiSection = buildKpiSection(kpiDescription)

  return `You are a productivity analyst reviewing an employee work session. Return ONLY valid JSON — no markdown, no explanation.

Employee: ${employeeName}
Session: ${sessionStr}
Events recorded: ${events.length}

Category breakdown:
${catLines || "  (no data)"}

Top sites by time:
${domainLines || "  (no data)"}
${kpiSection}
Return this exact JSON shape:
{
  "score": <integer 0-100, overall productivity score>,
  "grade": <"A" | "B" | "C" | "D" | "F">,
  "summary": <2-3 sentence plain-English description of what was worked on>,
  "productive_pct": <integer 0-100, % of tracked time on productive categories>,
  "highlights": [<up to 3 specific positive observations, empty array if none>],
  "concerns": [<up to 3 specific issues or flags, empty array if none>],
  "kpi_results": [<one string per KPI expectation from the admin: restate it briefly, then state whether this session "MET" or "MISSED" it based on the data — omit the field entirely if no KPIs were configured>]
}

Scoring: development, design, meetings, docs, pm, research, comms = productive. off_task = not productive. other = neutral.
Grades: A=90-100, B=75-89, C=60-74, D=45-59, F=<45. KPI misses should lower the score and appear in concerns.`
}

export async function analyzeSession(sessionId: string): Promise<void> {
  const session = await db.workSession.findUnique({
    where:   { id: sessionId },
    include: {
      employee: { select: { name: true, kpiDescription: true } },
      events:   { select: { category: true, domain: true, dwellSec: true } },
    },
  })

  if (!session || session.analysis) return  // skip if missing or already analyzed

  const prompt = buildPrompt(session.employee.name, session.clockIn, session.clockOut, session.events, session.employee.kpiDescription)

  const model  = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
  const result = await model.generateContent(prompt)
  const raw    = result.response.text().trim()
  const clean  = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")

  const analysis = JSON.parse(clean)
  await db.workSession.update({ where: { id: sessionId }, data: { analysis, analyzedAt: new Date() } })

  // Refresh cross-session pattern insights in the background (non-blocking)
  analyzePatterns(session.employeeId).catch((err) =>
    console.error("[trackR] Pattern analysis failed:", err)
  )
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

export async function analyzePatterns(employeeId: string): Promise<void> {
  const employee = await db.employee.findUnique({
    where:  { id: employeeId },
    select: { name: true, kpiDescription: true },
  })
  if (!employee) return

  const patterns = await computePatterns(employeeId)
  if (patterns.sessionCount < 2) return

  const topHours = patterns.peakHours.slice(0, 3).map(({ hour }) => {
    const ampm = hour >= 12 ? "pm" : "am"
    return `${hour % 12 || 12}${ampm}`
  }).join(", ")

  const bestDay = [...patterns.dayOfWeek].sort((a, b) => b.productivePct - a.productivePct)[0]
  const fatigueDelta = patterns.fatigueProfile.earlyPct - patterns.fatigueProfile.latePct
  const kpiSection = buildKpiSection(employee.kpiDescription)

  const prompt = `You are a workforce analyst. Review these 30-day behavioral patterns and return ONLY valid JSON — no markdown, no explanation.

Employee: ${employee.name}
Sessions analyzed: ${patterns.sessionCount}
Average productive time: ${patterns.avgProductivePct}%
Peak productive hours: ${topHours || "insufficient data"}
Fatigue signal: session start ${patterns.fatigueProfile.earlyPct}% productive → session end ${patterns.fatigueProfile.latePct}% (${Math.abs(fatigueDelta)}% ${fatigueDelta >= 0 ? "drop" : "increase"})
Context switching: ~${patterns.avgContextSwitches} domain changes per productive hour
Focus depth: avg ${patterns.avgFocusDepthSec}s per site visit
Warm-up time: ${patterns.avgWarmupMin} min before first productive activity
Best day of week: ${bestDay ? DAY_NAMES[bestDay.day] : "unknown"} (${bestDay?.productivePct ?? 0}% productive)
Trend: ${patterns.trend}
${kpiSection}
Return this exact JSON shape:
{
  "headline": <10-12 word insight summary about this employee's work pattern>,
  "insights": [<exactly 3 specific, actionable observations — no generic advice>],
  "peakHoursLabel": <e.g. "10am–12pm and 2pm–4pm">,
  "fatigueFlag": <true if fatigue drop > 15 percentage points, otherwise false>,
  "anomalies": [<up to 2 specific behavioral anomalies, or empty array if none>],
  "kpi_status": [<one string per KPI expectation from the admin, comparing the 30-day patterns against it and stating "MET" or "MISSED" — omit the field entirely if no KPIs were configured>]
}`

  const model  = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
  const result = await model.generateContent(prompt)
  const raw    = result.response.text().trim()
  const clean  = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")

  const narrative = JSON.parse(clean)

  await db.employee.update({
    where: { id: employeeId },
    data: {
      insightsSummary:   { ...patterns, ...narrative },
      insightsUpdatedAt: new Date(),
    },
  })
}
