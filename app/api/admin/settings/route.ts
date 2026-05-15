import { NextResponse }     from "next/server"
import { db }               from "@/lib/db"
import { getAuth }          from "@/lib/auth"
import { getLocalBalance }  from "@/lib/wallet"

export async function GET() {
  const auth = await getAuth()
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [admin, walletBalance] = await Promise.all([
    db.admin.findUnique({ where: { id: auth.sub } }),
    getLocalBalance(),
  ])
  if (!admin) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({
    squadVirtualAcctNumber: admin.squadVirtualAcctNumber,
    squadVirtualAcctBank:   admin.squadVirtualAcctBank,
    squadVirtualAcctName:   admin.squadVirtualAcctName,
    walletBalance,
    defaultBreakMinPerDay:  admin.defaultBreakMinPerDay,
    defaultHourlyRate:      admin.defaultHourlyRate ? Number(admin.defaultHourlyRate) : null,
  })
}

export async function PATCH(req: Request) {
  const auth = await getAuth()
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json() as {
    squadVirtualAcctNumber?: string
    squadVirtualAcctBank?:   string
    squadVirtualAcctName?:   string
    defaultBreakMinPerDay?:  number
    defaultHourlyRate?:      number | null
  }

  await db.admin.update({
    where: { id: auth.sub },
    data: {
      squadVirtualAcctNumber: body.squadVirtualAcctNumber ?? undefined,
      squadVirtualAcctBank:   body.squadVirtualAcctBank   ?? undefined,
      squadVirtualAcctName:   body.squadVirtualAcctName   ?? undefined,
      defaultBreakMinPerDay:  body.defaultBreakMinPerDay  ?? undefined,
      defaultHourlyRate:      body.defaultHourlyRate !== undefined ? body.defaultHourlyRate : undefined,
    },
  })

  return NextResponse.json({ ok: true })
}
