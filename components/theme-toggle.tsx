"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { HugeiconsIcon } from "@hugeicons/react"
import { Sun01Icon, Moon01Icon } from "@hugeicons/core-free-icons"

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="w-8 h-8 rounded-lg" />

  const isDark = resolvedTheme === "dark"

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
      className={`w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800/60 transition-colors text-slate-500 dark:text-zinc-400 ${className ?? ""}`}
    >
      {isDark
        ? <HugeiconsIcon icon={Sun01Icon}  size={15} className="text-current" />
        : <HugeiconsIcon icon={Moon01Icon} size={15} className="text-current" />
      }
    </button>
  )
}
