import "dotenv/config";
import bcrypt from "bcryptjs";
import { pool, initDb } from "./db.js";

/** Default logins (ON CONFLICT email skipped if exists):
 *  - Manager: admin@mamnon.local / admin123
 *  - Teacher: teacher@mamnon.local / teacher123 (liên kết giáo viên đầu tiên trong seed)
 */

async function seed() {
  await initDb();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Teachers ──
    const teacherRows = [
      ["Nguyễn Thị Hương", "huong.nguyen@mamnonthanhvy.edu.vn", "0901234567", "12 Nguyễn Huệ, Quận 1, TP.HCM", "active", "female"],
      ["Trần Văn Nam", "nam.tran@mamnonthanhvy.edu.vn", "0912345678", "45 Lê Lợi, Quận 3, TP.HCM", "active", "male"],
      ["Lê Thị Mai", "mai.le@mamnonthanhvy.edu.vn", "0923456789", "78 Trần Hưng Đạo, Quận 5, TP.HCM", "active", "female"],
      ["Phạm Thị Lan", "lan.pham@mamnonthanhvy.edu.vn", "0934567890", "23 Pasteur, Quận 1, TP.HCM", "active", "female"],
      ["Hoàng Văn Đức", "duc.hoang@mamnonthanhvy.edu.vn", "0945678901", "56 Hai Bà Trưng, Quận 1, TP.HCM", "leave", "male"],
      ["Võ Thị Thu", "thu.vo@mamnonthanhvy.edu.vn", "0956789012", "89 Điện Biên Phủ, Quận Bình Thạnh, TP.HCM", "active", "female"],
    ];

    const teacherIds = [];
    for (const [name, email, phone, address, status, gender] of teacherRows) {
      const r = await client.query(
        `INSERT INTO teachers (name, email, phone, address, status, gender)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [name, email, phone, address, status, gender]
      );
      teacherIds.push(r.rows[0].id);
    }
    console.log(`Inserted ${teacherIds.length} teachers`);

    // ── Classes ──
    const classRows = [
      ["Lớp Mầm 1", "Mầm", "P.101", teacherIds[0]],
      ["Lớp Mầm 2", "Mầm", "P.102", teacherIds[1]],
      ["Lớp Chồi 1", "Chồi", "P.201", teacherIds[2]],
      ["Lớp Chồi 2", "Chồi", "P.202", teacherIds[3]],
      ["Lớp Lá 1", "Lá", "P.301", teacherIds[5]],
      ["Lớp Lá 2", "Lá", "P.302", null],
    ];

    const classIds = [];
    for (const [name, level, room, tid] of classRows) {
      const r = await client.query(
        `INSERT INTO classes (name, level, room, teacher_id) VALUES ($1,$2,$3,$4) RETURNING id`,
        [name, level, room, tid]
      );
      classIds.push(r.rows[0].id);
    }
    console.log(`Inserted ${classIds.length} classes`);

    // ── Students ──
    const students = [
      { name: "Nguyễn Minh Anh", gender: "female", dob: "2021-03-15", classIdx: 0, phone: "0901111001", nationality: "Việt Nam", religion: "", province: "TP. Hồ Chí Minh", ward: "Phường Bến Nghé", hamlet: "Khu phố 3", birthPlace: "BV Từ Dũ, TP.HCM", fatherBY: "1990", motherBY: "1992", guardianName: "Nguyễn Văn Toàn", guardianOcc: "Kỹ sư", guardianBY: "1990" },
      { name: "Trần Gia Bảo", gender: "male", dob: "2021-06-22", classIdx: 0, phone: "0901111002", nationality: "Việt Nam", religion: "Phật giáo", province: "TP. Hồ Chí Minh", ward: "Phường Tân Định", hamlet: "", birthPlace: "BV Hùng Vương, TP.HCM", fatherBY: "1988", motherBY: "1991", guardianName: "Trần Thị Hoa", guardianOcc: "Giáo viên", guardianBY: "1991" },
      { name: "Lê Thùy Dương", gender: "female", dob: "2021-01-08", classIdx: 0, phone: "0901111003", nationality: "Việt Nam", religion: "", province: "Bình Dương", ward: "Phường Phú Hòa", hamlet: "Khu phố 5", birthPlace: "BV Đa khoa Bình Dương", fatherBY: "1989", motherBY: "1993", guardianName: "Lê Văn Hùng", guardianOcc: "Công nhân", guardianBY: "1989" },
      { name: "Phạm Đức Anh", gender: "male", dob: "2021-09-30", classIdx: 0, phone: "0901111004", nationality: "Việt Nam", religion: "", province: "TP. Hồ Chí Minh", ward: "Phường 7, Quận 3", hamlet: "", birthPlace: "TP.HCM", fatherBY: "1991", motherBY: "1994", guardianName: "Phạm Văn Long", guardianOcc: "Lái xe", guardianBY: "1991" },
      { name: "Hoàng Khánh Linh", gender: "female", dob: "2021-04-12", classIdx: 1, phone: "0901111005", nationality: "Việt Nam", religion: "Công giáo", province: "TP. Hồ Chí Minh", ward: "Phường Đa Kao", hamlet: "Khu phố 1", birthPlace: "BV Từ Dũ, TP.HCM", fatherBY: "1987", motherBY: "1990", guardianName: "Hoàng Văn Minh", guardianOcc: "Bác sĩ", guardianBY: "1987" },
      { name: "Võ Thanh Tùng", gender: "male", dob: "2021-07-18", classIdx: 1, phone: "0901111006", nationality: "Việt Nam", religion: "", province: "Đồng Nai", ward: "Phường Tân Hiệp", hamlet: "Ấp 2", birthPlace: "BV Đồng Nai", fatherBY: "1986", motherBY: "1989", guardianName: "Võ Thị Hạnh", guardianOcc: "Nội trợ", guardianBY: "1989" },
      { name: "Đặng Ngọc Hân", gender: "female", dob: "2021-02-25", classIdx: 1, phone: "0901111007", nationality: "Việt Nam", religion: "", province: "TP. Hồ Chí Minh", ward: "Phường 12, Quận 10", hamlet: "", birthPlace: "TP.HCM", fatherBY: "1992", motherBY: "1995", guardianName: "Đặng Văn Phong", guardianOcc: "Kinh doanh", guardianBY: "1992" },
      { name: "Bùi Quốc Đạt", gender: "male", dob: "2021-11-05", classIdx: 1, phone: "0901111008", nationality: "Việt Nam", religion: "", province: "Long An", ward: "TT Bến Lức", hamlet: "Ấp 1", birthPlace: "BV Long An", fatherBY: "1985", motherBY: "1988", guardianName: "Bùi Văn Thành", guardianOcc: "Nông dân", guardianBY: "1985" },
      { name: "Ngô Phương Trinh", gender: "female", dob: "2020-05-20", classIdx: 2, phone: "0901111009", nationality: "Việt Nam", religion: "", province: "TP. Hồ Chí Minh", ward: "Phường Thảo Điền", hamlet: "", birthPlace: "TP.HCM", fatherBY: "1988", motherBY: "1991", guardianName: "Ngô Văn Tâm", guardianOcc: "Luật sư", guardianBY: "1988" },
      { name: "Trương Nhật Minh", gender: "male", dob: "2020-08-14", classIdx: 2, phone: "0901111010", nationality: "Việt Nam", religion: "Phật giáo", province: "TP. Hồ Chí Minh", ward: "Phường 6, Quận 5", hamlet: "Khu phố 2", birthPlace: "BV Chợ Rẫy, TP.HCM", fatherBY: "1987", motherBY: "1990", guardianName: "Trương Văn Hải", guardianOcc: "Kế toán", guardianBY: "1987" },
      { name: "Lý Bảo Ngọc", gender: "female", dob: "2020-03-02", classIdx: 2, phone: "0901111011", nationality: "Việt Nam", religion: "", province: "Tây Ninh", ward: "Phường 1, TX Tây Ninh", hamlet: "", birthPlace: "Tây Ninh", fatherBY: "1990", motherBY: "1993", guardianName: "Lý Văn Quang", guardianOcc: "Thợ điện", guardianBY: "1990" },
      { name: "Dương Hoàng Nam", gender: "male", dob: "2020-12-28", classIdx: 2, phone: "0901111012", nationality: "Việt Nam", religion: "", province: "TP. Hồ Chí Minh", ward: "Phường Tân Phú", hamlet: "Khu phố 4", birthPlace: "BV Từ Dũ, TP.HCM", fatherBY: "1989", motherBY: "1992", guardianName: "Dương Thị Ngọc", guardianOcc: "Dược sĩ", guardianBY: "1992" },
      { name: "Phan Thị Yến Nhi", gender: "female", dob: "2020-06-10", classIdx: 3, phone: "0901111013", nationality: "Việt Nam", religion: "", province: "TP. Hồ Chí Minh", ward: "Phường 4, Quận 4", hamlet: "", birthPlace: "TP.HCM", fatherBY: "1986", motherBY: "1989", guardianName: "Phan Văn Tín", guardianOcc: "Tài xế", guardianBY: "1986" },
      { name: "Huỳnh Tuấn Kiệt", gender: "male", dob: "2020-10-03", classIdx: 3, phone: "0901111014", nationality: "Việt Nam", religion: "Cao Đài", province: "Tây Ninh", ward: "Xã Hiệp Tân", hamlet: "Ấp Ninh Trung", birthPlace: "Tây Ninh", fatherBY: "1984", motherBY: "1987", guardianName: "Huỳnh Văn Đạo", guardianOcc: "Buôn bán", guardianBY: "1984" },
      { name: "Mai Ngọc Châu", gender: "female", dob: "2020-01-17", classIdx: 3, phone: "0901111015", nationality: "Việt Nam", religion: "", province: "TP. Hồ Chí Minh", ward: "Phường 15, Quận Tân Bình", hamlet: "", birthPlace: "TP.HCM", fatherBY: "1991", motherBY: "1994", guardianName: "Mai Văn Sơn", guardianOcc: "Công chức", guardianBY: "1991" },
      { name: "Đinh Hải Đăng", gender: "male", dob: "2020-04-08", classIdx: 3, phone: "0901111016", nationality: "Việt Nam", religion: "", province: "Bình Dương", ward: "Phường Hiệp Thành", hamlet: "Khu phố 6", birthPlace: "Bình Dương", fatherBY: "1988", motherBY: "1991", guardianName: "Đinh Thị Thu", guardianOcc: "Nhân viên VP", guardianBY: "1991" },
      { name: "Tô Khánh Vy", gender: "female", dob: "2019-09-12", classIdx: 4, phone: "0901111017", nationality: "Việt Nam", religion: "", province: "TP. Hồ Chí Minh", ward: "Phường An Phú", hamlet: "", birthPlace: "BV Từ Dũ, TP.HCM", fatherBY: "1987", motherBY: "1990", guardianName: "Tô Văn Bình", guardianOcc: "Giám đốc", guardianBY: "1987" },
      { name: "Lâm Quốc Huy", gender: "male", dob: "2019-11-25", classIdx: 4, phone: "0901111018", nationality: "Việt Nam", religion: "", province: "TP. Hồ Chí Minh", ward: "Phường 8, Quận 11", hamlet: "Khu phố 1", birthPlace: "TP.HCM", fatherBY: "1985", motherBY: "1988", guardianName: "Lâm Thị Bích", guardianOcc: "Y tá", guardianBY: "1988" },
      { name: "Châu Ngọc Diệp", gender: "female", dob: "2019-07-03", classIdx: 4, phone: "0901111019", nationality: "Việt Nam", religion: "Phật giáo", province: "Đồng Nai", ward: "Phường Long Bình", hamlet: "Khu phố 3", birthPlace: "Đồng Nai", fatherBY: "1986", motherBY: "1989", guardianName: "Châu Văn Lộc", guardianOcc: "Thợ mộc", guardianBY: "1986" },
      { name: "Vũ Đình Khôi", gender: "male", dob: "2019-02-14", classIdx: 4, phone: "0901111020", nationality: "Việt Nam", religion: "", province: "TP. Hồ Chí Minh", ward: "Phường Cát Lái", hamlet: "", birthPlace: "TP.HCM", fatherBY: "1990", motherBY: "1993", guardianName: "Vũ Văn Hào", guardianOcc: "Kỹ thuật viên", guardianBY: "1990" },
      { name: "Trịnh Thanh Thảo", gender: "female", dob: "2019-06-20", classIdx: 5, phone: "0901111021", nationality: "Việt Nam", religion: "", province: "TP. Hồ Chí Minh", ward: "Phường 3, Quận Gò Vấp", hamlet: "Khu phố 7", birthPlace: "TP.HCM", fatherBY: "1988", motherBY: "1991", guardianName: "Trịnh Văn Đức", guardianOcc: "Giáo viên", guardianBY: "1988" },
      { name: "Lương Gia Hân", gender: "female", dob: "2019-12-01", classIdx: 5, phone: "0901111022", nationality: "Việt Nam", religion: "", province: "Long An", ward: "TT Tân Trụ", hamlet: "Ấp 3", birthPlace: "Long An", fatherBY: "1984", motherBY: "1987", guardianName: "Lương Văn Phát", guardianOcc: "Nông dân", guardianBY: "1984" },
      { name: "Cao Nhật Long", gender: "male", dob: "2019-04-28", classIdx: 5, phone: "0901111023", nationality: "Việt Nam", religion: "", province: "TP. Hồ Chí Minh", ward: "Phường Linh Trung", hamlet: "", birthPlace: "BV Thủ Đức", fatherBY: "1989", motherBY: "1992", guardianName: "Cao Thị Lan", guardianOcc: "Nội trợ", guardianBY: "1992" },
      { name: "Hà Phúc An", gender: "male", dob: "2019-08-16", classIdx: 5, phone: "0901111024", nationality: "Việt Nam", religion: "Công giáo", province: "TP. Hồ Chí Minh", ward: "Phường Tân Sơn Nhì", hamlet: "Khu phố 2", birthPlace: "TP.HCM", fatherBY: "1987", motherBY: "1990", guardianName: "Hà Văn Phúc", guardianOcc: "Kinh doanh", guardianBY: "1987" },
    ];

    const joinDates = [
      "2024-09-02", "2024-09-02", "2024-09-03", "2024-09-05",
      "2024-09-02", "2024-09-04", "2024-09-02", "2024-09-06",
      "2024-09-02", "2024-09-02", "2024-09-03", "2024-09-02",
      "2024-09-02", "2024-09-05", "2024-09-02", "2024-09-03",
      "2023-09-04", "2023-09-02", "2023-09-02", "2023-09-06",
      "2023-09-02", "2023-09-03", "2023-09-02", "2023-09-02",
    ];

    const studentIds = [];
    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      const r = await client.query(
        `INSERT INTO students (
           name, gender, date_of_birth, class_id, join_date, status,
           grade, email, avatar,
           phone, nationality, religion, province, ward, hamlet,
           birth_place, father_birth_year, mother_birth_year,
           id_number, id_issued_place, id_issued_date, area,
           disability_type, policy_beneficiary, eye_disease,
           guardian_name, guardian_occupation, guardian_birth_year
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28
         ) RETURNING id`,
        [
          s.name, s.gender, s.dob, classIds[s.classIdx], joinDates[i], "active",
          "", "", "",
          s.phone, s.nationality, s.religion || "", s.province, s.ward, s.hamlet || "",
          s.birthPlace, s.fatherBY, s.motherBY,
          "", "", null, "",
          "", "", "",
          s.guardianName, s.guardianOcc, s.guardianBY,
        ]
      );
      studentIds.push(r.rows[0].id);
    }
    console.log(`Inserted ${studentIds.length} students`);

    // ── Student attendance (last 2 weeks) ──
    const today = new Date();
    let attCount = 0;
    for (let dayOffset = 1; dayOffset <= 14; dayOffset++) {
      const d = new Date(today);
      d.setDate(d.getDate() - dayOffset);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      for (let si = 0; si < studentIds.length; si++) {
        const rand = Math.random();
        let status;
        if (rand < 0.82) status = "present";
        else if (rand < 0.95) status = "absent";
        else status = null;

        if (status) {
          const classIdx = students[si].classIdx;
          await client.query(
            `INSERT INTO student_attendance (student_id, class_id, attendance_date, session, status, note)
             VALUES ($1,$2,$3,'full',$4,'') ON CONFLICT DO NOTHING`,
            [studentIds[si], classIds[classIdx], dateStr, status]
          );
          attCount++;
        }
      }
    }
    console.log(`Inserted ${attCount} student attendance records`);

    // ── Teacher attendance (last 2 weeks) ──
    let tAttCount = 0;
    for (let dayOffset = 1; dayOffset <= 14; dayOffset++) {
      const d = new Date(today);
      d.setDate(d.getDate() - dayOffset);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      for (const tid of teacherIds) {
        const rand = Math.random();
        let status;
        if (rand < 0.9) status = "present";
        else if (rand < 0.97) status = "absent";
        else status = null;

        if (status) {
          await client.query(
            `INSERT INTO teacher_attendance (teacher_id, attendance_date, status, note)
             VALUES ($1,$2,$3,'') ON CONFLICT DO NOTHING`,
            [tid, dateStr, status]
          );
          tAttCount++;
        }
      }
    }
    console.log(`Inserted ${tAttCount} teacher attendance records`);

    const mgrHash = bcrypt.hashSync("admin123", 10);
    await client.query(
      `INSERT INTO users (email, phone, password_hash, role, name, teacher_id)
       VALUES ('admin@mamnon.local', '', $1, 'manager', 'Quản trị viên', NULL)
       ON CONFLICT (email) DO NOTHING`,
      [mgrHash]
    );
    console.log("Default manager (ON CONFLICT skip if exists): admin@mamnon.local / admin123");

    const tHash = bcrypt.hashSync("teacher123", 10);
    await client.query(
      `INSERT INTO users (email, phone, password_hash, role, name, teacher_id)
       VALUES ('teacher@mamnon.local', $1, $2, 'teacher', $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      [teacherRows[0][2], tHash, teacherRows[0][0], teacherIds[0]]
    );
    console.log(`Demo teacher (ON CONFLICT skip if exists): ${teacherRows[0][2]} / teacher123`);

    await client.query("COMMIT");
    console.log("\nSeed complete!");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Seed failed:", e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
