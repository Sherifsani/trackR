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

  const aliceKpi = `Alice should spend at least 70% of her tracked session time on frontend development work — writing code, reviewing PRs on GitHub, or working in design tools. Off-task browsing (social media, news, entertainment) should not exceed 10% of tracked time. She is expected to clock at least 7 billable hours per day. Sustained focus is important for this role: rapid tab-switching should be minimal and she should spend meaningful time on each site she visits.`

  const emp1 = await db.employee.upsert({
    where:  { email: "alice@trackr.dev" },
    update: { kpiDescription: aliceKpi },
    create: {
      apiId:           "emp_alice_001",
      name:            "Alice Johnson",
      email:           "alice@trackr.dev",
      role:            "Frontend Developer",
      hourlyRate:      4500,
      breakMinPerDay:  60,
      workHoursPerDay: 8,
      passwordHash:    empHash,
      status:          "active",
      kpiDescription:  aliceKpi,
    },
  })
  console.log("Employee 1:", emp1.email)

  const bobKpi = `Bob is a backend developer and should spend the majority of his session time on development-related work: coding, reading technical documentation, reviewing infrastructure or database changes, and communicating with the team. At least 75% of tracked time should be on productive categories. He must clock a minimum of 7.5 hours per day. Off-task browsing should stay below 10%. As a senior developer, deep focus is expected — he should avoid frequent context switching and spend sustained time on complex problems.`

  const emp2 = await db.employee.upsert({
    where:  { email: "bob@trackr.dev" },
    update: { kpiDescription: bobKpi },
    create: {
      apiId:           "emp_bob_002",
      name:            "Bob Smith",
      email:           "bob@trackr.dev",
      role:            "Backend Developer",
      hourlyRate:      5000,
      breakMinPerDay:  60,
      workHoursPerDay: 8,
      passwordHash:    empHash,
      status:          "active",
      kpiDescription:  bobKpi,
    },
  })
  console.log("Employee 2:", emp2.email)

  console.log("\nSeed complete.")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
