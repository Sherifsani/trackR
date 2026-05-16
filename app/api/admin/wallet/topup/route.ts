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

  const amountKobo  = Math.round(amount * 100)
  const uniqueRef   = `topup_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`
  const callbackUrl = `${process.env.SITE_URL}/admin`
  const isSandbox   = (process.env.SQUAD_BASE_URL ?? "").includes("sandbox")

  try {
    const result = await initiateCollection({
      amountKobo,
      email: auth.email,
      callbackUrl,
      uniqueRef,
    })

    // In sandbox, confirm immediately — Squad webhooks can't reach localhost
    await db.walletTopup.create({
      data: {
        squadTxRef:  uniqueRef,
        amountKobo,
        amountNgn:   amount,
        status:      isSandbox ? "confirmed" : "pending",
        confirmedAt: isSandbox ? new Date() : null,
      },
    })

    return NextResponse.json({
      checkoutUrl:  result.data.checkout_url,
      ref:          result.data.transaction_ref,
      sandboxNote:  isSandbox ? "Sandbox: balance credited immediately (no webhook needed)" : undefined,
    })
  } catch (err) {
    const message    = err instanceof Error ? err.message : "Failed to initiate top-up"
    const isNetworkErr = message === "fetch failed" || message.toLowerCase().includes("enotfound") || message.toLowerCase().includes("etimedout")

    // In sandbox, Squad may be unreachable — simulate a confirmed topup anyway
    if (isSandbox && isNetworkErr) {
      await db.walletTopup.create({
        data: {
          squadTxRef:  uniqueRef,
          amountKobo,
          amountNgn:   amount,
          status:      "confirmed",
          confirmedAt: new Date(),
        },
      })
      return NextResponse.json({
        checkoutUrl: null,
        ref:         uniqueRef,
        sandboxNote: "Sandbox: Squad unreachable — balance credited directly for demo",
      })
    }

    return NextResponse.json({ error: message }, { status: 502 })
  }
}
