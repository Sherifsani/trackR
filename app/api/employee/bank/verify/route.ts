import { NextResponse }       from "next/server"
import { getAuth }            from "@/lib/auth"
import { lookupBankAccount }  from "@/lib/squad"

export async function POST(req: Request) {
  const auth = await getAuth()
  if (!auth || auth.role !== "employee") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { bankCode, accountNumber } = await req.json() as {
    bankCode:      string
    accountNumber: string
  }

  if (!bankCode || !accountNumber) {
    return NextResponse.json({ error: "bankCode and accountNumber are required" }, { status: 400 })
  }

  try {
    const result = await lookupBankAccount(bankCode, accountNumber)
    return NextResponse.json({ accountName: result.data.account_name })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Account lookup failed"
    const isSandbox    = (process.env.SQUAD_BASE_URL ?? "").includes("sandbox")
    const isNetworkErr = msg === "fetch failed" || msg.toLowerCase().includes("enotfound") || msg.toLowerCase().includes("etimedout")
    // Squad sandbox requires merchant eligibility or may be unreachable — fall back to manual name entry.
    if (msg.toLowerCase().includes("not eligible") || (isSandbox && isNetworkErr)) {
      return NextResponse.json({ error: msg, manualFallback: true }, { status: 422 })
    }
    return NextResponse.json({ error: msg }, { status: 422 })
  }
}
