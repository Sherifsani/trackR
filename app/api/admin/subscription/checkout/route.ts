import { NextResponse }       from "next/server"
import { db }                 from "@/lib/db"
import { getAuth }            from "@/lib/auth"
import { initiateCollection } from "@/lib/squad"
import { getPlan }            from "@/lib/plans"
import crypto                 from "crypto"

export async function POST(req: Request) {
  const auth = await getAuth()
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { plan: planId } = await req.json() as { plan?: string }
  const plan = planId ? getPlan(planId) : null
  if (!plan) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
  }

  const uniqueRef   = `sub_${plan.id}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`
  const callbackUrl = `${process.env.SITE_URL}/admin?tab=settings`
  const isSandbox   = (process.env.SQUAD_BASE_URL ?? "").includes("sandbox")

  const now         = new Date()
  const periodStart = now
  const periodEnd   = new Date(now.getTime() + 30 * 86_400_000)

  try {
    const result = await initiateCollection({
      amountKobo:  plan.priceKobo,
      email:       auth.email,
      callbackUrl,
      uniqueRef,
    })

    await db.subscriptionPayment.create({
      data: {
        adminId:    auth.sub,
        plan:       plan.id,
        amountKobo: plan.priceKobo,
        amountNgn:  plan.priceNgn,
        squadTxRef: uniqueRef,
        status:     isSandbox ? "confirmed" : "pending",
        periodStart,
        periodEnd,
        confirmedAt: isSandbox ? now : null,
      },
    })

    if (isSandbox) {
      await db.subscription.upsert({
        where:  { adminId: auth.sub },
        update: { plan: plan.id, status: "active", currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
        create: { adminId: auth.sub, plan: plan.id, status: "active", currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
      })
    }

    return NextResponse.json({
      checkoutUrl: result.data.checkout_url,
      ref:         result.data.transaction_ref,
      sandboxNote: isSandbox ? "Sandbox: subscription activated immediately — no webhook needed" : undefined,
    })
  } catch (err) {
    const message      = err instanceof Error ? err.message : "Failed to initiate payment"
    const isNetworkErr = message === "fetch failed" || message.toLowerCase().includes("enotfound") || message.toLowerCase().includes("etimedout")

    if (isSandbox && isNetworkErr) {
      await db.subscriptionPayment.create({
        data: {
          adminId:    auth.sub,
          plan:       plan.id,
          amountKobo: plan.priceKobo,
          amountNgn:  plan.priceNgn,
          squadTxRef: uniqueRef,
          status:     "confirmed",
          periodStart,
          periodEnd,
          confirmedAt: now,
        },
      })
      await db.subscription.upsert({
        where:  { adminId: auth.sub },
        update: { plan: plan.id, status: "active", currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
        create: { adminId: auth.sub, plan: plan.id, status: "active", currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
      })
      return NextResponse.json({
        checkoutUrl: null,
        ref:         uniqueRef,
        sandboxNote: "Sandbox: Squad unreachable — subscription activated directly for demo",
      })
    }

    return NextResponse.json({ error: message }, { status: 502 })
  }
}
