# Spec: Điểm danh học sinh + check ăn sáng / ăn trưa

**Trạng thái:** phase 1 đã triển khai — chưa đổi học phí (`meal_days`)  
**Phạm vi:** mở rộng tính năng điểm danh hiện có, không làm module mới  
**Nguồn sự thật dự án:** `.agent/PROJECT_SPEC.md`  
**Màn hình chính giáo viên:** `/attendance` (`frontend/src/views/AttendancePanel.vue`)

---

## 1. Bối cảnh hiện tại

Hệ thống đã có điểm danh học sinh theo lớp / ngày / buổi.

### Dữ liệu

Bảng `student_attendance`:

| Cột | Ý nghĩa |
|---|---|
| `student_id`, `class_id` | Học sinh và lớp lúc ghi nhận |
| `attendance_date` | Ngày `YYYY-MM-DD` |
| `session` | `full` / `morning` / `afternoon` — UI giáo viên đang luôn gửi `full` |
| `status` | `present`, `absent`, `late`, `excused` |
| `note` | Ghi chú tự do |
| `recorded_by_teacher_id` | Giáo viên ghi nhận |
| Unique | `(student_id, attendance_date, session)` |

UI `/attendance` chỉ dùng `present` / `absent`. `late` và `excused` nếu có từ API bị coi như chưa điểm danh.

### API đã có

- `GET /api/attendance/students?classId=&date=&session=full`
- `PUT /api/attendance/students/bulk` — body `{ classId, date, session, items: [{ studentId, status, note? }] }`
- `DELETE /api/attendance/students/record?studentId=&date=&session=full`
- `GET /api/attendance/students/classes/:classId/month-summary`
- `GET /api/attendance/students/classes/:classId/student-month-summary`
- `GET /api/attendance/students/student/:studentId?from=&to=`

Quyền: `admin` mọi lớp; `teacher` chỉ lớp được gán trong `class_teachers`.

### UI đã có

- Giáo viên / admin: Kanban 3 cột trên `/attendance` — Chưa điểm danh / Đi học / Nghỉ học. Có điểm danh hàng loạt (mặc định Đi học).
- Admin xem tổng hợp: tab Điểm danh trong `/school` (`ClassAttendancePanel.vue`), drawer lớp (`ClassesPanel.vue`), lịch sử học sinh (`StudentsPanel.vue`).
- Dashboard đã có số liệu có mặt / vắng theo lớp.

### Lỗ hổng liên quan học phí

Khoản thu `calcType = meal_days` hiện **đếm ngày `status = present`**, giống `attendance_days`. Chưa có tín hiệu thật “bé có ăn hôm đó”. Spec này tạo tín hiệu đó; **không đổi công thức học phí ở phase 1**.

---

## 2. Vấn đề cần giải quyết

Nhà trường cần biết **bé nào ăn sáng / ăn trưa trong ngày** để:

1. Giáo viên check nhanh khi điểm danh.
2. Bếp / văn phòng biết số suất ăn sáng và ăn trưa theo lớp / toàn trường.
3. (Phase 2) Tính tiền ăn theo ngày ăn thật, không theo ngày đi học.

Hiện giáo viên chỉ đánh dấu Đi học / Nghỉ học. Không có chỗ ghi suất ăn.

---

## 3. Mục tiêu

### Phase 1 — vận hành trong ngày (làm trước)

- Giáo viên, khi học sinh **đi học**, tick **Ăn sáng** và/hoặc **Ăn trưa**.
- Hai suất độc lập: có thể ăn sáng không ăn trưa, hoặc ngược lại, hoặc cả hai, hoặc không ăn.
- Màn hình điểm danh hiện số suất ăn sáng / ăn trưa của lớp trong ngày.
- Admin xem được cùng thông tin trên các màn tổng hợp ngày / tháng / lịch sử học sinh.
- Dữ liệu cũ không bị phá: bản ghi chưa có tick → coi như không ăn.

### Phase 2 — học phí (chỉ khi được yêu cầu rõ)

- `meal_days` đếm ngày có ít nhất một suất ăn (`ate_breakfast OR ate_lunch`), hoặc tách `breakfast_days` / `lunch_days` nếu nhà trường thu riêng.
- Không làm trong phase 1 vì `PROJECT_SPEC.md` cấm đổi ngữ nghĩa tính phí tùy tiện.

---

## 4. Ngoài phạm vi

- App phụ huynh / thông báo phụ huynh.
- Menu thực đơn, dị ứng, khẩu phần đặc biệt.
- Ăn xế / ăn chiều (chỉ sáng + trưa).
- Chia buổi `morning` / `afternoon` trên UI (vẫn giữ `session=full` như hiện tại).
- Điểm danh giáo viên, xin nghỉ GV.
- Đổi công thức học phí, sinh bảng tính, thanh toán.
- Bảng / route / thư viện mới nếu không cần.

---

## 5. Người dùng

| Vai trò | Việc làm |
|---|---|
| Giáo viên | Điểm danh lớp được gán; tick ăn sáng / ăn trưa cho bé đi học |
| Admin | Làm được như giáo viên mọi lớp; xem tổng hợp ngày / tháng / từng bé |
| Kế toán | Không ghi điểm danh / suất ăn ở phase 1. Phase 2 mới dùng số liệu để tính phí |
| Phụ huynh | Không có trong app hiện tại |

---

## 6. Quyết định thiết kế

### 6.1 Lưu trên bản ghi điểm danh, không tách bảng

Thêm 2 cột boolean trên `student_attendance`:

- `ate_breakfast`
- `ate_lunch`

Lý do: UI đã theo học sinh + ngày; unique key đã có; học phí phase 2 đọc cùng bảng.

Không tạo `student_meals`. Không nhét JSON vào `note`.

### 6.2 Chỉ bé đi học mới có suất ăn

| Trạng thái | Ăn sáng / ăn trưa |
|---|---|
| Chưa điểm danh | Không hiện tick; không lưu |
| `present` | Cho phép tick độc lập; mặc định **tắt** |
| `absent` | Bắt buộc cả hai = `false` |
| Hủy điểm danh | Xóa bản ghi, mất luôn suất ăn |
| `late` / `excused` (API còn, UI chưa dùng) | Giữ cột; rule giống `present` nếu sau này bật UI |

### 6.3 Mặc định tắt (opt-in)

Giáo viên phải tick mới tính là có ăn. An toàn hơn mặc định bật (tránh tính thừa suất / tính thừa tiền sau này).

Điểm danh hàng loạt chỉ đổi trạng thái thành `present`, **không** tự tick ăn.

Có nút phụ trên cột Đi học: **Tick ăn trưa cả cột** / **Tick ăn sáng cả cột** — chỉ áp dụng bé đang `present`.

### 6.4 Sửa được trong ngày, không khóa giờ

Giáo viên / admin sửa tick bất kỳ lúc nào (kể cả ngày cũ). Không chốt ca, không giới hạn giờ bếp ở phase 1.

---

## 7. User stories

1. Là giáo viên, tôi mở `/attendance`, chọn lớp và ngày, điểm danh Đi học / Nghỉ như cũ.
2. Là giáo viên, với bé **Đi học**, tôi tick **Ăn sáng** và/hoặc **Ăn trưa** để bếp biết suất.
3. Là giáo viên, tôi bỏ tick nếu bé không ăn suất đó.
4. Là giáo viên, tôi chuyển bé sang Nghỉ hoặc Hủy điểm danh thì suất ăn bị xóa.
5. Là giáo viên, tôi thấy trên cùng màn hình: số bé đi học, số suất ăn sáng, số suất ăn trưa.
6. Là giáo viên, tôi tick nhanh ăn trưa (hoặc ăn sáng) cho cả cột Đi học.
7. Là admin, tôi xem cột Ăn sáng / Ăn trưa trên bảng điểm danh theo ngày và tổng số ngày ăn theo tháng / theo bé.

---

## 8. Model dữ liệu

### Migration (incremental trong `backend/src/db.js`)

```sql
ALTER TABLE student_attendance
  ADD COLUMN IF NOT EXISTS ate_breakfast BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE student_attendance
  ADD COLUMN IF NOT EXISTS ate_lunch BOOLEAN NOT NULL DEFAULT FALSE;
```

Không backfill: dữ liệu cũ = chưa ăn.

Index riêng không cần; query theo `class_id + attendance_date` đã có index.

### API camelCase

| DB | API |
|---|---|
| `ate_breakfast` | `ateBreakfast` |
| `ate_lunch` | `ateLunch` |

Cập nhật `mapStudentAttendanceRow` trong `backend/src/db.js`.

Giá trị khi chưa có bản ghi (`status: null`): `ateBreakfast: false`, `ateLunch: false`.

---

## 9. API

Giữ path hiện có. Không mount group mới.

### 9.1 `GET /api/attendance/students`

Mỗi phần tử thêm:

```json
{
  "ateBreakfast": false,
  "ateLunch": false
}
```

SELECT thêm `sa.ate_breakfast`, `sa.ate_lunch`.

### 9.2 `PUT /api/attendance/students/bulk`

Body mở rộng, tương thích ngược:

```json
{
  "classId": 3,
  "date": "2026-09-03",
  "session": "full",
  "items": [
    {
      "studentId": 12,
      "status": "present",
      "note": "",
      "ateBreakfast": true,
      "ateLunch": false
    }
  ]
}
```

Rule server:

1. Validate `ateBreakfast` / `ateLunch` là boolean nếu gửi lên.
2. Nếu thiếu field: giữ giá trị cũ khi upsert update; khi insert mới thì `false`.
3. Nếu `status === "absent"`: ép cả hai = `false` dù client gửi `true`.
4. Ghi `recorded_by_teacher_id` như hiện tại.

Ví dụ upsert:

```sql
INSERT INTO student_attendance
  (student_id, class_id, attendance_date, session, status, note,
   ate_breakfast, ate_lunch, recorded_by_teacher_id, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
ON CONFLICT (student_id, attendance_date, session)
DO UPDATE SET
  status = EXCLUDED.status,
  note = EXCLUDED.note,
  ate_breakfast = EXCLUDED.ate_breakfast,
  ate_lunch = EXCLUDED.ate_lunch,
  class_id = EXCLUDED.class_id,
  recorded_by_teacher_id = EXCLUDED.recorded_by_teacher_id,
  updated_at = NOW()
```

Nếu item chỉ đổi suất ăn, client vẫn gửi `status: "present"` hiện tại (UI đã làm vậy khi đổi trạng thái).

### 9.3 `DELETE /api/attendance/students/record`

Không đổi. Xóa bản ghi thì mất suất ăn.

### 9.4 Tổng hợp tháng / lịch sử

`GET .../month-summary` thêm:

```json
{
  "breakfastCount": 42,
  "lunchCount": 80
}
```

Đếm bản ghi `ate_breakfast = true` / `ate_lunch = true` trong tháng (không đếm absent vì đã ép false).

`GET .../student-month-summary` mỗi học sinh thêm:

```json
{
  "breakfastDays": 12,
  "lunchDays": 18
}
```

`GET .../student/:studentId` trả `ateBreakfast`, `ateLunch` qua mapper.

### 9.5 Tổng suất theo ngày (admin / giáo viên)

Endpoint mới, cùng router:

`GET /api/attendance/students/meal-summary?classId=&date=&session=full`

- Có `classId`: một lớp (giáo viên phải được gán lớp đó).
- Không `classId`:
  - admin: mọi lớp;
  - giáo viên: chỉ lớp được gán.

```json
{
  "date": "2026-09-03",
  "session": "full",
  "classId": 3,
  "presentCount": 22,
  "breakfastCount": 8,
  "lunchCount": 20,
  "bothMealsCount": 7,
  "noMealCount": 1,
  "classes": [
    {
      "classId": 3,
      "className": "Lớp Lá 1",
      "presentCount": 22,
      "breakfastCount": 8,
      "lunchCount": 20
    }
  ]
}
```

Phase 1: UI giáo viên **tính từ danh sách lớp đang mở** cũng đủ. Endpoint này phục vụ dashboard / bếp / admin, triển khai cùng phase 1 nếu ít công.

Quyền không nới: vẫn `requireAuth` + `assertClassAccess`.

---

## 10. UI

### 10.1 `/attendance` — việc chính của giáo viên

**Cột Đi học** — mỗi thẻ bé, dưới tên (hoặc dưới nút trạng thái):

- Chip / checkbox **Ăn sáng**
- Chip / checkbox **Ăn trưa**
- Disabled khi đang lưu thẻ đó
- Đổi tick → gọi `PUT /students/bulk` ngay (một học sinh), gửi `status: 'present'` + 2 flag

**Cột Chưa điểm danh / Nghỉ học:** không hiện tick ăn.

**Điểm danh hàng loạt:** giữ hành vi cũ; `ateBreakfast` / `ateLunch` = `false`.

**Nút phụ** (chỉ hiện khi cột Đi học có bé):

- `Tick ăn sáng cả cột`
- `Tick ăn trưa cả cột`

Gửi bulk các bé `present` với flag tương ứng = `true`, giữ flag kia.

**Không** có “bỏ tick cả cột” ở phase 1 (tránh bấm nhầm). Bỏ từng bé.

**Thẻ thống kê** — thêm 2 thẻ (hoặc mở rộng hàng hiện có):

| Thẻ | Nguồn |
|---|---|
| Ăn sáng | số `present && ateBreakfast` |
| Ăn trưa | số `present && ateLunch` |

Giữ: Tiến độ, Chưa điểm danh, Đi học, Nghỉ học.

**Trạng thái:** loading / empty / error / disabled như màn hiện tại. Lỗi lưu tick: revert + reload giống `markStudent`.

**Mobile:** chip đủ lớn để bấm; không bắt horizontal scroll.

### 10.2 Admin — `ClassAttendancePanel`

Bảng theo ngày: thêm cột **Ăn sáng**, **Ăn trưa** (Có / —).  
Bảng theo tháng: thêm **Ngày ăn sáng**, **Ngày ăn trưa**.  
Lưới stat tháng: thêm 2 ô suất ăn.

### 10.3 Drawer lớp — `ClassesPanel`

Bảng tổng hợp học sinh: thêm 2 cột ngày ăn.

### 10.4 Lịch sử học sinh — `StudentsPanel`

Ô ngày trên lịch: nếu có ăn, hiện dấu nhỏ (S / T hoặc icon). Tooltip: `Present · Ăn sáng · Ăn trưa`.

### 10.5 Dashboard

Phase 1 optional: 2 số “Suất sáng hôm nay / Suất trưa hôm nay”. Không chặn phase 1 nếu chưa làm.

### 10.6 CSS

Style scoped trong `AttendancePanel.vue` / panel liên quan. Không nhét vào `fee-panel.css`. Dùng `panel-tables.css` nếu bảng admin cần cột mới.

---

## 11. Quy tắc nghiệp vụ

1. Tick ăn chỉ hợp lệ khi `status = present` (phase 1 UI).
2. `absent` hoặc xóa bản ghi → không còn suất ăn.
3. Hai suất độc lập.
4. Giáo viên chỉ lớp được gán; admin mọi lớp.
5. Học sinh `status != active` không vào danh sách điểm danh ngày (như cũ).
6. Một ngày + `session=full` → tối đa một bộ flag.
7. Phase 1 **không** đụng `backend/src/routes/fees.js`.
8. Không log tên bé kèm token / PII ngoài nhu cầu hiện có.

---

## 12. Ảnh hưởng học phí (phase 2 — chưa làm)

Hiện `fees.js` (~dòng 1034–1043):

```sql
SELECT student_id, COUNT(DISTINCT attendance_date) AS attendance_days
FROM student_attendance
WHERE ... AND status = 'present'
GROUP BY student_id
```

Cả `attendance_days` và `meal_days` dùng chung map này.

Hướng phase 2 (chờ chỉ đạo):

- `attendance_days`: giữ đếm `status = 'present'`.
- `meal_days`: đếm ngày `ate_breakfast OR ate_lunch`.
- Nếu thu tách suất: thêm `calcType` `breakfast_days` / `lunch_days`.

Cần xác nhận nhà trường: tiền ăn = ngày có ít nhất một bữa, hay mỗi suất một đơn giá.

---

## 13. File dự kiến khi implement

| File | Việc |
|---|---|
| `backend/src/db.js` | `ALTER TABLE` + mapper |
| `backend/src/routes/attendance.js` | GET/PUT/summary |
| `frontend/src/views/AttendancePanel.vue` | Tick + thẻ số + bulk tick ăn |
| `frontend/src/views/ClassAttendancePanel.vue` | Cột / stat admin |
| `frontend/src/views/ClassesPanel.vue` | Cột tháng |
| `frontend/src/views/StudentsPanel.vue` | Lịch sử bé |
| `frontend/src/views/Dashboard.vue` | Optional |
| `.agent/PROJECT_SPEC.md` | Ghi nhận feature sau khi làm xong |

Không đổi: auth, CORS, JWT, scripts deploy, sidenav `/fee-services`, ngữ nghĩa thanh toán.

---

## 14. Tiêu chí chấp nhận (phase 1)

1. Giáo viên tick Ăn sáng / Ăn trưa trên thẻ bé **Đi học**; reload vẫn giữ.
2. Bé **Nghỉ** hoặc **Chưa điểm danh** không có tick; chuyển sang Nghỉ thì flag về false trên DB.
3. Điểm danh hàng loạt không tự tick ăn.
4. Tick ăn sáng cả cột / ăn trưa cả cột chỉ đụng bé đang Đi học.
5. Thẻ thống kê đúng số suất lớp + ngày đang chọn.
6. Giáo viên không sửa được lớp không được gán (403 như cũ).
7. Admin thấy suất ăn trên bảng ngày / tháng / lịch sử bé.
8. Bản ghi cũ: cả hai flag false; điểm danh cũ vẫn chạy.
9. `PUT` thiếu field ăn: không xóa flag cũ; `absent` luôn ghi false.
10. `frontend`: `npm run build` pass.
11. Chưa đổi generate học phí / số tiền kỳ thu.

---

## 15. Kế hoạch triển khai

1. Schema + mapper.
2. API list / bulk / month summaries.
3. UI giáo viên `/attendance` (ưu tiên).
4. UI admin tổng hợp.
5. `meal-summary` + dashboard nếu còn thời gian.
6. Build frontend; smoke API nếu có Postgres local.

---

## 16. Kiểm thử thủ công

Với tài khoản giáo viên demo (lớp được gán):

1. `/attendance` → chọn lớp + hôm nay.
2. Điểm danh 1 bé Đi học → hiện 2 tick tắt.
3. Tick Ăn trưa → reload → vẫn bật; thẻ “Ăn trưa” tăng 1.
4. Tick Ăn sáng → cả hai bật.
5. Chuyển Nghỉ → tick biến mất; DB cả hai false.
6. Hủy điểm danh → bé về cột chưa điểm danh.
7. Hàng loạt Đi học → không ai bị tick ăn.
8. Tick ăn trưa cả cột → mọi bé Đi học có ăn trưa; ăn sáng không đổi.
9. Đăng nhập giáo viên khác (không gán lớp) → 403.
10. Admin: School → Điểm danh theo lớp → cột ăn đúng.

---

## 17. Việc cần chốt trước khi code (nếu khác mặc định spec)

| Câu hỏi | Mặc định spec |
|---|---|
| Tick mặc định khi bấm Đi học? | Tắt cả hai |
| Điểm danh hàng loạt có kèm ăn trưa? | Không |
| Sửa ngày quá khứ? | Có |
| Phase 1 có đổi `meal_days`? | Không |
| Cần suất ăn xế? | Không |

---

## 18. Ghi chú implement

- Minimal diff; giữ Kanban 3 cột.
- Date picker: `AppDateField`.
- Boolean rõ, không `"true"` string.
- Ép `absent` → meal false ở **server**, không chỉ UI.
- Tương thích client cũ: thiếu field meal không làm vỡ upsert.
