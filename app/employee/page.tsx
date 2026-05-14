"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Clock01Icon,
  PlayIcon,
  Logout01Icon,
  Activity01Icon,
  CheckmarkCircle01Icon,
  Calendar01Icon,
  ArrowLeft01Icon,
  ClockCheckIcon,
} from "@hugeicons/core-free-icons"
import { ThemeToggle } from "@/components/theme-toggle"

type SessionState = "idle" | "active" | "clocked-out"

const MOCK_ACTIVITIES = [
  { time: "09:01", app: "Chrome",  detail: "mail.google.com",           category: "browser" },
  { time: "09:12", app: "VS Code", detail: "components/Header.tsx",     category: "dev"     },
  { time: "09:34", app: "Chrome",  detail: "github.com/org/trackR",     category: "browser" },
  { time: "09:47", app: "Zoom",    detail: "Team Standup — 30m",        category: "meeting" },
  { time: "10:20", app: "VS Code", detail: "app/api/routes/users.ts",   category: "dev"     },
  { time: "11:05", app: "Chrome",  detail: "react.dev/docs",            category: "browser" },
  { time: "11:33", app: "Slack",   detail: "#dev-general",              category: "comms"   },
  { time: "12:01", app: "Figma",   detail: "Dashboard v3.fig",          category: "design"  },
  { time: "13:14", app: "Zoom",    detail: "Design Review — 1h",        category: "meeting" },
  { time: "14:28", app: "VS Code", detail: "lib/utils/format.ts",       category: "dev"     },
  { time: "15:10", app: "Chrome",  detail: "stackoverflow.com",         category: "browser" },
  { time: "15:44", app: "Slack",   detail: "#design-feedback",          category: "comms"   },
]

const CATEGORY_STYLE: Record<string, { icon: string; color: string }> = {
  browser: { icon: "🌐", color: "text-sky-500 dark:text-sky-400"       },
  dev:     { icon: "💻", color: "text-violet-600 dark:text-violet-400"  },
  meeting: { icon: "📹", color: "text-emerald-600 dark:text-emerald-400"},
  comms:   { icon: "💬", color: "text-blue-600 dark:text-blue-400"      },
  design:  { icon: "🎨", color: "text-pink-600 dark:text-pink-400"      },
}

const APP_BREAKDOWN = [
  { label: "VS Code", hours: "4h 10m", color: "text-violet-600 dark:text-violet-400", bar: "bg-violet-500 dark:bg-violet-400", pct: 52 },
  { label: "Chrome",  hours: "2h 05m", color: "text-sky-600 dark:text-sky-400",       bar: "bg-sky-500 dark:bg-sky-400",       pct: 26 },
  { label: "Zoom",    hours: "1h 30m", color: "text-emerald-600 dark:text-emerald-400",bar: "bg-emerald-500 dark:bg-emerald-400",pct: 19 },
  { label: "Slack",   hours: "0h 45m", color: "text-blue-600 dark:text-blue-400",     bar: "bg-blue-500 dark:bg-blue-400",     pct: 9  },
  { label: "Figma",   hours: "0h 25m", color: "text-pink-600 dark:text-pink-400",     bar: "bg-pink-500 dark:bg-pink-400",     pct: 5  },
]

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}

export default function EmployeePage() {
  const [state, setState]         = useState<SessionState>("idle")
  const [elapsed, setElapsed]     = useState(0)
  const [clockInTime, setClockIn] = useState("")
  const [now, setNow]             = useState<Date>(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (state !== "active") return
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [state])

  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  })
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  })

  const fmt = (s: number) => {
    const h   = Math.floor(s / 3600).toString().padStart(2, "0")
    const m   = Math.floor((s % 3600) / 60).toString().padStart(2, "0")
    const sec = (s % 60).toString().padStart(2, "0")
    return `${h}:${m}:${sec}`
  }

  const handleClockIn = () => {
    setClockIn(
      new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
    )
    setElapsed(0)
    setState("active")
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-20 border-b border-slate-200 dark:border-zinc-800/50 bg-white/95 dark:bg-zinc-950/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center justify-center w-7 h-7 rounded-md text-slate-400 dark:text-zinc-600 hover:text-slate-600 dark:hover:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={15} className="text-current" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-amber-400 rounded-md flex items-center justify-center">
                <HugeiconsIcon icon={Clock01Icon} size={13} className="text-zinc-950" />
              </div>
              <span className="font-mono text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                track<span className="text-amber-500 dark:text-amber-400">R</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {state === "active" && (
              <div className="hidden sm:flex items-center gap-2 bg-emerald-50 dark:bg-emerald-400/10 border border-emerald-200 dark:border-emerald-400/20 rounded-full px-3 py-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium">Active</span>
              </div>
            )}
            <ThemeToggle />
            <div className="flex items-center gap-2.5 ml-1">
              <div className="w-8 h-8 bg-slate-200 dark:bg-zinc-800 rounded-full flex items-center justify-center border border-slate-300 dark:border-zinc-700">
                <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-zinc-300">JM</span>
              </div>
              <div className="hidden sm:block">
                <p className="text-slate-700 dark:text-zinc-300 text-xs font-medium leading-none">James Mitchell</p>
                <p className="text-slate-400 dark:text-zinc-600 text-[10px] mt-0.5">Employee #1042</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10">

        {/* ─────────────── IDLE ─────────────── */}
        {state === "idle" && (
          <div className="flex flex-col items-center gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="text-center pt-6">
              <div className="font-mono text-6xl sm:text-7xl font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">
                {timeStr}
              </div>
              <p className="text-slate-400 dark:text-zinc-500 text-sm mt-2">{dateStr}</p>
            </div>

            <div className="text-center">
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
                {getGreeting()}, James.
              </h1>
              <p className="text-slate-500 dark:text-zinc-500 text-sm mt-1">Ready to start your workday?</p>
            </div>

            <button
              onClick={handleClockIn}
              className="group flex items-center gap-3 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-lg px-12 py-4 rounded-2xl transition-all duration-200 hover:shadow-xl hover:shadow-amber-400/20 active:scale-[0.97]"
            >
              <HugeiconsIcon
                icon={PlayIcon}
                size={20}
                className="text-zinc-950 transition-transform group-hover:scale-110"
              />
              Clock In
            </button>

            <div className="w-full max-w-md bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 flex items-center gap-4">
              <div className="w-10 h-10 bg-slate-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center shrink-0">
                <HugeiconsIcon icon={Calendar01Icon} size={18} className="text-slate-400 dark:text-zinc-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-400 dark:text-zinc-500 text-xs uppercase tracking-wider mb-0.5">Yesterday</p>
                <p className="text-slate-800 dark:text-white text-sm font-medium">8h 24m worked</p>
                <p className="text-slate-400 dark:text-zinc-600 text-xs mt-0.5">Clocked in 09:00 · Out 17:24</p>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs shrink-0">
                <HugeiconsIcon icon={CheckmarkCircle01Icon} size={14} className="text-current" />
                <span>Verified</span>
              </div>
            </div>

            <div className="w-full max-w-md">
              <p className="text-slate-400 dark:text-zinc-600 text-xs uppercase tracking-wider mb-3">This Week</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Mon", hours: "8h 02m", done: true  },
                  { label: "Tue", hours: "7h 55m", done: true  },
                  { label: "Wed", hours: "—",       done: false },
                ].map((d) => (
                  <div
                    key={d.label}
                    className="bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800 rounded-lg p-3 text-center"
                  >
                    <p className="text-slate-400 dark:text-zinc-600 text-xs mb-1">{d.label}</p>
                    <p className={`font-mono text-sm font-medium ${
                      d.done ? "text-slate-800 dark:text-white" : "text-slate-300 dark:text-zinc-700"
                    }`}>
                      {d.hours}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─────────────── ACTIVE ─────────────── */}
        {state === "active" && (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="text-center py-8">
              <p className="text-slate-400 dark:text-zinc-600 text-xs uppercase tracking-[0.25em] mb-4 font-mono">
                Active Session
              </p>
              <div className="font-mono text-7xl sm:text-8xl font-bold text-amber-500 dark:text-amber-400 tabular-nums tracking-tight leading-none">
                {fmt(elapsed)}
              </div>
              <p className="text-slate-400 dark:text-zinc-600 text-sm mt-4">
                Clocked in at{" "}
                <span className="text-slate-600 dark:text-zinc-400 font-mono">{clockInTime}</span>
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200/80 dark:border-zinc-800/50 flex items-center gap-2">
                <HugeiconsIcon icon={Activity01Icon} size={15} className="text-slate-400 dark:text-zinc-600" />
                <span className="text-slate-600 dark:text-zinc-400 text-sm font-medium">Live Activity</span>
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-slate-400 dark:text-zinc-600 text-xs font-mono">
                    {MOCK_ACTIVITIES.length} events
                  </span>
                </div>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-zinc-800/30 max-h-80 overflow-y-auto scrollbar-thin">
                {MOCK_ACTIVITIES.map((item, i) => {
                  const cat = CATEGORY_STYLE[item.category]
                  return (
                    <div
                      key={i}
                      className="px-5 py-3 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-zinc-800/20 transition-colors"
                    >
                      <span className="font-mono text-xs text-slate-300 dark:text-zinc-700 w-12 shrink-0 tabular-nums">
                        {item.time}
                      </span>
                      <span className="text-sm leading-none shrink-0">{cat.icon}</span>
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className={`text-xs font-semibold shrink-0 ${cat.color}`}>
                          {item.app}
                        </span>
                        <span className="text-slate-300 dark:text-zinc-700 text-xs shrink-0">·</span>
                        <span className="text-slate-500 dark:text-zinc-500 text-xs truncate">{item.detail}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <button
              onClick={() => setState("clocked-out")}
              className="group w-full flex items-center justify-center gap-3 bg-white dark:bg-zinc-900 hover:bg-red-50 dark:hover:bg-red-950/50 border border-slate-200 dark:border-zinc-800 hover:border-red-300 dark:hover:border-red-900/60 text-slate-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 font-semibold px-8 py-4 rounded-2xl transition-all duration-200 active:scale-[0.98]"
            >
              <HugeiconsIcon
                icon={Logout01Icon}
                size={18}
                className="text-current transition-transform group-hover:translate-x-0.5"
              />
              Clock Out
            </button>
          </div>
        )}

        {/* ─────────────── CLOCKED OUT ─────────────── */}
        {state === "clocked-out" && (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="text-center pt-6">
              <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-400/10 border border-emerald-200 dark:border-emerald-400/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <HugeiconsIcon icon={CheckmarkCircle01Icon} size={30} className="text-emerald-500 dark:text-emerald-400" />
              </div>
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-1">Day Complete</h2>
              <p className="text-slate-500 dark:text-zinc-500 text-sm">Great work today, James!</p>
            </div>

            <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-2xl p-7 text-center">
              <p className="text-slate-400 dark:text-zinc-600 text-xs uppercase tracking-[0.2em] mb-3 font-mono">
                Total Time
              </p>
              <div className="font-mono text-6xl font-bold text-slate-900 dark:text-white tabular-nums">
                {fmt(elapsed)}
              </div>
              <div className="flex items-center justify-center gap-4 mt-4 text-xs text-slate-400 dark:text-zinc-600">
                <span>
                  In:{" "}
                  <span className="text-slate-600 dark:text-zinc-400 font-mono">{clockInTime}</span>
                </span>
                <span className="text-slate-200 dark:text-zinc-800">·</span>
                <span>
                  Out:{" "}
                  <span className="text-slate-600 dark:text-zinc-400 font-mono">
                    {new Date().toLocaleTimeString("en-US", {
                      hour: "2-digit", minute: "2-digit", hour12: true,
                    })}
                  </span>
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200/80 dark:border-zinc-800/50 flex items-center gap-2">
                <HugeiconsIcon icon={ClockCheckIcon} size={15} className="text-slate-400 dark:text-zinc-600" />
                <span className="text-slate-600 dark:text-zinc-400 text-sm font-medium">Time Breakdown</span>
              </div>
              <div className="p-5 space-y-3.5">
                {APP_BREAKDOWN.map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="text-slate-500 dark:text-zinc-500 text-sm w-16 shrink-0">{item.label}</span>
                    <div className="flex-1 bg-slate-100 dark:bg-zinc-800/80 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.bar}`}
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                    <span className={`font-mono text-xs font-semibold ${item.color} w-14 text-right shrink-0`}>
                      {item.hours}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5">
              <p className="text-slate-700 dark:text-zinc-400 text-sm font-medium mb-3">
                Meetings Today{" "}
                <span className="font-mono text-slate-300 dark:text-zinc-700 text-xs ml-1">2</span>
              </p>
              <div className="space-y-2.5">
                {[
                  { name: "Team Standup",  duration: "30m", time: "09:47" },
                  { name: "Design Review", duration: "1h",  time: "13:14" },
                ].map((m) => (
                  <div key={m.name} className="flex items-center gap-3 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/70 shrink-0" />
                    <span className="text-slate-600 dark:text-zinc-400 flex-1">{m.name}</span>
                    <span className="text-slate-300 dark:text-zinc-700 font-mono text-xs">{m.time}</span>
                    <span className="text-slate-400 dark:text-zinc-600 text-xs">{m.duration}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => { setElapsed(0); setState("idle") }}
              className="w-full flex items-center justify-center bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-medium px-8 py-3.5 rounded-2xl transition-all duration-200 active:scale-[0.98]"
            >
              Done
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
