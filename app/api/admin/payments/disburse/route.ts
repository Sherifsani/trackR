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

  const [emp, admin] = await Promise.all([
    db.employee.findUnique({ where: { id: employeeId } }),
    db.admin.findUnique({ where: { id: auth.sub }, select: { overtimeMultiplier: true, defaultWorkHoursPerDay: true } }),
  ])
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

  // Overtime settings: employee override → admin default → hardcoded fallback
  const multiplier     = emp.overtimeMultiplier ?? admin?.overtimeMultiplier ?? 1.5
  const workLimitSec   = emp.workHoursPerDay * 3600

  // Split each session into regular + overtime (per session, not aggregate)
  let grossSec    = 0
  let breakSec    = 0
  let regularSec  = 0
  let overtimeSec = 0

  for (const s of sessions) {
    const sessionGross = (s.clockOut!.getTime() - s.clockIn.getTime()) / 1000
    const sessionBreak = s.breakUsedSec
    const sessionNet   = Math.max(0, sessionGross - sessionBreak)
    const sessionReg   = Math.min(sessionNet, workLimitSec)
    const sessionOT    = sessionNet - sessionReg

    grossSec    += sessionGross
    breakSec    += sessionBreak
    regularSec  += sessionReg
    overtimeSec += sessionOT
  }

  const grossHours      = grossSec    / 3600
  const breakHours      = breakSec    / 3600
  const netHours        = Math.max(0, grossHours - breakHours)
  const regularHours    = regularSec  / 3600
  const overtimeHours   = overtimeSec / 3600
  const rate            = Number(emp.hourlyRate)
  const overtimeAmountNgn = overtimeHours * rate * (multiplier - 1)  // extra on top of base rate
  const amountNgn       = netHours * rate + overtimeAmountNgn
  const amountKobo      = Math.round(amountNgn * 100)

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
      regularHours,
      overtimeHours,
      overtimeMultiplier: multiplier,
      overtimeAmountNgn,
      hourlyRate:  emp.hourlyRate,
      periodStart: pStart,
      periodEnd:   pEnd,
      status:      "pending",
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

    // Simulate success in sandbox when Squad is unreachable or merchant not yet approved.
    const isNetworkErr  = reason === "fetch failed" || reason.toLowerCase().includes("enotfound") || reason.toLowerCase().includes("etimedout")
    const isEligibleErr = reason.toLowerCase().includes("not eligible") || reason.toLowerCase().includes("not profiled") || reason.toLowerCase().includes("not activated") || reason.toLowerCase().includes("not enabled")
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
