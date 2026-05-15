import { NextResponse }      from "next/server"
import { db }               from "@/lib/db"
import { getAuth }          from "@/lib/auth"
import { initiateTransfer } from "@/lib/squad"
import { getLocalBalance }  from "@/lib/wallet"
import crypto               from "crypto"

function startOfWeekUTC(d: Date) {
  const r = new Date(d)
  r.setUTCDate(r.getUTCDate() - r.getUTCDay())
  r.setUTCHours(0, 0, 0, 0)
  return r
}

function endOfWeekUTC(d: Date) {
  const r = startOfWeekUTC(d)
  r.setUTCDate(r.getUTCDate() + 6)
  r.setUTCHours(23, 59, 59, 999)
  return r
}

export async function POST(req: Request) {
  const auth = await getAuth()
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json() as {
    employeeId:  string
    periodStart?: string  // ISO; defaults to start of current week
    periodEnd?:   string  // ISO; defaults to end of current week
  }

  const { employeeId } = body
  if (!employeeId) {
    return NextResponse.json({ error: "employeeId is required" }, { status: 400 })
  }

  const now   = new Date()
  const pStart = body.periodStart ? new Date(body.periodStart) : startOfWeekUTC(now)
  const pEnd   = body.periodEnd   ? new Date(body.periodEnd)   : endOfWeekUTC(now)

  const emp = await db.employee.findUnique({ where: { id: employeeId } })
  if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 })

  if (!emp.bankVerified || !emp.accountNumber || !emp.bankCode || !emp.accountName) {
    return NextResponse.json({ error: "Employee has not set up verified bank details" }, { status: 422 })
  }

  if (!emp.hourlyRate) {
    return NextResponse.json({ error: "Employee hourly rate is not set" }, { status: 422 })
  }

  // Gather approved + clocked-out sessions in period
  const sessions = await db.workSession.findMany({
    where: {
      employeeId,
      approved:  true,
      clockOut:  { not: null },
      clockIn:   { gte: pStart, lte: pEnd },
    },
  })

  if (sessions.length === 0) {
    return NextResponse.json({ error: "No approved sessions found in this period" }, { status: 422 })
  }

  // Calculate gross hours and actual break time taken
  let grossSec = 0
  let breakSec = 0
  for (const s of sessions) {
    grossSec += (s.clockOut!.getTime() - s.clockIn.getTime()) / 1000
    breakSec += s.breakUsedSec
  }

  const grossHours = grossSec / 3600
  const breakHours = breakSec / 3600
  const netHours   = Math.max(0, grossHours - breakHours)
  const amountNgn  = netHours * Number(emp.hourlyRate)
  const amountKobo = Math.round(amountNgn * 100)

  if (amountKobo < 100) {
    return NextResponse.json({ error: "Calculated amount too small to transfer (minimum ₦1)" }, { status: 422 })
  }

  const isSandbox = (process.env.SQUAD_BASE_URL ?? "").includes("sandbox")
  if (!isSandbox) {
    const balance = await getLocalBalance()
    if (balance < amountNgn) {
      return NextResponse.json(
        { error: `Insufficient wallet balance. Available: ₦${balance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}, required: ₦${amountNgn.toLocaleString("en-NG", { minimumFractionDigits: 2 })}` },
        { status: 422 },
      )
    }
  }

  // Create payment record (pending) before calling Squad — so we have a ref even if it partially fails
  const uniqueRef  = crypto.randomUUID().replace(/-/g, "").slice(0, 16)
  const squadTxRef = `${process.env.SQUAD_MERCHANT_ID}_${uniqueRef}`

  const payment = await db.payment.create({
    data: {
      employeeId,
      amountNgn,
      amountKobo,
      grossHours,
      breakHours,
      netHours,
      hourlyRate: emp.hourlyRate,
      periodStart: pStart,
      periodEnd:   pEnd,
      status:     "pending",
      squadTxRef,
    },
  })

  // Call Squad payout
  try {
    const result = await initiateTransfer({
      amountKobo,
      bankCode:      emp.bankCode!,
      accountNumber: emp.accountNumber!,
      accountName:   emp.accountName!,
      remark:        `trackR salary — ${emp.name} — ${pStart.toISOString().slice(0, 10)} to ${pEnd.toISOString().slice(0, 10)}`,
      uniqueRef,
    })

    await db.payment.update({
      where: { id: payment.id },
      data:  {
        status:      "paid",
        squadNipRef: result.data.nip_transaction_reference,
        paidAt:      new Date(),
      },
    })

    return NextResponse.json({
      ok:      true,
      paymentId: payment.id,
      status:  "paid",
      amountNgn,
      netHours,
      squadTxRef,
    })
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Transfer failed"
    const isSandbox = (process.env.SQUAD_BASE_URL ?? "").includes("sandbox")

    // Simulate success in sandbox when Squad is unreachable or merchant not yet eligible.
    const isNetworkErr  = reason === "fetch failed" || reason.toLowerCase().includes("enotfound") || reason.toLowerCase().includes("etimedout")
    const isEligibleErr = reason.toLowerCase().includes("not eligible")
    if (isSandbox && (isNetworkErr || isEligibleErr)) {
      await db.payment.update({
        where: { id: payment.id },
        data:  {
          status:        "paid",
          failureReason: "sandbox_simulated",
          paidAt:        new Date(),
        },
      })
      return NextResponse.json({
        ok:          true,
        paymentId:   payment.id,
        status:      "paid",
        amountNgn,
        netHours,
        squadTxRef,
        sandboxNote: "Squad payout simulated — sandbox environment (merchant eligibility pending or network unreachable)",
      })
    }

    await db.payment.update({
      where: { id: payment.id },
      data:  { status: "failed", failureReason: reason },
    })
    return NextResponse.json({ error: reason, paymentId: payment.id }, { status: 502 })
  }
}
