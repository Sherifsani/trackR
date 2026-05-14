import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Briefcase01Icon,
  ShieldUserIcon,
  ArrowRight01Icon,
  Clock01Icon,
  UserGroupIcon,
  ChartHistogramIcon,
} from "@hugeicons/core-free-icons"
import { ThemeToggle } from "@/components/theme-toggle"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-8 relative overflow-hidden bg-grid">
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-amber-400/[0.06] dark:bg-amber-400/[0.04] rounded-full blur-[120px] pointer-events-none" />

      {/* Theme toggle — top right */}
      <div className="absolute top-5 right-5">
        <ThemeToggle />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-2xl">
        {/* Logo mark */}
        <div className="mb-3 flex items-center justify-center">
          <div className="w-12 h-12 bg-amber-400 rounded-xl flex items-center justify-center shadow-lg shadow-amber-400/20">
            <HugeiconsIcon icon={Clock01Icon} size={22} className="text-zinc-950" />
          </div>
        </div>

        {/* Wordmark */}
        <div className="mb-3 text-center">
          <h1 className="font-mono text-5xl font-bold text-slate-900 dark:text-white tracking-tight">
            track<span className="text-amber-500 dark:text-amber-400">R</span>
          </h1>
        </div>

        <p className="text-slate-400 dark:text-zinc-500 text-xs tracking-[0.25em] uppercase mb-14">
          Employee Time Tracking &amp; Verification
        </p>

        {/* Feature pills */}
        <div className="flex items-center gap-3 mb-12 flex-wrap justify-center">
          {[
            { icon: Clock01Icon,        label: "Clock In/Out"       },
            { icon: ChartHistogramIcon, label: "Activity Tracking"  },
            { icon: UserGroupIcon,      label: "Team Management"    },
            { icon: Briefcase01Icon,    label: "Payroll"            },
          ].map((f) => (
            <div
              key={f.label}
              className="flex items-center gap-1.5 bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-full px-3 py-1 text-slate-500 dark:text-zinc-500 text-xs"
            >
              <HugeiconsIcon icon={f.icon} size={12} className="text-current" />
              {f.label}
            </div>
          ))}
        </div>

        {/* Role selection */}
        <div className="grid grid-cols-2 gap-4 w-full">
          {/* Employee */}
          <Link href="/employee" className="group outline-none">
            <div className="bg-white dark:bg-zinc-900/70 border border-slate-200 dark:border-zinc-800 rounded-2xl p-7 flex flex-col gap-5 hover:border-amber-400/60 dark:hover:border-amber-400/40 hover:shadow-xl hover:shadow-amber-400/5 dark:hover:shadow-amber-400/5 transition-all duration-300 cursor-pointer h-full group-focus-visible:ring-2 group-focus-visible:ring-amber-400/50">
              <div className="w-12 h-12 bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/20 rounded-xl flex items-center justify-center transition-colors group-hover:bg-amber-100 dark:group-hover:bg-amber-400/15">
                <HugeiconsIcon icon={Briefcase01Icon} size={20} className="text-amber-500 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Employee</h2>
                <p className="text-slate-500 dark:text-zinc-500 text-sm leading-relaxed">
                  Clock in, monitor your session, and submit daily work logs.
                </p>
              </div>
              <div className="flex items-center gap-2 text-amber-500 dark:text-amber-400 text-sm font-medium transition-[gap] duration-200 group-hover:gap-3">
                <span>Enter Portal</span>
                <HugeiconsIcon icon={ArrowRight01Icon} size={15} className="text-current" />
              </div>
            </div>
          </Link>

          {/* Admin */}
          <Link href="/admin" className="group outline-none">
            <div className="bg-white dark:bg-zinc-900/70 border border-slate-200 dark:border-zinc-800 rounded-2xl p-7 flex flex-col gap-5 hover:border-slate-400 dark:hover:border-zinc-600/50 hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-black/40 transition-all duration-300 cursor-pointer h-full group-focus-visible:ring-2 group-focus-visible:ring-slate-400/50">
              <div className="w-12 h-12 bg-slate-100 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700/50 rounded-xl flex items-center justify-center transition-colors group-hover:bg-slate-200 dark:group-hover:bg-zinc-800">
                <HugeiconsIcon icon={ShieldUserIcon} size={20} className="text-slate-600 dark:text-zinc-300" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Admin</h2>
                <p className="text-slate-500 dark:text-zinc-500 text-sm leading-relaxed">
                  Review work logs, verify employee activity, and issue payments.
                </p>
              </div>
              <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 text-sm font-medium transition-[gap] duration-200 group-hover:gap-3">
                <span>Admin Panel</span>
                <HugeiconsIcon icon={ArrowRight01Icon} size={15} className="text-current" />
              </div>
            </div>
          </Link>
        </div>

        <p className="mt-10 text-slate-400 dark:text-zinc-700 text-xs">
          Press{" "}
          <kbd className="font-mono bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 px-1.5 py-0.5 rounded-md text-slate-400 dark:text-zinc-500 text-[10px]">
            D
          </kbd>{" "}
          to toggle theme
        </p>
      </div>
    </div>
  )
}
