import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { NextRequest } from "next/server"

const SECRET  = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "trackr-dev-secret-change-in-production-32"
)
export const AUTH_COOKIE = "trackr_auth"
const MAX_AGE = 7 * 24 * 60 * 60 // 7 days

export interface AuthPayload {
  sub:   string                      // DB record id (cuid)
  role:  "admin" | "employee"
  email: string
  name:  string
  apiId?: string                     // Employee.apiId — only set for employees
}

export async function signToken(payload: AuthPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(SECRET)
}

export async function verifyToken(token: string): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as AuthPayload
  } catch {
    return null
  }
}

// Server Components / Route Handlers
export async function getAuth(): Promise<AuthPayload | null> {
  const jar   = await cookies()
  const token = jar.get(AUTH_COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

// Middleware (uses NextRequest, not the cookies() helper)
export async function getAuthFromRequest(req: NextRequest): Promise<AuthPayload | null> {
  const token = req.cookies.get(AUTH_COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

export function authCookieOptions(token: string) {
  return {
    name:     AUTH_COOKIE,
    value:    token,
    httpOnly: true,
    sameSite: "lax" as const,
    path:     "/",
    maxAge:   MAX_AGE,
    secure:   process.env.NODE_ENV === "production",
  }
}
