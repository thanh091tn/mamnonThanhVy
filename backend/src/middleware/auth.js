import jwt from "jsonwebtoken";

export function getJwtSecret() {
  const s = process.env.JWT_SECRET;
  if (s != null && String(s).trim() !== "") return String(s).trim();
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production");
  }
  return "dev-only-jwt-secret-change-in-production";
}

export function signToken(payload) {
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
  return jwt.sign(payload, getJwtSecret(), { expiresIn });
}

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = auth.slice(7).trim();
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = {
      id: Number(decoded.sub),
      role: String(decoded.role || ""),
      teacherId:
        decoded.teacherId != null && decoded.teacherId !== ""
          ? Number(decoded.teacherId)
          : null,
    };
    if (!req.user.id || !req.user.role) {
      return res.status(401).json({ error: "Invalid token" });
    }
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
