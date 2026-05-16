import { NextResponse } from "next/server"
import bcrypt           from "bcryptjs"
import { db, Prisma }   from "@/lib/db"

const PASSWORD = "Demo@1234"

function dAgo(days: number, h: number, m = 0): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(h, m, 0, 0)
  return d
}

// ── Activity event generators ─────────────────────────────────────────────────

function jamesEvents(sessionId: string, apiId: string, clockIn: Date, durationSec: number) {
  const acts = [
    { domain: "slack.com",                title: "Engineering · #backend",                    category: "comms",       dwell: 420  },
    { domain: "linear.app",               title: "TRK-58 Refactor auth middleware",           category: "pm",          dwell: 360  },
    { domain: "github.com",               title: "feat/auth-refactor · trackR backend",       category: "development", dwell: 3600 },
    { domain: "localhost:3001",           title: "trackR API — Local Dev",                    category: "development", dwell: 4200 },
    { domain: "stackoverflow.com",        title: "Node.js JWT refresh token best practices",  category: "development", dwell: 780  },
    { domain: "hub.docker.com",           title: "postgres — Docker Hub",                     category: "development", dwell: 360  },
    { domain: "postgresql.org",           title: "PostgreSQL 16 — Documentation",             category: "development", dwell: 540  },
    { domain: "meet.google.com",          title: "Backend Sync — Daily Standup",              category: "meetings",    dwell: 1800 },
    { domain: "github.com",               title: "Pull Request #67 · API rate limiting",      category: "development", dwell: 2700 },
    { domain: "localhost:3001",           title: "trackR — Session management tests",         category: "development", dwell: 3000 },
    { domain: "npmjs.com",                title: "jsonwebtoken — npm",                        category: "development", dwell: 300  },
    { domain: "slack.com",                title: "engineering · #pr-reviews",                 category: "comms",       dwell: 480  },
    { domain: "github.com",               title: "Code review: payment webhook handler",      category: "development", dwell: 1800 },
    { domain: "youtube.com",              title: "System design: API Gateway patterns",       category: "off_task",    dwell: 720  },
    { domain: "redis.io",                 title: "Redis documentation — Caching strategies",  category: "development", dwell: 480  },
    { domain: "localhost:3001",           title: "trackR — Integration tests running",        category: "development", dwell: 2400 },
    { domain: "docs.google.com",          title: "API Design Doc — trackR v2",                category: "docs",        dwell: 720  },
    { domain: "github.com",               title: "trackR/backend · Commit history",           category: "development", dwell: 900  },
  ]
  return buildEvents(acts, sessionId, apiId, clockIn, durationSec)
}

function amakaEvents(sessionId: string, apiId: string, clockIn: Date, durationSec: number) {
  const acts = [
    { domain: "slack.com",                title: "Design team · #daily-check",                category: "comms",       dwell: 360  },
    { domain: "figma.com",                title: "trackR UI Kit — Component Library",         category: "design",      dwell: 5400 },
    { domain: "meet.google.com",          title: "Design Review — Sprint 12",                 category: "meetings",    dwell: 2700 },
    { domain: "figma.com",                title: "trackR Dashboard — High-fidelity mockups",  category: "design",      dwell: 4800 },
    { domain: "dribbble.com",             title: "SaaS Dashboard UI Inspiration",             category: "design",      dwell: 900  },
    { domain: "notion.so",                title: "Design System Guidelines — trackR",         category: "docs",        dwell: 840  },
    { domain: "coolors.co",               title: "trackR brand palette exploration",          category: "design",      dwell: 540  },
    { domain: "slack.com",                title: "Design team · #feedback",                   category: "comms",       dwell: 420  },
    { domain: "figma.com",                title: "Employee Dashboard — Insights tab redesign", category: "design",     dwell: 3600 },
    { domain: "medium.com",               title: "Data visualization best practices 2025",    category: "research",    dwell: 720  },
    { domain: "docs.google.com",          title: "User research notes — Remote workers",      category: "docs",        dwell: 600  },
    { domain: "behance.net",              title: "Analytics dashboard design showcase",       category: "design",      dwell: 600  },
    { domain: "figma.com",                title: "Mobile responsive layouts — trackR",        category: "design",      dwell: 2400 },
    { domain: "youtube.com",              title: "Figma auto layout advanced tips",           category: "off_task",    dwell: 600  },
    { domain: "slack.com",                title: "engineering · #design-handoff",             category: "comms",       dwell: 360  },
    { domain: "figma.com",                title: "Final review — Payment flow screens",       category: "design",      dwell: 1800 },
  ]
  return buildEvents(acts, sessionId, apiId, clockIn, durationSec)
}

function buildEvents(
  acts: Array<{ domain: string; title: string; category: string; dwell: number }>,
  sessionId: string, apiId: string, clockIn: Date, durationSec: number,
) {
  const result: Array<{
    sessionId: string; employeeId: string; type: string; domain: string
    title: string; category: string; dwellSec: number; occurredAt: Date; meta: typeof Prisma.JsonNull
  }> = []
  let t = clockIn.getTime()
  const end = t + durationSec * 1000
  for (const act of acts) {
    if (t >= end) break
    const dwell = Math.min(act.dwell, Math.max(30, Math.floor((end - t) / 1000) - 120))
    result.push({
      sessionId,
      employeeId: apiId,
      type: "tab_visit",
      domain: act.domain,
      title: act.title,
      category: act.category,
      dwellSec: dwell,
      occurredAt: new Date(t),
      meta: Prisma.JsonNull,
    })
    t += (dwell + Math.floor(Math.random() * 60 + 30)) * 1000
  }
  return result
}

// ── Analysis factories ────────────────────────────────────────────────────────

function jamesAnalysis(score: number, grade: string) {
  const summaries: Record<string, string> = {
    "80": "Strong backend session focused on API development and code review. Deep engagement with GitHub and the local dev environment made up the core of the day, with healthy team communication via Slack.",
    "83": "Productive session with significant time on GitHub pull request reviews and backend architecture. Quick afternoon context switch to system design content was brief and self-corrected.",
    "88": "Excellent session — deep backend infrastructure work with sustained focus on the auth refactor PR. Minimal distractions and high code-review output stand out.",
    "79": "Solid session with good development output. Afternoon showed slightly more context-switching than usual between the API tests and documentation tasks.",
    "85": "Strong end-of-week session with focused development work on the payment webhook integration. Clean handoff documented in Notion.",
  }
  return {
    score, grade,
    summary: summaries[String(score)] ?? "Productive backend development session.",
    productive_pct: Math.round(score * 0.94),
    highlights: score >= 85
      ? ["3+ hours uninterrupted on GitHub and local API development", "Code review completed within the session", "Context switching well below team average"]
      : ["Strong morning development block", "Active code review participation", "Efficient Slack usage under 15% of session"],
    concerns: score >= 85 ? [] : ["Brief off-task browsing in afternoon", "Slightly elevated context switching after standup"],
  }
}

function amakaAnalysis(score: number, grade: string) {
  const summaries: Record<string, string> = {
    "85": "Productive design session dominated by Figma work on the component library and dashboard mockups. Design review meeting drove strong alignment with the engineering team.",
    "78": "Good design output across the full day. Mix of high-fidelity work and research reflects the exploratory phase of the sprint. Brief inspiration browsing was minimal.",
    "91": "Outstanding creative session — exceptional Figma focus with the highest single-day design output this week. The final payment flow screens were completed and handed off.",
    "82": "Solid design session with healthy research mix. Responsive layout work in Figma was the dominant activity, balanced with user research notes review.",
    "87": "Strong session closing out the week. Component library updates and mobile layouts were completed with minimal distraction and a clean Slack handoff to engineering.",
  }
  return {
    score, grade,
    summary: summaries[String(score)] ?? "Productive design session.",
    productive_pct: Math.round(score * 0.96),
    highlights: score >= 85
      ? ["5+ hours focused Figma work — top design output this period", "Design review completed and documented", "Efficient async comms — Slack under 12% of session time"]
      : ["Sustained Figma engagement across the full day", "Research activities directly support current sprint", "Clear and timely design handoff to engineering"],
    concerns: score >= 85 ? [] : ["Inspiration browsing ran slightly over typical baseline", "Mid-session meeting caused a context switch that took ~20 min to recover"],
  }
}

// ── Session specs ─────────────────────────────────────────────────────────────
//   daysAgo = 4 → Monday, 3 → Tue, 2 → Wed, 1 → Thu, 0 → Fri (today)

const WEEK_SPECS = [
  // daysAgo, clockInH, clockInM, durMin, breakSec
  { da: 4, h: 9, m:  2, durMin: 525, breakSec: 3600 }, // Mon  8h 45m → OT 45m
  { da: 3, h: 8, m: 55, durMin: 510, breakSec: 3600 }, // Tue  8h 30m → OT 30m
  { da: 2, h: 9, m: 10, durMin: 555, breakSec: 3960 }, // Wed  9h 15m → OT 45m (after break)
  { da: 1, h: 8, m: 48, durMin: 500, breakSec: 3600 }, // Thu  8h 20m → OT 20m
  { da: 0, h: 9, m:  0, durMin: 510, breakSec: 3600 }, // Fri  8h 30m → OT 30m
]

const JAMES_SCORES  = [80, 83, 88, 79, 85]
const JAMES_GRADES  = ["B", "B", "B", "C", "B"]
const AMAKA_SCORES  = [85, 78, 91, 82, 87]
const AMAKA_GRADES  = ["B", "C", "A", "B", "B"]

// ── Seed ─────────────────────────────────────────────────────────────────────

async function seedEmployee(opts: {
  apiId: string
  name: string
  email: string
  role: string
  hourlyRate: number
  bankCode: string
  bankName: string
  accountNumber: string
  accountName: string
  scores: number[]
  grades: string[]
  makeEvents: (sid: string, apiId: string, ci: Date, dur: number) => object[]
  makeAnalysis: (score: number, grade: string) => object
  insightsSummary: object
}) {
  const passwordHash = await bcrypt.hash(PASSWORD, 12)

  let emp = await db.employee.findFirst({
    where: { OR: [{ email: opts.email }, { apiId: opts.apiId }] },
  })

  if (!emp) {
    emp = await db.employee.create({
      data: {
        apiId: opts.apiId, name: opts.name, email: opts.email, role: opts.role,
        passwordHash, status: "active", inviteToken: null,
        hourlyRate: opts.hourlyRate, workHoursPerDay: 8, breakMinPerDay: 60,
        overtimeMultiplier: null,
        bankCode: opts.bankCode, bankName: opts.bankName,
        accountNumber: opts.accountNumber, accountName: opts.accountName,
        bankVerified: true,
      },
    })
  }

  const createdSessions: string[] = []

  for (let i = 0; i < WEEK_SPECS.length; i++) {
    const spec = WEEK_SPECS[i]
    const clockIn    = dAgo(spec.da, spec.h, spec.m)
    const clockOut   = new Date(clockIn.getTime() + spec.durMin * 60_000)
    const durationSec = spec.durMin * 60

    const dayStart = new Date(clockIn); dayStart.setHours(0, 0, 0, 0)
    const dayEnd   = new Date(clockIn); dayEnd.setHours(23, 59, 59, 999)
    const existing = await db.workSession.findFirst({
      where: { employeeId: emp.id, clockIn: { gte: dayStart, lte: dayEnd } },
    })
    if (existing) { createdSessions.push(existing.id); continue }

    const analysis = opts.makeAnalysis(opts.scores[i], opts.grades[i])

    const session = await db.workSession.create({
      data: {
        employeeId:   emp.id,
        clockIn, clockOut,
        approved:     true,
        breakUsedSec: spec.breakSec,
        analysis,
        analyzedAt:   new Date(clockOut.getTime() + 300_000),
      },
    })
    createdSessions.push(session.id)

    const events = opts.makeEvents(session.id, emp.apiId, clockIn, durationSec)
    if (events.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.activityEvent.createMany({ data: events as any[], skipDuplicates: true })
    }
  }

  if (!emp.insightsSummary) {
    await db.employee.update({
      where: { id: emp.id },
      data: { insightsSummary: opts.insightsSummary, insightsUpdatedAt: dAgo(1, 8) },
    })
  }

  return { id: emp.id, name: emp.name, email: opts.email, sessions: createdSessions.length }
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST() {

  const james = await seedEmployee({
    apiId:         "660e9511-f30c-42e5-b827-557766551111",
    name:          "James Okafor",
    email:         "james@demo.com",
    role:          "Backend Engineer",
    hourlyRate:    5500,
    bankCode:      "000013",
    bankName:      "Guaranty Trust Bank",
    accountNumber: "0234567890",
    accountName:   "JAMES OKAFOR",
    scores:        JAMES_SCORES,
    grades:        JAMES_GRADES,
    makeEvents:    jamesEvents,
    makeAnalysis:  jamesAnalysis,
    insightsSummary: {
      sessionCount: 5, avgProductivePct: 83,
      peakHours: [
        { hour: 10, productiveSec: 10800 }, { hour: 11, productiveSec: 9900 },
        { hour: 9,  productiveSec: 8400  }, { hour: 14, productiveSec: 7200 },
        { hour: 15, productiveSec: 6300  },
      ],
      fatigueProfile: { earlyPct: 88, midPct: 82, latePct: 67 },
      avgContextSwitches: 6, avgFocusDepthSec: 218, avgWarmupMin: 9,
      dayOfWeek: [
        { day: 1, productivePct: 80, count: 1 }, { day: 2, productivePct: 83, count: 1 },
        { day: 3, productivePct: 88, count: 1 }, { day: 4, productivePct: 79, count: 1 },
        { day: 5, productivePct: 85, count: 1 },
      ],
      trend: "improving",
      headline: "Highly consistent backend engineer with exceptional mid-week focus",
      insights: [
        "Wednesday consistently delivers the highest productivity (88%) — ideal for complex backend architecture tasks and critical PR merges",
        "Morning block 9am–12pm is the strongest window, contributing 60%+ of daily productive output — protect this time from meetings",
        "Afternoon energy is well-maintained compared to team average, suggesting good energy management and short break habits",
      ],
      peakHoursLabel: "9am–12pm", fatigueFlag: false,
      anomalies: [],
    },
  })

  const amaka = await seedEmployee({
    apiId:         "770fa622-g41d-53f6-c938-668877662222",
    name:          "Amaka Nwosu",
    email:         "amaka@demo.com",
    role:          "Product Designer",
    hourlyRate:    4000,
    bankCode:      "000016",
    bankName:      "First Bank of Nigeria",
    accountNumber: "3456789012",
    accountName:   "AMAKA NWOSU",
    scores:        AMAKA_SCORES,
    grades:        AMAKA_GRADES,
    makeEvents:    amakaEvents,
    makeAnalysis:  amakaAnalysis,
    insightsSummary: {
      sessionCount: 5, avgProductivePct: 85,
      peakHours: [
        { hour: 10, productiveSec: 12600 }, { hour: 11, productiveSec: 11700 },
        { hour: 14, productiveSec: 9000  }, { hour: 9,  productiveSec: 7200  },
        { hour: 15, productiveSec: 6300  },
      ],
      fatigueProfile: { earlyPct: 83, midPct: 87, latePct: 76 },
      avgContextSwitches: 5, avgFocusDepthSec: 342, avgWarmupMin: 8,
      dayOfWeek: [
        { day: 1, productivePct: 85, count: 1 }, { day: 2, productivePct: 78, count: 1 },
        { day: 3, productivePct: 91, count: 1 }, { day: 4, productivePct: 82, count: 1 },
        { day: 5, productivePct: 87, count: 1 },
      ],
      trend: "improving",
      headline: "Deep-focus designer with the highest average dwell time on the team",
      insights: [
        "Exceptionally low context-switching rate (5/hr vs team avg 7/hr) reflects strong task discipline and single-tasking ability",
        "Mid-session productivity peaks higher than early-session (87% vs 83%) — unusual and positive, suggests strong warm-up routine and sustained creative flow",
        "Wednesday is clearly the best creative day — schedule design presentations, handoffs, and final reviews on Wednesdays",
      ],
      peakHoursLabel: "10am–1pm", fatigueFlag: false,
      anomalies: [],
    },
  })

  return NextResponse.json({
    ok: true,
    note: "Two demo employees created with a full week of sessions, activity, and AI analysis. No prior payments — ready for payroll disbursement demo.",
    credentials: {
      james: { email: "james@demo.com",  password: PASSWORD, role: "Backend Engineer",  hourlyRate: "₦5,500/hr" },
      amaka: { email: "amaka@demo.com",  password: PASSWORD, role: "Product Designer",  hourlyRate: "₦4,000/hr" },
    },
    sessions: { james: james.sessions, amaka: amaka.sessions },
  })
}
