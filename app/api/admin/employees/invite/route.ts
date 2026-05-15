import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { db } from "@/lib/db"
import { getAuth } from "@/lib/auth"
import { sendEmail, inviteEmailHtml } from "@/lib/email"

export async function POST(req: NextRequest) {
  const auth = await getAuth()
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { name, email, role, hourlyRate } = await req.json()
  if (!name || !email) {
    return NextResponse.json({ error: "Name and email required" }, { status: 400 })
  }

  // Pull admin defaults so new employees inherit them
  const admin = await db.admin.findUnique({ where: { id: auth.sub } })
  const defaultBreak  = admin?.defaultBreakMinPerDay ?? 60
  const defaultRate   = hourlyRate ?? (admin?.defaultHourlyRate ? Number(admin.defaultHourlyRate) : null)

  const inviteToken  = randomBytes(32).toString("hex")
  const inviteExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000)
  const apiId        = `emp-${Date.now()}`

  const employee = await db.employee.upsert({
    where:  { email: email.toLowerCase() },
    update: { name, inviteToken, inviteExpiry, status: "pending" },
    create: {
      apiId,
      name,
      email:          email.toLowerCase(),
      role:           role ?? null,
      hourlyRate:     defaultRate,
      breakMinPerDay: defaultBreak,
      inviteToken,
      inviteExpiry,
      status:         "pending",
    },
  })

  const inviteUrl = `${process.env.SITE_URL}/invite?token=${inviteToken}`
  await sendEmail({
    to:      email,
    subject: `You're invited to trackR`,
    html:    inviteEmailHtml(name, inviteUrl),
  })

  return NextResponse.json({ ok: true, employeeId: employee.id, inviteUrl })
}
