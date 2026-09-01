// src/lib/prisma.ts
// Shared Prisma Client singleton — every service should import from here
// instead of constructing its own PrismaClient, so tests can swap in the
// mocked version via vi.mock('../lib/prisma').
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

export default prisma;