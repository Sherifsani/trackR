import bcrypt from "bcryptjs"
import { PrismaClient } from "../generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

async function main() {
  const adminPassword = "Admin@1234"
  const employeePassword = "Employee@1234"

  // Admin
  const adminHash = await bcrypt.hash(adminPassword, 12)
  const admin = await db.admin.upsert({
    where: { email: "admin@trackr.dev" },
    update: {},
    create: {
      name: "Super Admin",
      email: "admin@trackr.dev",
      passwordHash: adminHash,
      defaultHourlyRate: 5000,
      defaultBreakMinPerDay: 60,
    },
  })
  console.log("Admin:", admin.email)

  // Employees
  const empHash = await bcrypt.hash(employeePassword, 12)

  const emp1 = await db.employee.upsert({
    where: { email: "alice@trackr.dev" },
    update: {},
    create: {
      apiId: "emp_alice_001",
      name: "Alice Johnson",
      email: "alice@trackr.dev",
      role: "Frontend Developer",
      hourlyRate: 4500,
      breakMinPerDay: 60,
      passwordHash: empHash,
      status: "active",
    },
  })
  console.log("Employee 1:", emp1.email)

  const emp2 = await db.employee.upsert({
    where: { email: "bob@trackr.dev" },
    update: {},
    create: {
      apiId: "emp_bob_002",
      name: "Bob Smith",
      email: "bob@trackr.dev",
      role: "Backend Developer",
      hourlyRate: 5000,
      breakMinPerDay: 60,
      passwordHash: empHash,
      status: "active",
    },
  })
  console.log("Employee 2:", emp2.email)

  console.log("\nSeed complete.")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
