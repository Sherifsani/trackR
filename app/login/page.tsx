"use client"

import { Suspense, useState, FormEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { Clock01Icon, ShieldUserIcon, EyeIcon, ViewOffIcon } from "@hugeicons/core-free-icons"

function LoginForm() {
  const router      = useRouter()
  const params      = useSearchParams()
  const from        = params.get("from") ?? ""

  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState("")

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/auth/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "Login failed")
        return
      }

      const dest = from || (data.role === "employee" ? "/employee" : "/admin")
      router.push(dest)
      router.refresh()
    } catch {
      setError("Network error — is the server running?")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      {/* Background grid */}
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

        {/* Card */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-8 backdrop-blur-sm">
          {/* Heading */}
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 bg-zinc-800 border border-zinc-700/50 rounded-lg flex items-center justify-center">
              <HugeiconsIcon icon={ShieldUserIcon} size={15} className="text-zinc-400" />
            </div>
            <div>
              <h1 className="text-white text-sm font-semibold leading-none">Admin Login</h1>
              <p className="text-zinc-600 text-xs mt-0.5">Secure access for administrators</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-zinc-400 text-xs font-medium mb-1.5" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-800/60 border border-zinc-700/60 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 rounded-lg px-3.5 py-2.5 text-white text-sm placeholder-zinc-600 outline-none transition-all"
                placeholder="admin@company.com"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-zinc-400 text-xs font-medium mb-1.5" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-800/60 border border-zinc-700/60 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 rounded-lg px-3.5 py-2.5 pr-10 text-white text-sm placeholder-zinc-600 outline-none transition-all"
                  placeholder="••••••••"
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

            {/* Error */}
            {error && (
              <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-400 hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-semibold py-2.5 rounded-lg transition-colors text-sm mt-2"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>

        <p className="text-zinc-600 text-xs text-center mt-4">
          New admin?{" "}
          <Link href="/signup" className="text-amber-400 hover:text-amber-300 transition-colors">
            Create an account
          </Link>
        </p>
        <p className="text-zinc-700 text-xs text-center mt-1.5">
          Employee? Use the link in your invite email.
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
