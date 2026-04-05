import "dotenv/config";
import pg from "pg";
import { parseIntoClientConfig } from "pg-connection-string";

const targetDb = process.env.PGDATABASE || "school";

function adminConfig() {
  if (process.env.DATABASE_URL) {
    const cfg = parseIntoClientConfig(process.env.DATABASE_URL);
    cfg.database = "postgres";
    cfg.password = String(cfg.password ?? "");
    return cfg;
  }
  return {
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || "postgres",
    password: String(process.env.PGPASSWORD ?? ""),
    database: "postgres",
  };
}

const client = new pg.Client(adminConfig());

try {
  await client.connect();
  await client.query(`CREATE DATABASE "${targetDb.replace(/"/g, '""')}"`);
  console.log(`Created database "${targetDb}".`);
} catch (e) {
  if (e.code === "42P04") {
    console.log(`Database "${targetDb}" already exists.`);
  } else {
    console.error(e.message);
    process.exitCode = 1;
  }
} finally {
  await client.end().catch(() => {});
}
