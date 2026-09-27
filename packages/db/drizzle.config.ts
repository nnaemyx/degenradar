import { defineConfig } from "drizzle-kit";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";

// Load root .env
dotenvConfig({ path: resolve(__dirname, "../../.env") });
dotenvConfig({ path: resolve(process.cwd(), ".env") });

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://degenradar:degenradar@localhost:5432/degenradar",
  },
});
