import { db } from "@/lib/db"

export async function getLocalBalance(): Promise<number> {
  const [topups, payouts] = await Promise.all([
    db.walletTopup.aggregate({
      where:  { status: "confirmed" },
      _sum:   { amountNgn: true },
    }),
    db.payment.aggregate({
      where:  { status: "paid" },
      _sum:   { amountNgn: true },
    }),
  ])

  const totalIn  = Number(topups._sum.amountNgn  ?? 0)
  const totalOut = Number(payouts._sum.amountNgn ?? 0)
  return Math.max(0, totalIn - totalOut)
}
