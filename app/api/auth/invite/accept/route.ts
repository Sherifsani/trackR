import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { signToken, authCookieOptions } from "@/lib/auth"

export async function POST(req: NextRequest) {
  const { token, password } = await req.json()

  if (!token || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Token and password (min 8 chars) required" },
      { status: 400 }
    )
  }

  const employee = await db.employee.findUnique({ where: { inviteToken: token } })

  if (!employee || !employee.inviteExpiry || employee.inviteExpiry < new Date()) {
    return NextResponse.json({ error: "Invite link is invalid or has expired" }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 12)

  await db.employee.update({
    where: { id: employee.id },
    data:  {
      passwordHash,
      inviteToken:  null,
      inviteExpiry: null,
      status:       "active",
    },
  })

  const jwt = await signToken({
    sub:   employee.id,
    role:  "employee",
    email: employee.email!,
    name:  employee.name,
    apiId: employee.apiId,
  })

  const res = NextResponse.json({ ok: true, name: employee.name })
  res.cookies.set(authCookieOptions(jwt))
  return res
}
