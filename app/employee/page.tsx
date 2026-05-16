"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Clock01Icon,
  PlayIcon,
  PauseIcon,
  Logout01Icon,
  Activity01Icon,
  CheckmarkCircle01Icon,
  Calendar01Icon,
  ArrowLeft01Icon,
  ClockCheckIcon,
  WifiOff01Icon,
  Home01Icon,
  ArrowRight01Icon,
  UserCircleIcon,
  BankIcon,
  Edit01Icon,
  FloppyDiskIcon,
  Cancel01Icon,
  InformationCircleIcon,
  Coffee01Icon,
  RefreshIcon,
  Analytics01Icon,
  AiBrain01Icon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons"
import { ThemeToggle } from "@/components/theme-toggle"
import { NIGERIAN_BANKS } from "@/lib/banks"

// ── Types ──────────────────────────────────────────────────────────────────────

type SessionState = "idle" | "active" | "clocked-out"
type View = "dashboard" | "sessions" | "session-detail" | "profile" | "insights"

interface ActivityEvent {
  type: string
  url?: string
  domain?: string
  title?: string
  category?: string
  dwell?: number
  ts: number
}
interface DaySummary {
  totalSec: number
  categories: Record<string, number>
  topDomains: Array<{ domain: string; dwell: number }>
  eventCount: number
}
interface Me {
  name: string
  email: string
  apiId: string
}
interface SessionRecord {
  id: string
  clockIn: string
  clockOut: string | null
  approved: boolean
  eventCount: number
  durationSec: number | null
}
interface EmployeeProfile {
  id: string
  name: string
  email: string | null
  role: string | null
  hourlyRate: number | null
  breakMinPerDay: number
  bankCode: string | null
  bankName: string | null
  accountNumber: string | null
  accountName: string | null
  bankVerified: boolean
}

// ── Category map ───────────────────────────────────────────────────────────────

const CAT: Record<
  string,
  { icon: string; color: string; bar: string; label: string }
> = {
  development: {
    icon: "💻",
    color: "text-violet-600 dark:text-violet-400",
    bar: "bg-violet-500",
    label: "Development",
  },
  design: {
    icon: "🎨",
    color: "text-pink-600 dark:text-pink-400",
    bar: "bg-pink-500",
    label: "Design",
  },
  meetings: {
    icon: "📹",
    color: "text-emerald-600 dark:text-emerald-400",
    bar: "bg-emerald-500",
    label: "Meetings",
  },
  comms: {
    icon: "💬",
    color: "text-blue-600 dark:text-blue-400",
    bar: "bg-blue-500",
    label: "Comms",
  },
  docs: {
    icon: "📄",
    color: "text-sky-600 dark:text-sky-400",
    bar: "bg-sky-500",
    label: "Docs",
  },
  pm: {
    icon: "📋",
    color: "text-amber-600 dark:text-amber-400",
    bar: "bg-amber-500",
    label: "PM",
  },
  research: {
    icon: "🔍",
    color: "text-cyan-600 dark:text-cyan-400",
    bar: "bg-cyan-500",
    label: "Research",
  },
  off_task: {
    icon: "⚡",
    color: "text-red-500 dark:text-red-400",
    bar: "bg-red-500",
    label: "Off-task",
  },
  other: {
    icon: "🌐",
    color: "text-slate-500 dark:text-zinc-400",
    bar: "bg-slate-400",
    label: "Other",
  },
}

function catOf(c?: string) {
  return CAT[c ?? "other"] ?? CAT.other
}

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmtSec(s: number) {
  const h = Math.floor(s / 3600)
    .toString()
    .padStart(2, "0")
  const m = Math.floor((s % 3600) / 60)
    .toString()
    .padStart(2, "0")
  const sec = (s % 60).toString().padStart(2, "0")
  return `${h}:${m}:${sec}`
}
function fmtDuration(sec: number) {
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m`
  const h = Math.floor(sec / 3600),
    m = Math.floor((sec % 3600) / 60)
  return m ? `${h}h ${m}m` : `${h}h`
}
function tsToTime(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}
function isoToClockStr(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}
function isoToShortTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}
function getGreeting() {
  const h = new Date().getHours()
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
}
function avatarInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
}

// ── Session grouping ───────────────────────────────────────────────────────────

function groupLabel(iso: string) {
  const d = new Date(iso),
    today = new Date(),
    yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return "Today"
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday"
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
}
function groupSessions(sessions: SessionRecord[]) {
  const groups: { label: string; items: SessionRecord[] }[] = []
  for (const s of sessions) {
    const label = groupLabel(s.clockIn)
    const last = groups[groups.length - 1]
    if (last?.label === label) last.items.push(s)
    else groups.push({ label, items: [s] })
  }
  return groups
}

const POLL_MS = 3_000

// ── Insights types ─────────────────────────────────────────────────────────────

interface InsightsSummary {
  sessionCount: number
  avgProductivePct: number
  peakHours: Array<{ hour: number; productiveSec: number }>
  fatigueProfile: { earlyPct: number; midPct: number; latePct: number }
  avgContextSwitches: number
  avgFocusDepthSec: number
  avgWarmupMin: number
  dayOfWeek: Array<{ day: number; productivePct: number; count: number }>
  trend: "improving" | "stable" | "declining"
  headline: string
  insights: string[]
  peakHoursLabel: string
  fatigueFlag: boolean
  anomalies: string[]
}

// ── Insights View ──────────────────────────────────────────────────────────────

function InsightsView() {
  const [data, setData] = useState<InsightsSummary | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/employee/insights")
      .then((r) => r.json())
      .then((d) => {
        setData(d.insights)
        setUpdatedAt(d.updatedAt)
      })
      .finally(() => setLoading(false))
  }, [])

  const fmtUpdated = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH}h ago`
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  const fmtHour = (h: number) => {
    const ampm = h >= 12 ? "pm" : "am"
    return `${h % 12 || 12}${ampm}`
  }

  const TREND_CFG = {
    improving: {
      label: "Improving",
      color: "text-emerald-600 dark:text-emerald-400",
      dot: "bg-emerald-400",
    },
    stable: {
      label: "Stable",
      color: "text-slate-500 dark:text-zinc-400",
      dot: "bg-slate-400",
    },
    declining: {
      label: "Declining",
      color: "text-red-500 dark:text-red-400",
      dot: "bg-red-400",
    },
  }

  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" />
      </div>
    )
  }

  if (!data || data.sessionCount < 2) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 px-6 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-400/20 dark:bg-amber-400/10">
          <HugeiconsIcon
            icon={AiBrain01Icon}
            size={28}
            className="text-amber-500 dark:text-amber-400"
          />
        </div>
        <div>
          <p className="mb-1 text-lg font-semibold text-slate-900 dark:text-white">
            Not enough data yet
          </p>
          <p className="mx-auto max-w-xs text-sm leading-relaxed text-slate-500 dark:text-zinc-500">
            Complete at least 2 sessions and your AI work pattern insights will
            appear here.
          </p>
        </div>
      </div>
    )
  }

  const trend = TREND_CFG[data.trend]

  // Build hour chart: work hours 6–22, sorted by time
  const hourMap = Object.fromEntries(
    data.peakHours.map((h) => [h.hour, h.productiveSec])
  )
  const workHours = Array.from({ length: 17 }, (_, i) => i + 6) // 6am–10pm
  const maxHourSec = Math.max(...workHours.map((h) => hourMap[h] ?? 0), 1)

  // Fatigue bars
  const fatigueItems = [
    { label: "Session start", pct: data.fatigueProfile.earlyPct },
    { label: "Mid-session", pct: data.fatigueProfile.midPct },
    { label: "Session end", pct: data.fatigueProfile.latePct },
  ]

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Work Patterns
          </h2>
          <p className="mt-0.5 text-xs text-slate-400 dark:text-zinc-500">
            {data.sessionCount} sessions analysed · last 30 days
          </p>
        </div>
        {updatedAt && (
          <span className="font-mono text-xs text-slate-300 dark:text-zinc-700">
            {fmtUpdated(updatedAt)}
          </span>
        )}
      </div>

      {/* AI Headline */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-400/15 dark:bg-amber-400/5">
        <div className="mb-2 flex items-center gap-2">
          <HugeiconsIcon
            icon={AiBrain01Icon}
            size={14}
            className="text-amber-500 dark:text-amber-400"
          />
          <span className="text-[10px] font-semibold tracking-wider text-amber-600 uppercase dark:text-amber-400">
            AI Summary
          </span>
        </div>
        <p className="text-sm leading-relaxed font-medium text-slate-800 dark:text-zinc-200">
          {data.headline}
        </p>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Avg Productivity", value: `${data.avgProductivePct}%` },
          {
            label: "Peak Hours",
            value:
              data.peakHoursLabel ||
              (data.peakHours[0] ? fmtHour(data.peakHours[0].hour) : "—"),
          },
          { label: "Trend", value: trend.label, color: trend.color },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
          >
            <p className="mb-1 text-[10px] tracking-wider text-slate-400 uppercase dark:text-zinc-600">
              {label}
            </p>
            <p
              className={`font-mono text-sm font-semibold ${color ?? "text-slate-800 dark:text-zinc-200"}`}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Peak hours chart */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="flex items-center gap-2 border-b border-slate-200/80 px-5 py-3.5 dark:border-zinc-800/50">
          <HugeiconsIcon
            icon={Analytics01Icon}
            size={15}
            className="text-slate-400 dark:text-zinc-600"
          />
          <span className="text-sm font-medium text-slate-600 dark:text-zinc-400">
            Productive Hours
          </span>
        </div>
        <div className="px-5 py-4">
          <div className="flex h-16 items-end gap-1">
            {workHours.map((h) => {
              const sec = hourMap[h] ?? 0
              const pct = Math.round((sec / maxHourSec) * 100)
              const isTop = sec > 0 && pct >= 60
              return (
                <div
                  key={h}
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <div
                    className="flex w-full items-end justify-center"
                    style={{ height: "48px" }}
                  >
                    <div
                      className={`w-full rounded-t-sm transition-all ${isTop ? "bg-amber-400 dark:bg-amber-400" : sec > 0 ? "bg-amber-200 dark:bg-amber-400/30" : "bg-slate-100 dark:bg-zinc-800/40"}`}
                      style={{ height: `${Math.max(pct, sec > 0 ? 8 : 2)}%` }}
                    />
                  </div>
                  {h % 3 === 0 && (
                    <span className="font-mono text-[9px] text-slate-300 dark:text-zinc-700">
                      {fmtHour(h)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Fatigue curve */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="flex items-center gap-2 border-b border-slate-200/80 px-5 py-3.5 dark:border-zinc-800/50">
          <HugeiconsIcon
            icon={Activity01Icon}
            size={15}
            className="text-slate-400 dark:text-zinc-600"
          />
          <span className="text-sm font-medium text-slate-600 dark:text-zinc-400">
            Energy Profile
          </span>
          {data.fatigueFlag && (
            <span className="ml-auto flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-600 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-400">
              <HugeiconsIcon
                icon={AlertCircleIcon}
                size={9}
                className="text-current"
              />
              Fatigue detected
            </span>
          )}
        </div>
        <div className="space-y-3.5 p-5">
          {fatigueItems.map(({ label, pct }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-sm text-slate-500 dark:text-zinc-500">
                {label}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800/80">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all dark:bg-amber-400"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
                {pct}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Day of week */}
      {data.dayOfWeek.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="mb-3 text-sm font-medium text-slate-700 dark:text-zinc-400">
            Best Days
          </p>
          <div className="flex h-14 items-end gap-2">
            {data.dayOfWeek.map(({ day, productivePct }) => {
              const maxDow = Math.max(
                ...data.dayOfWeek.map((d) => d.productivePct),
                1
              )
              const h = Math.round((productivePct / maxDow) * 100)
              const isTop = productivePct === maxDow
              return (
                <div
                  key={day}
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <div
                    className="flex w-full items-end justify-center"
                    style={{ height: "40px" }}
                  >
                    <div
                      className={`w-full rounded-t-sm ${isTop ? "bg-amber-400" : "bg-slate-200 dark:bg-zinc-700"}`}
                      style={{ height: `${Math.max(h, 8)}%` }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-slate-400 dark:text-zinc-600">
                    {DOW[day]}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* AI Insights */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="flex items-center gap-2 border-b border-slate-200/80 px-5 py-3.5 dark:border-zinc-800/50">
          <span className="text-sm leading-none text-amber-500 dark:text-amber-400">
            ✦
          </span>
          <span className="text-sm font-medium text-slate-600 dark:text-zinc-400">
            AI Insights
          </span>
        </div>
        <div className="space-y-3 p-5">
          {data.insights.map((insight, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-50 text-[10px] font-bold text-amber-600 dark:bg-amber-400/10 dark:text-amber-400">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                {insight}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Anomalies */}
      {data.anomalies.length > 0 && (
        <div className="space-y-2.5 rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-400/15 dark:bg-red-400/5">
          <div className="mb-1 flex items-center gap-2">
            <HugeiconsIcon
              icon={AlertCircleIcon}
              size={14}
              className="text-red-500 dark:text-red-400"
            />
            <span className="text-xs font-semibold tracking-wider text-red-600 uppercase dark:text-red-400">
              Flagged Patterns
            </span>
          </div>
          {data.anomalies.map((a, i) => (
            <p
              key={i}
              className="text-sm leading-relaxed text-slate-600 dark:text-zinc-400"
            >
              {a}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Profile View ───────────────────────────────────────────────────────────────

function ProfileView({ me }: { me: Me | null }) {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // Bank edit state
  const [editing, setEditing] = useState(false)
  const [bankCode, setBankCode] = useState("")
  const [accountNumber, setAccountNum] = useState("")
  const [verifiedName, setVerifiedName] = useState("")
  const [verifyStatus, setVerifyStatus] = useState<
    "idle" | "verifying" | "verified" | "error" | "manual"
  >("idle")
  const [verifyErr, setVerifyErr] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState("")

  const fetchProfile = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/employee/profile")
      if (res.ok) setProfile(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const startEdit = () => {
    if (!profile) return
    setBankCode(profile.bankCode ?? "")
    setAccountNum(profile.accountNumber ?? "")
    setVerifiedName(profile.bankVerified ? (profile.accountName ?? "") : "")
    setVerifyStatus(profile.bankVerified ? "verified" : "idle")
    setVerifyErr("")
    setSaveErr("")
    setEditing(true)
  }

  const handleVerify = async () => {
    if (!bankCode || accountNumber.length !== 10) {
      setVerifyErr("Enter a valid 10-digit account number and select a bank.")
      return
    }
    setVerifyStatus("verifying")
    setVerifyErr("")
    try {
      const res = await fetch("/api/employee/bank/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankCode, accountNumber }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.manualFallback) {
          setVerifyErr(
            "Auto-verify unavailable in sandbox — enter your account name manually below."
          )
          setVerifyStatus("manual")
        } else {
          setVerifyErr(data.error)
          setVerifyStatus("error")
        }
        return
      }
      setVerifiedName(data.accountName)
      setVerifyStatus("verified")
    } catch {
      setVerifyErr("Network error. Check your connection.")
      setVerifyStatus("error")
    }
  }

  const handleSave = async () => {
    if (verifyStatus !== "verified" && verifyStatus !== "manual") return
    if (verifyStatus === "manual" && verifiedName.trim().length < 3) return
    setSaving(true)
    setSaveErr("")
    try {
      const selectedBank = NIGERIAN_BANKS.find((b) => b.code === bankCode)
      const res = await fetch("/api/employee/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankCode,
          bankName: selectedBank?.name ?? "",
          accountNumber,
          accountName: verifiedName,
          bankVerified: true,
        }),
      })
      if (!res.ok) {
        setSaveErr("Failed to save. Try again.")
        return
      }
      await fetchProfile()
      setEditing(false)
    } catch {
      setSaveErr("Network error.")
    } finally {
      setSaving(false)
    }
  }

  const input =
    "w-full bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 rounded-lg px-3.5 py-2.5 text-slate-900 dark:text-white text-sm placeholder-slate-300 dark:placeholder-zinc-600 outline-none transition-all"

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" />
      </div>
    )
  }

  if (!profile) return null

  const hourlyRateFmt =
    profile.hourlyRate != null
      ? `₦${profile.hourlyRate.toLocaleString("en-NG")}/hr`
      : "Not set"

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-6 py-8">
      {/* Identity */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="mb-5 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-50 dark:border-amber-400/20 dark:bg-amber-400/10">
            <span className="font-mono text-lg font-bold text-amber-600 dark:text-amber-400">
              {me ? avatarInitials(me.name) : "…"}
            </span>
          </div>
          <div>
            <p className="text-base font-semibold text-slate-900 dark:text-white">
              {profile.name}
            </p>
            <p className="text-sm text-slate-400 dark:text-zinc-500">
              {profile.email ?? "—"}
            </p>
            {profile.role && (
              <p className="mt-0.5 text-xs text-slate-400 dark:text-zinc-600">
                {profile.role}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Hourly Rate", value: hourlyRateFmt },
            { label: "Break / Day", value: `${profile.breakMinPerDay} min` },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-xl bg-slate-50 p-4 dark:bg-zinc-800/40"
            >
              <p className="mb-1 text-[10px] tracking-wider text-slate-400 uppercase dark:text-zinc-600">
                {label}
              </p>
              <p className="font-mono text-sm font-semibold text-slate-800 dark:text-zinc-200">
                {value}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-3 flex items-center gap-1 text-xs text-slate-300 dark:text-zinc-700">
          <HugeiconsIcon
            icon={InformationCircleIcon}
            size={11}
            className="shrink-0 text-current"
          />
          Rate and break duration are set by your admin.
        </p>
      </div>

      {/* Bank Details */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HugeiconsIcon
              icon={BankIcon}
              size={16}
              className="text-slate-400 dark:text-zinc-500"
            />
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Bank Details
            </p>
            {profile.bankVerified && !editing && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400">
                <HugeiconsIcon
                  icon={CheckmarkCircle01Icon}
                  size={9}
                  className="text-current"
                />
                Verified
              </span>
            )}
          </div>
          {!editing && (
            <button
              onClick={startEdit}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 dark:border-zinc-800 dark:text-zinc-500 dark:hover:border-zinc-700 dark:hover:text-zinc-300"
            >
              <HugeiconsIcon
                icon={Edit01Icon}
                size={12}
                className="text-current"
              />
              {profile.bankVerified ? "Edit" : "Set up"}
            </button>
          )}
        </div>

        {!editing ? (
          profile.bankVerified ? (
            <div className="space-y-3">
              {[
                { label: "Bank", value: profile.bankName ?? "—" },
                {
                  label: "Account Number",
                  value: profile.accountNumber ?? "—",
                },
                { label: "Account Name", value: profile.accountName ?? "—" },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex items-center justify-between border-b border-slate-100 py-2.5 last:border-0 dark:border-zinc-800/60"
                >
                  <span className="text-xs text-slate-400 dark:text-zinc-600">
                    {label}
                  </span>
                  <span className="font-mono text-sm text-slate-700 dark:text-zinc-300">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-zinc-800">
                <HugeiconsIcon
                  icon={BankIcon}
                  size={20}
                  className="text-slate-400 dark:text-zinc-500"
                />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-zinc-400">
                  No bank details yet
                </p>
                <p className="mt-0.5 text-xs text-slate-400 dark:text-zinc-600">
                  Required to receive salary payments
                </p>
              </div>
              <button
                onClick={startEdit}
                className="text-xs text-amber-600 hover:underline dark:text-amber-400"
              >
                Add bank details →
              </button>
            </div>
          )
        ) : (
          <div className="space-y-4">
            {/* Bank select */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-zinc-500">
                Bank
              </label>
              <select
                value={bankCode}
                onChange={(e) => {
                  setBankCode(e.target.value)
                  setVerifyStatus("idle")
                  setVerifiedName("")
                }}
                className={input}
              >
                <option value="">Select bank…</option>
                {NIGERIAN_BANKS.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Account number */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-zinc-500">
                Account Number
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={accountNumber}
                  onChange={(e) => {
                    setAccountNum(e.target.value.replace(/\D/g, ""))
                    setVerifyStatus("idle")
                    setVerifiedName("")
                  }}
                  placeholder="10-digit NUBAN"
                  className={`${input} flex-1`}
                />
                <button
                  onClick={handleVerify}
                  disabled={
                    verifyStatus === "verifying" ||
                    !bankCode ||
                    accountNumber.length !== 10
                  }
                  className="shrink-0 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-40 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
                >
                  {verifyStatus === "verifying" ? "…" : "Verify"}
                </button>
              </div>
            </div>

            {/* Verified name */}
            {verifyStatus === "verified" && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 dark:border-emerald-400/20 dark:bg-emerald-400/10">
                <HugeiconsIcon
                  icon={CheckmarkCircle01Icon}
                  size={14}
                  className="shrink-0 text-emerald-500 dark:text-emerald-400"
                />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  {verifiedName}
                </span>
              </div>
            )}

            {/* Manual fallback when Squad payout not enabled on sandbox */}
            {verifyStatus === "manual" && (
              <div className="space-y-2">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {verifyErr}
                </p>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-zinc-500">
                    Account Name
                  </label>
                  <input
                    type="text"
                    value={verifiedName}
                    onChange={(e) => setVerifiedName(e.target.value)}
                    placeholder="e.g. JOHN DOE"
                    className={input}
                  />
                </div>
                {verifiedName.trim().length > 2 && (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 dark:border-emerald-400/20 dark:bg-emerald-400/10">
                    <HugeiconsIcon
                      icon={CheckmarkCircle01Icon}
                      size={14}
                      className="shrink-0 text-emerald-500 dark:text-emerald-400"
                    />
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      {verifiedName}
                    </span>
                  </div>
                )}
              </div>
            )}

            {verifyStatus === "error" && verifyErr && (
              <p className="text-xs text-red-500">{verifyErr}</p>
            )}

            {saveErr && <p className="text-xs text-red-500">{saveErr}</p>}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setEditing(false)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-500 transition-colors hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-500 dark:hover:bg-zinc-800/40"
              >
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  size={13}
                  className="text-current"
                />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={
                  (verifyStatus !== "verified" &&
                    !(
                      verifyStatus === "manual" &&
                      verifiedName.trim().length >= 3
                    )) ||
                  saving
                }
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-300 disabled:opacity-40"
              >
                <HugeiconsIcon
                  icon={FloppyDiskIcon}
                  size={13}
                  className="text-current"
                />
                {saving ? "Saving…" : "Save Bank Details"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function EmployeePage() {
  const router = useRouter()

  // ── Identity ────────────────────────────────────────────────────────────
  const [me, setMe] = useState<Me | null>(null)

  // ── Current session ─────────────────────────────────────────────────────
  const [state, setState] = useState<SessionState>("idle")
  const [clockInMs, setClockInMs] = useState(0)
  const [clockInTimeStr, setClockInTimeStr] = useState("")
  const [now, setNow] = useState<Date>(new Date())
  const [sessionId, setSessionId] = useState("")
  const [activities, setActivities] = useState<ActivityEvent[]>([])
  const [sessionEvents, setSessionEvents] = useState<ActivityEvent[]>([])
  const [summary, setSummary] = useState<DaySummary | null>(null)
  const [fetching, setFetching] = useState(false)
  const [finalElapsed, setFinalElapsed] = useState(0)
  const clockInEpochRef = useRef<number>(0)
  const sessionIdRef = useRef<string>("")

  // ── Break state ──────────────────────────────────────────────────────────
  const [onBreak, setOnBreak] = useState(false)
  const [breakStartedMs, setBreakStartedMs] = useState(0)
  const [breakUsedSec, setBreakUsedSec] = useState(0)
  const [breakMinPerDay, setBreakMinPerDay] = useState(60)
  const [breakLoading, setBreakLoading] = useState(false)
  const [clockingOut, setClockingOut] = useState(false)

  // ── Extension connectivity ───────────────────────────────────────────────
  // null = still checking, true = connected, false = not installed/connected
  const [extConnected, setExtConnected] = useState<boolean | null>(null)

  // ── Navigation ──────────────────────────────────────────────────────────
  const [view, setView] = useState<View>("dashboard")
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [selectedSession, setSelectedSession] = useState<SessionRecord | null>(
    null
  )
  const [detailSummary, setDetailSummary] = useState<DaySummary | null>(null)
  const [detailEvents, setDetailEvents] = useState<ActivityEvent[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const currentBreakSec =
    onBreak && breakStartedMs > 0
      ? Math.floor((now.getTime() - breakStartedMs) / 1000)
      : 0
  const totalBreakSec = breakUsedSec + currentBreakSec
  const elapsed =
    state === "active" && clockInMs > 0
      ? Math.max(
          0,
          Math.floor((now.getTime() - clockInMs) / 1000) - totalBreakSec
        )
      : 0
  const breakRemainSec = Math.max(0, breakMinPerDay * 60 - totalBreakSec)

  // ── Tick ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // ── Bootstrap ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => {
        if (!r.ok) {
          router.push("/login?from=/employee")
          return null
        }
        return r.json()
      })
      .then(async (d) => {
        if (!d) return
        const user: Me = { name: d.name, email: d.email, apiId: d.apiId }
        setMe(user)
        if (user.apiId) {
          if (!localStorage.getItem("trackr_extension_token"))
            localStorage.setItem("trackr_extension_token", crypto.randomUUID())
          localStorage.setItem("trackr_employee_id", user.apiId)
          localStorage.setItem("trackr_employee_name", user.name)
          window.dispatchEvent(new CustomEvent("trackr:auth_changed"))
        }
        const sr = await fetch("/api/sessions/active")
        if (!sr.ok) return
        const { session } = await sr.json()
        if (session)
          restoreSession(session.id, session.clockIn, {
            breakStartedAt: session.breakStartedAt,
            breakUsedSec: session.breakUsedSec,
            breakMinPerDay: session.breakMinPerDay,
          })
      })
      .catch(() => router.push("/login?from=/employee"))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // ── Extension events ─────────────────────────────────────────────────────
  useEffect(() => {
    const onIn = (e: Event) => {
      const { sessionId: sid, clockInTime } = (e as CustomEvent).detail ?? {}
      if (sid && clockInTime) restoreSession(sid, clockInTime)
    }
    const onOut = () => {
      setFinalElapsed(
        clockInMs > 0 ? Math.floor((Date.now() - clockInMs) / 1000) : 0
      )
      setState("clocked-out")
      localStorage.removeItem("trackr_session_id")
      localStorage.removeItem("trackr_clock_in_time")
    }
    window.addEventListener("trackr:ext_clocked_in", onIn)
    window.addEventListener("trackr:ext_clocked_out", onOut)
    return () => {
      window.removeEventListener("trackr:ext_clocked_in", onIn)
      window.removeEventListener("trackr:ext_clocked_out", onOut)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Extension connectivity detection ─────────────────────────────────────
  // Content script sets data-trackr-ext="1" on <html> the instant it loads.
  // MutationObserver catches it if the content script loads after this effect.
  useEffect(() => {
    const check = () => document.documentElement.hasAttribute('data-trackr-ext')

    if (check()) {
      setExtConnected(true)
      return
    }

    const observer = new MutationObserver(() => {
      if (check()) {
        setExtConnected(true)
        observer.disconnect()
        clearTimeout(fallback)
      }
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-trackr-ext'],
    })

    const fallback = setTimeout(() => {
      observer.disconnect()
      if (!check()) setExtConnected(false)
    }, 2000)

    return () => {
      observer.disconnect()
      clearTimeout(fallback)
    }
  }, [])

  // ── Live activity poll ───────────────────────────────────────────────────
  useEffect(() => {
    if (state !== "active" || !me) return
    const poll = async () => {
      try {
        setFetching(true)
        const sid = sessionIdRef.current
          ? `&sessionId=${sessionIdRef.current}`
          : ""
        const res = await fetch(
          `/api/extension/activity?since=${clockInEpochRef.current}${sid}`
        )
        if (res.ok) {
          const data = await res.json()
          setActivities(
            (data.events ?? []).filter(
              (e: ActivityEvent) =>
                e.type === "tab_visit" || e.type === "meeting_active"
            )
          )
        }
      } finally {
        setFetching(false)
      }
    }
    poll()
    const t = setInterval(poll, POLL_MS)
    return () => clearInterval(t)
  }, [state, me])

  // ── Post-clock-out fetch ─────────────────────────────────────────────────
  useEffect(() => {
    if (state !== "clocked-out" || !me) return
    const sid = sessionIdRef.current ? `&sessionId=${sessionIdRef.current}` : ""
    const since = clockInEpochRef.current
      ? `&since=${clockInEpochRef.current}`
      : ""
    fetch(`/api/extension/activity?mode=summary${sid}${since}`)
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => {})
    const t = setTimeout(() => {
      fetch(`/api/extension/activity?since=${clockInEpochRef.current}${sid}`)
        .then((r) => r.json())
        .then((data) =>
          setSessionEvents(
            (data.events ?? [])
              .filter(
                (e: ActivityEvent) =>
                  e.type === "tab_visit" || e.type === "meeting_active"
              )
              .sort((a: ActivityEvent, b: ActivityEvent) => b.ts - a.ts)
          )
        )
        .catch(() => {})
    }, 3000)
    return () => clearTimeout(t)
  }, [state, me])

  // ── Sessions list fetch ──────────────────────────────────────────────────
  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true)
    try {
      const res = await fetch("/api/sessions")
      if (res.ok) setSessions((await res.json()).sessions ?? [])
    } finally {
      setSessionsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (view === "sessions") fetchSessions()
  }, [view, fetchSessions])

  // ── Helpers ──────────────────────────────────────────────────────────────
  function restoreSession(
    sid: string,
    clockInISO: string,
    opts?: {
      breakStartedAt?: string | null
      breakUsedSec?: number
      breakMinPerDay?: number
    }
  ) {
    const ms = new Date(clockInISO).getTime()
    setSessionId(sid)
    setClockInMs(ms)
    setClockInTimeStr(isoToClockStr(clockInISO))
    clockInEpochRef.current = ms
    sessionIdRef.current = sid
    setActivities([])
    setState("active")
    // Restore break state
    setBreakUsedSec(opts?.breakUsedSec ?? 0)
    if (opts?.breakMinPerDay) setBreakMinPerDay(opts.breakMinPerDay)
    if (opts?.breakStartedAt) {
      setOnBreak(true)
      setBreakStartedMs(new Date(opts.breakStartedAt).getTime())
    } else {
      setOnBreak(false)
      setBreakStartedMs(0)
    }
    localStorage.setItem("trackr_session_id", sid)
    localStorage.setItem("trackr_clock_in_time", clockInISO)
    window.dispatchEvent(
      new CustomEvent("trackr:clocked_in", {
        detail: { sessionId: sid, clockInTime: clockInISO },
      })
    )
    window.dispatchEvent(
      new CustomEvent("trackr:session_changed", { detail: { sessionId: sid } })
    )
  }

  const handleClockIn = async () => {
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
      const data = await res.json()
      restoreSession(data.sessionId, data.clockIn)
    } catch {
      const iso = new Date().toISOString()
      setClockInMs(Date.now())
      setClockInTimeStr(isoToClockStr(iso))
      clockInEpochRef.current = Date.now()
      setActivities([])
      setState("active")
    }
  }

  const handleClockOut = async () => {
    if (clockingOut) return
    setClockingOut(true)
    const snapshotElapsed = elapsed
    try {
      if (sessionId) {
        await fetch(`/api/sessions/${sessionId}`, { method: "PATCH" })
        localStorage.removeItem("trackr_session_id")
        localStorage.removeItem("trackr_clock_in_time")
        window.dispatchEvent(new CustomEvent("trackr:clocked_out"))
        window.dispatchEvent(
          new CustomEvent("trackr:session_changed", {
            detail: { sessionId: null },
          })
        )
        setSessionId("")
        // sessionIdRef.current is intentionally kept so the clocked-out screen
        // can scope its summary/event queries to this session. It is cleared
        // when the user clicks Done or View History.
      }
      setFinalElapsed(snapshotElapsed)
      setOnBreak(false)
      setBreakStartedMs(0)
      setState("clocked-out")
    } catch {
      // keep active state if API failed — user can retry
    } finally {
      setClockingOut(false)
    }
  }

  const handleBreakStart = async () => {
    if (!sessionId || breakLoading) return
    // Optimistic — pause the timer immediately
    const optimisticStart = Date.now()
    setOnBreak(true)
    setBreakStartedMs(optimisticStart)
    setBreakLoading(true)
    try {
      const res = await fetch("/api/sessions/active/break", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      })
      if (res.ok) {
        const data = await res.json()
        // Snap to server timestamp so break time stays accurate
        setBreakStartedMs(new Date(data.breakStartedAt).getTime())
        if (data.breakMinPerDay) setBreakMinPerDay(data.breakMinPerDay)
      } else {
        // Revert
        setOnBreak(false)
        setBreakStartedMs(0)
      }
    } catch {
      setOnBreak(false)
      setBreakStartedMs(0)
    }
    setBreakLoading(false)
  }

  const handleBreakEnd = async () => {
    if (!sessionId || breakLoading) return
    setBreakLoading(true)
    try {
      const res = await fetch("/api/sessions/active/break", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end" }),
      })
      if (res.ok) {
        const data = await res.json()
        setBreakUsedSec(data.breakUsedSec)
        setOnBreak(false)
        setBreakStartedMs(0)
      }
    } catch {}
    setBreakLoading(false)
  }

  const handleLogout = async () => {
    if (sessionId)
      await fetch(`/api/sessions/${sessionId}`, { method: "PATCH" }).catch(
        () => {}
      )
    await fetch("/api/auth/logout", { method: "POST" })
    localStorage.removeItem("trackr_session_id")
    localStorage.removeItem("trackr_clock_in_time")
    window.dispatchEvent(new CustomEvent("trackr:auth_cleared"))
    router.push("/login")
    router.refresh()
  }

  const openSession = async (s: SessionRecord) => {
    setSelectedSession(s)
    setView("session-detail")
    setDetailSummary(null)
    setDetailEvents([])
    setDetailLoading(true)
    try {
      const [sr, er] = await Promise.all([
        fetch(`/api/extension/activity?sessionId=${s.id}&mode=summary`),
        fetch(`/api/extension/activity?sessionId=${s.id}`),
      ])
      const [sumData, evData] = await Promise.all([sr.json(), er.json()])
      setDetailSummary(sumData)
      setDetailEvents(
        (evData.events ?? [])
          .filter(
            (e: ActivityEvent) =>
              e.type === "tab_visit" || e.type === "meeting_active"
          )
          .sort((a: ActivityEvent, b: ActivityEvent) => b.ts - a.ts)
      )
    } finally {
      setDetailLoading(false)
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const firstName = me?.name.split(" ")[0] ?? "…"
  const initials = me ? avatarInitials(me.name) : "…"
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })

  const tabEvents = [...activities]
    .filter((e) => e.type === "tab_visit" || e.type === "meeting_active")
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 30)

  const summaryCategories = summary?.categories
    ? Object.entries(summary.categories)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 6)
    : []
  const maxSec = summaryCategories[0]?.[1] ?? 1

  const sessionGroups = groupSessions(sessions)

  // ── Sidebar nav ──────────────────────────────────────────────────────────
  const NAV = [
    { v: "dashboard" as View, icon: Home01Icon, label: "Dashboard" },
    { v: "sessions" as View, icon: ClockCheckIcon, label: "Sessions" },
    { v: "insights" as View, icon: Analytics01Icon, label: "Insights" },
    { v: "profile" as View, icon: UserCircleIcon, label: "Profile" },
  ]

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-zinc-950">
      {/* ─── Sidebar ────────────────────────────────────────────────────────── */}
      <aside className="z-10 flex w-14 shrink-0 flex-col border-r border-zinc-800/60 bg-zinc-950 md:w-56">
        {/* Logo */}
        <div className="flex h-14 shrink-0 items-center justify-center border-b border-zinc-800/60 md:justify-start md:px-5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-400">
            <HugeiconsIcon
              icon={Clock01Icon}
              size={14}
              className="text-zinc-950"
            />
          </div>
          <span className="ml-2.5 hidden font-mono text-sm font-bold tracking-tight text-white md:block">
            track<span className="text-amber-400">R</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 p-2 pt-3">
          {NAV.map(({ v, icon, label }) => {
            const active =
              view === v || (v === "sessions" && view === "session-detail")
            return (
              <button
                key={v}
                onClick={() => setView(v)}
                title={label}
                className={`flex h-9 w-full items-center justify-center gap-3 rounded-lg px-0 transition-colors md:justify-start md:px-3 ${
                  active
                    ? "bg-amber-400/10 text-amber-400"
                    : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-200"
                }`}
              >
                <HugeiconsIcon
                  icon={icon}
                  size={17}
                  className="shrink-0 text-current"
                />
                <span className="hidden text-sm font-medium md:block">
                  {label}
                </span>
              </button>
            )
          })}
        </nav>

        {/* User + logout */}
        <div className="shrink-0 space-y-1 border-t border-zinc-800/60 p-2 pb-3">
          <div className="flex items-center justify-center gap-2.5 px-0 py-2 md:justify-start md:px-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800">
              <span className="font-mono text-[10px] font-bold text-zinc-300">
                {initials}
              </span>
            </div>
            <div className="hidden min-w-0 md:block">
              <p className="truncate text-xs leading-none font-medium text-white">
                {me?.name ?? "…"}
              </p>
              <p className="mt-0.5 truncate text-[10px] text-zinc-500">
                {me?.email ?? ""}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="flex h-9 w-full items-center justify-center gap-3 rounded-lg px-0 text-zinc-600 transition-colors hover:bg-red-400/5 hover:text-red-400 md:justify-start md:px-3"
          >
            <HugeiconsIcon
              icon={Logout01Icon}
              size={16}
              className="shrink-0 text-current"
            />
            <span className="hidden text-sm md:block">Sign out</span>
          </button>
        </div>
      </aside>

      {/* ─── Main area ──────────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-6 backdrop-blur-md dark:border-zinc-800/50 dark:bg-zinc-950/90">
          <div className="flex items-center gap-3">
            {view === "session-detail" && (
              <button
                onClick={() => setView("sessions")}
                className="mr-1 flex items-center gap-1.5 text-slate-400 transition-colors hover:text-slate-700 dark:text-zinc-600 dark:hover:text-zinc-300"
              >
                <HugeiconsIcon
                  icon={ArrowLeft01Icon}
                  size={15}
                  className="text-current"
                />
                <span className="text-sm">Sessions</span>
              </button>
            )}
            <span className="text-sm font-medium text-slate-600 dark:text-zinc-400">
              {view === "dashboard"
                ? state === "idle"
                  ? `${getGreeting()}, ${firstName}`
                  : state === "active"
                    ? "Active Session"
                    : "Session Summary"
                : view === "sessions"
                  ? "Session History"
                  : view === "insights"
                    ? "Work Patterns"
                    : view === "profile"
                      ? "Profile & Settings"
                      : selectedSession
                        ? new Date(selectedSession.clockIn).toLocaleDateString(
                            "en-US",
                            { weekday: "short", month: "short", day: "numeric" }
                          )
                        : "Session Detail"}
            </span>
            {view === "dashboard" && state === "active" && (
              <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 dark:border-emerald-400/20 dark:bg-emerald-400/10">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 dark:bg-emerald-400" />
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  Live
                </span>
              </div>
            )}
          </div>
          <ThemeToggle />
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto">
          {/* ── INSIGHTS ──────────────────────────────────────────────────── */}
          {view === "insights" && <InsightsView />}

          {/* ── PROFILE ───────────────────────────────────────────────────── */}
          {view === "profile" && <ProfileView me={me} />}

          {/* ── DASHBOARD ─────────────────────────────────────────────────── */}
          {view === "dashboard" && (
            <div className="mx-auto max-w-2xl px-6 py-10">
              {/* IDLE */}
              {state === "idle" && (
                <>
                  {/* ── Extension install guide (shown until extension connects) ── */}
                  {extConnected === false && (
                    <div className="flex animate-in flex-col items-center gap-6 duration-300 fade-in slide-in-from-bottom-2">
                      {/* Header */}
                      <div className="text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/10 ring-1 ring-amber-400/30">
                          <span className="text-2xl">🧩</span>
                        </div>
                        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
                          Install the trackR extension
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-500">
                          The browser extension tracks your activity during work
                          sessions.
                          <br />
                          Follow the steps below — it only takes a minute.
                        </p>
                      </div>

                      {/* Steps card */}
                      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60">
                        {/* Step 1 — Download */}
                        <div className="flex items-start gap-4 border-b border-slate-100 p-5 dark:border-zinc-800">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-zinc-950">
                            1
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-800 dark:text-white">
                              Download the extension
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-500">
                              Click below to download the extension package.
                            </p>
                            <a
                              href="/trackr-extension.zip"
                              download="trackr-extension.zip"
                              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-zinc-950 transition-colors hover:bg-amber-300"
                            >
                              <HugeiconsIcon
                                icon={Activity01Icon}
                                size={13}
                                className="text-current"
                              />
                              Download trackR Extension
                            </a>
                          </div>
                        </div>

                        {/* Step 2 — Unzip */}
                        <div className="flex items-start gap-4 border-b border-slate-100 p-5 dark:border-zinc-800">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                            2
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-800 dark:text-white">
                              Unzip the file
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-500">
                              Extract the downloaded{" "}
                              <span className="font-mono text-slate-700 dark:text-zinc-300">
                                trackr-extension.zip
                              </span>{" "}
                              to any folder on your computer.
                            </p>
                          </div>
                        </div>

                        {/* Step 3 — Open Extensions */}
                        <div className="flex items-start gap-4 border-b border-slate-100 p-5 dark:border-zinc-800">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                            3
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-800 dark:text-white">
                              Open Chrome Extensions
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-500">
                              In Chrome, paste this into the address bar and
                              press Enter:
                            </p>
                            <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
                              <code className="flex-1 text-xs text-slate-700 select-all dark:text-zinc-300">
                                chrome://extensions
                              </code>
                              <button
                                onClick={() =>
                                  navigator.clipboard.writeText(
                                    "chrome://extensions"
                                  )
                                }
                                className="shrink-0 rounded text-xs text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                              >
                                Copy
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Step 4 — Developer mode */}
                        <div className="flex items-start gap-4 border-b border-slate-100 p-5 dark:border-zinc-800">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                            4
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-800 dark:text-white">
                              Enable Developer Mode
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-500">
                              Toggle{" "}
                              <span className="font-semibold text-slate-700 dark:text-zinc-300">
                                Developer mode
                              </span>{" "}
                              on in the top-right corner of the extensions page.
                            </p>
                          </div>
                        </div>

                        {/* Step 5 — Load unpacked */}
                        <div className="flex items-start gap-4 border-b border-slate-100 p-5 dark:border-zinc-800">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                            5
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-800 dark:text-white">
                              Load the extension
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-500">
                              Click{" "}
                              <span className="font-semibold text-slate-700 dark:text-zinc-300">
                                Load unpacked
                              </span>{" "}
                              and select the folder you unzipped in step 2.
                            </p>
                          </div>
                        </div>

                        {/* Step 6 — Pin it */}
                        <div className="flex items-start gap-4 border-b border-slate-100 p-5 dark:border-zinc-800">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                            6
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-800 dark:text-white">
                              Pin the extension
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-500">
                              Click the puzzle piece icon{" "}
                              <span className="font-mono text-slate-700 dark:text-zinc-300">
                                🧩
                              </span>{" "}
                              in the Chrome toolbar, find{" "}
                              <span className="font-semibold text-slate-700 dark:text-zinc-300">
                                trackR Monitor
                              </span>
                              , and click the pin icon. This lets you see your
                              live tracking status at a glance.
                            </p>
                          </div>
                        </div>

                        {/* Step 7 — Reload */}
                        <div className="flex items-start gap-4 p-5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                            7
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-800 dark:text-white">
                              Come back and reload
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-500">
                              Return to this page and click below. The extension
                              connects automatically — this page will update and
                              let you clock in.
                            </p>
                            <button
                              onClick={() => window.location.reload()}
                              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                            >
                              <HugeiconsIcon
                                icon={RefreshIcon}
                                size={13}
                                className="text-current"
                              />
                              Reload page
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Note about clocking in */}
                      <p className="max-w-md text-center text-xs text-slate-400 dark:text-zinc-600">
                        Once installed, you clock in directly from this
                        dashboard — not from the extension popup. Pinning just
                        gives you a live status indicator in your toolbar.
                      </p>
                    </div>
                  )}

                  {/* ── Normal idle state (extension connected or still checking) ── */}
                  {extConnected !== false && (
                    <div className="flex animate-in flex-col items-center gap-8 duration-300 fade-in slide-in-from-bottom-2">
                      <div className="pt-4 text-center">
                        <div className="font-mono text-6xl font-bold tracking-tight text-slate-900 tabular-nums sm:text-7xl dark:text-white">
                          {timeStr}
                        </div>
                        <p className="mt-2 text-sm text-slate-400 dark:text-zinc-500">
                          {dateStr}
                        </p>
                      </div>
                      <div className="text-center">
                        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
                          {getGreeting()}, {firstName}.
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-500">
                          Ready to start your workday?
                        </p>
                      </div>
                      <button
                        onClick={handleClockIn}
                        disabled={!me || extConnected === null}
                        className="group flex items-center gap-3 rounded-2xl bg-amber-400 px-12 py-4 text-lg font-semibold text-zinc-950 transition-all duration-200 hover:bg-amber-300 hover:shadow-xl hover:shadow-amber-400/20 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <HugeiconsIcon
                          icon={PlayIcon}
                          size={20}
                          className="text-zinc-950 transition-transform group-hover:scale-110"
                        />
                        Clock In
                      </button>
                      <div className="flex w-full max-w-md items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-zinc-800">
                          <HugeiconsIcon
                            icon={Calendar01Icon}
                            size={18}
                            className="text-slate-400 dark:text-zinc-500"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="mb-0.5 text-xs tracking-wider text-slate-400 uppercase dark:text-zinc-500">
                            Session
                          </p>
                          <p className="text-sm font-medium text-slate-800 dark:text-white">
                            Clock in to start tracking
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400 dark:text-zinc-600">
                            Activity captured once clocked in
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 text-xs">
                          {extConnected === true ? (
                            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                              <HugeiconsIcon
                                icon={CheckmarkCircle01Icon}
                                size={14}
                                className="text-current"
                              />
                              Extension connected
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-zinc-500">
                              Checking…
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ACTIVE */}
              {state === "active" && (
                <div className="flex animate-in flex-col gap-6 duration-300 fade-in slide-in-from-bottom-2">
                  <div className="py-8 text-center">
                    {onBreak ? (
                      <>
                        <p className="mb-4 font-mono text-xs tracking-[0.25em] text-slate-400 uppercase dark:text-zinc-600">
                          On Break
                        </p>
                        <div className="font-mono text-7xl leading-none font-bold tracking-tight text-amber-400/50 tabular-nums sm:text-8xl dark:text-amber-400/40">
                          {fmtSec(elapsed)}
                        </div>
                        <p className="mt-3 font-mono text-sm text-amber-600 dark:text-amber-400">
                          {fmtSec(currentBreakSec)} elapsed ·{" "}
                          {fmtSec(breakRemainSec)} remaining
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="mb-4 font-mono text-xs tracking-[0.25em] text-slate-400 uppercase dark:text-zinc-600">
                          Active Session
                        </p>
                        <div className="font-mono text-7xl leading-none font-bold tracking-tight text-amber-500 tabular-nums sm:text-8xl dark:text-amber-400">
                          {fmtSec(elapsed)}
                        </div>
                        <p className="mt-4 text-sm text-slate-400 dark:text-zinc-600">
                          Clocked in at{" "}
                          <span className="font-mono text-slate-600 dark:text-zinc-400">
                            {clockInTimeStr}
                          </span>
                        </p>
                        <p className="mt-1 font-mono text-xs text-slate-300 dark:text-zinc-700">
                          {breakRemainSec > 0
                            ? `${fmtSec(breakRemainSec)} break remaining`
                            : "No break left"}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/50">
                    <div className="flex items-center gap-2 border-b border-slate-200/80 px-5 py-3.5 dark:border-zinc-800/50">
                      <HugeiconsIcon
                        icon={Activity01Icon}
                        size={15}
                        className="text-slate-400 dark:text-zinc-600"
                      />
                      <span className="text-sm font-medium text-slate-600 dark:text-zinc-400">
                        Live Activity
                      </span>
                      <div className="ml-auto flex items-center gap-2">
                        {fetching && (
                          <span className="h-1 w-1 animate-ping rounded-full bg-amber-400 opacity-75" />
                        )}
                        <span
                          className={`flex items-center gap-1 font-mono text-xs ${tabEvents.length > 0 ? "text-slate-400 dark:text-zinc-600" : "text-slate-300 dark:text-zinc-700"}`}
                        >
                          {tabEvents.length > 0 && (
                            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 dark:bg-emerald-400" />
                          )}
                          {tabEvents.length} events
                        </span>
                      </div>
                    </div>
                    <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-zinc-800/30">
                      {tabEvents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-10">
                          <HugeiconsIcon
                            icon={WifiOff01Icon}
                            size={24}
                            className="text-slate-300 dark:text-zinc-700"
                          />
                          <p className="text-sm text-slate-400 dark:text-zinc-600">
                            Waiting for activity…
                          </p>
                          <p className="px-6 text-center text-xs text-slate-300 dark:text-zinc-700">
                            Make sure the trackR Chrome extension is installed
                            and active.
                          </p>
                        </div>
                      ) : (
                        tabEvents.map((item, i) => {
                          const cat = catOf(item.category)
                          return (
                            <div
                              key={i}
                              className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/20"
                            >
                              <span className="w-12 shrink-0 font-mono text-xs text-slate-300 tabular-nums dark:text-zinc-700">
                                {tsToTime(item.ts)}
                              </span>
                              <span className="shrink-0 text-sm leading-none">
                                {cat.icon}
                              </span>
                              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                <span
                                  className={`shrink-0 text-xs font-semibold ${cat.color}`}
                                >
                                  {cat.label}
                                </span>
                                <span className="shrink-0 text-xs text-slate-300 dark:text-zinc-700">
                                  ·
                                </span>
                                <span className="truncate text-xs text-slate-500 dark:text-zinc-500">
                                  {item.title || item.domain || item.url || "—"}
                                </span>
                              </div>
                              {typeof item.dwell === "number" &&
                                item.dwell > 0 && (
                                  <span className="shrink-0 font-mono text-xs text-slate-300 dark:text-zinc-700">
                                    {fmtDuration(item.dwell)}
                                  </span>
                                )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    {onBreak ? (
                      <button
                        onClick={handleBreakEnd}
                        disabled={breakLoading}
                        className="flex flex-1 items-center justify-center gap-2.5 rounded-2xl bg-amber-400 px-6 py-4 font-semibold text-zinc-950 transition-all duration-200 hover:bg-amber-300 active:scale-[0.98] disabled:opacity-50"
                      >
                        <HugeiconsIcon
                          icon={PlayIcon}
                          size={18}
                          className="text-current"
                        />
                        {breakLoading ? "…" : "End Break"}
                      </button>
                    ) : (
                      <button
                        onClick={handleBreakStart}
                        disabled={breakLoading || breakRemainSec === 0}
                        className="flex flex-1 items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-6 py-4 font-semibold text-slate-500 transition-all duration-200 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-600 active:scale-[0.98] disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-amber-900/60 dark:hover:bg-amber-950/30 dark:hover:text-amber-400"
                      >
                        <HugeiconsIcon
                          icon={Coffee01Icon}
                          size={18}
                          className="text-current"
                        />
                        {breakLoading
                          ? "…"
                          : breakRemainSec === 0
                            ? "No Break Left"
                            : "Take Break"}
                      </button>
                    )}
                    <button
                      onClick={handleClockOut}
                      disabled={clockingOut}
                      className="group flex flex-1 items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-6 py-4 font-semibold text-slate-500 transition-all duration-200 hover:border-red-300 hover:bg-red-50 hover:text-red-500 active:scale-[0.98] disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-red-900/60 dark:hover:bg-red-950/50 dark:hover:text-red-400"
                    >
                      <HugeiconsIcon
                        icon={clockingOut ? RefreshIcon : Logout01Icon}
                        size={18}
                        className={`text-current ${clockingOut ? "animate-spin" : ""}`}
                      />
                      {clockingOut ? "Clocking out…" : "Clock Out"}
                    </button>
                  </div>
                </div>
              )}

              {/* CLOCKED OUT */}
              {state === "clocked-out" && (
                <div className="flex animate-in flex-col gap-6 duration-300 fade-in slide-in-from-bottom-2">
                  <div className="pt-4 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 dark:border-emerald-400/20 dark:bg-emerald-400/10">
                      <HugeiconsIcon
                        icon={CheckmarkCircle01Icon}
                        size={30}
                        className="text-emerald-500 dark:text-emerald-400"
                      />
                    </div>
                    <h2 className="mb-1 text-2xl font-semibold text-slate-900 dark:text-white">
                      Session Complete
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-zinc-500">
                      Great work, {firstName}!
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-7 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
                    <p className="mb-3 font-mono text-xs tracking-[0.2em] text-slate-400 uppercase dark:text-zinc-600">
                      Total Session
                    </p>
                    <div className="font-mono text-6xl font-bold text-slate-900 tabular-nums dark:text-white">
                      {fmtSec(finalElapsed)}
                    </div>
                    <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-400 dark:text-zinc-600">
                      <span>
                        In:{" "}
                        <span className="font-mono text-slate-600 dark:text-zinc-400">
                          {clockInTimeStr}
                        </span>
                      </span>
                      <span className="text-slate-200 dark:text-zinc-800">
                        ·
                      </span>
                      <span>
                        Out:{" "}
                        <span className="font-mono text-slate-600 dark:text-zinc-400">
                          {new Date().toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </span>
                      </span>
                    </div>
                  </div>

                  {summaryCategories.length > 0 && (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/50">
                      <div className="flex items-center gap-2 border-b border-slate-200/80 px-5 py-3.5 dark:border-zinc-800/50">
                        <HugeiconsIcon
                          icon={ClockCheckIcon}
                          size={15}
                          className="text-slate-400 dark:text-zinc-600"
                        />
                        <span className="text-sm font-medium text-slate-600 dark:text-zinc-400">
                          Activity Breakdown
                        </span>
                        {summary && (
                          <span className="ml-auto font-mono text-xs text-slate-300 dark:text-zinc-700">
                            {summary.eventCount} visits
                          </span>
                        )}
                      </div>
                      <div className="space-y-3.5 p-5">
                        {summaryCategories.map(([cat, sec]) => {
                          const cfg = catOf(cat),
                            pct = Math.round((sec / maxSec) * 100)
                          return (
                            <div key={cat} className="flex items-center gap-3">
                              <span className="shrink-0 text-sm">
                                {cfg.icon}
                              </span>
                              <span className="w-24 shrink-0 truncate text-sm text-slate-500 dark:text-zinc-500">
                                {cfg.label}
                              </span>
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800/80">
                                <div
                                  className={`h-full rounded-full ${cfg.bar}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span
                                className={`font-mono text-xs font-semibold ${cfg.color} w-14 shrink-0 text-right`}
                              >
                                {fmtDuration(sec)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {summary && summary.topDomains.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <p className="mb-3 text-sm font-medium text-slate-700 dark:text-zinc-400">
                        Top Sites
                      </p>
                      <div className="space-y-2.5">
                        {summary.topDomains.map((d) => (
                          <div
                            key={d.domain}
                            className="flex items-center gap-3"
                          >
                            <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/70" />
                            <span className="flex-1 truncate font-mono text-xs text-slate-600 dark:text-zinc-400">
                              {d.domain}
                            </span>
                            <span className="font-mono text-xs text-slate-400 dark:text-zinc-600">
                              {fmtDuration(d.dwell)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {sessionEvents.length > 0 && (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/50">
                      <div className="flex items-center gap-2 border-b border-slate-200/80 px-5 py-3.5 dark:border-zinc-800/50">
                        <HugeiconsIcon
                          icon={Activity01Icon}
                          size={15}
                          className="text-slate-400 dark:text-zinc-600"
                        />
                        <span className="text-sm font-medium text-slate-600 dark:text-zinc-400">
                          Session Log
                        </span>
                        <span className="ml-auto font-mono text-xs text-slate-300 dark:text-zinc-700">
                          {sessionEvents.length} events
                        </span>
                      </div>
                      <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto dark:divide-zinc-800/30">
                        {sessionEvents.map((item, i) => {
                          const cat = catOf(item.category)
                          return (
                            <div
                              key={i}
                              className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/20"
                            >
                              <span className="w-12 shrink-0 font-mono text-xs text-slate-300 tabular-nums dark:text-zinc-700">
                                {tsToTime(item.ts)}
                              </span>
                              <span className="shrink-0 text-sm leading-none">
                                {cat.icon}
                              </span>
                              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                <span
                                  className={`shrink-0 text-xs font-semibold ${cat.color}`}
                                >
                                  {cat.label}
                                </span>
                                <span className="shrink-0 text-xs text-slate-300 dark:text-zinc-700">
                                  ·
                                </span>
                                <span className="truncate text-xs text-slate-500 dark:text-zinc-500">
                                  {item.title || item.domain || "—"}
                                </span>
                              </div>
                              {typeof item.dwell === "number" &&
                                item.dwell > 0 && (
                                  <span className="shrink-0 font-mono text-xs text-slate-300 dark:text-zinc-700">
                                    {fmtDuration(item.dwell)}
                                  </span>
                                )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setSummary(null)
                        setSessionEvents([])
                        setActivities([])
                        setClockInMs(0)
                        setFinalElapsed(0)
                        setSessionId("")
                        sessionIdRef.current = ""
                        clockInEpochRef.current = 0
                        setState("idle")
                      }}
                      className="flex flex-1 items-center justify-center rounded-2xl bg-slate-100 px-8 py-3.5 font-medium text-slate-700 transition-all duration-200 hover:bg-slate-200 active:scale-[0.98] dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                      Done
                    </button>
                    <button
                      onClick={() => {
                        setSummary(null)
                        setSessionEvents([])
                        setActivities([])
                        setClockInMs(0)
                        setFinalElapsed(0)
                        setSessionId("")
                        sessionIdRef.current = ""
                        clockInEpochRef.current = 0
                        setState("idle")
                        setView("sessions")
                      }}
                      className="flex items-center gap-2 rounded-2xl border border-slate-200 px-5 py-3.5 text-sm font-medium text-slate-500 transition-all duration-200 hover:bg-slate-50 hover:text-slate-700 dark:border-zinc-800 dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
                    >
                      <HugeiconsIcon
                        icon={ClockCheckIcon}
                        size={15}
                        className="text-current"
                      />
                      View History
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── SESSIONS LIST ──────────────────────────────────────────────── */}
          {view === "sessions" && (
            <div className="mx-auto max-w-2xl px-6 py-8">
              {sessionsLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" />
                  <p className="text-sm text-slate-400 dark:text-zinc-600">
                    Loading sessions…
                  </p>
                </div>
              ) : sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 py-20">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-zinc-900">
                    <HugeiconsIcon
                      icon={ClockCheckIcon}
                      size={24}
                      className="text-slate-300 dark:text-zinc-700"
                    />
                  </div>
                  <p className="text-sm text-slate-500 dark:text-zinc-500">
                    No sessions yet
                  </p>
                  <button
                    onClick={() => setView("dashboard")}
                    className="text-sm text-amber-500 hover:underline dark:text-amber-400"
                  >
                    Clock in to start →
                  </button>
                </div>
              ) : (
                <div className="space-y-8">
                  {sessionGroups.map(({ label, items }) => (
                    <div key={label}>
                      <p className="mb-3 px-1 text-[11px] font-semibold tracking-widest text-slate-400 uppercase dark:text-zinc-600">
                        {label}
                      </p>
                      <div className="space-y-2">
                        {items.map((s) => {
                          const isActive = !s.clockOut
                          const inTime = isoToShortTime(s.clockIn)
                          const outTime = s.clockOut
                            ? isoToShortTime(s.clockOut)
                            : null
                          return (
                            <button
                              key={s.id}
                              onClick={() => openSession(s)}
                              className="group flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left transition-colors hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:bg-zinc-800/40"
                            >
                              <div
                                className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                                  isActive
                                    ? "animate-pulse bg-emerald-400"
                                    : s.approved
                                      ? "bg-amber-400"
                                      : "bg-zinc-600 dark:bg-zinc-600"
                                }`}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-sm font-medium text-slate-800 dark:text-zinc-100">
                                    {inTime}
                                    {outTime ? ` – ${outTime}` : ""}
                                  </span>
                                  {isActive && (
                                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400">
                                      Active
                                    </span>
                                  )}
                                  {!isActive && s.approved && (
                                    <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-400">
                                      Approved
                                    </span>
                                  )}
                                </div>
                                <div className="mt-0.5 flex items-center gap-3">
                                  {s.durationSec != null && (
                                    <span className="text-xs text-slate-500 dark:text-zinc-500">
                                      {fmtDuration(s.durationSec)}
                                    </span>
                                  )}
                                  {s.eventCount > 0 && (
                                    <span className="text-xs text-slate-300 dark:text-zinc-700">
                                      {s.eventCount} events
                                    </span>
                                  )}
                                </div>
                              </div>
                              <HugeiconsIcon
                                icon={ArrowRight01Icon}
                                size={14}
                                className="shrink-0 text-slate-300 transition-colors group-hover:text-slate-400 dark:text-zinc-700 dark:group-hover:text-zinc-500"
                              />
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── SESSION DETAIL ─────────────────────────────────────────────── */}
          {view === "session-detail" && selectedSession && (
            <div className="mx-auto max-w-2xl px-6 py-8">
              <div className="mb-8">
                <p className="mb-2 font-mono text-xs tracking-widest text-slate-400 uppercase dark:text-zinc-600">
                  {new Date(selectedSession.clockIn).toLocaleDateString(
                    "en-US",
                    {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    }
                  )}
                </p>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="font-mono text-3xl font-bold text-slate-900 tabular-nums dark:text-white">
                      {isoToShortTime(selectedSession.clockIn)}
                      {selectedSession.clockOut && (
                        <>
                          <span className="mx-2 font-normal text-slate-300 dark:text-zinc-700">
                            –
                          </span>
                          {isoToShortTime(selectedSession.clockOut)}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5 pb-1">
                    {selectedSession.durationSec != null && (
                      <span className="font-mono text-lg font-bold text-slate-700 dark:text-zinc-300">
                        {fmtDuration(selectedSession.durationSec)}
                      </span>
                    )}
                    {!selectedSession.clockOut && (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400">
                        Active
                      </span>
                    )}
                    {selectedSession.approved && (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-400">
                        Approved
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {detailLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" />
                  <p className="text-sm text-slate-400 dark:text-zinc-600">
                    Loading activity…
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {detailSummary &&
                    Object.keys(detailSummary.categories).length > 0 &&
                    (() => {
                      const cats = Object.entries(detailSummary.categories)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 7)
                      const max = cats[0]?.[1] ?? 1
                      return (
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/50">
                          <div className="flex items-center gap-2 border-b border-slate-200/80 px-5 py-3.5 dark:border-zinc-800/50">
                            <HugeiconsIcon
                              icon={ClockCheckIcon}
                              size={15}
                              className="text-slate-400 dark:text-zinc-600"
                            />
                            <span className="text-sm font-medium text-slate-600 dark:text-zinc-400">
                              Activity Breakdown
                            </span>
                            <span className="ml-auto font-mono text-xs text-slate-300 dark:text-zinc-700">
                              {detailSummary.eventCount} visits ·{" "}
                              {fmtDuration(detailSummary.totalSec)}
                            </span>
                          </div>
                          <div className="space-y-3.5 p-5">
                            {cats.map(([cat, sec]) => {
                              const cfg = catOf(cat),
                                pct = Math.round((sec / max) * 100)
                              return (
                                <div
                                  key={cat}
                                  className="flex items-center gap-3"
                                >
                                  <span className="shrink-0 text-sm">
                                    {cfg.icon}
                                  </span>
                                  <span className="w-24 shrink-0 truncate text-sm text-slate-500 dark:text-zinc-500">
                                    {cfg.label}
                                  </span>
                                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800/80">
                                    <div
                                      className={`h-full rounded-full ${cfg.bar}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span
                                    className={`font-mono text-xs font-semibold ${cfg.color} w-14 shrink-0 text-right`}
                                  >
                                    {fmtDuration(sec)}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })()}

                  {detailSummary && detailSummary.topDomains.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <p className="mb-3 text-sm font-medium text-slate-700 dark:text-zinc-400">
                        Top Sites
                      </p>
                      <div className="space-y-2.5">
                        {detailSummary.topDomains.map((d) => (
                          <div
                            key={d.domain}
                            className="flex items-center gap-3"
                          >
                            <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/70" />
                            <span className="flex-1 truncate font-mono text-xs text-slate-600 dark:text-zinc-400">
                              {d.domain}
                            </span>
                            <span className="font-mono text-xs text-slate-400 dark:text-zinc-600">
                              {fmtDuration(d.dwell)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {detailEvents.length > 0 ? (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/50">
                      <div className="flex items-center gap-2 border-b border-slate-200/80 px-5 py-3.5 dark:border-zinc-800/50">
                        <HugeiconsIcon
                          icon={Activity01Icon}
                          size={15}
                          className="text-slate-400 dark:text-zinc-600"
                        />
                        <span className="text-sm font-medium text-slate-600 dark:text-zinc-400">
                          Activity Log
                        </span>
                        <span className="ml-auto font-mono text-xs text-slate-300 dark:text-zinc-700">
                          {detailEvents.length} events
                        </span>
                      </div>
                      <div className="max-h-[480px] divide-y divide-slate-100 overflow-y-auto dark:divide-zinc-800/30">
                        {detailEvents.map((item, i) => {
                          const cat = catOf(item.category)
                          return (
                            <div
                              key={i}
                              className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/20"
                            >
                              <span className="w-12 shrink-0 font-mono text-xs text-slate-300 tabular-nums dark:text-zinc-700">
                                {tsToTime(item.ts)}
                              </span>
                              <span className="shrink-0 text-sm leading-none">
                                {cat.icon}
                              </span>
                              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                <span
                                  className={`shrink-0 text-xs font-semibold ${cat.color}`}
                                >
                                  {cat.label}
                                </span>
                                <span className="shrink-0 text-xs text-slate-300 dark:text-zinc-700">
                                  ·
                                </span>
                                <span className="truncate text-xs text-slate-500 dark:text-zinc-500">
                                  {item.title || item.domain || "—"}
                                </span>
                              </div>
                              {typeof item.dwell === "number" &&
                                item.dwell > 0 && (
                                  <span className="shrink-0 font-mono text-xs text-slate-300 dark:text-zinc-700">
                                    {fmtDuration(item.dwell)}
                                  </span>
                                )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-12 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <HugeiconsIcon
                        icon={WifiOff01Icon}
                        size={22}
                        className="text-slate-300 dark:text-zinc-700"
                      />
                      <p className="text-sm text-slate-400 dark:text-zinc-600">
                        No activity recorded for this session
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
