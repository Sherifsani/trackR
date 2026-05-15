import crypto from "crypto"
import https  from "https"
import http   from "http"
import { URL } from "url"

const BASE       = process.env.SQUAD_BASE_URL ?? "https://sandbox-api-d.squadco.com"
const SECRET     = process.env.SQUAD_SECRET_KEY ?? ""
const MERCHANT   = process.env.SQUAD_MERCHANT_ID ?? ""

function httpsRequest(urlStr: string, options: http.RequestOptions, body?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr)
    const req = https.request(
      {
        hostname: parsed.hostname,
        port:     parsed.port || 443,
        path:     parsed.pathname + parsed.search,
        method:   options.method ?? "GET",
        headers:  options.headers,
        timeout:  60_000,
      },
      (res) => {
        let raw = ""
        res.on("data", (chunk: Buffer) => { raw += chunk.toString() })
        res.on("end", () => resolve(raw))
      },
    )
    req.on("timeout", () => { req.destroy(); reject(new Error("Squad request timed out")) })
    req.on("error", reject)
    if (body) req.write(body)
    req.end()
  })
}

async function squadFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method  = (init.method ?? "GET").toUpperCase()
  const body    = typeof init.body === "string" ? init.body : undefined
  const headers: Record<string, string> = {
    Authorization:  `Bearer ${SECRET}`,
    "Content-Type": "application/json",
  }

  const raw  = await httpsRequest(`${BASE}${path}`, { method, headers }, body)
  const data = JSON.parse(raw) as Record<string, unknown>

  const status = data.status as number
  if (status < 200 || status >= 300) {
    const msg = (data.message as string) ?? (data.error as string) ?? "Squad API error"
    throw new Error(msg)
  }
  return data as T
}

export interface BankLookupResult {
  status:  number
  message: string
  data:    { account_name: string; account_number: string }
}

export async function lookupBankAccount(nipCode: string, accountNumber: string) {
  return squadFetch<BankLookupResult>("/payout/account/lookup", {
    method: "POST",
    body:   JSON.stringify({ nip_code: nipCode, account_number: accountNumber }),
  })
}

export interface TransferResult {
  status:  number
  message: string
  data: {
    transaction_reference:      string
    nip_transaction_reference:  string
    recipient_account_number:   string
    recipient_bank:             string
  }
}

export async function initiateTransfer(params: {
  amountKobo:    number
  bankCode:      string
  accountNumber: string
  accountName:   string
  remark:        string
  uniqueRef:     string
}) {
  const txRef = `${MERCHANT}_${params.uniqueRef}`
  return squadFetch<TransferResult>("/payout/transfer", {
    method: "POST",
    body:   JSON.stringify({
      transaction_reference: txRef,
      amount:                params.amountKobo.toString(),
      bank_code:             params.bankCode,
      account_number:        params.accountNumber,
      account_name:          params.accountName,
      currency_id:           "NGN",
      remark:                params.remark,
    }),
  })
}

export interface RequeryResult {
  status:  number
  message: string
  data:    { transaction_status: string }
}

export async function requeryTransfer(txRef: string) {
  return squadFetch<RequeryResult>("/payout/requery", {
    method: "POST",
    body:   JSON.stringify({ transaction_reference: txRef }),
  })
}

export interface BalanceResult {
  status: number
  data:   { balance: number; currency_id: string }
}

export async function getWalletBalance() {
  return squadFetch<BalanceResult>("/merchant/balance?currency_id=NGN")
}

export interface CollectionResult {
  status:  number
  message: string
  data: {
    checkout_url:    string
    transaction_ref: string
  }
}

export async function initiateCollection(params: {
  amountKobo:  number
  email:       string
  callbackUrl: string
  uniqueRef:   string
}) {
  return squadFetch<CollectionResult>("/transaction/initiate", {
    method: "POST",
    body:   JSON.stringify({
      amount:          params.amountKobo,
      email:           params.email,
      initiate_type:   "inline",
      transaction_ref: params.uniqueRef,
      callback_url:    params.callbackUrl,
      pass_charge:     false,
    }),
  })
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!SECRET) return false
  const hash = crypto
    .createHmac("sha512", SECRET)
    .update(rawBody)
    .digest("hex")
  return hash.toLowerCase() === signature.toLowerCase()
}

export interface WebhookPayload {
  Event:          string
  TransactionRef: string
  Body: {
    amount:             number
    transaction_ref:    string
    gateway_ref:        string
    transaction_status: string
    email:              string
    merchant_id:        string
    currency:           string
    transaction_type:   string
    merchant_amount:    number
    created_at:         string
    meta?:              Record<string, unknown>
  }
}
