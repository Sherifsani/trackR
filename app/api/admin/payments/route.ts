import { NextResponse } from "next/server"
import { db }          from "@/lib/db"
import { getAuth }     from "@/lib/auth"

export async function GET() {
  const auth = await getAuth()
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payments = await db.payment.findMany({
    include: {
      employee: {
        select: { id: true, name: true, role: true, apiId: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take:    200,
  })

  return NextResponse.json({
    payments: payments.map((p) => ({
      id:           p.id,
      employee:     p.employee,
      amountNgn:    Number(p.amountNgn),
      grossHours:   Number(p.grossHours),
      breakHours:   Number(p.breakHours),
      netHours:     Number(p.netHours),
      hourlyRate:   Number(p.hourlyRate),
      periodStart:  p.periodStart.toISOString(),
      periodEnd:    p.periodEnd.toISOString(),
      status:       p.status,
      squadTxRef:   p.squadTxRef,
      paidAt:       p.paidAt?.toISOString() ?? null,
      createdAt:    p.createdAt.toISOString(),
      failureReason: p.failureReason,
    })),
  })
}
