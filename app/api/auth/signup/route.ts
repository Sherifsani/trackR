import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { signToken, authCookieOptions } from "@/lib/auth"

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json() as {
    name:     string
    email:    string
    password: string
  }

  if (!name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: "Name, email and password are required" }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
  }

  const lower = email.toLowerCase().trim()

  const existing = await db.admin.findUnique({ where: { email: lower } })
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const admin = await db.admin.create({
    data: { name: name.trim(), email: lower, passwordHash },
  })

  const token = await signToken({ sub: admin.id, role: "admin", email: admin.email, name: admin.name })
  const res   = NextResponse.json({ ok: true, name: admin.name })
  res.cookies.set(authCookieOptions(token))
  return res
}
