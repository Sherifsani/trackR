import { NextResponse } from "next/server"
import { getAuth } from "@/lib/auth"

export async function GET() {
  const auth = await getAuth()
  if (!auth) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  return NextResponse.json({ id: auth.sub, role: auth.role, email: auth.email, name: auth.name, apiId: auth.apiId })
}
