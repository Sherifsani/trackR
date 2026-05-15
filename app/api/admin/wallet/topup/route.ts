import { NextResponse }        from "next/server"
import { db }                  from "@/lib/db"
import { getAuth }             from "@/lib/auth"
import { initiateCollection }  from "@/lib/squad"
import crypto                  from "crypto"

export async function POST(req: Request) {
  const auth = await getAuth()
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body   = await req.json() as { amountNgn?: number }
  const amount = Number(body.amountNgn ?? 0)

  if (!amount || amount < 100) {
    return NextResponse.json({ error: "Minimum top-up is ₦100" }, { status: 400 })
  }

  const amountKobo = Math.round(amount * 100)
  const uniqueRef  = `topup_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`
  const callbackUrl = `${process.env.SITE_URL}/admin`

  try {
    const result = await initiateCollection({
      amountKobo,
      email: auth.email,
      callbackUrl,
      uniqueRef,
    })

    // Record as pending — webhook will confirm it once payment clears
    await db.walletTopup.create({
      data: {
        squadTxRef: uniqueRef,
        amountKobo,
        amountNgn:  amount,
        status:     "pending",
      },
    })

    return NextResponse.json({
      checkoutUrl: result.data.checkout_url,
      ref:         result.data.transaction_ref,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to initiate top-up"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
