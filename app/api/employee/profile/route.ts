import { NextResponse } from "next/server"
import { db }          from "@/lib/db"
import { getAuth }     from "@/lib/auth"

export async function GET() {
  const auth = await getAuth()
  if (!auth || auth.role !== "employee") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const emp = await db.employee.findUnique({ where: { id: auth.sub } })
  if (!emp) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({
    id:            emp.id,
    name:          emp.name,
    email:         emp.email,
    role:          emp.role,
    hourlyRate:    emp.hourlyRate ? Number(emp.hourlyRate) : null,
    breakMinPerDay: emp.breakMinPerDay,
    bankCode:      emp.bankCode,
    bankName:      emp.bankName,
    accountNumber: emp.accountNumber,
    accountName:   emp.accountName,
    bankVerified:  emp.bankVerified,
  })
}

export async function PATCH(req: Request) {
  const auth = await getAuth()
  if (!auth || auth.role !== "employee") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json() as {
    bankCode?:      string
    bankName?:      string
    accountNumber?: string
    accountName?:   string
    bankVerified?:  boolean
  }

  await db.employee.update({
    where: { id: auth.sub },
    data:  {
      bankCode:      body.bankCode      ?? undefined,
      bankName:      body.bankName      ?? undefined,
      accountNumber: body.accountNumber ?? undefined,
      accountName:   body.accountName   ?? undefined,
      bankVerified:  body.bankVerified  ?? false,
    },
  })

  return NextResponse.json({ ok: true })
}
