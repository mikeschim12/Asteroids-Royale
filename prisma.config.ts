import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 moved the migration connection string out of schema.prisma --
// this is only used by the `prisma migrate`/`prisma db push` CLI, not by
// the app itself (see src/lib/prisma.ts for the runtime client).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
