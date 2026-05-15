import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Clock01Icon,
  Activity01Icon,
  ChartHistogramIcon,
  ShieldUserIcon,
  ArrowRight01Icon,
  Mail01Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white overflow-x-hidden">

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 md:px-12 h-16 border-b border-white/[0.04] bg-zinc-950/80 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-amber-400 rounded-md flex items-center justify-center shrink-0">
            <HugeiconsIcon icon={Clock01Icon} size={13} className="text-zinc-950" />
          </div>
          <span className="font-mono text-sm font-bold tracking-tight">
            track<span className="text-amber-400">R</span>
          </span>
        </div>
        <Link
          href="/login"
          className="text-sm text-zinc-400 hover:text-white transition-colors"
        >
          Sign in →
        </Link>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center min-h-screen text-center px-6 pt-16 bg-grid overflow-hidden">

        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-amber-400/[0.07] rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-[400px] h-[400px] bg-amber-400/[0.05] rounded-full blur-[80px] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center max-w-3xl">

          {/* Eyebrow */}
          <div
            className="mb-8 inline-flex items-center gap-2 border border-amber-400/20 bg-amber-400/5 rounded-full px-3.5 py-1.5"
            style={{ animation: "fadeUp 0.6s ease both" }}
          >
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
            <span className="text-amber-400/80 text-xs font-mono tracking-wider uppercase">Employee Time Tracking</span>
          </div>

          {/* Headline */}
          <h1
            className="font-mono text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6"
            style={{ animation: "fadeUp 0.6s 0.1s ease both" }}
          >
            Track every hour.
            <br />
            <span className="text-amber-400">Pay every worker.</span>
          </h1>

          {/* Subtext */}
          <p
            className="text-zinc-400 text-lg md:text-xl leading-relaxed max-w-xl mb-10"
            style={{ animation: "fadeUp 0.6s 0.2s ease both" }}
          >
            Real-time activity tracking, session management, and payroll — built
            for teams that value transparency.
          </p>

          {/* CTAs */}
          <div
            className="flex items-center gap-4 flex-wrap justify-center"
            style={{ animation: "fadeUp 0.6s 0.3s ease both" }}
          >
            <Link
              href="/login"
              className="group flex items-center gap-2.5 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold px-7 py-3.5 rounded-xl transition-all duration-200 hover:shadow-xl hover:shadow-amber-400/25 active:scale-[0.97] text-sm"
            >
              Get Started
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                size={15}
                className="text-current transition-transform group-hover:translate-x-0.5"
              />
            </Link>
            <Link
              href="/login"
              className="flex items-center gap-2 text-zinc-400 hover:text-white border border-white/10 hover:border-white/20 px-7 py-3.5 rounded-xl transition-all duration-200 text-sm"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Dashboard preview strip */}
        <div
          className="relative z-10 mt-20 w-full max-w-2xl"
          style={{ animation: "fadeUp 0.6s 0.45s ease both" }}
        >
          <div className="bg-zinc-900/80 border border-white/[0.07] rounded-2xl overflow-hidden backdrop-blur-sm shadow-2xl shadow-black/60">
            {/* Fake header bar */}
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/[0.05]">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500/50" />
                <span className="w-3 h-3 rounded-full bg-amber-500/50" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/50" />
              </div>
              <div className="flex-1 mx-4">
                <div className="h-5 bg-white/[0.04] rounded-md w-48 mx-auto flex items-center justify-center">
                  <span className="font-mono text-[10px] text-zinc-600">app.trackr.io/employee</span>
                </div>
              </div>
            </div>
            {/* Fake session UI */}
            <div className="p-8 flex flex-col items-center gap-4">
              <p className="font-mono text-[10px] text-zinc-600 uppercase tracking-[0.2em]">Active Session</p>
              <p className="font-mono text-5xl font-bold text-amber-400 tabular-nums tracking-tight">04:27:13</p>
              <p className="text-zinc-600 text-xs font-mono">Clocked in at <span className="text-zinc-400">09:00 AM</span></p>
              <div className="w-full max-w-xs mt-2 space-y-2">
                {[
                  { cat: "Development", color: "bg-violet-500", w: "78%" },
                  { cat: "Meetings",    color: "bg-emerald-500", w: "14%" },
                  { cat: "Comms",       color: "bg-blue-500",   w: "8%"  },
                ].map(({ cat, color, w }) => (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="text-zinc-600 text-xs w-24 shrink-0">{cat}</span>
                    <div className="flex-1 bg-white/[0.04] rounded-full h-1">
                      <div className={`h-full rounded-full ${color}`} style={{ width: w }} />
                    </div>
                    <span className="text-zinc-600 text-xs font-mono w-8 text-right">{w}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Bottom fade */}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none" />
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-30">
          <div className="w-px h-10 bg-gradient-to-b from-transparent via-white to-transparent animate-pulse" />
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section className="px-6 md:px-12 py-28 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="font-mono text-amber-400/60 text-xs uppercase tracking-[0.3em] mb-4">What trackR does</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Everything you need,<br />nothing you don't.</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              icon: Clock01Icon,
              title: "Clock In / Clock Out",
              desc:  "One tap to start a session. Timestamps are immutable — no editing after the fact.",
              accent: "amber",
            },
            {
              icon: Activity01Icon,
              title: "Live Activity Tracking",
              desc:  "Browser activity captured in real time via the Chrome extension. Categorised automatically by type.",
              accent: "violet",
            },
            {
              icon: ChartHistogramIcon,
              title: "Session Analytics",
              desc:  "Per-session breakdowns of how time was spent — development, meetings, comms, research and more.",
              accent: "blue",
            },
            {
              icon: ShieldUserIcon,
              title: "Admin Verification",
              desc:  "Admins review and approve sessions before payroll. Full audit trail, no disputes.",
              accent: "emerald",
            },
            {
              icon: UserMultiple02Icon,
              title: "Team Management",
              desc:  "Invite employees by email. Set hourly rates, break allowances, and roles per person.",
              accent: "amber",
            },
            {
              icon: Mail01Icon,
              title: "Invite Onboarding",
              desc:  "New employees join via a secure invite link. No password creation friction.",
              accent: "zinc",
            },
          ].map(({ icon, title, desc, accent }) => {
            const colors: Record<string, { border: string; bg: string; icon: string }> = {
              amber:  { border: "hover:border-amber-400/25",  bg: "bg-amber-400/8",  icon: "text-amber-400"  },
              violet: { border: "hover:border-violet-400/25", bg: "bg-violet-400/8", icon: "text-violet-400" },
              blue:   { border: "hover:border-blue-400/25",   bg: "bg-blue-400/8",   icon: "text-blue-400"   },
              emerald:{ border: "hover:border-emerald-400/25",bg: "bg-emerald-400/8",icon: "text-emerald-400"},
              zinc:   { border: "hover:border-zinc-500/40",   bg: "bg-white/[0.04]", icon: "text-zinc-400"   },
            }
            const c = colors[accent]
            return (
              <div
                key={title}
                className={`bg-zinc-900/50 border border-white/[0.06] ${c.border} rounded-2xl p-6 flex flex-col gap-4 transition-all duration-300 group`}
              >
                <div className={`w-10 h-10 ${c.bg} rounded-xl flex items-center justify-center shrink-0`}>
                  <HugeiconsIcon icon={icon} size={18} className={c.icon} />
                </div>
                <div>
                  <h3 className="text-white text-sm font-semibold mb-1.5">{title}</h3>
                  <p className="text-zinc-500 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <section className="px-6 md:px-12 py-20 border-t border-white/[0.04]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <p className="font-mono text-amber-400/60 text-xs uppercase tracking-[0.3em] mb-4">How it works</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Up and running in minutes.</h2>
          </div>

          <div className="space-y-px">
            {[
              {
                n:    "01",
                head: "Admin invites the team",
                body: "Enter each employee's name and email. trackR sends a secure invite link — no manual account setup.",
              },
              {
                n:    "02",
                head: "Employees clock in and work",
                body: "Employees accept their invite, set a password, and start clocking in. The Chrome extension captures activity automatically.",
              },
              {
                n:    "03",
                head: "Review, approve, and pay",
                body: "At the end of each period, admins review sessions, approve them, and trigger payroll — all from one dashboard.",
              },
            ].map(({ n, head, body }, i) => (
              <div
                key={n}
                className="flex gap-8 py-8 border-b border-white/[0.04] last:border-0 group"
              >
                <div className="shrink-0 pt-0.5">
                  <span className="font-mono text-4xl font-bold text-white/[0.06] group-hover:text-amber-400/20 transition-colors duration-300 tabular-nums">
                    {n}
                  </span>
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg mb-2">{head}</h3>
                  <p className="text-zinc-500 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ──────────────────────────────────────────────────────── */}
      <section className="px-6 md:px-12 py-28">
        <div className="max-w-2xl mx-auto text-center relative">
          <div className="absolute inset-0 -z-10 bg-amber-400/[0.04] rounded-3xl blur-2xl" />
          <div className="bg-zinc-900/60 border border-white/[0.07] rounded-3xl p-12 backdrop-blur-sm">
            <div className="w-12 h-12 bg-amber-400 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-400/20">
              <HugeiconsIcon icon={Clock01Icon} size={20} className="text-zinc-950" />
            </div>
            <h2 className="font-mono text-3xl font-bold text-white tracking-tight mb-4">
              Ready to get started?
            </h2>
            <p className="text-zinc-400 leading-relaxed mb-8 max-w-md mx-auto">
              If your admin has invited you, check your email for a setup link.
              Already have an account? Sign in below.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Link
                href="/login"
                className="group flex items-center gap-2.5 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold px-7 py-3.5 rounded-xl transition-all duration-200 hover:shadow-xl hover:shadow-amber-400/25 active:scale-[0.97] text-sm"
              >
                Sign In
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  size={15}
                  className="text-current transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </div>
            <p className="text-zinc-700 text-xs mt-6 font-mono">
              No invite yet? Ask your manager to add you from the admin panel.
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.04] px-6 md:px-12 py-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-amber-400 rounded flex items-center justify-center shrink-0">
            <HugeiconsIcon icon={Clock01Icon} size={10} className="text-zinc-950" />
          </div>
          <span className="font-mono text-xs font-bold text-zinc-600">
            track<span className="text-amber-400">R</span>
          </span>
        </div>
        <p className="text-zinc-700 text-xs font-mono">© {new Date().getFullYear()}</p>
      </footer>

      {/* ── Keyframes ───────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>
    </div>
  )
}
