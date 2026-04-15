import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { initDb } from "./db.js";
import studentsRouter from "./routes/students.js";
import teachersRouter from "./routes/teachers.js";
import classesRouter from "./routes/classes.js";
import uploadRouter from "./routes/upload.js";
import attendanceRouter from "./routes/attendance.js";
import authRouter from "./routes/auth.js";
import feesRouter from "./routes/fees.js";
import { requireAuth } from "./middleware/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.join(__dirname, "..", "uploads");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());
app.use("/uploads", express.static(uploadsRoot));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter);
app.use("/api/upload", requireAuth, uploadRouter);
app.use("/api/students", requireAuth, studentsRouter);
app.use("/api/teachers", requireAuth, teachersRouter);
app.use("/api/classes", requireAuth, classesRouter);
app.use("/api/attendance", requireAuth, attendanceRouter);
app.use("/api/fees", requireAuth, feesRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "Image must be 2 MB or smaller" });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err?.message === "Only JPEG, PNG, GIF, or WebP images are allowed") {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`School API listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Database connection or init failed:", err.message);
    process.exit(1);
  });
