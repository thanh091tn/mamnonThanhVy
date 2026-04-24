<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { api } from '../api/client.js'
import ArgonAlert from '@/components/ArgonAlert.vue'
import AppDateField from '@/components/AppDateField.vue'
import defaultAvatarMale from '@/assets/img/logos/betrai.png'
import defaultAvatarFemale from '@/assets/img/logos/begai.png'

const classes = ref([])
const selectedClassId = ref('')
const attendanceView = ref('day')
const selectedDate = ref(new Date().toISOString().slice(0, 10))
const selectedMonth = ref(new Date().toISOString().slice(0, 7))
const summary = ref(null)
const rows = ref([])
const dailyRows = ref([])
const loadingClasses = ref(false)
const loadingAttendance = ref(false)
const loadErr = ref('')

const selectedClass = computed(() =>
  classes.value.find((item) => String(item.id) === String(selectedClassId.value))
)

const monthOptions = Array.from({ length: 12 }, (_, index) => {
  const value = String(index + 1).padStart(2, '0')
  return { value, label: `Tháng ${index + 1}` }
})

const yearOptions = computed(() => {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: 11 }, (_, index) => String(currentYear - 5 + index))
})

const selectedMonthYear = computed({
  get: () => String(selectedMonth.value || '').split('-')[0] || String(new Date().getFullYear()),
  set: (year) => {
    const month = selectedMonthNumber.value
    selectedMonth.value = `${year}-${month}`
  },
})

const selectedMonthNumber = computed({
  get: () => String(selectedMonth.value || '').split('-')[1] || String(new Date().getMonth() + 1).padStart(2, '0'),
  set: (month) => {
    const year = selectedMonthYear.value
    selectedMonth.value = `${year}-${month}`
  },
})

function formatDateDisplay(value) {
  const [year, month, day] = String(value || '').split('-')
  if (!year || !month || !day) return '—'
  return `${day}-${month}-${year}`
}

function formatMonthDisplay(value) {
  const [year, month] = String(value || '').split('-')
  if (!year || !month) return '—'
  return `${month}-${year}`
}

function avatarSrc(row) {
  const custom = String(row.studentAvatar || '').trim()
  if (custom) return custom
  return row.studentGender === 'female' ? defaultAvatarFemale : defaultAvatarMale
}

function onAvatarError(ev, row) {
  const el = ev?.target
  if (!el || el.dataset.fallbackApplied) return
  el.dataset.fallbackApplied = '1'
  el.src = row.studentGender === 'female' ? defaultAvatarFemale : defaultAvatarMale
}

async function loadClasses() {
  loadingClasses.value = true
  loadErr.value = ''
  try {
    const { data } = await api.get('/classes')
    classes.value = Array.isArray(data) ? data : []
    if (!selectedClassId.value && classes.value.length) {
      selectedClassId.value = String(classes.value[0].id)
    }
  } catch (e) {
    classes.value = []
    loadErr.value = e.response?.data?.error || e.message || 'Không tải được danh sách lớp'
  } finally {
    loadingClasses.value = false
  }
}

async function loadAttendance() {
  if (!selectedClassId.value) {
    summary.value = null
    rows.value = []
    dailyRows.value = []
    return
  }
  const [year, month] = String(selectedMonth.value || '').split('-')
  if (!year || !month) return
  loadingAttendance.value = true
  loadErr.value = ''
  try {
    const [summaryRes, studentRes, dailyRes] = await Promise.all([
      api.get(`/attendance/students/classes/${selectedClassId.value}/month-summary`, {
        params: { year: Number(year), month: Number(month) },
      }),
      api.get(`/attendance/students/classes/${selectedClassId.value}/student-month-summary`, {
        params: { year: Number(year), month: Number(month) },
      }),
      api.get('/attendance/students', {
        params: { classId: selectedClassId.value, date: selectedDate.value, session: 'full' },
      }),
    ])
    summary.value = summaryRes.data
    rows.value = Array.isArray(studentRes.data?.students) ? studentRes.data.students : []
    dailyRows.value = Array.isArray(dailyRes.data) ? dailyRes.data : []
  } catch (e) {
    summary.value = null
    rows.value = []
    dailyRows.value = []
    loadErr.value = e.response?.data?.error || e.message || 'Không tải được dữ liệu điểm danh'
  } finally {
    loadingAttendance.value = false
  }
}

function statusLabel(status) {
  if (status === 'present') return 'Đi học'
  if (status === 'absent') return 'Nghỉ'
  if (status === 'late') return 'Trễ'
  if (status === 'excused') return 'Có phép'
  return 'Chưa ghi nhận'
}

function statusClass(status) {
  if (status === 'present') return 'badge bg-gradient-success'
  if (status === 'absent') return 'badge bg-gradient-danger'
  if (status === 'late') return 'badge bg-gradient-warning'
  if (status === 'excused') return 'badge bg-gradient-info'
  return 'badge bg-gradient-secondary'
}

watch([selectedClassId, selectedDate], () => {
  loadAttendance()
})

watch(selectedMonth, () => {
  loadAttendance()
})

onMounted(async () => {
  await loadClasses()
  await loadAttendance()
})

defineExpose({ loadClasses, loadAttendance })
</script>

<template>
  <div class="py-4 container-fluid page-fill">
    <div class="row">
      <div class="col-12">
        <div class="card attendance-page-card">
          <div class="card-header d-flex flex-wrap align-items-center gap-3 pb-0">
            <div class="flex-grow-1">
              <h6>Điểm danh theo lớp</h6>
              <p class="mb-2 text-sm text-secondary">Xem điểm danh theo ngày hoặc tổng hợp theo tháng cho từng lớp.</p>
            </div>
            <div class="attendance-filters">
              <select v-model="selectedClassId" class="form-control form-control-sm attendance-class-select" :disabled="loadingClasses">
                <option value="">Chọn lớp</option>
                <option v-for="item in classes" :key="item.id" :value="String(item.id)">
                  {{ item.name }}
                </option>
              </select>
              <app-date-field
                v-if="attendanceView === 'day'"
                v-model="selectedDate"
                format="dd-MM-yyyy"
                input-class="attendance-date-picker-input"
                class="attendance-date-input"
              />
              <div v-else class="attendance-month-picker">
                <select v-model="selectedMonthNumber" class="form-control form-control-sm attendance-month-select">
                  <option v-for="month in monthOptions" :key="month.value" :value="month.value">
                    {{ month.label }}
                  </option>
                </select>
                <select v-model="selectedMonthYear" class="form-control form-control-sm attendance-year-select">
                  <option v-for="year in yearOptions" :key="year" :value="year">
                    {{ year }}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <div class="card-body">
            <argon-alert v-if="loadErr" color="danger" icon="ni ni-fat-remove">
              {{ loadErr }}
            </argon-alert>

            <div v-if="loadingClasses || loadingAttendance" class="py-5 text-center text-sm text-secondary">
              Đang tải điểm danh...
            </div>

            <div v-else-if="!classes.length" class="attendance-empty">
              Chưa có lớp nào để xem điểm danh.
            </div>

            <template v-else>
              <div class="attendance-view-tabs" role="tablist">
                <button
                  type="button"
                  :class="{ active: attendanceView === 'day' }"
                  @click="attendanceView = 'day'"
                >
                  Theo ngày
                </button>
                <button
                  type="button"
                  :class="{ active: attendanceView === 'month' }"
                  @click="attendanceView = 'month'"
                >
                  Theo tháng
                </button>
              </div>

              <div class="attendance-context">
                <div>
                  <span class="attendance-context-label">Lớp đang xem</span>
                  <strong>{{ selectedClass?.name || '—' }}</strong>
                </div>
                <span class="attendance-date-display">
                  {{ attendanceView === 'day' ? formatDateDisplay(selectedDate) : formatMonthDisplay(selectedMonth) }}
                </span>
              </div>

              <div v-if="attendanceView === 'month' && summary" class="attendance-summary-grid">
                <article class="attendance-stat">
                  <span>Sĩ số</span>
                  <strong>{{ summary.studentCount }}</strong>
                </article>
                <article class="attendance-stat stat-present">
                  <span>Đi học</span>
                  <strong>{{ summary.present }}</strong>
                </article>
                <article class="attendance-stat stat-absent">
                  <span>Nghỉ</span>
                  <strong>{{ summary.absent }}</strong>
                </article>
                <article class="attendance-stat stat-late">
                  <span>Trễ</span>
                  <strong>{{ summary.late }}</strong>
                </article>
                <article class="attendance-stat stat-excused">
                  <span>Có phép</span>
                  <strong>{{ summary.excused }}</strong>
                </article>
                <article class="attendance-stat">
                  <span>Chưa ghi nhận</span>
                  <strong>{{ summary.noRecord }}</strong>
                </article>
              </div>

              <div v-if="attendanceView === 'day'" class="student-month-card mt-4">
                <div class="student-month-header">
                  <div>
                    <h6 class="mb-1">Điểm danh ngày {{ formatDateDisplay(selectedDate) }}</h6>
                    <p class="mb-0 text-xs text-secondary">Trạng thái điểm danh của từng học sinh trong ngày được chọn.</p>
                  </div>
                </div>
                <div class="table-responsive student-month-table-wrap">
                  <table class="table align-items-center mb-0 student-month-table">
                    <thead>
                      <tr>
                        <th>Avatar</th>
                        <th>Tên học sinh</th>
                        <th>Trạng thái</th>
                        <th>Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in dailyRows" :key="row.studentId">
                        <td>
                          <img
                            :src="avatarSrc(row)"
                            class="avatar rounded-circle object-fit-cover bg-light"
                            width="44"
                            height="44"
                            alt=""
                            referrerpolicy="no-referrer"
                            @error="onAvatarError($event, row)"
                          />
                        </td>
                        <td class="student-name-cell">{{ row.studentName }}</td>
                        <td><span :class="statusClass(row.status)">{{ statusLabel(row.status) }}</span></td>
                        <td class="text-secondary">{{ row.note || '—' }}</td>
                      </tr>
                      <tr v-if="!dailyRows.length">
                        <td colspan="4" class="py-4 text-center text-sm text-secondary">
                          Lớp này chưa có học sinh.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div v-if="attendanceView === 'month'" class="student-month-card mt-4">
                <div class="student-month-header">
                  <div>
                    <h6 class="mb-1">Tổng hợp từng học sinh trong tháng {{ formatMonthDisplay(selectedMonth) }}</h6>
                    <p class="mb-0 text-xs text-secondary">Tổng hợp theo tháng đang chọn.</p>
                  </div>
                </div>
                <div class="table-responsive student-month-table-wrap">
                  <table class="table align-items-center mb-0 student-month-table">
                    <thead>
                      <tr>
                        <th>Avatar</th>
                        <th>Tên học sinh</th>
                        <th>Tổng ghi nhận</th>
                        <th>Đi học</th>
                        <th>Nghỉ</th>
                        <th>Trễ</th>
                        <th>Có phép</th>
                        <th>Chưa ghi nhận</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in rows" :key="row.studentId">
                        <td>
                          <img
                            :src="avatarSrc(row)"
                            class="avatar rounded-circle object-fit-cover bg-light"
                            width="44"
                            height="44"
                            alt=""
                            referrerpolicy="no-referrer"
                            @error="onAvatarError($event, row)"
                          />
                        </td>
                        <td class="student-name-cell">{{ row.studentName }}</td>
                        <td>{{ row.totalRecords }}</td>
                        <td class="stat-present-text">{{ row.present }}</td>
                        <td class="stat-absent-text">{{ row.absent }}</td>
                        <td class="stat-late-text">{{ row.late }}</td>
                        <td class="stat-excused-text">{{ row.excused }}</td>
                        <td>{{ row.noRecord }}</td>
                      </tr>
                      <tr v-if="!rows.length">
                        <td colspan="8" class="py-4 text-center text-sm text-secondary">
                          Lớp này chưa có học sinh.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.object-fit-cover {
  object-fit: cover;
}

.attendance-page-card {
  min-height: 0;
}

.attendance-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem;
}

.attendance-class-select {
  width: 16.75rem;
  height: 2.9rem;
  border-radius: 0.65rem;
  font-size: 0.9rem;
  font-weight: 700;
  text-align: center;
  text-align-last: center;
}

.attendance-date-input {
  width: 13.25rem;
}

.attendance-date-input :deep(.attendance-date-picker-input) {
  height: 2.9rem;
  min-height: 2.9rem;
  border-radius: 0.65rem;
  font-size: 0.95rem;
  font-weight: 700;
  text-align: center;
  padding-left: 2.65rem;
  padding-right: 2.25rem;
  line-height: 2.9rem;
}

.attendance-date-input :deep(.dp__input_icon) {
  left: 0.95rem;
}

.attendance-date-input :deep(.dp__clear_icon) {
  right: 0.75rem;
}

.attendance-date-input :deep(.dp__input_wrap) {
  height: 2.9rem;
}

.attendance-month-picker {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.attendance-month-select,
.attendance-year-select {
  height: 2.9rem;
  border-radius: 0.65rem;
  font-size: 0.9rem;
  font-weight: 800;
  text-align: center;
  text-align-last: center;
}

.attendance-month-select {
  width: 8.25rem;
}

.attendance-year-select {
  width: 6rem;
}

.attendance-view-tabs {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: 1rem;
  padding: 0.35rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  background: #f8fafc;
}

.attendance-view-tabs button {
  min-width: 7.25rem;
  min-height: 2.25rem;
  border: 0;
  border-radius: 0.55rem;
  background: transparent;
  color: #67748e;
  font-size: 0.84rem;
  font-weight: 800;
  cursor: pointer;
}

.attendance-view-tabs button.active {
  background: #ffffff;
  color: #0f766e;
  box-shadow: 0 0.7rem 1.4rem -1rem rgba(15, 23, 42, 0.35);
}

.attendance-context {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding: 0.9rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  background: #f8fafc;
  color: #344767;
}

.attendance-context-label {
  display: block;
  color: #67748e;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
}

.attendance-context strong {
  color: #1f2a44;
  font-size: 1rem;
}

.attendance-date-display {
  min-width: 7rem;
  color: #1f2a44;
  font-weight: 850;
  text-align: center;
}

.attendance-summary-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.75rem;
}

.attendance-stat {
  text-align: center;
  min-height: 5rem;
  padding: 0.8rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  background: #ffffff;
  box-shadow: 0 0.75rem 1.25rem -1.2rem rgba(15, 23, 42, 0.28);
}

.attendance-stat span {
  display: block;
  color: #67748e;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
}

.attendance-stat strong {
  display: block;
  margin-top: 0.35rem;
  color: #1f2a44;
  font-size: 1.35rem;
}

.stat-present strong,
.stat-present-text { color: #2dce89 !important; }
.stat-absent strong,
.stat-absent-text { color: #f5365c !important; }
.stat-late strong,
.stat-late-text { color: #fb6340 !important; }
.stat-excused strong,
.stat-excused-text { color: #11cdef !important; }

.student-month-card {
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 0.85rem;
  background: #ffffff;
}

.student-month-header {
  padding: 1rem;
  border-bottom: 1px solid #e2e8f0;
  background: #ffffff;
}

.student-month-header h6 {
  color: #1f2a44;
  font-weight: 850;
}

.student-month-table-wrap {
  max-height: 56vh;
  overflow: auto;
}

.student-month-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 0.65rem 0.75rem;
  color: #67748e;
  font-size: 0.68rem;
  font-weight: 800;
  white-space: nowrap;
  background: #f8fafc;
  text-align: center;
}

.student-month-table tbody td {
  padding: 0.65rem 0.75rem;
  color: #344767;
  font-size: 0.84rem;
  font-weight: 700;
  vertical-align: middle;
  border-bottom: 1px solid #f1f3f5;
  text-align: center;
}

.student-name-cell {
  min-width: 12rem;
  color: #1f2a44 !important;
  font-weight: 850 !important;
  text-align: left !important;
}

.attendance-empty {
  padding: 3rem 1rem;
  border: 1px dashed #d9e2ee;
  border-radius: 0.85rem;
  color: #67748e;
  font-size: 0.9rem;
  text-align: center;
  background: #f8fafc;
}

@media (max-width: 991.98px) {
  .attendance-summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 575.98px) {
  .attendance-filters,
  .attendance-class-select,
  .attendance-date-input,
  .attendance-month-picker,
  .attendance-month-select,
  .attendance-year-select {
    width: 100%;
  }

  .attendance-view-tabs {
    display: flex;
    width: 100%;
  }

  .attendance-view-tabs button {
    flex: 1 1 0;
  }

  .attendance-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
