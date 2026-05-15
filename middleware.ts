import { NextRequest, NextResponse } from "next/server"
import { getAuthFromRequest } from "@/lib/auth"

const ADMIN_PATHS    = ["/admin", "/api/admin"]
const EMPLOYEE_PATHS = ["/employee"]
const LOGIN_PAGE     = "/login"

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isAdminPath    = ADMIN_PATHS.some((p) => pathname.startsWith(p))
  const isEmployeePath = EMPLOYEE_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))

  if (!isAdminPath && !isEmployeePath) return NextResponse.next()

  const auth = await getAuthFromRequest(req)

  if (isAdminPath && (!auth || auth.role !== "admin")) {
    const loginUrl = new URL(LOGIN_PAGE, req.url)
    loginUrl.searchParams.set("from", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isEmployeePath && !auth) {
    const loginUrl = new URL(LOGIN_PAGE, req.url)
    loginUrl.searchParams.set("from", pathname)
    return NextResponse.redirect(loginUrl)
  }

  const res = NextResponse.next()
  if (auth) {
    res.headers.set("x-auth-id",   auth.sub)
    res.headers.set("x-auth-role", auth.role)
  }
  return res
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/employee", "/employee/:path*"],
}
