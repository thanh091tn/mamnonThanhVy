<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useStore } from "vuex";
import { api } from "@/api/client.js";
import ArgonAlert from "@/components/ArgonAlert.vue";
import ArgonButton from "@/components/ArgonButton.vue";
import ConfirmLogoutPopup from "@/components/ConfirmLogoutPopup.vue";
import { VueDatePicker } from "@vuepic/vue-datepicker";
import "@vuepic/vue-datepicker/dist/main.css";
import { vi } from "date-fns/locale";

const store = useStore();

function localTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDaysStr(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateToIso(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return "";
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayDateValue() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const authUser = computed(() => store.state.authUser);
const leaveMode = ref("full_day");
const leaveSession = ref("morning");
const leaveSingleDate = ref(todayDateValue());
const leaveDate = ref(localTodayStr());
const leaveEndDate = ref(localTodayStr());
const leaveRange = ref([todayDateValue(), todayDateValue()]);
const leaveNote = ref("");
const leaveSubmitting = ref(false);
const leaveErr = ref("");
const leaveOkMsg = ref("");
const myTeacherRecords = ref([]);
const myLeaveLoading = ref(false);
const showConfirmPopup = ref(false);
const confirmPopupTitle = ref("");
const confirmPopupMessage = ref("");
const confirmPopupConfirmText = ref("");
const confirmPopupDanger = ref(true);
const pendingLeaveAction = ref(null);

const teacherStatusOptions = [
  { value: "present", label: "Đi dạy" },
  { value: "absent", label: "Nghỉ" },
  { value: "late", label: "Trễ" },
  { value: "leave", label: "Phép" },
  { value: "excused", label: "Có phép" },
];

const leaveModeOptions = [
  {
    value: "half_day",
    title: "Nghỉ nửa ngày",
    description: "Chọn một ngày và buổi nghỉ",
    icon: "ni ni-time-alarm",
  },
  {
    value: "date_range",
    title: "Nghỉ trong khoảng ngày",
    description: "Chọn ngày bắt đầu và kết thúc",
    icon: "ni ni-calendar-grid-58",
  },
  {
    value: "full_day",
    title: "Nghỉ 1 ngày",
    description: "Chọn một ngày nghỉ trọn ngày",
    icon: "ni ni-calendar-grid-61",
  },
];

const leaveSessionOptions = [
  { value: "morning", label: "Buổi sáng" },
  { value: "afternoon", label: "Buổi chiều" },
];

function leaveTypeLabel(type, session = "") {
  if (type === "half_day") {
    return session === "afternoon" ? "Nửa ngày - chiều" : "Nửa ngày - sáng";
  }
  if (type === "date_range") return "Khoảng ngày";
  return "Nghỉ 1 ngày";
}

function currentLeaveDates() {
  if (leaveMode.value === "date_range") {
    const [startDate, endDate] = Array.isArray(leaveRange.value) ? leaveRange.value : [];
    const startIso = dateToIso(startDate);
    const endIso = dateToIso(endDate || startDate);
    return { startIso, endIso };
  }
  const startIso = dateToIso(leaveSingleDate.value);
  return { startIso, endIso: startIso };
}

function syncLeavePreview() {
  const { startIso, endIso } = currentLeaveDates();
  leaveDate.value = startIso || "";
  leaveEndDate.value = endIso || startIso || "";
}

watch([leaveMode, leaveSingleDate, leaveRange], syncLeavePreview, { immediate: true });

const myLeaveRows = computed(() => {
  const t = localTodayStr();
  return myTeacherRecords.value.filter(
    (r) => r.status === "leave" && r.attendanceDate >= t
  );
});

const myOtherAttendanceRows = computed(() => {
  const t = localTodayStr();
  return myTeacherRecords.value.filter(
    (r) => r.status !== "leave" && r.attendanceDate >= t
  );
});

async function loadMyTeacherLeaveRecords() {
  myLeaveLoading.value = true;
  leaveErr.value = "";
  try {
    const { data } = await api.get("/attendance/teachers/me", {
      params: { from: localTodayStr(), to: addDaysStr(120) },
    });
    myTeacherRecords.value = Array.isArray(data) ? data : [];
  } catch (e) {
    leaveErr.value =
      e.response?.data?.error || e.message || "Không tải được lịch nghỉ";
    myTeacherRecords.value = [];
  } finally {
    myLeaveLoading.value = false;
  }
}

async function submitLeaveRequest() {
  leaveErr.value = "";
  leaveOkMsg.value = "";
  leaveSubmitting.value = true;
  try {
    syncLeavePreview();
    await api.post("/attendance/teachers/me/leave-request", {
      date: leaveDate.value,
      toDate: leaveEndDate.value,
      leaveType: leaveMode.value,
      leaveSession: leaveMode.value === "half_day" ? leaveSession.value : undefined,
      note: leaveNote.value,
    });
    leaveOkMsg.value =
      leaveMode.value === "half_day"
        ? `Đã gửi đăng ký nghỉ nửa ngày (${leaveSession.value === "afternoon" ? "buổi chiều" : "buổi sáng"}) ${leaveDate.value}.`
        : leaveDate.value === leaveEndDate.value
        ? "Đã gửi đăng ký nghỉ phép."
        : `Đã gửi đăng ký nghỉ từ ${leaveDate.value} đến ${leaveEndDate.value}.`;
    leaveNote.value = "";
    await loadMyTeacherLeaveRecords();
  } catch (e) {
    leaveErr.value =
      e.response?.data?.error || e.message || "Gửi đăng ký thất bại";
  } finally {
    leaveSubmitting.value = false;
  }
}

async function cancelMyLeave(dateStr) {
  leaveErr.value = "";
  leaveOkMsg.value = "";
  try {
    await api.delete("/attendance/teachers/me/leave-request", {
      params: { date: dateStr },
    });
    leaveOkMsg.value = "Đã hủy đăng ký nghỉ phép.";
    await loadMyTeacherLeaveRecords();
  } catch (e) {
    leaveErr.value = e.response?.data?.error || e.message || "Hủy thất bại";
  }
}

function closeConfirmPopup() {
  showConfirmPopup.value = false;
  pendingLeaveAction.value = null;
}

function openSubmitLeaveConfirm() {
  const { startIso, endIso } = currentLeaveDates();
  const dateText =
    startIso && endIso
      ? startIso === endIso
        ? `ngày ${startIso}`
        : `từ ${startIso} đến ${endIso}`
      : "khoảng ngày đã chọn";

  confirmPopupTitle.value = "Xác nhận đăng ký nghỉ";
  confirmPopupMessage.value = `Xác nhận gửi đăng ký ${leaveTypeLabel(leaveMode.value, leaveSession.value).toLowerCase()} ${dateText}?`;
  confirmPopupConfirmText.value = "Gửi đăng ký";
  confirmPopupDanger.value = false;
  pendingLeaveAction.value = submitLeaveRequest;
  showConfirmPopup.value = true;
}

function openCancelLeaveConfirm(dateStr) {
  confirmPopupTitle.value = "Xác nhận hủy đăng ký nghỉ";
  confirmPopupMessage.value = `Xác nhận hủy đăng ký nghỉ ngày ${dateStr}?`;
  confirmPopupConfirmText.value = "Hủy đăng ký";
  confirmPopupDanger.value = true;
  pendingLeaveAction.value = () => cancelMyLeave(dateStr);
  showConfirmPopup.value = true;
}

async function confirmPendingLeaveAction() {
  const action = pendingLeaveAction.value;
  showConfirmPopup.value = false;
  pendingLeaveAction.value = null;
  if (typeof action === "function") {
    await action();
  }
}

onMounted(() => {
  loadMyTeacherLeaveRecords();
});
</script>

<template>
  <div class="teacher-leave-page page-fill">
    <section class="teacher-leave-hero">
      <div class="teacher-leave-copy">
        <span class="teacher-leave-eyebrow">Teacher Leave</span>
        <h4 class="teacher-leave-title mb-1">
          <span class="teacher-leave-title-icon">
            <i class="ni ni-calendar-grid-61"></i>
          </span>
          Xin nghỉ giáo viên
        </h4>
        <p class="teacher-leave-subtitle mb-0">
          Đăng ký nghỉ phép trước cho hôm nay hoặc nhiều ngày sắp tới. Quản lý sẽ theo dõi ở lịch nghỉ giáo viên.
        </p>
      </div>

      <div class="teacher-leave-highlight">
        <span class="teacher-leave-highlight-label">Tài khoản</span>
        <strong>{{ authUser?.name || authUser?.phone || authUser?.email || "Giáo viên" }}</strong>
        <small>{{ authUser?.email || "Đăng nhập bằng tài khoản giáo viên" }}</small>
      </div>
    </section>

    <div class="teacher-leave-grid">
      <div class="card teacher-leave-form-card">
        <div class="card-header pb-0">
          <h6 class="mb-1 teacher-leave-section-title">
            <i class="ni ni-single-copy-04 me-1"></i>
            Tạo đơn xin nghỉ
          </h6>
          <p class="text-sm text-secondary mb-0">
            Chọn loại nghỉ, ngày nghỉ và thêm ghi chú nếu cần.
          </p>
          <p class="text-xs text-secondary mt-2 mb-0">
            Hỗ trợ nghỉ nửa ngày, nghỉ 1 ngày hoặc nghỉ nhiều ngày liên tiếp.
          </p>
        </div>
        <div class="card-body teacher-leave-form-body">
          <argon-alert
            v-if="leaveErr"
            color="danger"
            icon="ni ni-fat-remove"
            class="mb-3"
          >
            {{ leaveErr }}
          </argon-alert>
          <argon-alert
            v-if="leaveOkMsg"
            color="success"
            icon="ni ni-check-bold"
            class="mb-3"
          >
            {{ leaveOkMsg }}
          </argon-alert>

          <div class="teacher-leave-form-grid">
            <div class="teacher-leave-picker-shell">
              <div class="teacher-leave-mode-grid">
                <button
                  v-for="option in leaveModeOptions"
                  :key="option.value"
                  type="button"
                  class="teacher-leave-mode-option"
                  :class="{ active: leaveMode === option.value }"
                  @click="leaveMode = option.value"
                >
                  <i :class="option.icon"></i>
                  <span>
                    <strong>{{ option.title }}</strong>
                    <small>{{ option.description }}</small>
                  </span>
                </button>
              </div>

              <div class="teacher-leave-field-head">
                <span class="teacher-leave-field-label">
                  {{ leaveMode === "date_range" ? "Khoảng ngày nghỉ" : "Ngày nghỉ" }}
                </span>
                <small class="teacher-leave-field-meta">
                  {{ leaveMode === "date_range" ? "Chọn ngày bắt đầu và kết thúc" : "Chọn ngày cần nghỉ" }}
                </small>
              </div>
              <VueDatePicker
                v-if="leaveMode === 'date_range'"
                v-model="leaveRange"
                range
                :min-date="todayDateValue()"
                :enable-time-picker="false"
                :auto-apply="true"
                :locale="vi"
                format="dd/MM/yyyy"
                select-text="Chọn"
                cancel-text="Hủy"
                placeholder="Chọn khoảng ngày nghỉ"
                class="teacher-leave-datepicker"
              />
              <VueDatePicker
                v-else
                v-model="leaveSingleDate"
                :min-date="todayDateValue()"
                :enable-time-picker="false"
                :auto-apply="true"
                :locale="vi"
                format="dd/MM/yyyy"
                select-text="Chọn"
                cancel-text="Hủy"
                placeholder="Chọn ngày nghỉ"
                class="teacher-leave-datepicker"
              />

              <div v-if="leaveMode === 'half_day'" class="teacher-leave-session-row">
                <button
                  v-for="option in leaveSessionOptions"
                  :key="option.value"
                  type="button"
                  class="teacher-leave-session-option"
                  :class="{ active: leaveSession === option.value }"
                  @click="leaveSession = option.value"
                >
                  {{ option.label }}
                </button>
              </div>

              <div class="teacher-leave-range-preview">
                <span class="teacher-leave-chip teacher-leave-chip--type">
                  {{ leaveTypeLabel(leaveMode, leaveSession) }}
                </span>
                <span class="teacher-leave-chip">{{ leaveDate || "Chưa chọn" }}</span>
                <template v-if="leaveMode === 'date_range'">
                  <i class="ni ni-bold-right teacher-leave-chip-arrow"></i>
                  <span class="teacher-leave-chip">{{ leaveEndDate || leaveDate || "Chưa chọn" }}</span>
                </template>
              </div>
            </div>

            <div class="teacher-leave-note-shell">
              <div class="teacher-leave-field-head">
                <span class="teacher-leave-field-label">Lý do hoặc ghi chú</span>
                <small class="teacher-leave-field-meta">Giúp quản lý nắm nhanh lý do nghỉ</small>
              </div>
              <textarea
                v-model="leaveNote"
                class="form-control teacher-leave-note-input"
                placeholder="Ví dụ: việc gia đình, khám sức khỏe…"
                maxlength="500"
                rows="6"
              ></textarea>
              <div class="teacher-leave-actions">
                <span class="teacher-leave-note-count">{{ leaveNote.length }}/500</span>
                <argon-button
                  color="primary"
                  variant="gradient"
                  type="button"
                  class="teacher-leave-submit"
                  :disabled="leaveSubmitting"
                  @click="openSubmitLeaveConfirm"
                >
                  <i class="ni ni-send me-1"></i>
                  {{ leaveSubmitting ? "Đang gửi…" : "Gửi đăng ký nghỉ" }}
                </argon-button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card teacher-leave-list-card">
        <div class="card-header pb-0 d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div>
            <h6 class="mb-0">Ngày đã đăng ký nghỉ</h6>
            <p class="text-xs text-secondary mb-0">Bạn có thể hủy từng ngày trước ngày nghỉ.</p>
          </div>
          <argon-button
            size="sm"
            color="secondary"
            variant="outline"
            type="button"
            :disabled="myLeaveLoading"
            @click="loadMyTeacherLeaveRecords"
          >
            Làm mới
          </argon-button>
        </div>
        <div class="card-body pt-3">
          <div v-if="myLeaveLoading" class="teacher-leave-empty">
            Đang tải…
          </div>
          <div v-else-if="!myLeaveRows.length" class="teacher-leave-empty">
            Chưa có ngày nghỉ phép nào được đăng ký từ hôm nay trở đi.
          </div>
          <div v-else class="table-responsive">
            <table class="table table-hover align-items-center mb-0 teacher-leave-table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Loại nghỉ</th>
                  <th>Trạng thái</th>
                  <th>Ghi chú</th>
                  <th style="width: 130px"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in myLeaveRows" :key="row.attendanceDate">
                  <td class="teacher-leave-date">{{ row.attendanceDate }}</td>
                  <td>
                    <span class="badge bg-gradient-info">
                      {{ leaveTypeLabel(row.leaveType, row.leaveSession) }}
                    </span>
                  </td>
                  <td>
                    <span class="badge bg-gradient-secondary">Nghỉ phép</span>
                  </td>
                  <td class="text-sm text-secondary">{{ row.note || "—" }}</td>
                  <td>
                    <argon-button
                      size="sm"
                      color="danger"
                      variant="outline"
                      type="button"
                      @click="openCancelLeaveConfirm(row.attendanceDate)"
                    >
                      Hủy
                    </argon-button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <confirm-logout-popup
      :open="showConfirmPopup"
      :title="confirmPopupTitle"
      :message="confirmPopupMessage"
      :confirm-text="confirmPopupConfirmText"
      cancel-text="Hủy"
      icon-class="ni ni-ui-04"
      :danger="confirmPopupDanger"
      @cancel="closeConfirmPopup"
      @confirm="confirmPendingLeaveAction"
    />

    <div v-if="myOtherAttendanceRows.length" class="card teacher-leave-history-card">
      <div class="card-header pb-0">
        <h6 class="mb-0">Các bản ghi khác trong hệ thống</h6>
        <p class="text-xs text-secondary mb-0">Chỉ xem, không chỉnh sửa tại đây.</p>
      </div>
      <div class="card-body pt-3">
        <div class="table-responsive">
          <table class="table table-sm align-items-center mb-0 teacher-leave-table">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Loại</th>
                <th>Trạng thái</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in myOtherAttendanceRows" :key="row.attendanceDate + row.status">
                <td class="teacher-leave-date">{{ row.attendanceDate }}</td>
                <td class="text-sm">
                  {{ leaveTypeLabel(row.leaveType, row.leaveSession) }}
                </td>
                <td class="text-sm">
                  {{ teacherStatusOptions.find((o) => o.value === row.status)?.label || row.status }}
                </td>
                <td class="text-sm text-secondary">{{ row.note || "—" }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.teacher-leave-page {
  padding: 1rem 1.5rem 1.5rem;
}

.teacher-leave-hero {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 1.35rem 1.4rem;
  border: 1px solid rgba(255, 255, 255, 0.65);
  border-radius: 1.25rem;
  background:
    radial-gradient(circle at top left, rgba(245, 158, 11, 0.16), transparent 28%),
    radial-gradient(circle at bottom right, rgba(20, 184, 166, 0.16), transparent 26%),
    linear-gradient(135deg, #ffffff 0%, #fffaf2 55%, #f4fbfa 100%);
  box-shadow: 0 1.4rem 2.6rem -2rem rgba(17, 24, 39, 0.32);
}

.teacher-leave-copy {
  max-width: 48rem;
}

.teacher-leave-eyebrow {
  display: inline-block;
  margin-bottom: 0.45rem;
  color: #d97706;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.teacher-leave-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #1f2a44;
  font-size: 1.5rem;
  font-weight: 700;
}

.teacher-leave-title-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 0.9rem;
  background: linear-gradient(135deg, #d97706, #f59e0b);
  color: #fff;
  box-shadow: 0 0.9rem 1.5rem -1rem rgba(217, 119, 6, 0.55);
  flex-shrink: 0;
}

.teacher-leave-title-icon i {
  font-size: 1rem;
}

.teacher-leave-subtitle {
  color: #67748e;
  font-size: 0.93rem;
  line-height: 1.6;
}

.teacher-leave-highlight {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 250px;
  padding: 1rem 1.1rem;
  border: 1px solid rgba(245, 158, 11, 0.16);
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 1rem 1.5rem -1.2rem rgba(245, 158, 11, 0.35);
}

.teacher-leave-highlight-label {
  margin-bottom: 0.35rem;
  color: #8392ab;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.teacher-leave-highlight strong {
  color: #344767;
  font-size: 1rem;
}

.teacher-leave-highlight small {
  margin-top: 0.25rem;
  color: #67748e;
  font-size: 0.78rem;
}

.teacher-leave-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: 1rem;
}

.teacher-leave-form-card,
.teacher-leave-list-card,
.teacher-leave-history-card {
  border: 1px solid #e9eef5;
  border-radius: 1.1rem;
  box-shadow: 0 0.35rem 1rem rgba(15, 23, 42, 0.05);
}

.teacher-leave-list-card,
.teacher-leave-history-card {
  overflow: hidden;
}

.teacher-leave-form-body {
  padding-top: 1.1rem;
}

.teacher-leave-form-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
  gap: 1rem;
}

.teacher-leave-picker-shell,
.teacher-leave-note-shell {
  border: 1px solid #edf2f7;
  border-radius: 1rem;
  background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
  padding: 1rem;
}

.teacher-leave-picker-shell {
  overflow: visible;
}

.teacher-leave-mode-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.55rem;
  margin-bottom: 1rem;
}

.teacher-leave-mode-option {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  min-height: 76px;
  padding: 0.65rem;
  border: 1px solid #e5edf6;
  border-radius: 0.85rem;
  background: #fff;
  color: #344767;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
}

.teacher-leave-mode-option i {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.9rem;
  height: 1.9rem;
  border-radius: 0.65rem;
  background: #fff7ed;
  color: #d97706;
  flex-shrink: 0;
}

.teacher-leave-mode-option strong,
.teacher-leave-mode-option small {
  display: block;
  line-height: 1.25;
}

.teacher-leave-mode-option strong {
  font-size: 0.78rem;
}

.teacher-leave-mode-option small {
  margin-top: 0.18rem;
  color: #8392ab;
  font-size: 0.68rem;
}

.teacher-leave-mode-option.active {
  border-color: #f59e0b;
  background: #fff7ed;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.12);
}

.teacher-leave-session-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
  margin-top: 0.75rem;
}

.teacher-leave-session-option {
  min-height: 2.45rem;
  border: 1px solid #dbe4f0;
  border-radius: 0.75rem;
  background: #fff;
  color: #344767;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
}

.teacher-leave-session-option.active {
  border-color: #14b8a6;
  background: #ecfdf5;
  color: #0f766e;
}

.teacher-leave-field-head {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-bottom: 0.75rem;
}

.teacher-leave-field-label {
  color: #1f2a44;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.teacher-leave-field-meta {
  color: #8392ab;
  font-size: 0.78rem;
}

.teacher-leave-form-card :deep(.dp__main) {
  width: 100%;
  position: relative;
}

.teacher-leave-form-card :deep(.dp__input_wrap) {
  width: 100%;
}

.teacher-leave-form-card :deep(.dp__input) {
  min-height: 3.2rem;
  border: 1px solid #dbe4f0;
  border-radius: 1rem;
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  font-size: 0.92rem;
  padding-left: 2.8rem;
}

.teacher-leave-form-card :deep(.dp__input:focus),
.teacher-leave-form-card :deep(.dp__input_focus) {
  border-color: #38bdf8;
  box-shadow: 0 0 0 0.22rem rgba(56, 189, 248, 0.16);
}

.teacher-leave-form-card :deep(.dp__input_icon) {
  left: 1rem;
  color: #d97706;
}

.teacher-leave-form-card :deep(.dp__menu) {
  border: 1px solid #e7edf5;
  border-radius: 1.25rem;
  background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
  box-shadow: 0 1.5rem 3rem rgba(15, 23, 42, 0.16);
  overflow: hidden;
}

.teacher-leave-form-card :deep(.dp__menu_inner) {
  padding: 0.5rem;
}

.teacher-leave-form-card :deep(.dp__arrow_top),
.teacher-leave-form-card :deep(.dp__arrow_bottom) {
  display: none;
}

.teacher-leave-form-card :deep(.dp__month_year_wrap) {
  padding: 0.35rem 0.35rem 0.65rem;
  margin-bottom: 0.35rem;
}

.teacher-leave-form-card :deep(.dp__month_year_select) {
  border-radius: 0.85rem;
  color: #1f2a44;
  font-weight: 700;
}

.teacher-leave-form-card :deep(.dp__month_year_select:hover) {
  background: #f8fafc;
}

.teacher-leave-form-card :deep(.dp__button) {
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  color: #b45309;
}

.teacher-leave-form-card :deep(.dp__button:hover) {
  background: #fff7ed;
  color: #9a3412;
}

.teacher-leave-form-card :deep(.dp__calendar_header),
.teacher-leave-form-card :deep(.dp__month_year_wrap),
.teacher-leave-form-card :deep(.dp__calendar_header_item) {
  color: #1f2a44;
}

.teacher-leave-form-card :deep(.dp__calendar_header) {
  margin-bottom: 0.35rem;
}

.teacher-leave-form-card :deep(.dp__calendar_header_item) {
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #94a3b8;
}

.teacher-leave-form-card :deep(.dp__calendar_row) {
  margin: 0.12rem 0;
}

.teacher-leave-form-card :deep(.dp__calendar_item) {
  padding: 0.14rem;
}

.teacher-leave-form-card :deep(.dp__cell_inner) {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.75rem;
  font-size: 0.84rem;
  font-weight: 600;
  color: #334155;
}

.teacher-leave-form-card :deep(.dp__cell_inner:hover) {
  background: #fef3c7;
  color: #92400e;
}

.teacher-leave-form-card :deep(.dp__today) {
  border-color: #f59e0b;
  color: #b45309;
}

.teacher-leave-form-card :deep(.dp__range_start),
.teacher-leave-form-card :deep(.dp__range_end),
.teacher-leave-form-card :deep(.dp__active_date) {
  background: linear-gradient(135deg, #d97706, #f59e0b);
  color: #fff;
  box-shadow: 0 0.75rem 1.4rem -1rem rgba(217, 119, 6, 0.55);
}

.teacher-leave-form-card :deep(.dp__range_between) {
  background: rgba(245, 158, 11, 0.16);
  color: #8a4b08;
}

.teacher-leave-form-card :deep(.dp__range_between_week) {
  background: rgba(245, 158, 11, 0.12);
}

.teacher-leave-form-card :deep(.dp__overlay) {
  border-radius: 1rem;
}

.teacher-leave-range-preview {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin-top: 0.9rem;
  flex-wrap: wrap;
}

.teacher-leave-chip {
  display: inline-flex;
  align-items: center;
  min-height: 2.1rem;
  padding: 0.4rem 0.8rem;
  border-radius: 999px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #9a3412;
  font-size: 0.8rem;
  font-weight: 700;
}

.teacher-leave-chip--type {
  background: #ecfeff;
  border-color: #a5f3fc;
  color: #0e7490;
}

.teacher-leave-chip-arrow {
  color: #c2410c;
  font-size: 0.8rem;
}

.teacher-leave-section-title {
  display: inline-flex;
  align-items: center;
  color: #1f2a44;
}

.teacher-leave-note-input {
  min-height: 10rem;
  border: 1px solid #dbe4f0;
  border-radius: 1rem;
  padding: 0.9rem 1rem;
  resize: vertical;
  box-shadow: none;
}

.teacher-leave-note-input:focus {
  border-color: #38bdf8;
  box-shadow: 0 0 0 0.22rem rgba(56, 189, 248, 0.16);
}

.teacher-leave-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.85rem;
  flex-wrap: wrap;
}

.teacher-leave-note-count {
  color: #8392ab;
  font-size: 0.78rem;
}

.teacher-leave-submit {
  min-width: 220px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.teacher-leave-empty {
  padding: 2.2rem 1rem;
  text-align: center;
  color: #64748b;
  font-size: 0.92rem;
  border: 1px dashed #dbe4ef;
  border-radius: 0.9rem;
  background: #fafcff;
}

.teacher-leave-table thead th {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #64748b;
  border-bottom: 1px solid #e9eef5;
  background: #f8fafc;
}

.teacher-leave-table tbody td {
  vertical-align: middle;
  padding-top: 0.9rem;
  padding-bottom: 0.9rem;
}

.teacher-leave-table tbody tr:hover td {
  background: #fcfcfd;
}

.teacher-leave-date {
  font-weight: 700;
  color: #1f2a44;
}

.teacher-leave-history-card {
  margin-top: 1rem;
}

@media (max-width: 991.98px) {
  .teacher-leave-page {
    padding: 1rem;
  }

  .teacher-leave-hero {
    flex-direction: column;
    padding: 1.1rem;
  }

  .teacher-leave-grid {
    grid-template-columns: 1fr;
  }

  .teacher-leave-form-grid {
    grid-template-columns: 1fr;
  }

  .teacher-leave-mode-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 767.98px) {
  .teacher-leave-submit {
    width: 100%;
  }

  .teacher-leave-actions {
    align-items: stretch;
  }
}
</style>
