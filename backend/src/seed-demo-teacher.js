/**
 * Tạo hoặc cập nhật tài khoản giáo viên demo (không xóa dữ liệu khác).
 * Chạy: npm run db:demo-teacher
 *
 * Đăng nhập: teacher@mamnon.local / teacher123
 * Gắn với giáo viên đầu tiên trong bảng teachers (ORDER BY id).
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { pool, initDb } from "./db.js";

async function main() {
  await initDb();
  const t = await pool.query(
    `SELECT id, name FROM teachers ORDER BY id ASC LIMIT 1`
  );
  if (!t.rowCount) {
    console.error("Chưa có giáo viên nào. Chạy trước: npm run db:seed");
    process.exit(1);
  }
  const row = t.rows[0];
  const teacherId = row.id;
  const teacherName = row.name ?? "";
  const hash = bcrypt.hashSync("teacher123", 10);
  await pool.query(
    `INSERT INTO users (email, password_hash, role, name, teacher_id)
     VALUES ('teacher@mamnon.local', $1, 'teacher', $2, $3)
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       teacher_id = EXCLUDED.teacher_id,
       name = EXCLUDED.name,
       role = 'teacher'`,
    [hash, teacherName, teacherId]
  );
  console.log("OK — Đăng nhập giáo viên demo:");
  console.log("  Email:    teacher@mamnon.local");
  console.log("  Mật khẩu: teacher123");
  console.log(`  Liên kết: ${teacherName} (teacher id ${teacherId})`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
