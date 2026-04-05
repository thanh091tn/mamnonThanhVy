import { Router } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const avatarsDir = path.join(__dirname, "..", "uploads", "avatars");
fs.mkdirSync(avatarsDir, { recursive: true });

const allowedExt = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, avatarsDir),
  filename: (_req, file, cb) => {
    let ext = path.extname(file.originalname || "").toLowerCase();
    if (!allowedExt.has(ext)) ext = ".jpg";
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype)) {
      cb(new Error("Only JPEG, PNG, GIF, or WebP images are allowed"));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

router.post("/avatar", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image file received" });
  }
  const base = (process.env.UPLOAD_PUBLIC_BASE || "").replace(/\/$/, "");
  const pathPart = `/uploads/avatars/${req.file.filename}`;
  const url = base ? `${base}${pathPart}` : pathPart;
  res.status(201).json({ url });
});

export default router;
