import { PrismaClient, Prisma } from "../generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

export { Prisma }

function makeClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const db = globalForPrisma.prisma ?? makeClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
