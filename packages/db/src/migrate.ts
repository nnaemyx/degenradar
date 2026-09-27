import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, client } from "./index";

async function runMigrations() {
  console.log("Running pending migrations...");
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migrations applied successfully!");
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
