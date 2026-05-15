// Dev-only endpoint to create the initial admin account.
// Remove or gate behind an env check before going to production.

import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 })
  }

  const { name, email, password } = await req.json()

  if (!name || !email || !password) {
    return NextResponse.json({ error: "name, email, password required" }, { status: 400 })
  }

  const existing = await db.admin.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) {
    return NextResponse.json({ error: "Admin already exists", id: existing.id })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const admin = await db.admin.create({
    data: { name, email: email.toLowerCase(), passwordHash },
  })

  return NextResponse.json({ ok: true, id: admin.id, email: admin.email })
}
