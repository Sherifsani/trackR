"use client"

import { useState } from "react"
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
} from "@hugeicons/core-free-icons"
import { ThemeToggle } from "@/components/theme-toggle"

type TabType = "overview" | "payments"
type EmployeeStatus = "active" | "clocked-out" | "absent"

const EMPLOYEES = [
  { id: 1, name: "James Mitchell", initials: "JM", role: "Frontend Dev",     status: "active"      as EmployeeStatus, clockIn: "09:00", hours: "4h 32m" },
  { id: 2, name: "Sarah Al-Omar",  initials: "SA", role: "Product Designer", status: "active"      as EmployeeStatus, clockIn: "08:15", hours: "5h 17m" },
  { id: 3, name: "Mike Chen",      initials: "MC", role: "Backend Engineer", status: "clocked-out" as EmployeeStatus, clockIn: "08:30", hours: "8h 00m" },
  { id: 4, name: "Amira Hassan",   initials: "AH", role: "QA Engineer",      status: "active"      as EmployeeStatus, clockIn: "09:30", hours: "3h 02m" },
  { id: 5, name: "David Okafor",   initials: "DO", role: "DevOps Engineer",  status: "absent"      as EmployeeStatus, clockIn: "—",     hours: "0h 00m" },
  { id: 6, name: "Lena Bauer",     initials: "LB", role: "Project Manager",  status: "clocked-out" as EmployeeStatus, clockIn: "07:45", hours: "8h 15m" },
]

const PAYROLL = [
  { id: 1, name: "James Mitchell", initials: "JM", weekHours: 38.5,  rate: 45, paid: false },
  { id: 2, name: "Sarah Al-Omar",  initials: "SA", weekHours: 42.0,  rate: 52, paid: true  },
  { id: 3, name: "Mike Chen",      initials: "MC", weekHours: 40.0,  rate: 48, paid: false },
  { id: 4, name: "Amira Hassan",   initials: "AH", weekHours: 35.5,  rate: 40, paid: false },
  { id: 5, name: "David Okafor",   initials: "DO", weekHours: 32.0,  rate: 55, paid: true  },
  { id: 6, name: "Lena Bauer",     initials: "LB", weekHours: 40.25, rate: 47, paid: false },
]

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

const AVATAR_COLOR: Record<string, string> = {
  JM: "bg-amber-50 dark:bg-amber-400/15 text-amber-600 dark:text-amber-300 border-amber-200 dark:border-amber-400/20",
  SA: "bg-violet-50 dark:bg-violet-400/15 text-violet-600 dark:text-violet-300 border-violet-200 dark:border-violet-400/20",
  MC: "bg-sky-50 dark:bg-sky-400/15 text-sky-600 dark:text-sky-300 border-sky-200 dark:border-sky-400/20",
  AH: "bg-emerald-50 dark:bg-emerald-400/15 text-emerald-600 dark:text-emerald-300 border-emerald-200 dark:border-emerald-400/20",
  DO: "bg-orange-50 dark:bg-orange-400/15 text-orange-600 dark:text-orange-300 border-orange-200 dark:border-orange-400/20",
  LB: "bg-pink-50 dark:bg-pink-400/15 text-pink-600 dark:text-pink-300 border-pink-200 dark:border-pink-400/20",
}

function Avatar({ initials, sm }: { initials: string; sm?: boolean }) {
  const cls = AVATAR_COLOR[initials] ?? "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700"
  return (
    <div
      className={`${sm ? "w-7 h-7 text-[10px]" : "w-9 h-9 text-xs"} ${cls} rounded-full flex items-center justify-center font-mono font-bold border shrink-0`}
    >
      {initials}
    </div>
  )
}

export default function AdminPage() {
  const [tab, setTab]           = useState<TabType>("overview")
  const [paid, setPaid]         = useState<Record<number, boolean>>(
    Object.fromEntries(PAYROLL.map((p) => [p.id, p.paid]))
  )
  const [approved, setApproved] = useState<Record<number, boolean>>({})

  const activeCount  = EMPLOYEES.filter((e) => e.status === "active").length
  const pendingCount = EMPLOYEES.filter((e) => e.status === "clocked-out" && !approved[e.id]).length
  const totalPayroll = PAYROLL.reduce((s, e) => s + e.weekHours * e.rate, 0)
  const paidCount    = Object.values(paid).filter(Boolean).length

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex">
      {/* ── Sidebar ── */}
      <aside className="w-56 shrink-0 border-r border-slate-200 dark:border-zinc-800/50 flex flex-col bg-white dark:bg-zinc-900/20 sticky top-0 h-screen">
        {/* Logo */}
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

        {/* Nav */}
        <nav className="flex-1 p-3 overflow-y-auto scrollbar-thin">
          <p className="text-slate-400 dark:text-zinc-700 text-[10px] uppercase tracking-[0.18em] font-medium px-2 mb-2 mt-1">
            Menu
          </p>
          <div className="space-y-0.5">
            {([
              { id: "overview" as TabType, icon: Home01Icon,  label: "Overview", badge: null                               },
              { id: "payments" as TabType, icon: Money01Icon, label: "Payments", badge: PAYROLL.length - paidCount || null },
            ] as const).map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
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

          {/* Team mini-list */}
          <div className="mt-5">
            <p className="text-slate-400 dark:text-zinc-700 text-[10px] uppercase tracking-[0.18em] font-medium px-2 mb-2">
              Team
            </p>
            <div className="space-y-0.5">
              {EMPLOYEES.slice(0, 5).map((e) => {
                const s = STATUS_CFG[e.status]
                return (
                  <div
                    key={e.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer"
                  >
                    <Avatar initials={e.initials} sm />
                    <span className="text-slate-500 dark:text-zinc-500 text-xs truncate flex-1 min-w-0">
                      {e.name.split(" ")[0]}
                    </span>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot} shrink-0 ${s.pulse ? "animate-pulse" : ""}`} />
                  </div>
                )
              })}
            </div>
          </div>
        </nav>

        {/* Admin profile + theme toggle */}
        <div className="p-4 border-t border-slate-200 dark:border-zinc-800/50 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700/50 rounded-full flex items-center justify-center shrink-0">
              <HugeiconsIcon icon={ShieldUserIcon} size={13} className="text-slate-500 dark:text-zinc-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-slate-700 dark:text-zinc-300 text-xs font-medium truncate">Administrator</p>
              <p className="text-slate-400 dark:text-zinc-600 text-[10px] truncate">admin@company.com</p>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-auto">

        {/* ── Overview ── */}
        {tab === "overview" && (
          <div className="p-8 max-w-5xl mx-auto w-full">
            <div className="flex items-start justify-between mb-8">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Overview</h1>
                <p className="text-slate-400 dark:text-zinc-500 text-sm mt-0.5">Wednesday, May 14 · Today</p>
              </div>
              <button className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/50 px-3 py-2 rounded-lg transition-colors">
                <HugeiconsIcon icon={Activity01Icon} size={13} className="text-current" />
                Export Report
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                {
                  label:  "Total Employees",
                  value:  EMPLOYEES.length.toString(),
                  sub:    "across all teams",
                  icon:   <HugeiconsIcon icon={UserGroupIcon} size={16} className="text-slate-400 dark:text-zinc-500" />,
                  accent: "text-slate-900 dark:text-white",
                },
                {
                  label:  "Currently Active",
                  value:  activeCount.toString(),
                  sub:    "online now",
                  icon:   <span className="w-2 h-2 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-pulse inline-block" />,
                  accent: "text-emerald-600 dark:text-emerald-400",
                },
                {
                  label:  "Pending Review",
                  value:  pendingCount.toString(),
                  sub:    "need approval",
                  icon:   <HugeiconsIcon icon={ClockAlertIcon} size={16} className="text-amber-500 dark:text-amber-400" />,
                  accent: "text-amber-600 dark:text-amber-400",
                },
                {
                  label:  "Hours Today",
                  value:  "36h 06m",
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

            {/* Employee table */}
            <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200/80 dark:border-zinc-800/50 flex items-center justify-between">
                <h2 className="text-slate-900 dark:text-white text-sm font-semibold">Employees</h2>
                <span className="text-slate-400 dark:text-zinc-600 text-xs font-mono">{EMPLOYEES.length} total</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-zinc-800/30">
                {EMPLOYEES.map((emp) => {
                  const s        = STATUS_CFG[emp.status]
                  const isApproved = approved[emp.id]
                  return (
                    <div
                      key={emp.id}
                      className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-zinc-800/15 transition-colors group"
                    >
                      <Avatar initials={emp.initials} />

                      <div className="flex-1 min-w-0">
                        <p className="text-slate-900 dark:text-white text-sm font-medium leading-none">{emp.name}</p>
                        <p className="text-slate-400 dark:text-zinc-600 text-xs mt-1">{emp.role}</p>
                      </div>

                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${s.text} ${s.bg} ${s.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${s.pulse ? "animate-pulse" : ""}`} />
                        {s.label}
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
                        <button className="text-xs text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 px-2.5 py-1.5 rounded-lg transition-colors">
                          View
                        </button>
                        {emp.status === "clocked-out" && !isApproved && (
                          <button
                            onClick={() => setApproved((p) => ({ ...p, [emp.id]: true }))}
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
                          <button className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 border border-amber-200 dark:border-amber-900/40 hover:border-amber-300 dark:hover:border-amber-700/60 bg-amber-50 dark:bg-amber-400/5 hover:bg-amber-100 dark:hover:bg-amber-400/10 px-2.5 py-1.5 rounded-lg transition-colors">
                            Monitor
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Payments ── */}
        {tab === "payments" && (
          <div className="p-8 max-w-5xl mx-auto w-full">
            <div className="mb-8">
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Payments</h1>
              <p className="text-slate-400 dark:text-zinc-500 text-sm mt-0.5">Week of May 12–18, 2026</p>
            </div>

            {/* Payroll summary */}
            <div className="relative bg-white dark:bg-zinc-900/50 border border-amber-200 dark:border-zinc-800 rounded-2xl p-6 mb-6 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-50 dark:from-amber-400/5 via-transparent to-transparent pointer-events-none" />
              <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/20 rounded-xl flex items-center justify-center shrink-0">
                    <HugeiconsIcon icon={Money01Icon} size={22} className="text-amber-500 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-slate-400 dark:text-zinc-500 text-xs uppercase tracking-wider mb-0.5">
                      Total Payroll This Week
                    </p>
                    <p className="font-mono text-4xl font-bold text-slate-900 dark:text-white">
                      ${totalPayroll.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                </div>
                <div className="sm:ml-auto flex items-center gap-6">
                  {[
                    { val: paidCount,                  label: "Paid",        color: "text-emerald-600 dark:text-emerald-400" },
                    { val: PAYROLL.length - paidCount, label: "Pending",     color: "text-amber-600 dark:text-amber-400"     },
                    {
                      val: `$${PAYROLL.filter((p) => !paid[p.id])
                        .reduce((s, p) => s + p.weekHours * p.rate, 0)
                        .toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                      label: "Outstanding",
                      color: "text-slate-900 dark:text-white",
                    },
                  ].map((item, i) => (
                    <div key={i} className="text-center">
                      <p className={`font-mono text-xl font-bold ${item.color}`}>{item.val}</p>
                      <p className="text-slate-400 dark:text-zinc-600 text-xs mt-0.5">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Wage table */}
            <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200/80 dark:border-zinc-800/50 flex items-center justify-between">
                <h2 className="text-slate-900 dark:text-white text-sm font-semibold">Employee Wages</h2>
                <button
                  onClick={() => setPaid(Object.fromEntries(PAYROLL.map((p) => [p.id, true])))}
                  className="text-xs text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Pay All
                </button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-zinc-800/30">
                {PAYROLL.map((emp) => {
                  const wages  = emp.weekHours * emp.rate
                  const isPaid = paid[emp.id]
                  return (
                    <div
                      key={emp.id}
                      className={`px-6 py-4 flex items-center gap-4 transition-colors ${
                        isPaid ? "opacity-50" : "hover:bg-slate-50 dark:hover:bg-zinc-800/15"
                      }`}
                    >
                      <Avatar initials={emp.initials} />

                      <div className="flex-1 min-w-0">
                        <p className="text-slate-900 dark:text-white text-sm font-medium">{emp.name}</p>
                      </div>

                      <div className="text-right w-20 hidden sm:block">
                        <p className="text-slate-300 dark:text-zinc-700 text-[10px] uppercase tracking-wider mb-0.5">Hours</p>
                        <p className="text-slate-600 dark:text-zinc-400 text-sm font-mono">{emp.weekHours}h</p>
                      </div>

                      <div className="text-right w-20 hidden sm:block">
                        <p className="text-slate-300 dark:text-zinc-700 text-[10px] uppercase tracking-wider mb-0.5">Rate</p>
                        <p className="text-slate-600 dark:text-zinc-400 text-sm font-mono">${emp.rate}/hr</p>
                      </div>

                      <div className="text-right w-28">
                        <p className="text-slate-300 dark:text-zinc-700 text-[10px] uppercase tracking-wider mb-0.5">Wages</p>
                        <p className="text-slate-900 dark:text-white text-base font-mono font-bold">
                          ${wages.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      </div>

                      <div className="w-36 flex justify-end">
                        {isPaid ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs border border-emerald-200 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-400/5 px-3 py-1.5 rounded-lg">
                            <HugeiconsIcon icon={CheckmarkCircle01Icon} size={13} className="text-current" />
                            <span>Payment Sent</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => setPaid((p) => ({ ...p, [emp.id]: true }))}
                            className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 border border-amber-200 dark:border-amber-900/40 hover:border-amber-300 dark:hover:border-amber-700/50 bg-amber-50 dark:bg-amber-400/5 hover:bg-amber-100 dark:hover:bg-amber-400/10 px-3 py-1.5 rounded-lg transition-all active:scale-95"
                          >
                            <HugeiconsIcon icon={DollarCircleIcon} size={13} className="text-current" />
                            <span>Issue Payment</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
