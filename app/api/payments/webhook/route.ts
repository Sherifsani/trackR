import { NextResponse }          from "next/server"
import { db }                   from "@/lib/db"
import { verifyWebhookSignature, type WebhookPayload } from "@/lib/squad"

export async function POST(req: Request) {
  const rawBody   = await req.text()
  const signature = req.headers.get("x-squad-encrypted-body") ?? ""

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let payload: WebhookPayload
  try {
    payload = JSON.parse(rawBody) as WebhookPayload
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (payload.Event !== "charge_successful") {
    return NextResponse.json({ ok: true, ignored: true })
  }

  const txRef = payload.TransactionRef ?? payload.Body?.transaction_ref
  if (!txRef) return NextResponse.json({ ok: true })

  // Subscription payment
  if (txRef.startsWith("sub_")) {
    const payment = await db.subscriptionPayment.findUnique({ where: { squadTxRef: txRef } })
    if (!payment || payment.status === "confirmed") {
      return NextResponse.json({ ok: true })
    }

    const now         = new Date()
    const periodStart = payment.periodStart
    const periodEnd   = payment.periodEnd

    await db.subscriptionPayment.update({
      where: { squadTxRef: txRef },
      data:  { status: "confirmed", confirmedAt: now },
    })

    await db.subscription.upsert({
      where:  { adminId: payment.adminId },
      update: { plan: payment.plan, status: "active", currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
      create: { adminId: payment.adminId, plan: payment.plan, status: "active", currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
    })

    return NextResponse.json({ ok: true })
  }

  // Top-up: incoming collection from the admin funding the wallet
  if (txRef.startsWith("topup_")) {
    const existing = await db.walletTopup.findUnique({ where: { squadTxRef: txRef } })
    if (existing && existing.status === "confirmed") {
      return NextResponse.json({ ok: true })
    }

    const amountKobo = payload.Body?.merchant_amount ?? payload.Body?.amount ?? 0
    const amountNgn  = amountKobo / 100

    if (existing) {
      await db.walletTopup.update({
        where: { squadTxRef: txRef },
        data:  { status: "confirmed", confirmedAt: new Date() },
      })
    } else {
      await db.walletTopup.create({
        data: {
          squadTxRef: txRef,
          amountKobo,
          amountNgn,
          status:      "confirmed",
          confirmedAt: new Date(),
        },
      })
    }

    return NextResponse.json({ ok: true })
  }

  // Payout: outgoing salary payment confirmation
  const payment = await db.payment.findUnique({ where: { squadTxRef: txRef } })
  if (!payment || payment.status === "paid") {
    return NextResponse.json({ ok: true })
  }

  await db.payment.update({
    where: { squadTxRef: txRef },
    data:  { status: "paid", paidAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
