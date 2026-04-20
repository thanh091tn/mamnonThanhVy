import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rawPath = process.argv[2];

if (!rawPath) {
  console.error("Usage: node src/run-sql-file.js <path-to-sql>");
  process.exit(1);
}

const sqlPath = path.resolve(__dirname, "..", rawPath);
const sql = await fs.readFile(sqlPath, "utf8");

try {
  await pool.query(sql);
  console.log(`Executed SQL seed: ${sqlPath}`);
} finally {
  await pool.end();
}
