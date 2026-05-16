import { NextResponse } from "next/server"
import bcrypt          from "bcryptjs"
import crypto          from "crypto"
import { db, Prisma }  from "@/lib/db"

// ── Demo credentials (shown in the response) ──────────────────────────────────
const ADMIN_EMAIL = "admin@demo.com"
const EMP_EMAIL   = "sarah@demo.com"
const PASSWORD    = "Demo@1234"
const EMP_API_ID  = "550e8400-e29b-41d4-a716-446655440000"

// ── Helpers ───────────────────────────────────────────────────────────────────

function dAgo(days: number, h: number, m = 0): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(h, m, 0, 0)
  return d
}

function sessionSummary(score: number): string {
  if (score >= 90)
    return "Outstanding session — spent the majority of the day on high-value development and design tasks with minimal distractions. Strong focus depth throughout."
  if (score >= 80)
    return "Productive session with consistent output across development and communication. Brief afternoon distractions were quickly corrected."
  if (score >= 70)
    return "Solid session with good development output. Morning block was particularly focused; afternoon showed some context-switching between tasks."
  return "Moderate session — good stretches of development work offset by higher off-task browsing in the afternoon."
}

function sessionHighlights(score: number): string[] {
  if (score >= 87)
    return [
      "3+ hours of uninterrupted deep work on GitHub and local dev environment",
      "High focus depth — avg 4+ minutes per productive site visit",
      "Productivity remained consistent across all three session thirds",
    ]
  if (score >= 75)
    return [
      "Strong morning block with 2+ hours focused on development tasks",
      "Active code review and collaboration on GitHub",
      "Slack and email processing kept under 15% of session time",
    ]
  return [
    "Development work was well-focused when active",
    "Responded promptly to team communications",
  ]
}

function sessionConcerns(score: number): string[] {
  if (score >= 87) return []
  if (score >= 75) return ["Afternoon productivity dipped — possible energy slump post-lunch"]
  return [
    "Off-task browsing accounted for ~12% of tracked time",
    "Above-average context-switching rate in the afternoon",
  ]
}

function makeEvents(
  sessionId: string,
  apiId: string,
  clockIn: Date,
  durationSec: number,
  score: number,
) {
  const timeline: Array<{ domain: string; title: string; category: string; dwell: number }> = [
    { domain: "slack.com",             title: "Engineering · #general",                   category: "comms",       dwell: 480  },
    { domain: "linear.app",            title: "TRK-51 Employee insights page",            category: "pm",          dwell: 360  },
    { domain: "github.com",            title: "feat/employee-insights · trackR",          category: "development", dwell: 2700 },
    { domain: "localhost:3000",        title: "trackR — Admin Dashboard",                 category: "development", dwell: 3600 },
    { domain: "stackoverflow.com",     title: "Prisma — groupBy with nested relations",   category: "development", dwell: 840  },
    { domain: "developer.mozilla.org", title: "Array.prototype.reduce() — MDN",           category: "development", dwell: 420  },
    { domain: "github.com",            title: "Pull Request #42 · Code Review",           category: "development", dwell: 1800 },
    { domain: "slack.com",             title: "Engineering · #frontend",                  category: "comms",       dwell: 540  },
    { domain: "notion.so",             title: "Sprint 12 Planning Notes",                 category: "docs",        dwell: 720  },
    { domain: "meet.google.com",       title: "Daily Standup — trackR Team",              category: "meetings",    dwell: 1800 },
    { domain: "localhost:3000",        title: "trackR — Employee Dashboard",              category: "development", dwell: 2400 },
    { domain: "figma.com",             title: "trackR UI Kit — Insights Components",      category: "design",      dwell: 1200 },
    { domain: "github.com",            title: "trackR/app · Commit History",              category: "development", dwell: 900  },
    // off-task proportion grows for lower scores
    ...(score < 80
      ? [
          { domain: "youtube.com", title: "Lo-fi hip hop radio 📚",            category: "off_task",    dwell: 1200 },
          { domain: "twitter.com", title: "Twitter / X",                        category: "off_task",    dwell: 600  },
        ]
      : [
          { domain: "youtube.com", title: "VS Code tips and tricks",            category: "off_task",    dwell: 480  },
        ]),
    { domain: "npmjs.com",             title: "prisma — npm",                             category: "development", dwell: 360  },
    { domain: "localhost:3000",        title: "trackR — Insights tab prototype",          category: "development", dwell: 1800 },
    { domain: "slack.com",             title: "Design team · #ui-review",                category: "comms",       dwell: 300  },
    { domain: "docs.google.com",       title: "trackR Technical Spec v2",                category: "docs",        dwell: 600  },
  ]

  const result = []
  let t = clockIn.getTime()
  const end = t + durationSec * 1000

  for (const act of timeline) {
    if (t >= end) break
    const dwell = Math.min(act.dwell, Math.max(30, Math.floor((end - t) / 1000) - 60))
    result.push({
      sessionId,
      employeeId: apiId,
      type:       "tab_visit",
      domain:     act.domain,
      title:      act.title,
      category:   act.category,
      dwellSec:   dwell,
      occurredAt: new Date(t),
      meta:       Prisma.JsonNull,
    })
    t += (dwell + Math.floor(Math.random() * 90 + 30)) * 1000
  }

  return result
}

// ── Seed ─────────────────────────────────────────────────────────────────────

export async function POST() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12)

  // ── Admin ────────────────────────────────────────────────────────────────
  let admin = await db.admin.findUnique({ where: { email: ADMIN_EMAIL } })
  if (!admin) {
    admin = await db.admin.create({
      data: {
        name:                  "Alex Johnson",
        email:                 ADMIN_EMAIL,
        passwordHash,
        defaultWorkHoursPerDay: 8,
        defaultBreakMinPerDay:  60,
        defaultHourlyRate:     4500,
        overtimeMultiplier:    1.5,
      },
    })
  }

  // ── Employee ─────────────────────────────────────────────────────────────
  let emp = await db.employee.findFirst({
    where: { OR: [{ email: EMP_EMAIL }, { apiId: EMP_API_ID }] },
  })
  if (!emp) {
    emp = await db.employee.create({
      data: {
        apiId:             EMP_API_ID,
        name:              "Sarah Chen",
        email:             EMP_EMAIL,
        role:              "Senior Frontend Developer",
        passwordHash,
        status:            "active",
        inviteToken:       null,
        hourlyRate:        4500,
        workHoursPerDay:   8,
        breakMinPerDay:    60,
        overtimeMultiplier: null,
        bankCode:          "000014",
        bankName:          "Access Bank",
        accountNumber:     "0123456789",
        accountName:       "SARAH CHEN",
        bankVerified:      true,
      },
    })
  }

  // ── Sessions ─────────────────────────────────────────────────────────────
  const SESSION_SPECS = [
    // 3 weeks ago
    { da: 15, h: 9,  m: 5,  durMin: 515, breakSec: 3600, score: 72, grade: "C" },
    { da: 13, h: 8,  m: 52, durMin: 503, breakSec: 3600, score: 79, grade: "C" },
    { da: 12, h: 9,  m: 22, durMin: 516, breakSec: 3240, score: 81, grade: "B" },
    { da: 11, h: 9,  m: 1,  durMin: 451, breakSec: 3600, score: 75, grade: "C" },
    // 2 weeks ago
    { da: 8,  h: 8,  m: 45, durMin: 547, breakSec: 3600, score: 85, grade: "B" },
    { da: 7,  h: 9,  m: 8,  durMin: 510, breakSec: 3600, score: 82, grade: "B" },
    { da: 6,  h: 9,  m: 17, durMin: 535, breakSec: 3960, score: 88, grade: "B" },
    { da: 4,  h: 9,  m: 3,  durMin: 492, breakSec: 3600, score: 80, grade: "B" },
    // last week
    { da: 3,  h: 8,  m: 58, durMin: 527, breakSec: 3600, score: 91, grade: "A" },
    { da: 2,  h: 9,  m: 12, durMin: 522, breakSec: 3600, score: 87, grade: "B" },
    // this week — no analysis yet
    { da: 1,  h: 9,  m: 0,  durMin: 510, breakSec: 3600, score: null, grade: null },
  ] as const

  const createdSessions: { id: string }[] = []

  for (const spec of SESSION_SPECS) {
    const clockIn  = dAgo(spec.da, spec.h, spec.m)
    const clockOut = new Date(clockIn.getTime() + spec.durMin * 60_000)
    const durationSec = spec.durMin * 60

    // Idempotent — skip if session already exists for this employee on this date
    const dayStart = new Date(clockIn); dayStart.setHours(0, 0, 0, 0)
    const dayEnd   = new Date(clockIn); dayEnd.setHours(23, 59, 59, 999)
    const existing = await db.workSession.findFirst({
      where: { employeeId: emp.id, clockIn: { gte: dayStart, lte: dayEnd } },
    })
    if (existing) { createdSessions.push(existing); continue }

    const analysis =
      spec.score !== null
        ? {
            score:          spec.score,
            grade:          spec.grade,
            summary:        sessionSummary(spec.score),
            productive_pct: Math.round(spec.score * 0.95),
            highlights:     sessionHighlights(spec.score),
            concerns:       sessionConcerns(spec.score),
          }
        : null

    const session = await db.workSession.create({
      data: {
        employeeId:   emp.id,
        clockIn,
        clockOut,
        approved:     true,
        breakUsedSec: spec.breakSec,
        analysis:     analysis ?? undefined,
        analyzedAt:   analysis ? new Date(clockOut.getTime() + 300_000) : null,
      },
    })
    createdSessions.push(session)

    const events = makeEvents(session.id, emp.apiId, clockIn, durationSec, spec.score ?? 80)
    if (events.length > 0) {
      await db.activityEvent.createMany({ data: events, skipDuplicates: true })
    }
  }

  // ── Anomaly flags ─────────────────────────────────────────────────────────
  const existingFlags = await db.anomalyFlag.count({ where: { employeeId: emp.id } })
  if (existingFlags === 0 && createdSessions.length >= 5) {
    await db.anomalyFlag.createMany({
      data: [
        {
          employeeId: emp.id,
          sessionId:  createdSessions[4]?.id ?? null,
          stream:     "wellbeing",
          signal:     "engagement_decay",
          severity:   "medium",
          score:      0.72,
          message:    "Productivity dropped 23% in the final 2 hours of the Monday session — energy management may need attention.",
          createdAt:  dAgo(8, 17, 15),
        },
        {
          employeeId: emp.id,
          sessionId:  createdSessions[3]?.id ?? null,
          stream:     "security",
          signal:     "rapid_context_switching",
          severity:   "low",
          score:      0.41,
          message:    "High domain-switching rate detected (14 switches/hr vs team avg of 7/hr) — may indicate task fragmentation.",
          createdAt:  dAgo(11, 16, 45),
        },
      ],
    })
  }

  // ── Payments ─────────────────────────────────────────────────────────────
  const existingPayments = await db.payment.count({ where: { employeeId: emp.id } })
  if (existingPayments === 0) {
    const ref = () => `SBTCWGHF9N_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`
    await db.payment.createMany({
      data: [
        {
          employeeId:         emp.id,
          amountNgn:          162000,
          amountKobo:         16200000,
          grossHours:         40.5,
          breakHours:         5.0,
          netHours:           35.5,
          regularHours:       35.5,
          overtimeHours:      0,
          overtimeMultiplier: 1.5,
          overtimeAmountNgn:  0,
          hourlyRate:         4500,
          periodStart:        dAgo(22, 0),
          periodEnd:          dAgo(16, 23, 59),
          status:             "paid",
          squadTxRef:         ref(),
          paidAt:             dAgo(15, 14, 30),
          createdAt:          dAgo(15, 14, 29),
        },
        {
          employeeId:         emp.id,
          amountNgn:          192375,
          amountKobo:         19237500,
          grossHours:         46.5,
          breakHours:         5.25,
          netHours:           41.25,
          regularHours:       40.0,
          overtimeHours:      1.25,
          overtimeMultiplier: 1.5,
          overtimeAmountNgn:  2812.5,
          hourlyRate:         4500,
          periodStart:        dAgo(15, 0),
          periodEnd:          dAgo(9, 23, 59),
          status:             "paid",
          squadTxRef:         ref(),
          paidAt:             dAgo(8, 10, 15),
          createdAt:          dAgo(8, 10, 14),
        },
      ],
    })
  }

  // ── AI Pattern insights ───────────────────────────────────────────────────
  if (!emp.insightsSummary) {
    await db.employee.update({
      where: { id: emp.id },
      data: {
        insightsSummary: {
          sessionCount:       10,
          avgProductivePct:   78,
          peakHours: [
            { hour: 10, productiveSec: 9180 },
            { hour: 11, productiveSec: 8640 },
            { hour: 9,  productiveSec: 8100 },
            { hour: 14, productiveSec: 7200 },
            { hour: 15, productiveSec: 6480 },
            { hour: 16, productiveSec: 5040 },
          ],
          fatigueProfile: { earlyPct: 85, midPct: 79, latePct: 61 },
          avgContextSwitches: 7,
          avgFocusDepthSec:   198,
          avgWarmupMin:       11,
          dayOfWeek: [
            { day: 1, productivePct: 83, count: 3 },
            { day: 2, productivePct: 77, count: 2 },
            { day: 3, productivePct: 80, count: 2 },
            { day: 4, productivePct: 74, count: 2 },
            { day: 5, productivePct: 70, count: 1 },
          ],
          trend:     "improving",
          headline:  "Highly focused developer with strong morning output and a clear improving weekly trend",
          insights: [
            "Peak productivity window is 9am–12pm — schedule deep work, code reviews, and complex features in this block for maximum output",
            "Energy drops significantly in the final third of sessions (61% vs 85% early) — a deliberate 15-min break around the 6-hour mark could recover 10-15% more productive time",
            "Monday and Wednesday consistently show the strongest output — critical deadlines and architecture work are best placed at the start of the week",
          ],
          peakHoursLabel: "9am–12pm",
          fatigueFlag:    true,
          anomalies: [
            "Engagement drops noticeably after 6 hours of work, particularly visible on Friday sessions",
          ],
        },
        insightsUpdatedAt: dAgo(1, 9),
      },
    })
  }

  return NextResponse.json({
    ok:   true,
    note: "Demo data created — use the credentials below to log in",
    credentials: {
      admin:    { email: ADMIN_EMAIL,  password: PASSWORD, role: "admin"    },
      employee: { email: EMP_EMAIL,    password: PASSWORD, role: "employee" },
    },
    created: {
      sessions:   createdSessions.length,
      adminEmail: ADMIN_EMAIL,
      empEmail:   EMP_EMAIL,
    },
  })
}
