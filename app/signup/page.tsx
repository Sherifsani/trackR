"use client"

import { useState, FormEvent } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { Clock01Icon, UserAdd01Icon, EyeIcon, ViewOffIcon } from "@hugeicons/core-free-icons"

export default function SignupPage() {
  const router = useRouter()

  const [name,      setName]      = useState("")
  const [email,     setEmail]     = useState("")
  const [password,  setPassword]  = useState("")
  const [confirm,   setConfirm]   = useState("")
  const [showPw,    setShowPw]    = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState("")

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")

    if (password !== confirm) {
      setError("Passwords don't match")
      return
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }

    setLoading(true)
    try {
      const res  = await fetch("/api/auth/signup", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name, email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Signup failed"); return }
      router.push("/admin?onboarding=1")
      router.refresh()
    } catch {
      setError("Network error — is the server running?")
    } finally {
      setLoading(false)
    }
  }

  const input = "w-full bg-zinc-800/60 border border-zinc-700/60 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 rounded-lg px-3.5 py-2.5 text-white text-sm placeholder-zinc-600 outline-none transition-all"

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none" />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 bg-amber-400 rounded-xl flex items-center justify-center">
            <HugeiconsIcon icon={Clock01Icon} size={18} className="text-zinc-950" />
          </div>
          <span className="font-mono text-2xl font-bold text-white tracking-tight">
            track<span className="text-amber-400">R</span>
          </span>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-8 backdrop-blur-sm">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 bg-zinc-800 border border-zinc-700/50 rounded-lg flex items-center justify-center">
              <HugeiconsIcon icon={UserAdd01Icon} size={15} className="text-zinc-400" />
            </div>
            <div>
              <h1 className="text-white text-sm font-semibold leading-none">Create Admin Account</h1>
              <p className="text-zinc-600 text-xs mt-0.5">Set up your trackR workspace</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-zinc-400 text-xs font-medium mb-1.5" htmlFor="name">
                Full name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={input}
                placeholder="Jane Smith"
              />
            </div>

            <div>
              <label className="block text-zinc-400 text-xs font-medium mb-1.5" htmlFor="email">
                Work email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={input}
                placeholder="jane@company.com"
              />
            </div>

            <div>
              <label className="block text-zinc-400 text-xs font-medium mb-1.5" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${input} pr-10`}
                  placeholder="Min. 8 characters"
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
              <label className="block text-zinc-400 text-xs font-medium mb-1.5" htmlFor="confirm">
                Confirm password
              </label>
              <input
                id="confirm"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={input}
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
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>
        </div>

        <p className="text-zinc-600 text-xs text-center mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-amber-400 hover:text-amber-300 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
