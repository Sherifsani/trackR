import { NextResponse }           from "next/server"
import { db }                    from "@/lib/db"
import { getAuth }               from "@/lib/auth"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuth()
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json() as {
    hourlyRate?:    number
    breakMinPerDay?: number
    role?:          string
  }

  const data: Record<string, unknown> = {}
  if (body.hourlyRate    !== undefined) data.hourlyRate    = body.hourlyRate
  if (body.breakMinPerDay !== undefined) data.breakMinPerDay = body.breakMinPerDay
  if (body.role          !== undefined) data.role          = body.role

  const emp = await db.employee.update({ where: { id }, data })

  return NextResponse.json({
    id:            emp.id,
    hourlyRate:    emp.hourlyRate    ? Number(emp.hourlyRate)    : null,
    breakMinPerDay: emp.breakMinPerDay,
    role:          emp.role,
  })
}
