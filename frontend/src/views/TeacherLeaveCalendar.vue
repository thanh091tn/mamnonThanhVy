<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useStore } from 'vuex'
import { api } from '../api/client.js'
import ArgonAlert from '@/components/ArgonAlert.vue'
import ArgonButton from '@/components/ArgonButton.vue'

const store = useStore()
const isManager = computed(() => store.state.authUser?.role === 'manager')

const now = new Date()
const viewYear = ref(now.getFullYear())
const viewMonth = ref(now.getMonth() + 1)

const loading = ref(false)
const err = ref('')
const leaves = ref([])
const selectedDateStr = ref('')

const monthTitle = computed(() => {
  const d = new Date(viewYear.value, viewMonth.value - 1, 1)
  return d.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })
})

const weekdayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

const leavesByDate = computed(() => {
  const map = {}
  for (const row of leaves.value) {
    const key = row.attendanceDate
    if (!key) continue
    if (!map[key]) map[key] = []
    map[key].push(row)
  }
  return map
})

const calendarCells = computed(() => {
  const y = viewYear.value
  const m = viewMonth.value
  const first = new Date(y, m - 1, 1)
  const dow = first.getDay()
  const mondayPad = (dow + 6) % 7
  const dim = new Date(y, m, 0).getDate()
  const pad = (n) => String(n).padStart(2, '0')
  const cells = []

  for (let i = 0; i < mondayPad; i++) cells.push({ type: 'pad' })
  for (let d = 1; d <= dim; d++) {
    const dateStr = `${y}-${pad(m)}-${pad(d)}`
    cells.push({ type: 'day', day: d, dateStr })
  }
  while (cells.length % 7 !== 0) cells.push({ type: 'pad' })

  return cells
})

function localTodayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const todayStr = localTodayStr()

function isToday(dateStr) {
  return dateStr === todayStr
}

function leaveTypeLabel(type, session = '') {
  if (type === 'half_day') {
    return session === 'afternoon' ? 'Nửa ngày - chiều' : 'Nửa ngày - sáng'
  }
  if (type === 'date_range') return 'Khoảng ngày'
  return 'Nghỉ 1 ngày'
}

const selectedLeaves = computed(() => {
  if (!selectedDateStr.value) return []
  return leavesByDate.value[selectedDateStr.value] || []
})

async function loadMonth() {
  if (!isManager.value) return

  err.value = ''
  loading.value = true

  try {
    const { data } = await api.get('/attendance/teachers/leave-calendar', {
      params: { year: viewYear.value, month: viewMonth.value },
    })

    leaves.value = data.leaves || []

    if (
      selectedDateStr.value &&
      !selectedDateStr.value.startsWith(
        `${viewYear.value}-${String(viewMonth.value).padStart(2, '0')}-`
      )
    ) {
      selectedDateStr.value = ''
    }
  } catch (e) {
    err.value = e.response?.data?.error || e.message || 'Không tải được dữ liệu'
    leaves.value = []
  } finally {
    loading.value = false
  }
}

function prevMonth() {
  let m = viewMonth.value - 1
  let y = viewYear.value

  if (m < 1) {
    m = 12
    y -= 1
  }

  viewMonth.value = m
  viewYear.value = y
}

function nextMonth() {
  let m = viewMonth.value + 1
  let y = viewYear.value

  if (m > 12) {
    m = 1
    y += 1
  }

  viewMonth.value = m
  viewYear.value = y
}

function goThisMonth() {
  const d = new Date()
  viewYear.value = d.getFullYear()
  viewMonth.value = d.getMonth() + 1
}

function selectDay(dateStr) {
  selectedDateStr.value = selectedDateStr.value === dateStr ? '' : dateStr
}

watch([viewYear, viewMonth], () => {
  loadMonth()
})

onMounted(() => {
  if (isManager.value) loadMonth()
})
</script>

<template>
  <div class="page-fill py-4 container-fluid">
    <div class="row mb-3">
      <div class="col-12">
        <div class="card">
          <div class="card-header pb-0 d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div>
              <h5 class="mb-0">Lịch nghỉ giáo viên</h5>
              <p class="text-sm text-secondary mb-0">
                Xem theo tháng để biết giáo viên nào đã xin nghỉ trong từng ngày.
              </p>
            </div>
          </div>

          <div class="card-body">
            <argon-alert v-if="!isManager" color="warning">
              Chỉ tài khoản quản lý mới xem được trang này.
            </argon-alert>

            <template v-else>
              <argon-alert v-if="err" color="danger">{{ err }}</argon-alert>

              <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                <div class="d-flex align-items-center gap-2">
                  <argon-button color="secondary" size="sm" @click="prevMonth" :disabled="loading">
                    Tháng trước
                  </argon-button>
                  <h6 class="mb-0 px-2 text-capitalize">{{ monthTitle }}</h6>
                  <argon-button color="secondary" size="sm" @click="nextMonth" :disabled="loading">
                    Tháng sau
                  </argon-button>
                </div>

                <argon-button color="info" variant="outline" size="sm" @click="goThisMonth" :disabled="loading">
                  Tháng này
                </argon-button>
              </div>

              <div v-if="loading" class="text-center py-5 text-secondary">Đang tải...</div>

              <div v-else class="leave-cal-wrap">
                <div class="leave-cal-grid">
                  <div v-for="(w, i) in weekdayLabels" :key="'w' + i" class="leave-cal-head">
                    {{ w }}
                  </div>

                  <template v-for="(cell, idx) in calendarCells" :key="idx">
                    <div v-if="cell.type === 'pad'" class="leave-cal-cell leave-cal-pad" />

                    <button
                      v-else
                      type="button"
                      class="leave-cal-cell leave-cal-day"
                      :class="{
                        'leave-cal-today': isToday(cell.dateStr),
                        'leave-cal-selected': selectedDateStr === cell.dateStr,
                        'leave-cal-has-leave': (leavesByDate[cell.dateStr] || []).length > 0,
                      }"
                      @click="selectDay(cell.dateStr)"
                    >
                      <span class="leave-cal-daynum">{{ cell.day }}</span>

                      <div v-if="(leavesByDate[cell.dateStr] || []).length" class="leave-cal-chips">
                        <span
                          v-for="(lv, j) in (leavesByDate[cell.dateStr] || []).slice(0, 2)"
                          :key="lv.id + '-' + j"
                          class="leave-cal-chip"
                          :title="`${lv.teacherName} - ${leaveTypeLabel(lv.leaveType, lv.leaveSession)}`"
                        >
                          {{ lv.teacherName }}
                        </span>

                        <span
                          v-if="(leavesByDate[cell.dateStr] || []).length > 2"
                          class="leave-cal-more"
                        >
                          +{{ (leavesByDate[cell.dateStr] || []).length - 2 }}
                        </span>
                      </div>
                    </button>
                  </template>
                </div>

                <div v-if="selectedDateStr" class="leave-cal-detail card bg-gray-100 mt-3">
                  <div class="card-body py-3">
                    <h6 class="text-sm font-weight-bold mb-2">Chi tiết {{ selectedDateStr }}</h6>

                    <div v-if="selectedLeaves.length" class="leave-detail-table-wrap">
                      <div class="table-responsive">
                        <table class="table align-items-center mb-0 leave-detail-table">
                          <thead>
                            <tr>
                              <th>Tên giáo viên</th>
                              <th>Loại nghỉ</th>
                              <th>Ghi chú</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr v-for="lv in selectedLeaves" :key="lv.id">
                              <td>
                                <span class="leave-detail-name">{{ lv.teacherName }}</span>
                              </td>
                              <td>
                                <span class="leave-detail-type">{{ leaveTypeLabel(lv.leaveType, lv.leaveSession) }}</span>
                              </td>
                              <td>
                                <span v-if="lv.note" class="leave-detail-note">{{ lv.note }}</span>
                                <span v-else class="leave-detail-empty">Không ghi chú</span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <p v-else class="text-secondary mb-0 small">
                      Không có giáo viên nghỉ trong ngày này.
                    </p>
                  </div>
                </div>

                <p v-else class="text-muted text-sm mt-3 mb-0">
                  Chọn một ngày trên lịch để xem chi tiết danh sách nghỉ.
                </p>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.leave-cal-wrap {
  width: 100%;
  max-width: 100%;
}

.leave-cal-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
}

.leave-cal-head {
  padding: 0.35rem 0;
  color: #8392ab;
  font-size: 0.7rem;
  font-weight: 700;
  text-align: center;
  text-transform: uppercase;
}

.leave-cal-cell {
  min-height: 6rem;
  border: 1px solid #e9ecef;
  border-radius: 0.5rem;
  background: #fff;
}

.leave-cal-pad {
  min-height: 0.5rem;
  border: none;
  background: transparent;
}

.leave-cal-day {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 0.5rem;
  text-align: left;
  vertical-align: top;
  cursor: pointer;
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
}

.leave-cal-day:hover {
  border-color: #5e72e4;
  box-shadow: 0 0 0 1px rgba(94, 114, 228, 0.2);
}

.leave-cal-today {
  border-color: #5e72e4;
  box-shadow: inset 0 0 0 1px rgba(94, 114, 228, 0.35);
}

.leave-cal-selected {
  border-color: #5e72e4;
  background: #f8f9fe;
}

.leave-cal-has-leave:not(.leave-cal-selected) {
  background: #fffbf0;
}

.leave-cal-daynum {
  color: #344767;
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.2;
}

.leave-cal-chips {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.3rem;
  min-height: 0;
  margin-top: 0.4rem;
  overflow: hidden;
}

.leave-cal-chip {
  max-width: 100%;
  overflow: hidden;
  padding: 2px 4px;
  border-radius: 4px;
  background: linear-gradient(310deg, #fb6340, #fbb140);
  color: #fff;
  font-size: 0.62rem;
  font-weight: 600;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.leave-cal-more {
  color: #f5365c;
  font-size: 0.62rem;
  font-weight: 700;
}

.leave-cal-detail {
  overflow: hidden;
}

.leave-detail-table-wrap {
  overflow: hidden;
  border: 1px solid #e9ecef;
  border-radius: 0.75rem;
  background: #fff;
}

.leave-detail-table {
  margin-bottom: 0;
}

.leave-detail-table thead th {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
  color: #8392ab;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}

.leave-detail-table tbody td {
  padding: 0.9rem 1rem;
  border-bottom: 1px solid #f1f3f5;
  vertical-align: top;
}

.leave-detail-table tbody tr:last-child td {
  border-bottom: none;
}

.leave-detail-name {
  display: inline-block;
  min-width: 12rem;
  color: #344767;
  font-weight: 600;
}

.leave-detail-type {
  display: inline-flex;
  align-items: center;
  min-height: 1.65rem;
  padding: 0.25rem 0.55rem;
  border-radius: 999px;
  background: #ecfeff;
  color: #0e7490;
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
}

.leave-detail-note {
  color: #67748e;
  line-height: 1.5;
}

.leave-detail-empty {
  color: #adb5bd;
  font-style: italic;
}

@media (max-width: 576px) {
  .leave-cal-cell {
    min-height: 4.25rem;
    padding: 0.25rem !important;
  }

  .leave-cal-chip {
    font-size: 0.55rem;
  }

  .leave-detail-table thead th,
  .leave-detail-table tbody td {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }

  .leave-detail-name {
    min-width: 8.5rem;
  }
}
</style>
