import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Standard Next.js dev-mode singleton -- hot reload would otherwise create
// a new PrismaClient (and connection pool) on every edit.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set -- required for leaderboard persistence");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}

// A lazy proxy, not a real client constructed at module load -- Next.js
// imports every route module (this one transitively, via
// src/app/api/scores/submit and src/app/leaderboard) while collecting build
// metadata, which would otherwise throw the "DATABASE_URL is not set" error
// above at *build* time even in environments that don't need the
// leaderboard at all. Deferring construction to first actual use (a real
// request) keeps that opt-in.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
});
