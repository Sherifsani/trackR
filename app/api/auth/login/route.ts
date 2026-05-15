import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { signToken, authCookieOptions } from "@/lib/auth"

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 })
  }

  const lower = email.toLowerCase()

  const admin = await db.admin.findUnique({ where: { email: lower } })
  if (admin && (await bcrypt.compare(password, admin.passwordHash))) {
    const token = await signToken({ sub: admin.id, role: "admin", email: admin.email, name: admin.name })
    const res = NextResponse.json({ ok: true, role: "admin", name: admin.name })
    res.cookies.set(authCookieOptions(token))
    return res
  }

  const employee = await db.employee.findUnique({ where: { email: lower } })
  if (employee?.passwordHash && (await bcrypt.compare(password, employee.passwordHash))) {
    const token = await signToken({
      sub:   employee.id,
      role:  "employee",
      email: employee.email!,
      name:  employee.name,
      apiId: employee.apiId,
    })
    const res = NextResponse.json({ ok: true, role: "employee", name: employee.name })
    res.cookies.set(authCookieOptions(token))
    return res
  }

  return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
}
