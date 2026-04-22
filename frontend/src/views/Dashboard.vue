<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { api } from "@/api/client.js";
import ArgonAlert from "@/components/ArgonAlert.vue";
import ArgonButton from "@/components/ArgonButton.vue";
import DashboardDonutChart from "@/components/DashboardDonutChart.vue";

const loading = ref(false);
const loadErr = ref("");
const data = ref(null);
const selectedMonth = ref(currentMonthKey());

const isAdmin = computed(() => data.value?.role === "admin");
const isTeacher = computed(() => data.value?.role === "teacher");
const attendance = computed(() => data.value?.attendanceToday || {});
const byClass = computed(() => attendance.value.byClass || data.value?.classes || []);
const alerts = computed(() => data.value?.alerts || []);
const unfinishedClasses = computed(() =>
  byClass.value.filter((row) => Number(row.studentCount || 0) > 0 && Number(row.unmarkedCount || 0) > 0)
);
const quietClasses = computed(() =>
  byClass.value.filter((row) => Number(row.studentCount || 0) === 0 || Number(row.unmarkedCount || 0) === 0)
);
const leaveUpcoming = computed(() =>
  isAdmin.value ? data.value?.teacherLeave?.upcoming || [] : data.value?.myLeave?.upcoming || []
);
const monthlyAttendance = computed(() => data.value?.monthlyAttendance || {});
const monthOptions = computed(() => data.value?.monthOptions || []);
const monthlyChartItems = computed(() => monthlyAttendance.value.chart || []);
const monthRangeLabel = computed(() => {
  const from = formatDate(monthlyAttendance.value.from);
  const to = formatDate(monthlyAttendance.value.to);
  return from && to ? `${from} - ${to}` : "";
});

const kpis = computed(() => {
  if (!data.value) return [];
  if (isAdmin.value) {
    const overview = data.value.overview || {};
    return [
      {
        label: "Học sinh đang học",
        value: overview.activeStudentCount || 0,
        meta: `${overview.studentCount || 0} hồ sơ`,
        icon: "ni ni-hat-3",
        tone: "teal",
      },
      {
        label: "Giáo viên hoạt động",
        value: overview.activeTeacherCount || 0,
        meta: `${overview.teacherCount || 0} giáo viên`,
        icon: "ni ni-badge",
        tone: "blue",
      },
      {
        label: "Lớp học",
        value: overview.classCount || 0,
        meta: `${overview.unassignedClassCount || 0} lớp thiếu GV`,
        icon: "ni ni-books",
        tone: "violet",
      },
      {
        label: "Điểm danh hôm nay",
        value: `${attendance.value.progressPercent || 0}%`,
        meta: `${attendance.value.markedCount || 0}/${attendance.value.studentCount || 0} học sinh`,
        icon: "ni ni-check-bold",
        tone: "green",
      },
    ];
  }
  const overview = data.value.overview || {};
  return [
    {
      label: "Lớp phụ trách",
      value: overview.assignedClassCount || 0,
      meta: "Theo phân công hiện tại",
      icon: "ni ni-books",
      tone: "violet",
    },
    {
      label: "Học sinh",
      value: overview.studentCount || 0,
      meta: "Trong các lớp của bạn",
      icon: "ni ni-hat-3",
      tone: "teal",
    },
    {
      label: "Đã điểm danh",
      value: attendance.value.markedCount || 0,
      meta: `${attendance.value.progressPercent || 0}% hoàn tất`,
      icon: "ni ni-check-bold",
      tone: "green",
    },
    {
      label: "Chưa điểm danh",
      value: attendance.value.unmarkedCount || 0,
      meta: "Cần xử lý hôm nay",
      icon: "ni ni-bullet-list-67",
      tone: "orange",
    },
  ];
});

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function loadDashboard() {
  loading.value = true;
  loadErr.value = "";
  try {
    const res = await api.get("/dashboard", {
      params: { month: selectedMonth.value },
    });
    data.value = res.data;
    if (res.data?.selectedMonth && res.data.selectedMonth !== selectedMonth.value) {
      selectedMonth.value = res.data.selectedMonth;
    }
  } catch (e) {
    loadErr.value = e.response?.data?.error || e.message || "Không tải được dashboard";
    data.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(loadDashboard);

watch(selectedMonth, () => {
  loadDashboard();
});
</script>

<template>
  <div class="dashboard-page page-fill">
    <section class="dashboard-hero">
      <div>
        <span class="dashboard-eyebrow">Tổng quan</span>
        <h4 class="dashboard-title">Vận hành hôm nay</h4>
        <p class="dashboard-subtitle">
          Theo dõi nhanh điểm danh, lớp học, giáo viên và các việc cần xử lý trong ngày.
        </p>
      </div>
      <div class="dashboard-hero-actions">
        <div class="dashboard-date">
          <span>Ngày</span>
          <strong>{{ formatDate(data?.today) || "Hôm nay" }}</strong>
        </div>
        <argon-button color="primary" variant="gradient" type="button" :disabled="loading" @click="loadDashboard">
          {{ loading ? "Đang tải..." : "Làm mới" }}
        </argon-button>
      </div>
    </section>

    <argon-alert v-if="loadErr" color="danger" icon="ni ni-fat-remove" class="mb-3">
      {{ loadErr }}
    </argon-alert>

    <div v-if="loading && !data" class="dashboard-placeholder">
      <div class="spinner-border text-primary" role="status"></div>
      <p>Đang tải dashboard...</p>
    </div>

    <template v-else-if="data">
      <section class="dashboard-kpis">
        <article v-for="card in kpis" :key="card.label" class="dashboard-kpi" :class="`dashboard-kpi--${card.tone}`">
          <span class="dashboard-kpi-icon">
            <i :class="card.icon"></i>
          </span>
          <div>
            <span class="dashboard-kpi-label">{{ card.label }}</span>
            <strong>{{ card.value }}</strong>
            <small>{{ card.meta }}</small>
          </div>
        </article>
      </section>

      <section class="dashboard-panel dashboard-monthly-panel">
        <div class="dashboard-panel-header">
          <div>
            <h6>Thống kê điểm danh theo tháng</h6>
            <p>{{ monthRangeLabel || "Chọn tháng để xem dữ liệu" }}</p>
          </div>
          <div class="dashboard-month-select-wrap">
            <select v-model="selectedMonth" class="dashboard-month-select" :disabled="loading">
              <option v-for="option in monthOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
        </div>
        <div class="dashboard-monthly-content">
          <DashboardDonutChart
            :items="monthlyChartItems"
            :center-value="`${monthlyAttendance.progressPercent || 0}%`"
            center-label="Hoàn tất"
          />
          <div class="dashboard-monthly-summary">
            <div>
              <span>Tổng lượt cần điểm danh</span>
              <strong>{{ Number(monthlyAttendance.totalSlots || 0).toLocaleString("vi-VN") }}</strong>
            </div>
            <div>
              <span>Đã ghi nhận</span>
              <strong>{{ Number(monthlyAttendance.markedCount || 0).toLocaleString("vi-VN") }}</strong>
            </div>
            <div>
              <span>Chưa điểm danh</span>
              <strong>{{ Number(monthlyAttendance.unmarkedCount || 0).toLocaleString("vi-VN") }}</strong>
            </div>
            <div>
              <span>Số ngày tính</span>
              <strong>{{ monthlyAttendance.dayCount || 0 }}</strong>
            </div>
          </div>
        </div>
      </section>

      <section class="dashboard-grid">
        <article class="dashboard-panel dashboard-panel--wide">
          <div class="dashboard-panel-header">
            <div>
              <h6>Điểm danh hôm nay</h6>
              <p>{{ attendance.markedCount || 0 }}/{{ attendance.studentCount || 0 }} học sinh đã được ghi nhận.</p>
            </div>
            <RouterLink to="/attendance" class="dashboard-link">Mở điểm danh</RouterLink>
          </div>

          <div class="dashboard-progress-shell">
            <div class="dashboard-progress-top">
              <strong>{{ attendance.progressPercent || 0 }}%</strong>
              <span>Còn {{ attendance.unmarkedCount || 0 }} học sinh</span>
            </div>
            <div class="dashboard-progress-track">
              <div class="dashboard-progress-fill" :style="{ width: `${attendance.progressPercent || 0}%` }"></div>
            </div>
          </div>

          <div class="dashboard-status-row">
            <span><b>{{ attendance.presentCount || 0 }}</b> Có mặt</span>
            <span><b>{{ attendance.absentCount || 0 }}</b> Nghỉ</span>
            <span><b>{{ attendance.lateCount || 0 }}</b> Trễ</span>
            <span><b>{{ attendance.excusedCount || 0 }}</b> Có phép</span>
          </div>

          <div class="dashboard-class-list">
            <div v-for="row in unfinishedClasses.slice(0, 6)" :key="row.id" class="dashboard-class-row">
              <div>
                <strong>{{ row.name }}</strong>
                <small>
                  {{ row.teacherNames?.length ? row.teacherNames.join(", ") : "Chưa có giáo viên" }}
                </small>
              </div>
              <div class="dashboard-class-metric">
                <span>{{ row.progressPercent }}%</span>
                <small>{{ row.unmarkedCount }} chưa điểm danh</small>
              </div>
            </div>
            <div v-if="!unfinishedClasses.length" class="dashboard-empty">
              Tất cả lớp có học sinh đều đã điểm danh xong.
            </div>
          </div>
        </article>

        <article class="dashboard-panel">
          <div class="dashboard-panel-header">
            <div>
              <h6>Cảnh báo</h6>
              <p>Những việc nên xử lý trước.</p>
            </div>
          </div>
          <div class="dashboard-alert-list">
            <RouterLink
              v-for="alert in alerts"
              :key="alert.type + alert.message"
              :to="alert.actionTo || '/dashboard'"
              class="dashboard-alert"
              :class="`dashboard-alert--${alert.level}`"
            >
              <span>{{ alert.message }}</span>
              <i class="ni ni-bold-right"></i>
            </RouterLink>
            <div v-if="!alerts.length" class="dashboard-empty">
              Chưa có cảnh báo cần xử lý.
            </div>
          </div>
        </article>
      </section>

      <section class="dashboard-grid">
        <article class="dashboard-panel">
          <div class="dashboard-panel-header">
            <div>
              <h6>{{ isAdmin ? "Lịch nghỉ giáo viên" : "Lịch nghỉ của tôi" }}</h6>
              <p>{{ isAdmin ? "Các ngày nghỉ trong 7 ngày tới." : "Các bản ghi sắp tới của bạn." }}</p>
            </div>
            <RouterLink :to="isAdmin ? '/leave-calendar' : '/teacher-leave'" class="dashboard-link">
              Xem lịch
            </RouterLink>
          </div>
          <div class="dashboard-leave-list">
            <div v-for="row in leaveUpcoming.slice(0, 6)" :key="row.id" class="dashboard-leave-row">
              <div>
                <strong>{{ isAdmin ? row.teacherName : formatDate(row.attendanceDate) }}</strong>
                <small>{{ isAdmin ? formatDate(row.attendanceDate) : row.note || "Không có ghi chú" }}</small>
              </div>
              <span>{{ row.status === "leave" ? "Nghỉ phép" : row.status }}</span>
            </div>
            <div v-if="!leaveUpcoming.length" class="dashboard-empty">
              Không có lịch nghỉ sắp tới.
            </div>
          </div>
        </article>

        <article class="dashboard-panel dashboard-panel--wide">
          <div class="dashboard-panel-header">
            <div>
              <h6>{{ isTeacher ? "Lớp của tôi" : "Tình trạng lớp" }}</h6>
              <p>
                {{ isTeacher ? "Chỉ hiển thị lớp bạn được phân công." : "Theo dõi nhanh các lớp đã hoàn tất điểm danh." }}
              </p>
            </div>
            <RouterLink to="/school" class="dashboard-link">Quản lý lớp</RouterLink>
          </div>
          <div class="dashboard-class-grid">
            <div v-for="row in byClass.slice(0, 8)" :key="row.id" class="dashboard-mini-class">
              <div>
                <strong>{{ row.name }}</strong>
                <small>{{ row.studentCount }} học sinh</small>
              </div>
              <span :class="{ done: row.studentCount === 0 || row.unmarkedCount === 0 }">
                {{ row.studentCount === 0 ? "Chưa có HS" : row.unmarkedCount === 0 ? "Xong" : `${row.unmarkedCount} còn lại` }}
              </span>
            </div>
            <div v-if="!byClass.length" class="dashboard-empty">
              {{ isTeacher ? "Bạn chưa được phân công lớp nào." : "Chưa có lớp học nào." }}
            </div>
          </div>
          <div v-if="quietClasses.length && unfinishedClasses.length" class="dashboard-note">
            {{ quietClasses.length }} lớp còn lại đã ổn trong hôm nay.
          </div>
        </article>
      </section>
    </template>
  </div>
</template>

<style scoped>
.dashboard-page {
  gap: 1rem;
  padding: 1rem 1.5rem 1.5rem;
}

.dashboard-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.2rem 1.25rem;
  border: 1px solid #e5edf7;
  border-radius: 1rem;
  background: linear-gradient(135deg, #ffffff 0%, #f7fbff 52%, #eef8f6 100%);
  box-shadow: 0 1rem 2.2rem -1.8rem rgba(15, 23, 42, 0.32);
}

.dashboard-eyebrow {
  display: inline-block;
  margin-bottom: 0.35rem;
  color: #0f766e;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.dashboard-title {
  margin: 0;
  color: #1f2a44;
  font-size: 1.45rem;
  font-weight: 800;
}

.dashboard-subtitle {
  max-width: 48rem;
  margin: 0.35rem 0 0;
  color: #67748e;
  font-size: 0.9rem;
  line-height: 1.55;
}

.dashboard-hero-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.dashboard-date {
  display: flex;
  flex-direction: column;
  min-width: 130px;
  padding: 0.65rem 0.8rem;
  border: 1px solid #dce8f6;
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.82);
}

.dashboard-date span {
  color: #8392ab;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
}

.dashboard-date strong {
  color: #344767;
  font-size: 0.95rem;
}

.dashboard-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.85rem;
}

.dashboard-kpi {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 1rem;
  border: 1px solid #edf2f7;
  border-radius: 1rem;
  background: #fff;
  box-shadow: 0 0.7rem 1.6rem -1.45rem rgba(15, 23, 42, 0.3);
}

.dashboard-kpi-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 0.8rem;
  flex-shrink: 0;
  color: #fff;
}

.dashboard-kpi--teal .dashboard-kpi-icon { background: #0f766e; }
.dashboard-kpi--blue .dashboard-kpi-icon { background: #2563eb; }
.dashboard-kpi--violet .dashboard-kpi-icon { background: #7c3aed; }
.dashboard-kpi--green .dashboard-kpi-icon { background: #16a34a; }
.dashboard-kpi--orange .dashboard-kpi-icon { background: #ea580c; }

.dashboard-kpi-label {
  display: block;
  color: #8392ab;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
}

.dashboard-kpi strong {
  display: block;
  color: #1f2a44;
  font-size: 1.45rem;
  font-weight: 800;
  line-height: 1.2;
}

.dashboard-kpi small {
  color: #67748e;
  font-size: 0.78rem;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.65fr);
  gap: 1rem;
}

.dashboard-panel {
  min-width: 0;
  padding: 1rem;
  border: 1px solid #edf2f7;
  border-radius: 1rem;
  background: #fff;
  box-shadow: 0 0.7rem 1.6rem -1.45rem rgba(15, 23, 42, 0.28);
}

.dashboard-panel--wide {
  min-height: 280px;
}

.dashboard-panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.8rem;
  margin-bottom: 0.9rem;
}

.dashboard-panel-header h6 {
  margin: 0;
  color: #1f2a44;
  font-size: 0.98rem;
  font-weight: 800;
}

.dashboard-panel-header p {
  margin: 0.2rem 0 0;
  color: #8392ab;
  font-size: 0.78rem;
}

.dashboard-link {
  color: #0f766e;
  font-size: 0.78rem;
  font-weight: 800;
  white-space: nowrap;
}

.dashboard-monthly-panel {
  min-height: 320px;
}

.dashboard-month-select-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.dashboard-month-select {
  min-width: 160px;
  min-height: 38px;
  padding: 0.45rem 0.75rem;
  border: 1px solid #dce4ef;
  border-radius: 0.65rem;
  background: #fff;
  color: #344767;
  font-size: 0.82rem;
  font-weight: 700;
  outline: none;
}

.dashboard-month-select:focus {
  border-color: #0f766e;
  box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.12);
}

.dashboard-monthly-content {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(240px, 0.65fr);
  gap: 1rem;
  align-items: center;
}

.dashboard-monthly-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
}

.dashboard-monthly-summary div {
  padding: 0.8rem;
  border: 1px solid #edf2f7;
  border-radius: 0.8rem;
  background: #f8fafc;
}

.dashboard-monthly-summary span {
  display: block;
  color: #8392ab;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
}

.dashboard-monthly-summary strong {
  display: block;
  margin-top: 0.2rem;
  color: #1f2a44;
  font-size: 1.2rem;
  font-weight: 800;
}

.dashboard-progress-shell {
  padding: 0.85rem;
  border: 1px solid #e8f2ef;
  border-radius: 0.8rem;
  background: #f8fffd;
}

.dashboard-progress-top {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.55rem;
}

.dashboard-progress-top strong {
  color: #0f766e;
  font-size: 1.2rem;
}

.dashboard-progress-top span {
  color: #67748e;
  font-size: 0.8rem;
  font-weight: 700;
}

.dashboard-progress-track {
  height: 0.55rem;
  overflow: hidden;
  border-radius: 999px;
  background: #dcefeb;
}

.dashboard-progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #0f766e, #14b8a6);
  transition: width 0.2s ease;
}

.dashboard-status-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
  margin: 0.85rem 0;
}

.dashboard-status-row span {
  padding: 0.6rem;
  border-radius: 0.65rem;
  background: #f8fafc;
  color: #67748e;
  font-size: 0.78rem;
}

.dashboard-status-row b {
  color: #1f2a44;
  font-size: 1rem;
}

.dashboard-class-list,
.dashboard-alert-list,
.dashboard-leave-list,
.dashboard-class-grid {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.dashboard-class-row,
.dashboard-leave-row,
.dashboard-mini-class {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid #edf2f7;
  border-radius: 0.75rem;
  background: #fff;
}

.dashboard-class-row strong,
.dashboard-leave-row strong,
.dashboard-mini-class strong {
  display: block;
  color: #344767;
  font-size: 0.86rem;
}

.dashboard-class-row small,
.dashboard-leave-row small,
.dashboard-mini-class small {
  color: #8392ab;
  font-size: 0.76rem;
}

.dashboard-class-metric {
  text-align: right;
}

.dashboard-class-metric span {
  display: block;
  color: #ea580c;
  font-weight: 800;
}

.dashboard-alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 0.75rem;
  font-size: 0.82rem;
  font-weight: 700;
}

.dashboard-alert--warning {
  background: #fff7ed;
  color: #c2410c;
}

.dashboard-alert--danger {
  background: #fef2f2;
  color: #dc2626;
}

.dashboard-alert--info {
  background: #eff6ff;
  color: #2563eb;
}

.dashboard-leave-row span,
.dashboard-mini-class span {
  padding: 0.3rem 0.55rem;
  border-radius: 999px;
  background: #fff7ed;
  color: #c2410c;
  font-size: 0.72rem;
  font-weight: 800;
  white-space: nowrap;
}

.dashboard-mini-class span.done {
  background: #ecfdf5;
  color: #0f766e;
}

.dashboard-empty,
.dashboard-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  min-height: 96px;
  padding: 1rem;
  border: 1px dashed #dce4ef;
  border-radius: 0.8rem;
  color: #8392ab;
  font-size: 0.86rem;
  text-align: center;
}

.dashboard-note {
  margin-top: 0.75rem;
  color: #8392ab;
  font-size: 0.78rem;
}

@media (max-width: 1199.98px) {
  .dashboard-kpis,
  .dashboard-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 767.98px) {
  .dashboard-page {
    padding: 0.9rem;
  }

  .dashboard-hero,
  .dashboard-hero-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .dashboard-kpis,
  .dashboard-grid,
  .dashboard-monthly-content,
  .dashboard-status-row {
    grid-template-columns: 1fr;
  }

  .dashboard-panel-header {
    flex-direction: column;
  }

  .dashboard-month-select,
  .dashboard-month-select-wrap {
    width: 100%;
  }

  .dashboard-monthly-summary {
    grid-template-columns: 1fr;
  }
}
</style>
