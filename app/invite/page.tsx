"use client"

import { Suspense, useState, FormEvent } from "react"
import { useSearchParams } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { Clock01Icon, CheckmarkCircle01Icon, EyeIcon, ViewOffIcon } from "@hugeicons/core-free-icons"

type Stage = "form" | "success" | "invalid"

function InviteForm() {
  const params = useSearchParams()
  const token  = params.get("token") ?? ""

  const [password,   setPassword]   = useState("")
  const [confirm,    setConfirm]    = useState("")
  const [showPw,     setShowPw]     = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState("")
  const [stage,      setStage]      = useState<Stage>(token ? "form" : "invalid")
  const [staffName,  setStaffName]  = useState("")

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")

    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (password !== confirm) {
      setError("Passwords don't match.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/invite/accept", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token, password }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Something went wrong")
        if (res.status === 400) setStage("invalid")
        return
      }

      setStaffName(data.name)
      setStage("success")
    } catch {
      setError("Network error — please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {stage === "invalid" && (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">🔗</div>
          <h1 className="text-white font-semibold mb-2">Link expired or invalid</h1>
          <p className="text-zinc-500 text-sm">
            This invite link is no longer valid. Ask your admin to send a new invite.
          </p>
        </div>
      )}

      {stage === "success" && (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-8 text-center">
          <div className="w-14 h-14 bg-emerald-400/10 border border-emerald-400/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <HugeiconsIcon icon={CheckmarkCircle01Icon} size={28} className="text-emerald-400" />
          </div>
          <h1 className="text-white font-semibold mb-2">Welcome, {staffName}!</h1>
          <p className="text-zinc-500 text-sm mb-6">
            Your account is set up. You can now close this tab and open the trackR web app to clock in.
          </p>
          <a
            href="/employee"
            className="inline-flex items-center justify-center bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
          >
            Go to Dashboard →
          </a>
        </div>
      )}

      {stage === "form" && (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-8 backdrop-blur-sm">
          <div className="mb-6">
            <h1 className="text-white text-base font-semibold mb-1">Set up your account</h1>
            <p className="text-zinc-500 text-sm">Choose a password to activate your trackR account.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-zinc-400 text-xs font-medium mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-800/60 border border-zinc-700/60 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 rounded-lg px-3.5 py-2.5 pr-10 text-white text-sm placeholder-zinc-600 outline-none transition-all"
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  <HugeiconsIcon icon={showPw ? ViewOffIcon : EyeIcon} size={15} className="text-current" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-zinc-400 text-xs font-medium mb-1.5">Confirm password</label>
              <input
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full bg-zinc-800/60 border border-zinc-700/60 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 rounded-lg px-3.5 py-2.5 text-white text-sm placeholder-zinc-600 outline-none transition-all"
                placeholder="Repeat password"
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-400 hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-semibold py-2.5 rounded-lg transition-colors text-sm mt-2"
            >
              {loading ? "Setting up…" : "Activate Account →"}
            </button>
          </form>
        </div>
      )}
    </>
  )
}

export default function InvitePage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none" />
      <div className="relative w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 bg-amber-400 rounded-xl flex items-center justify-center">
            <HugeiconsIcon icon={Clock01Icon} size={18} className="text-zinc-950" />
          </div>
          <span className="font-mono text-2xl font-bold text-white tracking-tight">
            track<span className="text-amber-400">R</span>
          </span>
        </div>
        <Suspense fallback={<div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500 text-sm">Loading…</div>}>
          <InviteForm />
        </Suspense>
      </div>
    </div>
  )
}
