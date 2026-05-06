// Prisma 7.x config — uses pg adapter for both CLI (migrate) and runtime.
import "dotenv/config";
import { defineConfig } from "prisma/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"]!,
    adapter: () => {
      const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });
      return new PrismaPg(pool);
    },
  },
});
