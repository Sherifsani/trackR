"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Clock01Icon,
  Home01Icon,
  Money01Icon,
  UserGroupIcon,
  ClockCheckIcon,
  ClockAlertIcon,
  CheckmarkCircle01Icon,
  DollarCircleIcon,
  ShieldUserIcon,
  Activity01Icon,
  ArrowLeft01Icon,
  Cancel01Icon,
  Radio01Icon,
  UserAdd01Icon,
  Logout01Icon,
  ArrowRight01Icon,
  Calendar01Icon,
  Settings01Icon,
  BankIcon,
  Edit01Icon,
  FloppyDiskIcon,
  InformationCircleIcon,
  RefreshIcon,
  AlertCircleIcon,
  CreditCardIcon,
  AiBrain01Icon,
  Analytics01Icon,
} from "@hugeicons/core-free-icons"
import { ThemeToggle } from "@/components/theme-toggle"

type TabType = "overview" | "payments" | "sessions" | "settings" | "insights"
type EmployeeStatus = "active" | "clocked-out" | "absent"

interface Employee {
  id:                  string
  apiId:               string
  name:                string
  initials:            string
  role:                string
  status:              EmployeeStatus
  clockIn:             string
  hours:               string
  weekHours:           number
  hourlyRate:          number
  breakMinPerDay:      number
  workHoursPerDay:     number
  overtimeMultiplier:  number | null
  bankVerified:        boolean
  accountName:         string | null
  sessionId:           string | null
  todayNetSec:         number
  onBreak:             boolean
  breakUsedSec:        number
}

interface LiveEmployeeActivity {
  employeeId:     string
  apiId:          string
  onBreak:        boolean
  breakUsedSec:   number
  breakLimitSec:  number
  workLimitSec:   number
  netElapsedSec:  number
  domain:         string | null
  category:       string | null
  title:          string | null
  ts:             number | null
}

interface AnomalyFlag {
  id:        string
  stream:    "security" | "wellbeing"
  signal:    string
  severity:  "low" | "medium" | "high"
  score:     number
  message:   string
  meta:      Record<string, unknown> | null
  sessionId: string | null
  createdAt: string
  employee:  { id: string; name: string; role: string | null }
}

interface ActivityEvent {
  type: string
  domain?: string
  title?: string
  category?: string
  dwell?: number
  ts: number
}

interface SessionAnalysis {
  score:          number
  grade:          string
  summary:        string
  productive_pct: number
  highlights:     string[]
  concerns:       string[]
}

interface InsightsSummary {
  sessionCount:       number
  avgProductivePct:   number
  peakHours:          Array<{ hour: number; productiveSec: number }>
  fatigueProfile:     { earlyPct: number; midPct: number; latePct: number }
  avgContextSwitches: number
  avgFocusDepthSec:   number
  avgWarmupMin:       number
  dayOfWeek:          Array<{ day: number; productivePct: number; count: number }>
  trend:              "improving" | "stable" | "declining"
  headline:           string
  insights:           string[]
  peakHoursLabel:     string
  fatigueFlag:        boolean
  anomalies:          string[]
}

interface SessionRecord {
  id: string
  clockIn: string
  clockOut: string | null
  approved: boolean
  eventCount: number
  durationSec: number | null
  analysis:    SessionAnalysis | null
  analyzedAt:  string | null
}

interface EmployeeOverviewSession {
  id: string
  clockIn: string
  clockOut: string | null
  durationSec: number | null
  eventCount: number
  analysis: SessionAnalysis | null
}
interface EmployeeOverviewAnomaly {
  id: string
  stream: string
  signal: string
  severity: string
  score: number
  message: string
  sessionId: string | null
  createdAt: string
}
interface EmployeeOverviewData {
  employee: { id: string; name: string; role: string | null }
  insights: InsightsSummary | null
  updatedAt: string | null
  recentSessions: EmployeeOverviewSession[]
  anomalies: EmployeeOverviewAnomaly[]
  stats: { totalSessions: number; avgSessionSec: number }
}

interface AdminSessionRecord extends SessionRecord {
  employee: { id: string; name: string; apiId: string; role: string | null }
}

interface DaySummary {
  totalSec: number
  categories: Record<string, number>
  topDomains: Array<{ domain: string; dwell: number }>
  eventCount: number
}

const CAT: Record<string, { icon: string; color: string }> = {
  development: { icon: "💻", color: "text-violet-600 dark:text-violet-400"  },
  design:      { icon: "🎨", color: "text-pink-600 dark:text-pink-400"      },
  meetings:    { icon: "📹", color: "text-emerald-600 dark:text-emerald-400" },
  comms:       { icon: "💬", color: "text-blue-600 dark:text-blue-400"      },
  docs:        { icon: "📄", color: "text-sky-600 dark:text-sky-400"        },
  pm:          { icon: "📋", color: "text-amber-600 dark:text-amber-400"    },
  research:    { icon: "🔍", color: "text-cyan-600 dark:text-cyan-400"      },
  off_task:    { icon: "⚡", color: "text-red-500 dark:text-red-400"        },
  other:       { icon: "🌐", color: "text-slate-500 dark:text-zinc-400"     },
}

function catOf(c?: string) {
  return CAT[c ?? "other"] ?? CAT.other
}

function tsToTime(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: false,
  })
}

function fmtDuration(sec: number) {
  if (sec < 60)   return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m`
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return m ? `${h}h ${m}m` : `${h}h`
}

function fmtSessionDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === now.toDateString()) return "Today"
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday"
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

function fmtTimeRange(clockIn: string, clockOut: string | null) {
  const inn = new Date(clockIn).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
  const out = clockOut
    ? new Date(clockOut).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
    : "ongoing"
  return `${inn} – ${out}`
}

function groupSessions(list: SessionRecord[]): Array<{ label: string; items: SessionRecord[] }> {
  const map = new Map<string, SessionRecord[]>()
  for (const s of list) {
    const label = fmtSessionDate(s.clockIn)
    if (!map.has(label)) map.set(label, [])
    map.get(label)!.push(s)
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }))
}

function groupAdminSessions(list: AdminSessionRecord[]): Array<{ label: string; items: AdminSessionRecord[] }> {
  const map = new Map<string, AdminSessionRecord[]>()
  for (const s of list) {
    const label = fmtSessionDate(s.clockIn)
    if (!map.has(label)) map.set(label, [])
    map.get(label)!.push(s)
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }))
}

const STATUS_CFG = {
  active: {
    label:  "Active",
    dot:    "bg-emerald-500 dark:bg-emerald-400",
    text:   "text-emerald-600 dark:text-emerald-400",
    bg:     "bg-emerald-50 dark:bg-emerald-400/10",
    border: "border-emerald-200 dark:border-emerald-400/20",
    pulse:  true,
  },
  "clocked-out": {
    label:  "Clocked Out",
    dot:    "bg-slate-400 dark:bg-zinc-500",
    text:   "text-slate-500 dark:text-zinc-400",
    bg:     "bg-slate-100 dark:bg-zinc-800/40",
    border: "border-slate-200 dark:border-zinc-700/30",
    pulse:  false,
  },
  absent: {
    label:  "Absent",
    dot:    "bg-red-500 dark:bg-red-400",
    text:   "text-red-600 dark:text-red-400",
    bg:     "bg-red-50 dark:bg-red-400/10",
    border: "border-red-200 dark:border-red-400/20",
    pulse:  false,
  },
}

const AVATAR_PALETTE = [
  "bg-amber-50 dark:bg-amber-400/15 text-amber-600 dark:text-amber-300 border-amber-200 dark:border-amber-400/20",
  "bg-violet-50 dark:bg-violet-400/15 text-violet-600 dark:text-violet-300 border-violet-200 dark:border-violet-400/20",
  "bg-sky-50 dark:bg-sky-400/15 text-sky-600 dark:text-sky-300 border-sky-200 dark:border-sky-400/20",
  "bg-emerald-50 dark:bg-emerald-400/15 text-emerald-600 dark:text-emerald-300 border-emerald-200 dark:border-emerald-400/20",
  "bg-orange-50 dark:bg-orange-400/15 text-orange-600 dark:text-orange-300 border-orange-200 dark:border-orange-400/20",
  "bg-pink-50 dark:bg-pink-400/15 text-pink-600 dark:text-pink-300 border-pink-200 dark:border-pink-400/20",
]

function avatarColor(idx: number) {
  return AVATAR_PALETTE[idx % AVATAR_PALETTE.length]
}

function Avatar({ initials, idx, sm }: { initials: string; idx: number; sm?: boolean }) {
  const cls = avatarColor(idx)
  return (
    <div className={`${sm ? "w-7 h-7 text-[10px]" : "w-9 h-9 text-xs"} ${cls} rounded-full flex items-center justify-center font-mono font-bold border shrink-0`}>
      {initials}
    </div>
  )
}

function ScoreRing({ score, size = 72 }: { score: number; size?: number }) {
  const r = 15
  const circ = 2 * Math.PI * r
  const filled = (Math.max(0, Math.min(100, score)) / 100) * circ
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : score >= 40 ? "#f97316" : "#ef4444"
  return (
    <svg width={size} height={size} viewBox="0 0 38 38">
      <circle cx="19" cy="19" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-100 dark:text-zinc-800" />
      <circle
        cx="19" cy="19" r={r}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circ}`}
        transform="rotate(-90 19 19)"
      />
      <text x="19" y="19" textAnchor="middle" dominantBaseline="central" fontSize="8" fontWeight="700" fill={color}>
        {score}%
      </text>
    </svg>
  )
}

function gradeColor(grade?: string) {
  if (grade === "A") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-400"
  if (grade === "B") return "bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-400"
  if (grade === "C") return "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-400"
  if (grade === "D") return "bg-orange-100 text-orange-700 dark:bg-orange-400/15 dark:text-orange-400"
  return "bg-red-100 text-red-700 dark:bg-red-400/15 dark:text-red-400"
}

// ── Monitor panel ─────────────────────────────────────────────────────────────
function MonitorPanel({
  employee,
  idx,
  onClose,
}: {
  employee: Employee | null
  idx: number
  onClose: () => void
}) {
  const [events, setEvents]       = useState<ActivityEvent[]>([])
  const [loading, setLoading]     = useState(false)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)

  const fetchEvents = useCallback(async () => {
    if (!employee) return
    setLoading(true)
    try {
      const res = await fetch(`/api/extension/activity?employeeId=${employee.apiId}`)
      if (res.ok) {
        const data = await res.json()
        setEvents(
          (data.events as ActivityEvent[])
            .filter((e) => e.type === "tab_visit" || e.type === "meeting_active")
            .sort((a, b) => b.ts - a.ts)
            .slice(0, 40)
        )
        setLastFetch(new Date())
      }
    } catch {
      // keep stale data
    } finally {
      setLoading(false)
    }
  }, [employee])

  useEffect(() => {
    setEvents([])
    setLastFetch(null)
    if (!employee) return
    fetchEvents()
    const t = setInterval(fetchEvents, 10_000)
    return () => clearInterval(t)
  }, [employee, fetchEvents])

  const open = !!employee

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/20 dark:bg-black/50 z-30 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      <div
        className={`fixed inset-y-0 right-0 w-96 bg-white dark:bg-zinc-900 border-l border-slate-200 dark:border-zinc-800 z-40 flex flex-col shadow-2xl transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <HugeiconsIcon icon={Radio01Icon} size={16} className="text-amber-500 dark:text-amber-400 shrink-0 animate-pulse" />
            <div className="min-w-0">
              <p className="text-slate-900 dark:text-white text-sm font-semibold truncate">
                {employee?.name ?? "—"}
              </p>
              <p className="text-slate-400 dark:text-zinc-600 text-xs">Live activity monitor</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {loading && (
              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping" />
            )}
            {lastFetch && (
              <span className="text-slate-300 dark:text-zinc-700 text-[10px] font-mono">
                {lastFetch.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
              </span>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 dark:text-zinc-600 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={14} className="text-current" />
            </button>
          </div>
        </div>

        {employee && (
          <div className="px-5 py-3 border-b border-slate-200/60 dark:border-zinc-800/60 flex items-center gap-3 shrink-0">
            <Avatar initials={employee.initials} idx={idx} sm />
            <div className="flex-1 min-w-0">
              <p className="text-slate-500 dark:text-zinc-500 text-xs">{employee.role || "Employee"}</p>
            </div>
            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[11px] font-medium ${STATUS_CFG[employee.status].text} ${STATUS_CFG[employee.status].bg} ${STATUS_CFG[employee.status].border}`}>
              <span className={`w-1 h-1 rounded-full ${STATUS_CFG[employee.status].dot}`} />
              {STATUS_CFG[employee.status].label}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
              <HugeiconsIcon icon={Activity01Icon} size={28} className="text-slate-200 dark:text-zinc-800" />
              <p className="text-slate-400 dark:text-zinc-600 text-sm">No activity data yet</p>
              <p className="text-slate-300 dark:text-zinc-700 text-xs leading-relaxed">
                Activity appears here once the employee's Chrome extension starts sending events.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-zinc-800/40">
              {events.map((ev, i) => {
                const cat = catOf(ev.category)
                return (
                  <div
                    key={i}
                    className="px-5 py-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-zinc-800/20 transition-colors"
                  >
                    <span className="font-mono text-[11px] text-slate-300 dark:text-zinc-700 w-11 shrink-0 tabular-nums pt-0.5">
                      {tsToTime(ev.ts)}
                    </span>
                    <span className="text-sm shrink-0">{cat.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-slate-700 dark:text-zinc-300 text-xs font-medium truncate">
                        {ev.title || ev.domain || "—"}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[11px] font-medium ${cat.color}`}>
                          {ev.category ?? "other"}
                        </span>
                        {ev.domain && ev.title && (
                          <>
                            <span className="text-slate-200 dark:text-zinc-800 text-[11px]">·</span>
                            <span className="text-slate-300 dark:text-zinc-700 text-[11px] font-mono truncate">
                              {ev.domain}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {typeof ev.dwell === "number" && ev.dwell > 0 && (
                      <span className="text-slate-300 dark:text-zinc-700 text-[11px] font-mono shrink-0 pt-0.5">
                        {fmtDuration(ev.dwell)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 dark:border-zinc-800 shrink-0">
          <p className="text-slate-300 dark:text-zinc-700 text-[10px] text-center font-mono">
            Auto-refreshes every 10s · {events.length} events today
          </p>
        </div>
      </div>
    </>
  )
}

// ── Invite modal ─────────────────────────────────────────────────────────────
function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const [name,   setName]   = useState("")
  const [email,  setEmail]  = useState("")
  const [role,   setRole]   = useState("")
  const [rate,   setRate]   = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [link,   setLink]   = useState("")
  const [err,    setErr]    = useState("")

  const submit = async () => {
    setStatus("loading")
    setErr("")
    try {
      const res = await fetch("/api/admin/employees/invite", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name, email, role: role || undefined, hourlyRate: rate ? Number(rate) : undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error); setStatus("error"); return }
      setLink(data.inviteUrl)
      setStatus("done")
      onInvited()
    } catch {
      setErr("Network error"); setStatus("error")
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={UserAdd01Icon} size={16} className="text-amber-500" />
              <h2 className="text-slate-900 dark:text-white font-semibold text-sm">Invite Employee</h2>
            </div>
            <button onClick={onClose} className="text-slate-400 dark:text-zinc-600 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors">
              <HugeiconsIcon icon={Cancel01Icon} size={16} className="text-current" />
            </button>
          </div>

          {status === "done" ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-400/10 border border-emerald-200 dark:border-emerald-400/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <HugeiconsIcon icon={CheckmarkCircle01Icon} size={22} className="text-emerald-500 dark:text-emerald-400" />
              </div>
              <p className="text-slate-900 dark:text-white text-sm font-medium mb-1">Invite sent to {email}</p>
              <p className="text-slate-500 dark:text-zinc-500 text-xs mb-4">The invite link expires in 48 hours.</p>
              {link && (
                <div className="text-left bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 rounded-lg p-3 mb-4">
                  <p className="text-slate-400 dark:text-zinc-500 text-[10px] mb-1 uppercase tracking-wider">Dev link (logged to console)</p>
                  <p className="text-slate-600 dark:text-zinc-400 text-xs font-mono break-all">{link}</p>
                </div>
              )}
              <button onClick={onClose} className="text-sm text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors">
                Close
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {[
                { label: "Full name *",     value: name,  set: setName,  type: "text",   placeholder: "Jane Smith"       },
                { label: "Email address *", value: email, set: setEmail, type: "email",  placeholder: "jane@company.com" },
                { label: "Role",            value: role,  set: setRole,  type: "text",   placeholder: "Frontend Engineer"},
                { label: "Hourly rate ($)", value: rate,  set: setRate,  type: "number", placeholder: "45"               },
              ].map((f) => (
                <div key={f.label}>
                  <label className="block text-slate-500 dark:text-zinc-500 text-xs font-medium mb-1.5">{f.label}</label>
                  <input
                    type={f.type}
                    value={f.value}
                    onChange={(e) => f.set(e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 rounded-lg px-3.5 py-2.5 text-slate-900 dark:text-white text-sm placeholder-slate-300 dark:placeholder-zinc-600 outline-none transition-all"
                  />
                </div>
              ))}

              {err && <p className="text-red-500 text-xs">{err}</p>}

              <button
                onClick={submit}
                disabled={!name || !email || status === "loading"}
                className="w-full bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-zinc-950 font-semibold py-2.5 rounded-lg transition-colors text-sm"
              >
                {status === "loading" ? "Sending…" : "Send Invite"}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Payment record type ───────────────────────────────────────────────────────
interface PaymentRecord {
  id:                  string
  employee:            { id: string; name: string; role: string | null }
  amountNgn:           number
  grossHours:          number
  breakHours:          number
  netHours:            number
  regularHours:        number
  overtimeHours:       number
  overtimeMultiplier:  number
  overtimeAmountNgn:   number
  hourlyRate:          number
  periodStart:         string
  periodEnd:           string
  status:              "pending" | "paid" | "failed"
  squadTxRef:          string | null
  paidAt:              string | null
  createdAt:           string
  failureReason?:      string | null
}

// ── Payments Tab ─────────────────────────────────────────────────────────────
function PaymentsTab({
  employees,
  loading,
  payments,
  paymentsLoading,
  disbursing,
  onDisburse,
  onRefreshPayments,
}: {
  employees:         Employee[]
  loading:           boolean
  payments:          PaymentRecord[]
  paymentsLoading:   boolean
  disbursing:        Record<string, boolean>
  onDisburse:        (id: string) => void
  onRefreshPayments: () => void
}) {
  const fmtNgn = (n: number) =>
    `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const totalPayroll   = employees.reduce((s, e) => s + e.weekHours * e.hourlyRate, 0)
  const paidThisWeek   = payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amountNgn, 0)
  const pendingEmpCount = employees.filter((e) => !payments.some((p) => p.employee.id === e.id && p.status === "paid")).length

  return (
    <div className="p-8 max-w-5xl mx-auto w-full space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Payments</h1>
        <p className="text-slate-400 dark:text-zinc-500 text-sm mt-0.5">
          Week of {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Summary banner */}
      <div className="relative bg-white dark:bg-zinc-900/50 border border-amber-200 dark:border-zinc-800 rounded-2xl p-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50 dark:from-amber-400/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/20 rounded-xl flex items-center justify-center shrink-0">
              <HugeiconsIcon icon={Money01Icon} size={22} className="text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-slate-400 dark:text-zinc-500 text-xs uppercase tracking-wider mb-0.5">Estimated Payroll This Week</p>
              <p className="font-mono text-4xl font-bold text-slate-900 dark:text-white">
                {fmtNgn(totalPayroll)}
              </p>
            </div>
          </div>
          <div className="sm:ml-auto flex items-center gap-6">
            {[
              { val: fmtNgn(paidThisWeek), label: "Paid",    color: "text-emerald-600 dark:text-emerald-400" },
              { val: pendingEmpCount,       label: "Pending", color: "text-amber-600 dark:text-amber-400"     },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <p className={`font-mono text-xl font-bold ${item.color}`}>{item.val}</p>
                <p className="text-slate-400 dark:text-zinc-600 text-xs mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Employee wages table */}
      <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-zinc-800/50 flex items-center justify-between">
          <h2 className="text-slate-900 dark:text-white text-sm font-semibold">Employee Wages</h2>
          <p className="text-slate-400 dark:text-zinc-600 text-xs">Amounts in NGN · break deducted at disbursement</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="text-slate-400 dark:text-zinc-600 text-sm">Loading…</span>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-zinc-800/30">
            {employees.map((emp, i) => {
              const grossWages  = emp.weekHours * emp.hourlyRate
              const alreadyPaid = payments.some((p) => p.employee.id === emp.id && p.status === "paid")
              const isDisburse  = disbursing[emp.id]
              const noBankDetails = !emp.bankVerified

              return (
                <div key={emp.id} className={`px-6 py-4 flex items-center gap-4 transition-colors ${alreadyPaid ? "opacity-60" : "hover:bg-slate-50 dark:hover:bg-zinc-800/15"}`}>
                  <Avatar initials={emp.initials} idx={i} />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-900 dark:text-white text-sm font-medium">{emp.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-slate-400 dark:text-zinc-600 text-xs">{emp.role || "Employee"}</p>
                      {noBankDetails && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/20 px-1.5 py-0.5 rounded-full">
                          <HugeiconsIcon icon={AlertCircleIcon} size={9} className="text-current" />
                          Bank not set
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right w-20 hidden sm:block">
                    <p className="text-slate-300 dark:text-zinc-700 text-[10px] uppercase tracking-wider mb-0.5">Hours</p>
                    <p className="text-slate-600 dark:text-zinc-400 text-sm font-mono">{emp.weekHours}h</p>
                  </div>
                  <div className="text-right w-24 hidden sm:block">
                    <p className="text-slate-300 dark:text-zinc-700 text-[10px] uppercase tracking-wider mb-0.5">Rate</p>
                    <p className="text-slate-600 dark:text-zinc-400 text-sm font-mono">
                      {emp.hourlyRate ? `₦${emp.hourlyRate.toLocaleString()}/hr` : "—"}
                    </p>
                  </div>
                  <div className="text-right w-36">
                    <p className="text-slate-300 dark:text-zinc-700 text-[10px] uppercase tracking-wider mb-0.5">Est. Wages</p>
                    <p className="text-slate-900 dark:text-white text-base font-mono font-bold">
                      {emp.hourlyRate ? fmtNgn(grossWages) : "—"}
                    </p>
                  </div>
                  <div className="w-36 flex justify-end">
                    {alreadyPaid ? (
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs border border-emerald-200 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-400/5 px-3 py-1.5 rounded-lg">
                        <HugeiconsIcon icon={CheckmarkCircle01Icon} size={13} className="text-current" />
                        <span>Paid</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => onDisburse(emp.id)}
                        disabled={isDisburse || !emp.hourlyRate || noBankDetails}
                        title={noBankDetails ? "Employee has not set up bank details" : !emp.hourlyRate ? "Hourly rate not set" : undefined}
                        className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 border border-amber-200 dark:border-amber-900/40 hover:border-amber-300 dark:hover:border-amber-700/50 bg-amber-50 dark:bg-amber-400/5 hover:bg-amber-100 dark:hover:bg-amber-400/10 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition-all active:scale-95"
                      >
                        <HugeiconsIcon icon={isDisburse ? RefreshIcon : DollarCircleIcon} size={13} className={`text-current ${isDisburse ? "animate-spin" : ""}`} />
                        <span>{isDisburse ? "Sending…" : "Pay Now"}</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Payment History */}
      <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-zinc-800/50 flex items-center justify-between">
          <h2 className="text-slate-900 dark:text-white text-sm font-semibold">Payment History</h2>
          <button onClick={onRefreshPayments} className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-zinc-600 hover:text-slate-600 dark:hover:text-zinc-400 transition-colors">
            <HugeiconsIcon icon={RefreshIcon} size={12} className="text-current" />
            Refresh
          </button>
        </div>
        {paymentsLoading ? (
          <div className="flex items-center justify-center py-10">
            <span className="text-slate-400 dark:text-zinc-600 text-sm">Loading…</span>
          </div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <HugeiconsIcon icon={CreditCardIcon} size={24} className="text-slate-200 dark:text-zinc-800" />
            <p className="text-slate-400 dark:text-zinc-600 text-sm">No payments yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-zinc-800/30 max-h-96 overflow-y-auto">
            {payments.map((p, i) => {
              const words    = p.employee.name.trim().split(" ")
              const initials = ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase()
              const palette  = AVATAR_PALETTE[i % AVATAR_PALETTE.length]
              return (
                <div key={p.id} className="px-6 py-3.5 flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-mono font-bold text-[10px] border shrink-0 ${palette}`}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-800 dark:text-zinc-200 text-sm font-medium">{p.employee.name}</p>
                    <p className="text-slate-400 dark:text-zinc-600 text-xs font-mono">
                      {new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {" · "}{p.regularHours.toFixed(2)}h reg
                      {p.overtimeHours > 0 && (
                        <span className="text-orange-500 dark:text-orange-400"> + {p.overtimeHours.toFixed(2)}h OT ×{p.overtimeMultiplier}</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-900 dark:text-white text-sm font-mono font-bold">{fmtNgn(p.amountNgn)}</p>
                    {p.overtimeHours > 0 && (
                      <p className="text-orange-500 dark:text-orange-400 text-[10px] font-mono">+{fmtNgn(p.overtimeAmountNgn)} OT bonus</p>
                    )}
                    <span className={`text-[10px] font-medium ${
                      p.status === "paid"    ? "text-emerald-600 dark:text-emerald-400" :
                      p.status === "failed"  ? "text-red-500 dark:text-red-400" :
                                               "text-amber-600 dark:text-amber-400"
                    }`}>
                      {p.status === "paid" ? "✓ Paid" : p.status === "failed" ? `✗ ${p.failureReason ?? "Failed"}` : "Pending"}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Settings Tab ─────────────────────────────────────────────────────────────
function SettingsTab({ employees, onSaved }: { employees: Employee[]; onSaved: () => void }) {
  const [balance,        setBalance]        = useState<number | null>(null)
  const [acctLoading,    setAcctLoading]    = useState(true)
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [topupAmount,    setTopupAmount]    = useState("")
  const [topupLoading,   setTopupLoading]   = useState(false)
  const [topupError,     setTopupError]     = useState("")

  // Global team defaults
  const [defaultBreak,       setDefaultBreak]       = useState("60")
  const [defaultRate,        setDefaultRate]        = useState("")
  const [defaultWorkHours,   setDefaultWorkHours]   = useState("8")
  const [defaultOTMulti,     setDefaultOTMulti]     = useState("1.5")
  const [defaultsSaving,     setDefaultsSaving]     = useState(false)
  const [defaultsSaved,      setDefaultsSaved]      = useState(false)

  // Per-employee editable rates
  const [empRates,      setEmpRates]      = useState<Record<string, string>>({})
  const [empBreaks,     setEmpBreaks]     = useState<Record<string, string>>({})
  const [empWorkHours,  setEmpWorkHours]  = useState<Record<string, string>>({})
  const [empOTMulti,    setEmpOTMulti]    = useState<Record<string, string>>({})
  const [saving,    setSaving]    = useState<Record<string, boolean>>({})

  const input = "bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm outline-none transition-all w-full"

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        setBalance(d.walletBalance)
        setDefaultBreak(String(d.defaultBreakMinPerDay ?? 60))
        setDefaultRate(d.defaultHourlyRate ? String(d.defaultHourlyRate) : "")
        setDefaultWorkHours(String(d.defaultWorkHoursPerDay ?? 8))
        setDefaultOTMulti(String(d.overtimeMultiplier ?? 1.5))
      })
      .catch(() => {})
      .finally(() => setAcctLoading(false))
  }, [])

  useEffect(() => {
    const rates:      Record<string, string> = {}
    const breaks:     Record<string, string> = {}
    const workHours:  Record<string, string> = {}
    const otMulti:    Record<string, string> = {}
    for (const e of employees) {
      rates[e.id]      = e.hourlyRate         ? String(e.hourlyRate)         : ""
      breaks[e.id]     = e.breakMinPerDay     ? String(e.breakMinPerDay)     : "60"
      workHours[e.id]  = String(e.workHoursPerDay ?? 8)
      otMulti[e.id]    = e.overtimeMultiplier != null ? String(e.overtimeMultiplier) : ""
    }
    setEmpRates(rates)
    setEmpBreaks(breaks)
    setEmpWorkHours(workHours)
    setEmpOTMulti(otMulti)
  }, [employees])

  const checkBalance = async () => {
    setBalanceLoading(true)
    try {
      const res = await fetch("/api/admin/settings")
      const d   = await res.json()
      setBalance(d.walletBalance)
    } catch {}
    setBalanceLoading(false)
  }

  const handleTopup = async () => {
    const amount = Number(topupAmount)
    if (!amount || amount < 100) { setTopupError("Minimum top-up is ₦100"); return }
    setTopupError("")
    setTopupLoading(true)
    try {
      const res  = await fetch("/api/admin/wallet/topup", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ amountNgn: amount }),
      })
      const data = await res.json()
      if (!res.ok) { setTopupError(data.error ?? "Failed to initiate top-up"); return }
      window.open(data.checkoutUrl, "_blank", "noopener,noreferrer")
      setTopupAmount("")
    } catch {
      setTopupError("Network error. Try again.")
    } finally {
      setTopupLoading(false)
    }
  }

  const saveDefaults = async () => {
    setDefaultsSaving(true)
    try {
      await fetch("/api/admin/settings", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          defaultBreakMinPerDay:  defaultBreak   ? Number(defaultBreak)   : 60,
          defaultHourlyRate:      defaultRate    ? Number(defaultRate)    : null,
          defaultWorkHoursPerDay: defaultWorkHours ? Number(defaultWorkHours) : 8,
          overtimeMultiplier:     defaultOTMulti ? Number(defaultOTMulti) : 1.5,
        }),
      })
      setDefaultsSaved(true)
      setTimeout(() => setDefaultsSaved(false), 2500)
    } catch {}
    setDefaultsSaving(false)
  }

  const saveEmpSettings = async (empId: string) => {
    setSaving((p) => ({ ...p, [empId]: true }))
    try {
      await fetch(`/api/admin/employees/${empId}/settings`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          hourlyRate:         empRates[empId]     ? Number(empRates[empId])     : undefined,
          breakMinPerDay:     empBreaks[empId]    ? Number(empBreaks[empId])    : undefined,
          workHoursPerDay:    empWorkHours[empId] ? Number(empWorkHours[empId]) : undefined,
          overtimeMultiplier: empOTMulti[empId]   ? Number(empOTMulti[empId])   : null,
        }),
      })
      onSaved()
    } catch {}
    setSaving((p) => ({ ...p, [empId]: false }))
  }

  return (
    <div className="p-8 max-w-3xl mx-auto w-full space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-slate-400 dark:text-zinc-500 text-sm mt-0.5">Squad payroll account and team pay configuration</p>
      </div>

      {/* Global Team Defaults */}
      <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <HugeiconsIcon icon={Settings01Icon} size={16} className="text-slate-400 dark:text-zinc-500" />
          <h2 className="text-slate-900 dark:text-white text-sm font-semibold">Team Defaults</h2>
        </div>
        <p className="text-slate-400 dark:text-zinc-600 text-xs mb-5">
          Applied to newly invited employees. You can still override these per employee below.
        </p>
        <div className="grid grid-cols-2 gap-4 mb-4 sm:grid-cols-4">
          <div>
            <label className="block text-slate-500 dark:text-zinc-500 text-xs font-medium mb-1.5">
              Work hours / day
            </label>
            <input
              type="number"
              min="1"
              max="24"
              value={defaultWorkHours}
              onChange={(e) => setDefaultWorkHours(e.target.value)}
              placeholder="8"
              className={input}
            />
          </div>
          <div>
            <label className="block text-slate-500 dark:text-zinc-500 text-xs font-medium mb-1.5">
              Overtime rate
            </label>
            <input
              type="number"
              min="1"
              max="3"
              step="0.25"
              value={defaultOTMulti}
              onChange={(e) => setDefaultOTMulti(e.target.value)}
              placeholder="1.5"
              className={input}
            />
            <p className="text-slate-400 dark:text-zinc-600 text-[10px] mt-1">× base rate (e.g. 1.5 = time-and-a-half)</p>
          </div>
          <div>
            <label className="block text-slate-500 dark:text-zinc-500 text-xs font-medium mb-1.5">
              Break duration (min/day)
            </label>
            <input
              type="number"
              min="0"
              max="480"
              value={defaultBreak}
              onChange={(e) => setDefaultBreak(e.target.value)}
              placeholder="60"
              className={input}
            />
          </div>
          <div>
            <label className="block text-slate-500 dark:text-zinc-500 text-xs font-medium mb-1.5">
              Hourly rate (₦) — optional
            </label>
            <input
              type="number"
              min="0"
              value={defaultRate}
              onChange={(e) => setDefaultRate(e.target.value)}
              placeholder="e.g. 5000"
              className={input}
            />
          </div>
        </div>
        <button
          onClick={saveDefaults}
          disabled={defaultsSaving}
          className="flex items-center gap-1.5 text-sm font-semibold bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-zinc-950 px-5 py-2.5 rounded-lg transition-colors"
        >
          <HugeiconsIcon icon={defaultsSaved ? CheckmarkCircle01Icon : FloppyDiskIcon} size={14} className="text-current" />
          {defaultsSaving ? "Saving…" : defaultsSaved ? "Saved!" : "Save Defaults"}
        </button>
      </div>

      {/* Squad Wallet */}
      <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={BankIcon} size={16} className="text-slate-400 dark:text-zinc-500" />
          <h2 className="text-slate-900 dark:text-white text-sm font-semibold">Squad Wallet</h2>
        </div>

        {/* Balance row */}
        <div className="flex items-center gap-3 bg-slate-50 dark:bg-zinc-800/40 rounded-xl px-4 py-3">
          <div className="flex-1">
            <p className="text-slate-400 dark:text-zinc-600 text-[10px] uppercase tracking-wider mb-0.5">Available Balance</p>
            <p className="text-slate-900 dark:text-white text-2xl font-mono font-bold">
              {acctLoading
                ? <span className="text-slate-300 dark:text-zinc-700 text-base">Loading…</span>
                : balance != null
                  ? `₦${balance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`
                  : "—"}
            </p>
          </div>
          <button
            onClick={checkBalance}
            disabled={balanceLoading}
            className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 border border-slate-200 dark:border-zinc-800 px-3 py-1.5 rounded-lg transition-colors"
          >
            <HugeiconsIcon icon={RefreshIcon} size={12} className={`text-current ${balanceLoading ? "animate-spin" : ""}`} />
            {balanceLoading ? "Checking…" : "Refresh"}
          </button>
        </div>

        {/* Top-up */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 text-sm pointer-events-none">₦</span>
            <input
              type="number"
              min="100"
              value={topupAmount}
              onChange={(e) => { setTopupAmount(e.target.value); setTopupError("") }}
              placeholder="Enter amount to top up"
              className={`${input} pl-7`}
            />
          </div>
          <button
            onClick={handleTopup}
            disabled={topupLoading || !topupAmount}
            className="shrink-0 flex items-center gap-1.5 text-sm font-semibold bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-zinc-950 px-4 py-2.5 rounded-lg transition-colors"
          >
            <HugeiconsIcon icon={topupLoading ? RefreshIcon : CreditCardIcon} size={14} className={`text-current ${topupLoading ? "animate-spin" : ""}`} />
            {topupLoading ? "Opening…" : "Top Up"}
          </button>
        </div>
        {topupError && <p className="text-red-500 text-xs">{topupError}</p>}
        <p className="text-slate-400 dark:text-zinc-600 text-xs">
          Pay via card, bank transfer, or USSD on Squad's checkout. Balance updates once payment clears — hit Refresh to confirm.
        </p>
      </div>

      {/* Team Payment Settings */}
      <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-zinc-800/50">
          <h2 className="text-slate-900 dark:text-white text-sm font-semibold">Team Pay Settings</h2>
          <p className="text-slate-400 dark:text-zinc-600 text-xs mt-0.5">Set hourly rate (₦) and daily break duration per employee</p>
        </div>

        {employees.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <p className="text-slate-400 dark:text-zinc-600 text-sm">No employees yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-zinc-800/30">
            {employees.map((emp, i) => (
              <div key={emp.id} className="px-6 py-4 flex items-center gap-4">
                <Avatar initials={emp.initials} idx={i} sm />
                <div className="flex-1 min-w-0">
                  <p className="text-slate-800 dark:text-zinc-200 text-sm font-medium truncate">{emp.name}</p>
                  <p className="text-slate-400 dark:text-zinc-600 text-xs truncate">{emp.role || "Employee"}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div>
                    <label className="block text-slate-400 dark:text-zinc-600 text-[10px] mb-1 uppercase tracking-wider">Rate (₦/hr)</label>
                    <input
                      type="number"
                      min="0"
                      value={empRates[emp.id] ?? ""}
                      onChange={(e) => setEmpRates((p) => ({ ...p, [emp.id]: e.target.value }))}
                      placeholder="5000"
                      className="w-24 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 focus:border-amber-500/50 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white text-sm outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 dark:text-zinc-600 text-[10px] mb-1 uppercase tracking-wider">Hrs / day</label>
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={empWorkHours[emp.id] ?? ""}
                      onChange={(e) => setEmpWorkHours((p) => ({ ...p, [emp.id]: e.target.value }))}
                      placeholder="8"
                      className="w-20 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 focus:border-amber-500/50 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white text-sm outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 dark:text-zinc-600 text-[10px] mb-1 uppercase tracking-wider">OT rate</label>
                    <input
                      type="number"
                      min="1"
                      max="3"
                      step="0.25"
                      value={empOTMulti[emp.id] ?? ""}
                      onChange={(e) => setEmpOTMulti((p) => ({ ...p, [emp.id]: e.target.value }))}
                      placeholder="default"
                      className="w-20 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 focus:border-amber-500/50 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white text-sm outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 dark:text-zinc-600 text-[10px] mb-1 uppercase tracking-wider">Break (min)</label>
                    <input
                      type="number"
                      min="0"
                      max="480"
                      value={empBreaks[emp.id] ?? ""}
                      onChange={(e) => setEmpBreaks((p) => ({ ...p, [emp.id]: e.target.value }))}
                      placeholder="60"
                      className="w-20 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 focus:border-amber-500/50 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white text-sm outline-none transition-all"
                    />
                  </div>
                  <div className="pt-4">
                    <button
                      onClick={() => saveEmpSettings(emp.id)}
                      disabled={saving[emp.id]}
                      className="flex items-center gap-1 text-xs font-medium bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-zinc-950 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <HugeiconsIcon icon={saving[emp.id] ? RefreshIcon : FloppyDiskIcon} size={12} className={`text-current ${saving[emp.id] ? "animate-spin" : ""}`} />
                      {saving[emp.id] ? "…" : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Onboarding modal ─────────────────────────────────────────────────────────
function OnboardingModal({ adminName, onDone, onInvite }: {
  adminName: string
  onDone:    () => void
  onInvite:  () => void
}) {
  const [step,         setStep]         = useState(0)
  const [breakMin,     setBreakMin]     = useState("60")
  const [hourlyRate,   setHourlyRate]   = useState("")
  const [saving,       setSaving]       = useState(false)

  const saveDefaults = async () => {
    setSaving(true)
    try {
      await fetch("/api/admin/settings", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          defaultBreakMinPerDay: breakMin ? Number(breakMin) : 60,
          defaultHourlyRate:     hourlyRate ? Number(hourlyRate) : null,
        }),
      })
    } catch {}
    setSaving(false)
    setStep(2)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-md p-7 shadow-2xl">

          {step === 0 && (
            <div className="text-center">
              <div className="w-14 h-14 bg-amber-400/10 border border-amber-400/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <HugeiconsIcon icon={Clock01Icon} size={26} className="text-amber-400" />
              </div>
              <h2 className="text-slate-900 dark:text-white text-lg font-bold mb-1">
                Welcome, {adminName.split(" ")[0]}!
              </h2>
              <p className="text-slate-500 dark:text-zinc-500 text-sm mb-6">
                Let's set up your trackR workspace in two quick steps.
              </p>
              <div className="text-left space-y-2.5 mb-6">
                {[
                  { n: 1, label: "Set team defaults", sub: "Break duration & hourly rate for new employees" },
                  { n: 2, label: "Invite your first employee", sub: "Send an email invite with a secure link" },
                ].map(({ n, label, sub }) => (
                  <div key={n} className="flex items-start gap-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl px-4 py-3">
                    <span className="w-5 h-5 bg-amber-400 text-zinc-950 text-xs font-bold rounded-full flex items-center justify-center shrink-0 mt-0.5">{n}</span>
                    <div>
                      <p className="text-slate-800 dark:text-zinc-200 text-sm font-medium">{label}</p>
                      <p className="text-slate-400 dark:text-zinc-600 text-xs">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setStep(1)}
                className="w-full bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold py-2.5 rounded-lg transition-colors text-sm"
              >
                Get Started
              </button>
              <button onClick={onDone} className="mt-2 w-full text-xs text-slate-400 dark:text-zinc-600 hover:text-slate-600 dark:hover:text-zinc-400 transition-colors py-1.5">
                Skip for now
              </button>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-7 h-7 bg-amber-400/10 border border-amber-400/20 rounded-lg flex items-center justify-center">
                  <HugeiconsIcon icon={Settings01Icon} size={14} className="text-amber-400" />
                </div>
                <div>
                  <h2 className="text-slate-900 dark:text-white text-sm font-semibold">Team Defaults</h2>
                  <p className="text-slate-400 dark:text-zinc-600 text-xs">Applied to all new employees</p>
                </div>
                <span className="ml-auto text-xs text-slate-400 dark:text-zinc-600">Step 1 of 2</span>
              </div>

              <div className="space-y-4 mb-5">
                <div>
                  <label className="block text-slate-500 dark:text-zinc-500 text-xs font-medium mb-1.5">
                    Daily break duration (minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="480"
                    value={breakMin}
                    onChange={(e) => setBreakMin(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 rounded-lg px-3.5 py-2.5 text-slate-900 dark:text-white text-sm outline-none transition-all"
                    placeholder="60"
                  />
                  <p className="text-slate-400 dark:text-zinc-600 text-xs mt-1">
                    Deducted from gross hours when calculating pay
                  </p>
                </div>
                <div>
                  <label className="block text-slate-500 dark:text-zinc-500 text-xs font-medium mb-1.5">
                    Default hourly rate (₦) <span className="text-slate-300 dark:text-zinc-700 font-normal">— optional</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 rounded-lg px-3.5 py-2.5 text-slate-900 dark:text-white text-sm outline-none transition-all"
                    placeholder="e.g. 5000"
                  />
                </div>
              </div>

              <button
                onClick={saveDefaults}
                disabled={saving}
                className="w-full bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-zinc-950 font-semibold py-2.5 rounded-lg transition-colors text-sm"
              >
                {saving ? "Saving…" : "Save & Continue"}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-400/10 border border-emerald-200 dark:border-emerald-400/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <HugeiconsIcon icon={CheckmarkCircle01Icon} size={22} className="text-emerald-500 dark:text-emerald-400" />
              </div>
              <h2 className="text-slate-900 dark:text-white text-sm font-semibold mb-1">Defaults saved!</h2>
              <p className="text-slate-500 dark:text-zinc-500 text-xs mb-6">
                Now invite your first employee. They'll receive an email with a secure link to set up their account.
              </p>
              <button
                onClick={() => { onDone(); onInvite() }}
                className="w-full bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold py-2.5 rounded-lg transition-colors text-sm mb-2"
              >
                Invite First Employee
              </button>
              <button
                onClick={onDone}
                className="w-full text-xs text-slate-400 dark:text-zinc-600 hover:text-slate-600 dark:hover:text-zinc-400 transition-colors py-1.5"
              >
                I'll do this later
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const router                          = useRouter()
  const [tab, setTab]                   = useState<TabType>("overview")
  const [employees, setEmployees]       = useState<Employee[]>([])
  const [loading, setLoading]           = useState(true)
  const [paid, setPaid]                 = useState<Record<string, boolean>>({})
  const [approved, setApproved]         = useState<Record<string, boolean>>({})
  const [monitorIdx, setMonitorIdx]     = useState<number>(-1)
  const [showInvite, setShowInvite]     = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [adminName, setAdminName]       = useState("Administrator")
  const [drillEmp, setDrillEmp]                     = useState<Employee | null>(null)
  const [drillEmpIdx, setDrillEmpIdx]               = useState(0)
  const [drillInsights, setDrillInsights]           = useState<InsightsSummary | null>(null)
  const [drillInsightsLoad, setDrillInsightsLoad]   = useState(false)
  const [drillSessions, setDrillSessions]           = useState<SessionRecord[]>([])
  const [drillSessionsLoad, setDrillSessionsLoad]   = useState(false)
  const [drillSession, setDrillSession]             = useState<SessionRecord | null>(null)
  const [drillSummary, setDrillSummary]             = useState<DaySummary | null>(null)
  const [drillEvents, setDrillEvents]               = useState<ActivityEvent[]>([])
  const [drillDetailLoad, setDrillDetailLoad]       = useState(false)
  const [analysisLoading, setAnalysisLoading]       = useState(false)
  const [allSessions, setAllSessions]               = useState<AdminSessionRecord[]>([])
  const [allSessionsLoad, setAllSessionsLoad]       = useState(false)
  const [analyzingId, setAnalyzingId]               = useState<string | null>(null)
  const [drillSource, setDrillSource]               = useState<"history" | "sessions" | null>(null)

  // ── Live activity feed ────────────────────────────────────────────────────
  const [liveActivity, setLiveActivity] = useState<Record<string, LiveEmployeeActivity>>({})

  // ── Anomaly flags ─────────────────────────────────────────────────────────
  const [anomalyFlags,    setAnomalyFlags]    = useState<AnomalyFlag[]>([])
  const [anomaliesLoaded, setAnomaliesLoaded] = useState(false)

  // ── Session filters ───────────────────────────────────────────────────────
  const [sessionFrom,           setSessionFrom]           = useState("")
  const [sessionTo,             setSessionTo]             = useState("")
  const [sessionEmployeeFilter, setSessionEmployeeFilter] = useState("")
  const [csvExporting,          setCsvExporting]          = useState(false)

  // ── Payments ─────────────────────────────────────────────────────────────
  const [paymentHistory, setPaymentHistory]   = useState<PaymentRecord[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(false)
  const [disbursing, setDisbursing]           = useState<Record<string, boolean>>({})

  // ── Insights tab ─────────────────────────────────────────────────────────
  const [insightEmp,     setInsightEmp]     = useState<Employee | null>(null)
  const [insightData,    setInsightData]    = useState<EmployeeOverviewData | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [insightRefresh, setInsightRefresh] = useState(false)

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/employees")
      if (!res.ok) return
      const data = await res.json()
      setEmployees(data.employees ?? [])
    } catch {
      // keep stale
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { if (d.name) setAdminName(d.name) })
      .catch(() => {})

    fetchEmployees()
    const t = setInterval(fetchEmployees, 30_000)
    return () => clearInterval(t)
  }, [fetchEmployees])

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("onboarding") === "1") {
      setShowOnboarding(true)
      router.replace("/admin")
    }
  }, [router])

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  const fetchAllSessions = async () => {
    setAllSessionsLoad(true)
    try {
      const params = new URLSearchParams()
      if (sessionFrom)           params.set("from",       sessionFrom)
      if (sessionTo)             params.set("to",         sessionTo)
      if (sessionEmployeeFilter) params.set("employeeId", sessionEmployeeFilter)
      const res = await fetch(`/api/admin/sessions?${params}`)
      if (res.ok) setAllSessions((await res.json()).sessions ?? [])
    } catch {}
    setAllSessionsLoad(false)
  }

  const fetchPaymentHistory = async () => {
    setPaymentsLoading(true)
    try {
      const res = await fetch("/api/admin/payments")
      if (res.ok) setPaymentHistory((await res.json()).payments ?? [])
    } catch {}
    setPaymentsLoading(false)
  }

  const fetchInsightData = useCallback(async (emp: Employee) => {
    setInsightLoading(true)
    try {
      const res = await fetch(`/api/admin/employees/${emp.id}/overview`)
      if (res.ok) setInsightData((await res.json()) as EmployeeOverviewData)
    } catch {}
    setInsightLoading(false)
  }, [])

  const refreshInsightAnalysis = async () => {
    if (!insightEmp) return
    setInsightRefresh(true)
    try {
      await fetch(`/api/admin/employees/${insightEmp.id}/overview`, { method: "POST" })
      const res = await fetch(`/api/admin/employees/${insightEmp.id}/overview`)
      if (res.ok) setInsightData((await res.json()) as EmployeeOverviewData)
    } catch {}
    setInsightRefresh(false)
  }

  useEffect(() => {
    if (!insightEmp) return
    setInsightData(null)
    fetchInsightData(insightEmp)
  }, [insightEmp, fetchInsightData])

  // ── Live activity polling (overview only, every 8 s) ─────────────────────
  useEffect(() => {
    if (tab !== "overview" || drillEmp) return
    const poll = async () => {
      try {
        const res = await fetch("/api/admin/live")
        if (!res.ok) return
        const { employees: live } = await res.json() as { employees: LiveEmployeeActivity[] }
        const map: Record<string, LiveEmployeeActivity> = {}
        for (const e of live) map[e.employeeId] = e
        setLiveActivity(map)
      } catch {}
    }
    poll()
    const t = setInterval(poll, 8_000)
    return () => clearInterval(t)
  }, [tab, drillEmp])

  // ── Anomaly flags (load once per overview visit) ──────────────────────────
  useEffect(() => {
    if (tab !== "overview" || anomaliesLoaded) return
    fetch("/api/admin/anomalies")
      .then((r) => r.json())
      .then((d) => { setAnomalyFlags(d.flags ?? []); setAnomaliesLoaded(true) })
      .catch(() => {})
  }, [tab, anomaliesLoaded])

  const resolveAnomaly = async (id: string) => {
    try {
      await fetch("/api/admin/anomalies", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id }),
      })
      setAnomalyFlags((prev) => prev.filter((f) => f.id !== id))
    } catch {}
  }

  // ── Sessions: fetch with filters ──────────────────────────────────────────
  const fetchFilteredSessions = async () => {
    setAllSessionsLoad(true)
    try {
      const params = new URLSearchParams()
      if (sessionFrom)           params.set("from",       sessionFrom)
      if (sessionTo)             params.set("to",         sessionTo)
      if (sessionEmployeeFilter) params.set("employeeId", sessionEmployeeFilter)
      const res = await fetch(`/api/admin/sessions?${params}`)
      if (res.ok) setAllSessions((await res.json()).sessions ?? [])
    } catch {}
    setAllSessionsLoad(false)
  }

  const exportCSV = async () => {
    setCsvExporting(true)
    try {
      const params = new URLSearchParams({ format: "csv" })
      if (sessionFrom)           params.set("from",       sessionFrom)
      if (sessionTo)             params.set("to",         sessionTo)
      if (sessionEmployeeFilter) params.set("employeeId", sessionEmployeeFilter)
      const res  = await fetch(`/api/admin/sessions?${params}`)
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href     = url
      a.download = `sessions-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {}
    setCsvExporting(false)
  }

  const handleDisburse = async (employeeId: string) => {
    setDisbursing((p) => ({ ...p, [employeeId]: true }))
    try {
      const res = await fetch("/api/admin/payments/disburse", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ employeeId }),
      })
      const data = await res.json()
      if (res.ok) {
        setPaid((p) => ({ ...p, [employeeId]: true }))
        await fetchPaymentHistory()
        if (data.sandboxNote) {
          alert(`✓ ${data.sandboxNote}`)
        }
      } else {
        alert(`Payment failed: ${data.error}`)
      }
    } catch {
      alert("Network error — payment not sent.")
    }
    setDisbursing((p) => ({ ...p, [employeeId]: false }))
  }

  const analyzeFromList = async (sessionId: string) => {
    setAnalyzingId(sessionId)
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}/analyze`, { method: "POST" })
      if (res.ok) {
        const { analysis, analyzedAt } = await res.json()
        setAllSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, analysis, analyzedAt } : s))
        setDrillSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, analysis, analyzedAt } : s))
        setDrillSession((prev) => prev?.id === sessionId ? { ...prev, analysis, analyzedAt } : prev)
      }
    } catch {}
    setAnalyzingId(null)
  }

  const openFromSessionsTab = async (s: AdminSessionRecord) => {
    const words = s.employee.name.trim().split(" ")
    const initials = (words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")
    const emp: Employee = {
      id:             s.employee.id,
      apiId:          s.employee.apiId,
      name:           s.employee.name,
      initials:       initials.toUpperCase(),
      role:           s.employee.role ?? "Employee",
      status:         s.clockOut ? "clocked-out" : "active",
      clockIn:        "—",
      hours:          "—",
      weekHours:      0,
      hourlyRate:     0,
      breakMinPerDay:     60,
      workHoursPerDay:    8,
      overtimeMultiplier: null,
      bankVerified:       false,
      accountName:     null,
      sessionId:       s.id,
      todayNetSec:     0,
      onBreak:         false,
      breakUsedSec:    0,
    }
    setDrillEmp(emp)
    setDrillSource("sessions")
    await openSessionDetail(s, emp)
  }

  const openHistory = async (emp: Employee, idx: number) => {
    setDrillSource("history")
    setDrillEmp(emp)
    setDrillEmpIdx(idx)
    setDrillSession(null)
    setDrillSessions([])
    setDrillInsights(null)
    setDrillSessionsLoad(true)
    setDrillInsightsLoad(true)
    try {
      const [sessRes, insRes] = await Promise.all([
        fetch(`/api/sessions?employeeId=${emp.id}`),
        fetch(`/api/admin/employees/${emp.id}/insights`),
      ])
      if (sessRes.ok) setDrillSessions((await sessRes.json()).sessions ?? [])
      if (insRes.ok) {
        const { insights } = await insRes.json()
        setDrillInsights(insights)
      }
    } catch {}
    setDrillSessionsLoad(false)
    setDrillInsightsLoad(false)
  }

  const openSessionDetail = async (session: SessionRecord, emp: Employee) => {
    setDrillSession(session)
    setDrillSummary(null)
    setDrillEvents([])
    setDrillDetailLoad(true)
    try {
      const [sumRes, evRes] = await Promise.all([
        fetch(`/api/extension/activity?employeeId=${emp.apiId}&sessionId=${session.id}&mode=summary`),
        fetch(`/api/extension/activity?employeeId=${emp.apiId}&sessionId=${session.id}`),
      ])
      if (sumRes.ok) setDrillSummary(await sumRes.json())
      if (evRes.ok) {
        const d = await evRes.json()
        setDrillEvents(
          (d.events as ActivityEvent[])
            .filter((e) => e.type === "tab_visit")
            .sort((a, b) => b.ts - a.ts)
        )
      }
    } catch {}
    setDrillDetailLoad(false)
  }

  const approveSession = async (sessionId: string) => {
    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ approve: true }),
      })
      setDrillSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, approved: true } : s))
      setDrillSession((prev) => prev?.id === sessionId ? { ...prev, approved: true } : prev)
    } catch {}
  }

  const generateAnalysis = async () => {
    if (!drillSession) return
    setAnalysisLoading(true)
    try {
      const res = await fetch(`/api/admin/sessions/${drillSession.id}/analyze`, { method: "POST" })
      if (res.ok) {
        const { analysis, analyzedAt } = await res.json()
        const updated = { ...drillSession, analysis, analyzedAt }
        setDrillSession(updated)
        setDrillSessions((prev) => prev.map((s) => s.id === drillSession.id ? updated : s))
      }
    } catch {}
    setAnalysisLoading(false)
  }

  const approveLatestSession = async (emp: Employee) => {
    if (!emp.sessionId) return
    try {
      await fetch(`/api/sessions/${emp.sessionId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ approve: true }),
      })
      setApproved((p) => ({ ...p, [emp.id]: true }))
    } catch {}
  }

  const monitorEmployee = monitorIdx >= 0 ? employees[monitorIdx] ?? null : null

  const activeCount  = employees.filter((e) => e.status === "active").length
  const pendingCount = employees.filter((e) => e.status === "clocked-out" && !approved[e.id]).length
  const totalHrsSec  = employees.reduce((s, e) => {
    const [h, m] = e.hours.replace("m","").split("h ").map(Number)
    return s + (h * 3600) + ((m ?? 0) * 60)
  }, 0)
  const totalHrsStr  = `${Math.floor(totalHrsSec / 3600)}h ${Math.floor((totalHrsSec % 3600) / 60).toString().padStart(2,"0")}m`

  const totalPayroll    = employees.reduce((s, e) => s + e.weekHours * e.hourlyRate, 0)
  const paidCount       = Object.values(paid).filter(Boolean).length
  const pendingPayCount = employees.filter((e) => !paid[e.id]).length

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex">
      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside className="w-56 shrink-0 border-r border-slate-200 dark:border-zinc-800/50 flex flex-col bg-white dark:bg-zinc-900/20 sticky top-0 h-screen">
        <div className="px-5 h-14 flex items-center border-b border-slate-200 dark:border-zinc-800/50 gap-2">
          <Link
            href="/"
            className="mr-1 flex items-center justify-center w-6 h-6 rounded text-slate-400 dark:text-zinc-600 hover:text-slate-600 dark:hover:text-zinc-400 transition-colors"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={14} className="text-current" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-amber-400 rounded-md flex items-center justify-center shrink-0">
              <HugeiconsIcon icon={Clock01Icon} size={13} className="text-zinc-950" />
            </div>
            <span className="font-mono text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              track<span className="text-amber-500 dark:text-amber-400">R</span>
            </span>
          </div>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto scrollbar-thin">
          <p className="text-slate-400 dark:text-zinc-700 text-[10px] uppercase tracking-[0.18em] font-medium px-2 mb-2 mt-1">
            Menu
          </p>
          <div className="space-y-0.5">
            {([
              { id: "overview"  as TabType, icon: Home01Icon,      label: "Overview",  badge: null                  },
              { id: "sessions"  as TabType, icon: Calendar01Icon,  label: "Sessions",  badge: null                  },
              { id: "payments"  as TabType, icon: Money01Icon,     label: "Payments",  badge: pendingPayCount || null },
              { id: "insights"  as TabType, icon: Analytics01Icon, label: "Insights",  badge: null                  },
              { id: "settings"  as TabType, icon: Settings01Icon,  label: "Settings",  badge: null                  },
            ] as const).map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setTab(item.id)
                  setDrillEmp(null)
                  setDrillSession(null)
                  if (item.id === "sessions") fetchAllSessions()
                  if (item.id === "payments") fetchPaymentHistory()
                  if (item.id === "insights") { setInsightEmp(null); setInsightData(null) }
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                  tab === item.id
                    ? "bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white"
                    : "text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800/40"
                }`}
              >
                <HugeiconsIcon icon={item.icon} size={15} className="text-current shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge ? (
                  <span className="text-[10px] font-mono bg-amber-100 dark:bg-amber-400/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full leading-none">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {employees.length > 0 && (
            <div className="mt-5">
              <p className="text-slate-400 dark:text-zinc-700 text-[10px] uppercase tracking-[0.18em] font-medium px-2 mb-2">
                Team
              </p>
              <div className="space-y-0.5">
                {employees.slice(0, 5).map((e, i) => {
                  const s = STATUS_CFG[e.status]
                  return (
                    <div
                      key={e.id}
                      onClick={() => setMonitorIdx(i)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer"
                    >
                      <Avatar initials={e.initials} idx={i} sm />
                      <span className="text-slate-500 dark:text-zinc-500 text-xs truncate flex-1 min-w-0">
                        {e.name.split(" ")[0]}
                      </span>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} shrink-0 ${s.pulse ? "animate-pulse" : ""}`} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-zinc-800/50 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700/50 rounded-full flex items-center justify-center shrink-0">
              <HugeiconsIcon icon={ShieldUserIcon} size={13} className="text-slate-500 dark:text-zinc-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-slate-700 dark:text-zinc-300 text-xs font-medium truncate">{adminName}</p>
              <p className="text-slate-400 dark:text-zinc-600 text-[10px] truncate">Administrator</p>
            </div>
            <ThemeToggle />
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-400/5 transition-colors"
          >
            <HugeiconsIcon icon={Logout01Icon} size={13} className="text-current" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto">

        {/* ── Overview ── */}
        {!drillEmp && tab === "overview" && (
          <div className="p-8 max-w-5xl mx-auto w-full">
            <div className="flex items-start justify-between mb-8">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Overview</h1>
                <p className="text-slate-400 dark:text-zinc-500 text-sm mt-0.5">
                  {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · Today
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowInvite(true)}
                  className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-400/5 hover:bg-amber-100 dark:hover:bg-amber-400/10 px-3 py-2 rounded-lg transition-colors"
                >
                  <HugeiconsIcon icon={UserAdd01Icon} size={13} className="text-current" />
                  Invite Employee
                </button>
                <button
                  onClick={fetchEmployees}
                  className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/50 px-3 py-2 rounded-lg transition-colors"
                >
                  <HugeiconsIcon icon={Activity01Icon} size={13} className="text-current" />
                  Refresh
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                {
                  label:  "Total Employees",
                  value:  loading ? "…" : employees.length.toString(),
                  sub:    "across all teams",
                  icon:   <HugeiconsIcon icon={UserGroupIcon} size={16} className="text-slate-400 dark:text-zinc-500" />,
                  accent: "text-slate-900 dark:text-white",
                },
                {
                  label:  "Currently Active",
                  value:  loading ? "…" : activeCount.toString(),
                  sub:    "online now",
                  icon:   <span className="w-2 h-2 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-pulse inline-block" />,
                  accent: "text-emerald-600 dark:text-emerald-400",
                },
                {
                  label:  "Pending Review",
                  value:  loading ? "…" : pendingCount.toString(),
                  sub:    "need approval",
                  icon:   <HugeiconsIcon icon={ClockAlertIcon} size={16} className="text-amber-500 dark:text-amber-400" />,
                  accent: "text-amber-600 dark:text-amber-400",
                },
                {
                  label:  "Hours Today",
                  value:  loading ? "…" : totalHrsStr,
                  sub:    "total logged",
                  icon:   <HugeiconsIcon icon={ClockCheckIcon} size={16} className="text-slate-400 dark:text-zinc-500" />,
                  accent: "text-slate-900 dark:text-white",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 hover:border-slate-300 dark:hover:border-zinc-700/80 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-slate-400 dark:text-zinc-600 text-[10px] uppercase tracking-wider">{s.label}</span>
                    {s.icon}
                  </div>
                  <div className={`text-2xl font-mono font-bold ${s.accent}`}>{s.value}</div>
                  <p className="text-slate-300 dark:text-zinc-700 text-xs mt-1">{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Anomaly alerts panel */}
            {anomalyFlags.length > 0 && (
              <div className="mb-6 bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200/80 dark:border-zinc-800/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HugeiconsIcon icon={AlertCircleIcon} size={15} className="text-red-500 dark:text-red-400" />
                    <h2 className="text-slate-900 dark:text-white text-sm font-semibold">Anomaly Alerts</h2>
                    <span className="text-[10px] font-mono bg-red-50 dark:bg-red-400/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-400/20 px-2 py-0.5 rounded-full">
                      {anomalyFlags.length}
                    </span>
                  </div>
                  <button
                    onClick={() => { setAnomaliesLoaded(false) }}
                    className="text-xs text-slate-400 dark:text-zinc-600 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
                  >
                    Refresh
                  </button>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-zinc-800/30">
                  {anomalyFlags.map((flag) => {
                    const severityColor = flag.severity === "high"
                      ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-400/10 border-red-200 dark:border-red-400/20"
                      : flag.severity === "medium"
                        ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-400/10 border-amber-200 dark:border-amber-400/20"
                        : "text-slate-500 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800/40 border-slate-200 dark:border-zinc-700/30"
                    const streamIcon = flag.stream === "security" ? ShieldUserIcon : AiBrain01Icon
                    const streamColor = flag.stream === "security"
                      ? "text-violet-500 dark:text-violet-400"
                      : "text-emerald-500 dark:text-emerald-400"

                    return (
                      <div key={flag.id} className="px-6 py-3.5 flex items-start gap-4 group">
                        <HugeiconsIcon icon={streamIcon} size={15} className={`${streamColor} shrink-0 mt-0.5`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="text-slate-900 dark:text-white text-xs font-medium">{flag.employee.name}</span>
                            <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded border ${severityColor}`}>
                              {flag.severity}
                            </span>
                            <span className="text-slate-300 dark:text-zinc-700 text-[10px] font-mono capitalize">
                              {flag.signal.replace(/_/g, " ")}
                            </span>
                          </div>
                          <p className="text-slate-500 dark:text-zinc-400 text-xs leading-relaxed">{flag.message}</p>
                          <p className="text-slate-300 dark:text-zinc-700 text-[10px] mt-0.5 font-mono">
                            {new Date(flag.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}
                          </p>
                        </div>
                        <button
                          onClick={() => resolveAnomaly(flag.id)}
                          className="shrink-0 flex items-center gap-1 text-[11px] text-slate-400 dark:text-zinc-600 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200 dark:border-zinc-800 hover:border-emerald-200 dark:hover:border-emerald-900/60 px-2 py-1 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <HugeiconsIcon icon={CheckmarkCircle01Icon} size={11} className="text-current" />
                          Resolve
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Employee table */}
            <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200/80 dark:border-zinc-800/50 flex items-center justify-between">
                <h2 className="text-slate-900 dark:text-white text-sm font-semibold">Employees</h2>
                <span className="text-slate-400 dark:text-zinc-600 text-xs font-mono">{employees.length} total</span>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <span className="text-slate-400 dark:text-zinc-600 text-sm">Loading employees…</span>
                </div>
              ) : employees.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <HugeiconsIcon icon={UserGroupIcon} size={32} className="text-slate-200 dark:text-zinc-800" />
                  <p className="text-slate-400 dark:text-zinc-600 text-sm">No employees yet.</p>
                  <button
                    onClick={() => setShowInvite(true)}
                    className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
                  >
                    Invite your first employee →
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-zinc-800/30">
                  {employees.map((emp, i) => {
                    const s          = STATUS_CFG[emp.status]
                    const isApproved = approved[emp.id]
                    const live       = liveActivity[emp.id]
                    const breakOverage   = emp.status === "active" && emp.breakUsedSec > emp.breakMinPerDay * 60
                    // Overtime: net worked seconds today exceed the daily work limit
                    const workLimitSec   = emp.workHoursPerDay * 3600
                    const netSec         = emp.status === "active" && live
                      ? live.netElapsedSec
                      : emp.todayNetSec
                    const overtimeSec    = netSec - workLimitSec
                    const isOvertime     = overtimeSec > 0
                    return (
                      <div
                        key={emp.id}
                        className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-zinc-800/15 transition-colors group"
                      >
                        <Avatar initials={emp.initials} idx={i} />

                        <div className="flex-1 min-w-0">
                          <p className="text-slate-900 dark:text-white text-sm font-medium leading-none">{emp.name}</p>
                          {/* Live current activity or role */}
                          {emp.status === "active" && live?.domain ? (
                            <p className="text-xs mt-1 truncate flex items-center gap-1.5">
                              <span className={`font-medium ${catOf(live.category ?? undefined).color}`}>
                                {catOf(live.category ?? undefined).icon} {live.domain}
                              </span>
                              {live.title && (
                                <span className="text-slate-300 dark:text-zinc-700 truncate">· {live.title}</span>
                              )}
                            </p>
                          ) : (
                            <p className="text-slate-400 dark:text-zinc-600 text-xs mt-1">{emp.role || "Employee"}</p>
                          )}
                        </div>

                        {/* Overtime badge */}
                        {isOvertime && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-400/10 border border-orange-200 dark:border-orange-400/20 px-2 py-1 rounded-full shrink-0">
                            <HugeiconsIcon icon={Clock01Icon} size={10} className="text-current" />
                            OT +{Math.floor(overtimeSec / 3600) > 0
                              ? `${Math.floor(overtimeSec / 3600)}h ${Math.round((overtimeSec % 3600) / 60)}m`
                              : `${Math.round(overtimeSec / 60)}m`}
                          </span>
                        )}

                        {/* Break overage badge */}
                        {breakOverage && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20 px-2 py-1 rounded-full shrink-0">
                            <HugeiconsIcon icon={ClockAlertIcon} size={10} className="text-current" />
                            Break +{Math.round((emp.breakUsedSec - emp.breakMinPerDay * 60) / 60)}m over
                          </span>
                        )}

                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${s.text} ${s.bg} ${s.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${s.pulse ? "animate-pulse" : ""}`} />
                          {live?.onBreak ? "On Break" : s.label}
                        </div>

                        <div className="text-right w-24 hidden md:block">
                          <p className="text-slate-300 dark:text-zinc-700 text-[10px] uppercase tracking-wider mb-0.5">Clock In</p>
                          <p className="text-slate-600 dark:text-zinc-400 text-sm font-mono">{emp.clockIn}</p>
                        </div>

                        <div className="text-right w-20">
                          <p className="text-slate-300 dark:text-zinc-700 text-[10px] uppercase tracking-wider mb-0.5">Hours</p>
                          <p className="text-slate-900 dark:text-white text-sm font-mono font-semibold">{emp.hours}</p>
                        </div>

                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openHistory(emp, i)}
                            className="text-xs text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 px-2.5 py-1.5 rounded-lg transition-colors"
                          >
                            History
                          </button>
                          {emp.status === "clocked-out" && !isApproved && (
                            <button
                              onClick={() => approveLatestSession(emp)}
                              className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60 hover:border-emerald-300 dark:hover:border-emerald-700/60 bg-emerald-50 dark:bg-emerald-400/5 hover:bg-emerald-100 dark:hover:bg-emerald-400/10 px-2.5 py-1.5 rounded-lg transition-colors"
                            >
                              Approve
                            </button>
                          )}
                          {emp.status === "clocked-out" && isApproved && (
                            <span className="flex items-center gap-1 text-xs text-emerald-600/70 dark:text-emerald-400/70 border border-emerald-200 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-400/5 px-2.5 py-1.5 rounded-lg">
                              <HugeiconsIcon icon={CheckmarkCircle01Icon} size={12} className="text-current" />
                              Done
                            </span>
                          )}
                          {emp.status === "active" && (
                            <button
                              onClick={() => setMonitorIdx(i)}
                              className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 border border-amber-200 dark:border-amber-900/40 hover:border-amber-300 dark:hover:border-amber-700/60 bg-amber-50 dark:bg-amber-400/5 hover:bg-amber-100 dark:hover:bg-amber-400/10 px-2.5 py-1.5 rounded-lg transition-colors"
                            >
                              Monitor
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Payments ── */}
        {!drillEmp && tab === "payments" && (
          <PaymentsTab
            employees={employees}
            loading={loading}
            payments={paymentHistory}
            paymentsLoading={paymentsLoading}
            disbursing={disbursing}
            onDisburse={handleDisburse}
            onRefreshPayments={fetchPaymentHistory}
          />
        )}
        {/* ── Sessions Tab ── */}
        {!drillEmp && tab === "sessions" && (
          <div className="p-8 max-w-5xl mx-auto w-full">
            <div className="mb-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Sessions</h1>
                  <p className="text-slate-400 dark:text-zinc-500 text-sm mt-0.5">All work sessions across your team</p>
                </div>
                <button
                  onClick={exportCSV}
                  disabled={csvExporting}
                  className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/50 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  <HugeiconsIcon icon={ArrowRight01Icon} size={13} className="text-current" />
                  {csvExporting ? "Exporting…" : "Export CSV"}
                </button>
              </div>

              {/* Filters row */}
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-slate-400 dark:text-zinc-600 text-[10px] uppercase tracking-wider mb-1">From</label>
                  <input
                    type="date"
                    value={sessionFrom}
                    onChange={(e) => setSessionFrom(e.target.value)}
                    className="bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 focus:border-amber-500/50 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white text-xs outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 dark:text-zinc-600 text-[10px] uppercase tracking-wider mb-1">To</label>
                  <input
                    type="date"
                    value={sessionTo}
                    onChange={(e) => setSessionTo(e.target.value)}
                    className="bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 focus:border-amber-500/50 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white text-xs outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 dark:text-zinc-600 text-[10px] uppercase tracking-wider mb-1">Employee</label>
                  <select
                    value={sessionEmployeeFilter}
                    onChange={(e) => setSessionEmployeeFilter(e.target.value)}
                    className="bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 focus:border-amber-500/50 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white text-xs outline-none transition-all"
                  >
                    <option value="">All employees</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={fetchFilteredSessions}
                  disabled={allSessionsLoad}
                  className="flex items-center gap-1.5 text-xs font-medium bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-zinc-950 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <HugeiconsIcon icon={Activity01Icon} size={12} className="text-current" />
                  {allSessionsLoad ? "Loading…" : "Apply"}
                </button>
                {(sessionFrom || sessionTo || sessionEmployeeFilter) && (
                  <button
                    onClick={() => { setSessionFrom(""); setSessionTo(""); setSessionEmployeeFilter("") }}
                    className="text-xs text-slate-400 dark:text-zinc-600 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {allSessionsLoad ? (
              <div className="flex items-center justify-center py-16">
                <span className="text-slate-400 dark:text-zinc-600 text-sm">Loading sessions…</span>
              </div>
            ) : allSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <HugeiconsIcon icon={Calendar01Icon} size={32} className="text-slate-200 dark:text-zinc-800" />
                <p className="text-slate-400 dark:text-zinc-600 text-sm">No sessions recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {groupAdminSessions(allSessions).map(({ label, items }) => (
                  <div key={label}>
                    <div className="flex items-center gap-3 mb-3">
                      <p className="text-slate-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider">
                        {label}
                      </p>
                      <span className="text-slate-300 dark:text-zinc-700 text-[10px] font-mono">{items.length} session{items.length !== 1 ? "s" : ""}</span>
                    </div>

                    <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                      {items.map((s, si) => {
                        const words   = s.employee.name.trim().split(" ")
                        const initials = ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase()
                        const empIdx  = employees.findIndex((e) => e.id === s.employee.id)
                        const palette = AVATAR_PALETTE[(empIdx >= 0 ? empIdx : si) % AVATAR_PALETTE.length]
                        const isAnalyzing = analyzingId === s.id

                        return (
                          <div
                            key={s.id}
                            className={`px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-zinc-800/20 transition-colors group ${si > 0 ? "border-t border-slate-100 dark:border-zinc-800/30" : ""}`}
                          >
                            {/* Avatar */}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-mono font-bold text-[10px] border shrink-0 ${palette}`}>
                              {initials}
                            </div>

                            {/* Name + time */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-slate-900 dark:text-white text-sm font-medium">{s.employee.name}</span>
                                <span className="text-slate-300 dark:text-zinc-700 text-xs">·</span>
                                <span className="text-slate-500 dark:text-zinc-500 text-xs font-mono">{fmtTimeRange(s.clockIn, s.clockOut)}</span>
                                {s.durationSec !== null && (
                                  <span className="text-slate-400 dark:text-zinc-600 text-xs">{fmtDuration(s.durationSec)}</span>
                                )}
                                <span className="text-slate-300 dark:text-zinc-700 text-xs">{s.eventCount} events</span>
                              </div>
                            </div>

                            {/* Badges + actions */}
                            <div className="flex items-center gap-2 shrink-0">
                              {/* Analysis badge / button */}
                              {s.analysis ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/20 px-2 py-1 rounded-full">
                                  <span className="leading-none">✦</span>
                                  {(s.analysis as SessionAnalysis).grade} · {(s.analysis as SessionAnalysis).score}
                                </span>
                              ) : (
                                <button
                                  onClick={() => analyzeFromList(s.id)}
                                  disabled={isAnalyzing}
                                  className="text-[11px] text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-400/5 hover:bg-amber-100 dark:hover:bg-amber-400/10 disabled:opacity-50 px-2 py-1 rounded-lg transition-colors"
                                >
                                  {isAnalyzing ? "…" : "Analyze"}
                                </button>
                              )}

                              {/* Approved badge / button */}
                              {s.approved ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-400/10 border border-emerald-200 dark:border-emerald-400/20 px-2 py-1 rounded-full">
                                  <HugeiconsIcon icon={CheckmarkCircle01Icon} size={9} className="text-current" />
                                  Approved
                                </span>
                              ) : (
                                <button
                                  onClick={() => approveSession(s.id).then(() =>
                                    setAllSessions((prev) => prev.map((x) => x.id === s.id ? { ...x, approved: true } : x))
                                  )}
                                  className="text-[11px] text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-400/5 hover:bg-emerald-100 dark:hover:bg-emerald-400/10 px-2 py-1 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                >
                                  Approve
                                </button>
                              )}

                              {/* View detail */}
                              <button
                                onClick={() => openFromSessionsTab(s)}
                                className="text-[11px] text-slate-500 dark:text-zinc-500 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 px-2 py-1 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                              >
                                View
                              </button>
                            </div>

                            <HugeiconsIcon icon={ArrowRight01Icon} size={12} className="text-slate-200 dark:text-zinc-800 shrink-0" />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Employee Sessions ── */}
        {drillEmp && !drillSession && (
          <div className="p-8 max-w-3xl mx-auto w-full">
            <div className="flex items-center gap-3 mb-8">
              <button
                onClick={() => setDrillEmp(null)}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 dark:text-zinc-600 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} size={15} className="text-current" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{drillEmp.name}</h1>
                <p className="text-slate-400 dark:text-zinc-500 text-sm">Session history</p>
              </div>
            </div>

            {/* ── AI Insights Panel ── */}
            {drillInsightsLoad ? (
              <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 mb-6 flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin shrink-0" />
                <span className="text-slate-400 dark:text-zinc-600 text-sm">Loading work pattern insights…</span>
              </div>
            ) : drillInsights ? (
              <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 mb-6 space-y-4">
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={AiBrain01Icon} size={15} className="text-amber-500 dark:text-amber-400" />
                  <p className="text-slate-900 dark:text-white text-sm font-semibold">Work Pattern Insights</p>
                  <span className="ml-auto text-slate-300 dark:text-zinc-700 text-[10px] font-mono">{drillInsights.sessionCount} sessions</span>
                </div>

                {/* Headline */}
                <p className="text-slate-600 dark:text-zinc-400 text-sm leading-relaxed border-l-2 border-amber-400 dark:border-amber-400/60 pl-3">
                  {drillInsights.headline}
                </p>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Avg Productivity", value: `${drillInsights.avgProductivePct}%` },
                    { label: "Peak Hours",        value: drillInsights.peakHoursLabel || (drillInsights.peakHours[0] ? `${drillInsights.peakHours[0].hour % 12 || 12}${drillInsights.peakHours[0].hour >= 12 ? "pm" : "am"}` : "—") },
                    { label: "Trend",             value: drillInsights.trend.charAt(0).toUpperCase() + drillInsights.trend.slice(1),
                      color: drillInsights.trend === "improving" ? "text-emerald-600 dark:text-emerald-400" : drillInsights.trend === "declining" ? "text-red-500 dark:text-red-400" : "text-slate-500 dark:text-zinc-400" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-slate-50 dark:bg-zinc-800/40 rounded-lg p-3">
                      <p className="text-slate-400 dark:text-zinc-600 text-[10px] uppercase tracking-wider mb-0.5">{label}</p>
                      <p className={`text-sm font-semibold font-mono ${color ?? "text-slate-800 dark:text-zinc-200"}`}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Fatigue */}
                {drillInsights.fatigueFlag && (
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/20 rounded-lg px-3 py-2 text-xs">
                    <HugeiconsIcon icon={AlertCircleIcon} size={13} className="text-current shrink-0" />
                    Fatigue detected: productivity drops {drillInsights.fatigueProfile.earlyPct - drillInsights.fatigueProfile.latePct}% from session start to end
                  </div>
                )}

                {/* AI Insights */}
                <div className="space-y-2">
                  {drillInsights.insights.map((insight, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="w-4 h-4 bg-amber-50 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                      <p className="text-slate-600 dark:text-zinc-400 text-xs leading-relaxed">{insight}</p>
                    </div>
                  ))}
                </div>

                {/* Anomalies */}
                {drillInsights.anomalies.length > 0 && (
                  <div className="space-y-1.5 bg-red-50 dark:bg-red-400/5 border border-red-200 dark:border-red-400/15 rounded-lg p-3">
                    <p className="text-red-600 dark:text-red-400 text-[10px] font-semibold uppercase tracking-wider mb-2">Flagged</p>
                    {drillInsights.anomalies.map((a, i) => (
                      <p key={i} className="text-slate-600 dark:text-zinc-400 text-xs leading-relaxed">{a}</p>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {drillSessionsLoad ? (
              <div className="flex items-center justify-center py-16">
                <span className="text-slate-400 dark:text-zinc-600 text-sm">Loading sessions…</span>
              </div>
            ) : drillSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <HugeiconsIcon icon={Clock01Icon} size={32} className="text-slate-200 dark:text-zinc-800" />
                <p className="text-slate-400 dark:text-zinc-600 text-sm">No sessions recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {groupSessions(drillSessions).map(({ label, items }) => (
                  <div key={label}>
                    <p className="text-slate-400 dark:text-zinc-600 text-xs font-medium uppercase tracking-wider mb-3 px-1">
                      {label}
                    </p>
                    <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                      {items.map((s, si) => (
                        <div
                          key={s.id}
                          className={`px-5 py-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-zinc-800/20 transition-colors group ${si > 0 ? "border-t border-slate-100 dark:border-zinc-800/30" : ""}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-slate-900 dark:text-white text-sm font-mono">
                                {fmtTimeRange(s.clockIn, s.clockOut)}
                              </p>
                              {s.approved && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/20 px-1.5 py-0.5 rounded-full">
                                  <HugeiconsIcon icon={CheckmarkCircle01Icon} size={9} className="text-current" />
                                  Approved
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-zinc-600">
                              {s.durationSec !== null && <span>{fmtDuration(s.durationSec)}</span>}
                              <span>{s.eventCount} events</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!s.approved && (
                              <button
                                onClick={(e) => { e.stopPropagation(); approveSession(s.id) }}
                                className="text-xs text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-400/5 hover:bg-emerald-100 dark:hover:bg-emerald-400/10 px-2.5 py-1.5 rounded-lg transition-colors"
                              >
                                Approve
                              </button>
                            )}
                            <button
                              onClick={() => openSessionDetail(s, drillEmp!)}
                              className="text-xs text-slate-500 dark:text-zinc-500 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 px-2.5 py-1.5 rounded-lg transition-colors"
                            >
                              View
                            </button>
                          </div>
                          <HugeiconsIcon icon={ArrowRight01Icon} size={13} className="text-slate-200 dark:text-zinc-800 shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Session Detail ── */}
        {drillSession && (
          <div className="p-8 max-w-3xl mx-auto w-full">
            <div className="flex items-center gap-3 mb-8">
              <button
                onClick={() => {
                  setDrillSession(null)
                  if (drillSource === "sessions") setDrillEmp(null)
                }}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 dark:text-zinc-600 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} size={15} className="text-current" />
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-semibold text-slate-900 dark:text-white truncate">
                  {new Date(drillSession.clockIn).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  {" · "}{fmtTimeRange(drillSession.clockIn, drillSession.clockOut)}
                </h1>
                <p className="text-slate-400 dark:text-zinc-500 text-sm">{drillEmp?.name}</p>
              </div>
              {drillSession.approved ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/20 px-3 py-1.5 rounded-lg shrink-0">
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} size={12} className="text-current" />
                  Approved
                </span>
              ) : (
                <button
                  onClick={() => approveSession(drillSession.id)}
                  className="text-xs text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-400/5 hover:bg-emerald-100 dark:hover:bg-emerald-400/10 px-3 py-1.5 rounded-lg transition-colors shrink-0"
                >
                  Approve
                </button>
              )}
            </div>

            {drillDetailLoad ? (
              <div className="flex items-center justify-center py-16">
                <span className="text-slate-400 dark:text-zinc-600 text-sm">Loading…</span>
              </div>
            ) : (
              <>
                {/* ── AI Analysis ── */}
                <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-amber-500 dark:text-amber-400 text-sm leading-none">✦</span>
                      <p className="text-slate-900 dark:text-white text-sm font-semibold">AI Analysis</p>
                      {drillSession.analyzedAt && (
                        <span className="text-slate-300 dark:text-zinc-700 text-[10px] font-mono">
                          {new Date(drillSession.analyzedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                        </span>
                      )}
                    </div>
                    {!drillSession.analysis && (
                      <button
                        onClick={generateAnalysis}
                        disabled={analysisLoading}
                        className="text-xs text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-400/5 hover:bg-amber-100 dark:hover:bg-amber-400/10 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {analysisLoading ? "Analyzing…" : "Generate Analysis"}
                      </button>
                    )}
                  </div>

                  {drillSession.analysis ? (
                    <>
                      <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-100 dark:border-zinc-800/50">
                        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/20 flex flex-col items-center justify-center shrink-0">
                          <span className="text-2xl font-mono font-bold text-amber-600 dark:text-amber-400 leading-none">
                            {drillSession.analysis.grade}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-baseline gap-1.5 mb-0.5">
                            <span className="text-3xl font-mono font-bold text-slate-900 dark:text-white">
                              {drillSession.analysis.score}
                            </span>
                            <span className="text-slate-400 dark:text-zinc-600 text-sm">/100</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-amber-400 dark:bg-amber-400 rounded-full"
                                style={{ width: `${drillSession.analysis.score}%` }}
                              />
                            </div>
                            <span className="text-slate-400 dark:text-zinc-600 text-xs">
                              {drillSession.analysis.productive_pct}% productive
                            </span>
                          </div>
                        </div>
                      </div>

                      <p className="text-slate-600 dark:text-zinc-400 text-sm leading-relaxed mb-4">
                        {drillSession.analysis.summary}
                      </p>

                      {drillSession.analysis.highlights.length > 0 && (
                        <div className="space-y-1.5 mb-3">
                          {drillSession.analysis.highlights.map((h, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="text-emerald-500 dark:text-emerald-400 text-xs font-bold mt-0.5 shrink-0">✓</span>
                              <span className="text-slate-600 dark:text-zinc-400 text-xs">{h}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {drillSession.analysis.concerns.length > 0 && (
                        <div className="space-y-1.5">
                          {drillSession.analysis.concerns.map((c, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="text-amber-500 dark:text-amber-400 text-xs font-bold mt-0.5 shrink-0">!</span>
                              <span className="text-slate-600 dark:text-zinc-400 text-xs">{c}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-slate-400 dark:text-zinc-600 text-sm text-center py-4">
                      {analysisLoading
                        ? "Generating analysis…"
                        : "Analysis is generated automatically when a session ends. Click Generate Analysis if this session is missing one."}
                    </p>
                  )}
                </div>

                {drillSummary && (
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-xl p-5">
                      <p className="text-slate-400 dark:text-zinc-600 text-[10px] uppercase tracking-wider mb-2">Total Time</p>
                      <p className="text-2xl font-mono font-bold text-slate-900 dark:text-white">{fmtDuration(drillSummary.totalSec)}</p>
                      <p className="text-slate-300 dark:text-zinc-700 text-xs mt-1">{drillSession.eventCount} events tracked</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-xl p-5">
                      <p className="text-slate-400 dark:text-zinc-600 text-[10px] uppercase tracking-wider mb-3">Categories</p>
                      <div className="space-y-1.5">
                        {Object.entries(drillSummary.categories)
                          .sort(([, a], [, b]) => b - a)
                          .slice(0, 4)
                          .map(([cat, sec]) => {
                            const c = catOf(cat)
                            return (
                              <div key={cat} className="flex items-center gap-2">
                                <span className="text-xs">{c.icon}</span>
                                <span className={`text-xs font-medium ${c.color}`}>{cat}</span>
                                <span className="text-slate-300 dark:text-zinc-700 text-xs ml-auto font-mono">{fmtDuration(sec)}</span>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  </div>
                )}

                {drillSummary && drillSummary.topDomains.length > 0 && (
                  <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 mb-6">
                    <p className="text-slate-400 dark:text-zinc-600 text-[10px] uppercase tracking-wider mb-3">Top Sites</p>
                    <div className="space-y-2">
                      {drillSummary.topDomains.map(({ domain, dwell }) => (
                        <div key={domain} className="flex items-center gap-3">
                          <span className="text-slate-700 dark:text-zinc-300 text-xs font-mono flex-1 truncate">{domain}</span>
                          <span className="text-slate-400 dark:text-zinc-600 text-xs font-mono shrink-0">{fmtDuration(dwell)}</span>
                          <div
                            className="h-1.5 bg-amber-400/40 dark:bg-amber-400/20 rounded-full shrink-0"
                            style={{ width: `${Math.max(20, Math.round((dwell / (drillSummary.topDomains[0]?.dwell || 1)) * 80))}px` }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {drillEvents.length > 0 && (
                  <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-200/80 dark:border-zinc-800/50 flex items-center justify-between">
                      <p className="text-slate-900 dark:text-white text-sm font-semibold">Activity Log</p>
                      <span className="text-slate-400 dark:text-zinc-600 text-xs font-mono">{drillEvents.length} visits</span>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-zinc-800/40 max-h-96 overflow-y-auto scrollbar-thin">
                      {drillEvents.map((ev, i) => {
                        const cat = catOf(ev.category)
                        return (
                          <div key={i} className="px-5 py-3 flex items-start gap-3">
                            <span className="font-mono text-[11px] text-slate-300 dark:text-zinc-700 w-11 shrink-0 tabular-nums pt-0.5">
                              {tsToTime(ev.ts)}
                            </span>
                            <span className="text-sm shrink-0">{cat.icon}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-slate-700 dark:text-zinc-300 text-xs font-medium truncate">
                                {ev.title || ev.domain || "—"}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[11px] font-medium ${cat.color}`}>{ev.category ?? "other"}</span>
                                {ev.domain && ev.title && (
                                  <>
                                    <span className="text-slate-200 dark:text-zinc-800 text-[11px]">·</span>
                                    <span className="text-slate-300 dark:text-zinc-700 text-[11px] font-mono truncate">{ev.domain}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            {typeof ev.dwell === "number" && ev.dwell > 0 && (
                              <span className="text-slate-300 dark:text-zinc-700 text-[11px] font-mono shrink-0 pt-0.5">
                                {fmtDuration(ev.dwell)}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Settings ── */}
        {!drillEmp && tab === "settings" && (
          <SettingsTab employees={employees} onSaved={fetchEmployees} />
        )}

        {/* ── Insights ── */}
        {!drillEmp && tab === "insights" && (
          <div className="p-8 max-w-5xl mx-auto w-full">

            {/* ── Employee list ── */}
            {!insightEmp && (
              <>
                <div className="mb-8">
                  <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Insights</h1>
                  <p className="text-slate-400 dark:text-zinc-500 text-sm mt-0.5">
                    AI-powered performance analysis for each team member
                  </p>
                </div>

                {employees.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                    <HugeiconsIcon icon={UserGroupIcon} size={32} className="text-slate-300 dark:text-zinc-700" />
                    <p className="text-slate-400 dark:text-zinc-600 text-sm">No employees yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {employees.map((emp, idx) => {
                      const ins = emp as Employee & { _insightsSummary?: InsightsSummary }
                      void ins
                      return (
                        <button
                          key={emp.id}
                          onClick={() => setInsightEmp(emp)}
                          className="text-left bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 hover:border-amber-400/50 dark:hover:border-amber-400/30 hover:shadow-md transition-all group"
                        >
                          <div className="flex items-start gap-3 mb-4">
                            <Avatar initials={emp.initials} idx={idx} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{emp.name}</p>
                              <p className="text-xs text-slate-400 dark:text-zinc-500 truncate">{emp.role || "—"}</p>
                            </div>
                            <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_CFG[emp.status].bg} ${STATUS_CFG[emp.status].text} ${STATUS_CFG[emp.status].border}`}>
                              {STATUS_CFG[emp.status].label}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-slate-300 dark:text-zinc-700">
                              <HugeiconsIcon icon={Analytics01Icon} size={28} className="text-current" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-500 dark:text-zinc-500">View performance analysis</p>
                              <p className="text-xs font-medium text-amber-500 dark:text-amber-400 group-hover:underline mt-0.5">
                                Open Insights →
                              </p>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {/* ── Employee detail ── */}
            {insightEmp && (
              <>
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                  <button
                    onClick={() => { setInsightEmp(null); setInsightData(null) }}
                    className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-600 hover:text-slate-600 dark:hover:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <HugeiconsIcon icon={ArrowLeft01Icon} size={14} className="text-current" />
                  </button>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar initials={insightEmp.initials} idx={employees.findIndex(e => e.id === insightEmp.id)} />
                    <div className="min-w-0">
                      <h1 className="text-xl font-semibold text-slate-900 dark:text-white truncate">{insightEmp.name}</h1>
                      <p className="text-slate-400 dark:text-zinc-500 text-xs">{insightEmp.role || "Employee"}</p>
                    </div>
                    {insightData?.insights?.trend && (
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        insightData.insights.trend === "improving" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-400" :
                        insightData.insights.trend === "declining" ? "bg-red-100 text-red-700 dark:bg-red-400/15 dark:text-red-400" :
                        "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}>
                        {insightData.insights.trend === "improving" ? "↑ Improving" :
                         insightData.insights.trend === "declining" ? "↓ Declining" : "→ Stable"}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={refreshInsightAnalysis}
                    disabled={insightRefresh}
                    className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <HugeiconsIcon icon={RefreshIcon} size={12} className={`text-current ${insightRefresh ? "animate-spin" : ""}`} />
                    {insightRefresh ? "Analysing…" : "Refresh Analysis"}
                  </button>
                </div>

                {insightLoading ? (
                  <div className="flex items-center justify-center py-24">
                    <span className="text-slate-400 dark:text-zinc-600 text-sm">Loading insights…</span>
                  </div>
                ) : insightData && (
                  <div className="space-y-6">

                    {/* Stat cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      {[
                        {
                          label: "Total Sessions",
                          value: insightData.stats.totalSessions.toString(),
                          sub: `${insightData.recentSessions.filter(s => s.analysis).length} analyzed`,
                        },
                        {
                          label: "Avg Productivity",
                          value: insightData.insights ? `${insightData.insights.avgProductivePct}%` : "—",
                          sub: insightData.insights ? `${insightData.insights.sessionCount} sessions` : "No data yet",
                        },
                        {
                          label: "Peak Hours",
                          value: insightData.insights?.peakHoursLabel || "—",
                          sub: "Most productive window",
                        },
                        {
                          label: "Avg Session",
                          value: insightData.stats.avgSessionSec > 0 ? fmtDuration(insightData.stats.avgSessionSec) : "—",
                          sub: `${Math.round(insightData.stats.avgSessionSec / 60)}m avg work time`,
                        },
                      ].map((card) => (
                        <div key={card.label} className="bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 rounded-xl p-4">
                          <p className="text-[10px] text-slate-400 dark:text-zinc-600 uppercase tracking-wider mb-1">{card.label}</p>
                          <p className="text-xl font-bold text-slate-900 dark:text-white">{card.value}</p>
                          <p className="text-[11px] text-slate-400 dark:text-zinc-600 mt-0.5">{card.sub}</p>
                        </div>
                      ))}
                    </div>

                    {/* AI Insights */}
                    {insightData.insights?.headline ? (
                      <div className="bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <HugeiconsIcon icon={AiBrain01Icon} size={16} className="text-amber-500 dark:text-amber-400" />
                          <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">AI Pattern Analysis</span>
                          {insightData.updatedAt && (
                            <span className="ml-auto text-[10px] text-slate-300 dark:text-zinc-700">
                              Updated {new Date(insightData.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white mb-3">{insightData.insights.headline}</p>
                        <div className="space-y-2">
                          {insightData.insights.insights?.map((insight, i) => (
                            <div key={i} className="flex items-start gap-2.5">
                              <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-400/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                              <p className="text-sm text-slate-600 dark:text-zinc-400">{insight}</p>
                            </div>
                          ))}
                        </div>
                        {insightData.insights.anomalies?.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-2">
                            {insightData.insights.anomalies.map((a, i) => (
                              <div key={i} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                                <HugeiconsIcon icon={AlertCircleIcon} size={14} className="text-current shrink-0 mt-0.5" />
                                <span>{a}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-slate-50 dark:bg-zinc-900/30 border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl p-6 text-center">
                        <HugeiconsIcon icon={AiBrain01Icon} size={24} className="text-slate-300 dark:text-zinc-700 mx-auto mb-2" />
                        <p className="text-sm text-slate-500 dark:text-zinc-500">No AI pattern insights yet</p>
                        <p className="text-xs text-slate-400 dark:text-zinc-600 mt-1">Needs at least 2 sessions with AI analysis. Click "Refresh Analysis" to generate.</p>
                      </div>
                    )}

                    {/* Fatigue + Day of Week */}
                    {insightData.insights && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Fatigue profile */}
                        <div className="bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 rounded-xl p-5">
                          <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Session Fatigue Profile</p>
                          <p className="text-xs text-slate-400 dark:text-zinc-600 mb-4">Productivity across thirds of each work session</p>
                          {insightData.insights.fatigueFlag && (
                            <div className="flex items-center gap-1.5 mb-3 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-400/10 px-3 py-1.5 rounded-lg">
                              <HugeiconsIcon icon={AlertCircleIcon} size={12} className="text-current" />
                              Significant energy drop detected in later sessions
                            </div>
                          )}
                          {(["Early", "Mid", "Late"] as const).map((label, i) => {
                            const pct = [
                              insightData.insights!.fatigueProfile.earlyPct,
                              insightData.insights!.fatigueProfile.midPct,
                              insightData.insights!.fatigueProfile.latePct,
                            ][i]
                            const barColor = pct >= 70 ? "bg-emerald-400" : pct >= 50 ? "bg-amber-400" : "bg-red-400"
                            return (
                              <div key={label} className="mb-3">
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-slate-600 dark:text-zinc-400">{label} session</span>
                                  <span className="font-mono text-slate-500 dark:text-zinc-500">{pct}%</span>
                                </div>
                                <div className="h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                  <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            )
                          })}
                          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-zinc-500">
                            <div>Context switches: <span className="font-mono text-slate-700 dark:text-zinc-300">{insightData.insights.avgContextSwitches}/hr</span></div>
                            <div>Warm-up time: <span className="font-mono text-slate-700 dark:text-zinc-300">{insightData.insights.avgWarmupMin}m</span></div>
                          </div>
                        </div>

                        {/* Day of week */}
                        <div className="bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 rounded-xl p-5">
                          <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Day of Week</p>
                          <p className="text-xs text-slate-400 dark:text-zinc-600 mb-4">Average productivity by weekday</p>
                          <div className="space-y-2.5">
                            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day, d) => {
                              const entry = insightData.insights!.dayOfWeek.find(x => x.day === d)
                              const pct   = entry?.productivePct ?? 0
                              const count = entry?.count ?? 0
                              if (count === 0) return null
                              const barColor = pct >= 70 ? "bg-emerald-400" : pct >= 50 ? "bg-amber-400" : "bg-red-400"
                              return (
                                <div key={day} className="flex items-center gap-3">
                                  <span className="text-xs text-slate-500 dark:text-zinc-500 w-7 shrink-0">{day}</span>
                                  <div className="flex-1 h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                    <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-xs font-mono text-slate-500 dark:text-zinc-500 w-8 text-right">{pct}%</span>
                                  <span className="text-[10px] text-slate-300 dark:text-zinc-700 w-10">{count}×</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Recent sessions */}
                    <div className="bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                      <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">Recent Sessions</p>
                        <span className="text-xs text-slate-400 dark:text-zinc-600">Last {insightData.recentSessions.length}</span>
                      </div>
                      {insightData.recentSessions.length === 0 ? (
                        <div className="px-5 py-8 text-center text-sm text-slate-400 dark:text-zinc-600">No sessions yet</div>
                      ) : (
                        <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                          {insightData.recentSessions.map((s) => {
                            const analysis = s.analysis as SessionAnalysis | null
                            return (
                              <div key={s.id} className="px-5 py-3 flex items-center gap-4">
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                                    {fmtSessionDate(s.clockIn)}
                                    <span className="font-normal text-slate-400 dark:text-zinc-600 ml-2">{fmtTimeRange(s.clockIn, s.clockOut)}</span>
                                  </p>
                                  <p className="text-[11px] text-slate-400 dark:text-zinc-600 mt-0.5">
                                    {s.durationSec ? fmtDuration(s.durationSec) : "Ongoing"} · {s.eventCount} events
                                  </p>
                                </div>
                                {analysis ? (
                                  <div className="flex items-center gap-3 shrink-0">
                                    <ScoreRing score={analysis.score} size={44} />
                                    <div>
                                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${gradeColor(analysis.grade)}`}>
                                        {analysis.grade}
                                      </span>
                                      <p className="text-[10px] text-slate-400 dark:text-zinc-600 mt-1">{analysis.productive_pct}% productive</p>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-slate-300 dark:text-zinc-700 shrink-0">Not analyzed</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Anomaly flags */}
                    {insightData.anomalies.length > 0 && (
                      <div className="bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2">
                          <HugeiconsIcon icon={AlertCircleIcon} size={14} className="text-red-500 dark:text-red-400" />
                          <p className="text-sm font-semibold text-slate-800 dark:text-white">Anomaly Flags</p>
                          <span className="ml-auto text-xs font-mono bg-red-100 dark:bg-red-400/15 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full">
                            {insightData.anomalies.length} unresolved
                          </span>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                          {insightData.anomalies.map((flag) => (
                            <div key={flag.id} className="px-5 py-3 flex items-start gap-3">
                              <span className={`shrink-0 mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                                flag.severity === "high"   ? "bg-red-100 text-red-700 dark:bg-red-400/15 dark:text-red-400" :
                                flag.severity === "medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-400" :
                                "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400"
                              }`}>
                                {flag.severity}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-slate-700 dark:text-zinc-300">{flag.signal.replace(/_/g, " ")}</p>
                                <p className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">{flag.message}</p>
                              </div>
                              <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-500`}>
                                {flag.stream}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </>
            )}

          </div>
        )}

      </main>

      {/* ── Monitor panel ───────────────────────────────────────────────────── */}
      <MonitorPanel
        employee={monitorEmployee}
        idx={monitorIdx >= 0 ? monitorIdx : 0}
        onClose={() => setMonitorIdx(-1)}
      />

      {/* ── Invite modal ────────────────────────────────────────────────────── */}
      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvited={fetchEmployees}
        />
      )}

      {/* ── Onboarding modal ────────────────────────────────────────────────── */}
      {showOnboarding && (
        <OnboardingModal
          adminName={adminName}
          onDone={() => setShowOnboarding(false)}
          onInvite={() => { setShowOnboarding(false); setShowInvite(true) }}
        />
      )}
    </div>
  )
}
