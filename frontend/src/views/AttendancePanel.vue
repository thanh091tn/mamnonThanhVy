<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useStore } from 'vuex'
import { api } from '../api/client.js'
import ArgonAlert from '@/components/ArgonAlert.vue'
import ArgonButton from '@/components/ArgonButton.vue'
import AppDateField from '@/components/AppDateField.vue'
import ConfirmLogoutPopup from '@/components/ConfirmLogoutPopup.vue'

const store = useStore()

function localTodayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDaysStr(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const authUser = computed(() => store.state.authUser)
const isManager = computed(() => authUser.value?.role === 'manager')
const isTeacher = computed(
  () => authUser.value?.role === 'teacher' && authUser.value?.teacherId != null
)
import defaultAvatarMale from '@/assets/img/logos/betrai.png'
import defaultAvatarFemale from '@/assets/img/logos/begai.png'

const activeTab = ref('students')
const searchQuery = ref('')
const noteOpenIds = ref([])

function todayStr() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

function studentAvatarSrc(row) {
  if (row.studentAvatar && typeof row.studentAvatar === 'string' && row.studentAvatar.trim()) {
    return row.studentAvatar.trim()
  }
  return row.studentGender === 'female' ? defaultAvatarFemale : defaultAvatarMale
}

function onAvatarError(ev, row) {
  const el = ev?.target
  if (!el || el.dataset.fallbackApplied) return
  el.dataset.fallbackApplied = '1'
  el.src = row.studentGender === 'female' ? defaultAvatarFemale : defaultAvatarMale
}

function toggleNote(id) {
  const idx = noteOpenIds.value.indexOf(id)
  if (idx >= 0) noteOpenIds.value.splice(idx, 1)
  else noteOpenIds.value.push(id)
}

function isNoteOpen(id) {
  return noteOpenIds.value.includes(id)
}

// ---- student attendance state ----
const classes = ref([])
const selectedClassId = ref('')
const selectedDate = ref(todayStr())
const studentRows = ref([])
const studentLoading = ref(false)
const studentErr = ref('')
const studentSaving = ref(false)

const canLoadStudents = computed(
  () => selectedClassId.value && selectedDate.value
)

const totalStudents = computed(() => studentRows.value.length)

const filteredRows = computed(() => {
  if (!searchQuery.value.trim()) return studentRows.value
  const q = searchQuery.value.trim().toLowerCase()
  return studentRows.value.filter((r) =>
    r.studentName.toLowerCase().includes(q)
  )
})

const unmarkedStudents = computed(() =>
  filteredRows.value.filter((r) => r.status == null)
)
const presentStudents = computed(() =>
  filteredRows.value.filter((r) => r.status === 'present')
)
const absentStudents = computed(() =>
  filteredRows.value.filter((r) => r.status === 'absent')
)

const selectedClassName = computed(() => {
  const found = classes.value.find((c) => String(c.id) === String(selectedClassId.value))
  return found?.name || 'Chưa chọn lớp'
})

const attendanceProgress = computed(() => {
  if (!totalStudents.value) return 0
  return Math.round(((presentStudents.value.length + absentStudents.value.length) / totalStudents.value) * 100)
})

async function loadClasses() {
  try {
    const { data } = await api.get('/classes')
    classes.value = data
    if (data.length && !selectedClassId.value) {
      selectedClassId.value = String(data[0].id)
    }
  } catch {
    classes.value = []
  }
}

async function loadStudentAttendance() {
  if (!canLoadStudents.value) return
  studentLoading.value = true
  studentErr.value = ''
  try {
    const { data } = await api.get('/attendance/students', {
      params: {
        classId: selectedClassId.value,
        date: selectedDate.value,
        session: 'full',
      },
    })
    studentRows.value = data.map((r) => {
      const st = r.status === 'present' || r.status === 'absent' ? r.status : null
      return { ...r, status: st, note: r.note || '' }
    })
  } catch (e) {
    studentErr.value =
      e.response?.data?.error || e.message || 'Failed to load attendance'
  } finally {
    studentLoading.value = false
  }
}

async function markStudent(studentId, newStatus) {
  const row = studentRows.value.find((r) => r.studentId === studentId)
  if (!row) return
  row.status = newStatus
  studentErr.value = ''
  try {
    await api.put('/attendance/students/bulk', {
      classId: Number(selectedClassId.value),
      date: selectedDate.value,
      session: 'full',
      items: [{ studentId, status: newStatus, note: row.note }],
    })
  } catch (e) {
    studentErr.value =
      e.response?.data?.error || e.message || 'Save failed'
    await loadStudentAttendance()
  }
}

async function unmarkStudent(studentId) {
  const row = studentRows.value.find((r) => r.studentId === studentId)
  if (!row) return
  row.status = null
  studentErr.value = ''
  try {
    await api.delete('/attendance/students/record', {
      params: {
        studentId,
        date: selectedDate.value,
        session: 'full',
      },
    })
  } catch (e) {
    studentErr.value =
      e.response?.data?.error || e.message || 'Undo failed'
    await loadStudentAttendance()
  }
}

async function markAllPresent() {
  const toMark = unmarkedStudents.value
  if (!toMark.length) return
  toMark.forEach((r) => (r.status = 'present'))
  studentSaving.value = true
  studentErr.value = ''
  try {
    await api.put('/attendance/students/bulk', {
      classId: Number(selectedClassId.value),
      date: selectedDate.value,
      session: 'full',
      items: toMark.map((r) => ({
        studentId: r.studentId,
        status: 'present',
        note: r.note,
      })),
    })
  } catch (e) {
    studentErr.value =
      e.response?.data?.error || e.message || 'Save failed'
    await loadStudentAttendance()
  } finally {
    studentSaving.value = false
  }
}

watch([selectedClassId, selectedDate], () => {
  if (canLoadStudents.value) loadStudentAttendance()
})

const teacherStatusOptions = [
  { value: 'present', label: 'Đi dạy', color: 'bg-gradient-success' },
  { value: 'absent', label: 'Nghỉ', color: 'bg-gradient-danger' },
  { value: 'late', label: 'Trễ', color: 'bg-gradient-warning' },
  { value: 'leave', label: 'Phép', color: 'bg-gradient-secondary' },
  { value: 'excused', label: 'Có phép', color: 'bg-gradient-info' },
]

// ---- teacher self-service leave (xin nghỉ trước) ----
const leaveDate = ref(localTodayStr())
const leaveNote = ref('')
const leaveSubmitting = ref(false)
const leaveErr = ref('')
const leaveOkMsg = ref('')
const myTeacherRecords = ref([])
const myLeaveLoading = ref(false)
const showConfirmPopup = ref(false)
const confirmPopupTitle = ref('')
const confirmPopupMessage = ref('')
const confirmPopupConfirmText = ref('')
const confirmPopupDanger = ref(true)
const pendingLeaveAction = ref(null)

const myLeaveRows = computed(() => {
  const t = localTodayStr()
  return myTeacherRecords.value.filter(
    (r) => r.status === 'leave' && r.attendanceDate >= t
  )
})

const myOtherAttendanceRows = computed(() => {
  const t = localTodayStr()
  return myTeacherRecords.value.filter(
    (r) => r.status !== 'leave' && r.attendanceDate >= t
  )
})

async function loadMyTeacherLeaveRecords() {
  if (!isTeacher.value) return
  myLeaveLoading.value = true
  leaveErr.value = ''
  try {
    const { data } = await api.get('/attendance/teachers/me', {
      params: { from: localTodayStr(), to: addDaysStr(120) },
    })
    myTeacherRecords.value = Array.isArray(data) ? data : []
  } catch (e) {
    leaveErr.value =
      e.response?.data?.error || e.message || 'Không tải được lịch nghỉ'
    myTeacherRecords.value = []
  } finally {
    myLeaveLoading.value = false
  }
}

async function submitLeaveRequest() {
  leaveErr.value = ''
  leaveOkMsg.value = ''
  leaveSubmitting.value = true
  try {
    await api.post('/attendance/teachers/me/leave-request', {
      date: leaveDate.value,
      note: leaveNote.value,
    })
    leaveOkMsg.value = 'Đã gửi đăng ký nghỉ phép.'
    leaveNote.value = ''
    await loadMyTeacherLeaveRecords()
  } catch (e) {
    leaveErr.value =
      e.response?.data?.error || e.message || 'Gửi đăng ký thất bại'
  } finally {
    leaveSubmitting.value = false
  }
}

async function cancelMyLeave(dateStr) {
  leaveErr.value = ''
  leaveOkMsg.value = ''
  try {
    await api.delete('/attendance/teachers/me/leave-request', {
      params: { date: dateStr },
    })
    leaveOkMsg.value = 'Đã hủy đăng ký nghỉ phép.'
    await loadMyTeacherLeaveRecords()
  } catch (e) {
    leaveErr.value = e.response?.data?.error || e.message || 'Hủy thất bại'
  }
}

function closeConfirmPopup() {
  showConfirmPopup.value = false
  pendingLeaveAction.value = null
}

function openSubmitLeaveConfirm() {
  confirmPopupTitle.value = 'Xác nhận đăng ký nghỉ'
  confirmPopupMessage.value = `Xác nhận gửi đăng ký nghỉ ngày ${leaveDate.value}?`
  confirmPopupConfirmText.value = 'Gửi đăng ký'
  confirmPopupDanger.value = false
  pendingLeaveAction.value = submitLeaveRequest
  showConfirmPopup.value = true
}

function openCancelLeaveConfirm(dateStr) {
  confirmPopupTitle.value = 'Xác nhận hủy đăng ký nghỉ'
  confirmPopupMessage.value = `Xác nhận hủy đăng ký nghỉ ngày ${dateStr}?`
  confirmPopupConfirmText.value = 'Hủy đăng ký'
  confirmPopupDanger.value = true
  pendingLeaveAction.value = () => cancelMyLeave(dateStr)
  showConfirmPopup.value = true
}

async function confirmPendingLeaveAction() {
  const action = pendingLeaveAction.value
  showConfirmPopup.value = false
  pendingLeaveAction.value = null
  if (typeof action === 'function') {
    await action()
  }
}

watch(
  () => [activeTab.value, isTeacher.value],
  () => {
    if (activeTab.value === 'teachers' && isTeacher.value) {
      loadMyTeacherLeaveRecords()
    }
  },
  { immediate: true }
)

onMounted(() => {
  loadClasses()
})
</script>

<template>
  <div class="att-page page-fill">
    <section class="att-hero">
      <div class="att-hero-copy">
        <span class="att-hero-eyebrow">Attendance</span>
        <h4 class="att-hero-title mb-1">Điểm danh và theo dõi trong ngày</h4>
        <p class="att-hero-subtitle mb-0">
          Theo dõi nhanh tình trạng lớp học, cập nhật điểm danh và chuyển giữa học sinh, giáo viên trong một màn hình.
        </p>
      </div>

      <div class="att-hero-highlight">
        <span class="att-hero-highlight-label">Lớp đang xem</span>
        <strong>{{ selectedClassName }}</strong>
        <small>{{ selectedDate || 'Chưa chọn ngày' }}</small>
      </div>
    </section>

    <!-- ===== TOOLBAR ===== -->
    <div class="att-toolbar">
      <div class="att-toolbar-left">
        <div class="att-filter-group">
          <span class="att-filter-label">Theo ngày</span>
          <app-date-field
            v-model="selectedDate"
            input-class="att-date-input"
          />
        </div>
        <div class="att-filter-group">
          <select
            v-model="selectedClassId"
            class="att-class-select"
          >
            <option value="" disabled>— Chọn lớp —</option>
            <option
              v-for="c in classes"
              :key="c.id"
              :value="String(c.id)"
            >
              {{ c.name }}
            </option>
          </select>
        </div>
      </div>
      <div class="att-toolbar-right">
        <div class="att-search-box">
          <i class="ni ni-zoom-split-in att-search-icon"></i>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Tìm kiếm học sinh..."
            class="att-search-input"
          />
        </div>
        <div class="att-view-toggle">
          <button
            type="button"
            :class="{ active: activeTab === 'students' }"
            title="Học sinh"
            @click="activeTab = 'students'"
          >
            <i class="ni ni-hat-3"></i>
          </button>
          <button
            type="button"
            :class="{ active: activeTab === 'teachers' }"
            title="Giáo viên"
            @click="activeTab = 'teachers'"
          >
            <i class="ni ni-badge"></i>
          </button>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'students'" class="att-overview">
      <article class="att-stat-card att-stat-card--neutral">
        <span class="att-stat-label">Tiến độ điểm danh</span>
        <strong class="att-stat-value">{{ attendanceProgress }}%</strong>
        <small class="att-stat-meta">{{ presentStudents.length + absentStudents.length }}/{{ totalStudents }} học sinh</small>
      </article>

      <article class="att-stat-card att-stat-card--warning">
        <span class="att-stat-label">Chưa điểm danh</span>
        <strong class="att-stat-value">{{ unmarkedStudents.length }}</strong>
        <small class="att-stat-meta">Cần xử lý trước khi chốt buổi học</small>
      </article>

      <article class="att-stat-card att-stat-card--success">
        <span class="att-stat-label">Đi học</span>
        <strong class="att-stat-value">{{ presentStudents.length }}</strong>
        <small class="att-stat-meta">Đã được xác nhận có mặt</small>
      </article>

      <article class="att-stat-card att-stat-card--danger">
        <span class="att-stat-label">Nghỉ học</span>
        <strong class="att-stat-value">{{ absentStudents.length }}</strong>
        <small class="att-stat-meta">Các trường hợp vắng mặt trong ngày</small>
      </article>
    </div>

    <!-- ===== STUDENT ATTENDANCE (KANBAN) ===== -->
    <div v-if="activeTab === 'students'" class="att-content">
      <argon-alert
        v-if="studentErr"
        color="danger"
        icon="ni ni-fat-remove"
        class="mb-3"
      >
        {{ studentErr }}
      </argon-alert>

      <div v-if="!canLoadStudents" class="att-placeholder">
        <i class="ni ni-calendar-grid-61 att-placeholder-icon"></i>
        <p>Chọn lớp và ngày để xem điểm danh.</p>
      </div>
      <div v-else-if="studentLoading" class="att-placeholder">
        <div class="spinner-border text-primary" role="status"></div>
        <p>Đang tải...</p>
      </div>
      <div v-else-if="!studentRows.length" class="att-placeholder">
        <i class="ni ni-single-02 att-placeholder-icon"></i>
        <p>Không có học sinh nào trong lớp này.</p>
      </div>

      <div v-else class="att-columns">
        <!-- ── Chưa điểm danh ── -->
        <div class="att-col">
          <div class="att-col-header att-col-header--unmarked">
            <div class="att-col-header-left">
              <span class="att-col-icon att-col-icon--unmarked">
                <i class="ni ni-bullet-list-67"></i>
              </span>
              <span class="att-col-title">Chưa điểm danh</span>
            </div>
            <span class="att-col-count">{{ unmarkedStudents.length }}/{{ totalStudents }}</span>
          </div>
          <div class="att-col-body">
            <button
              v-if="unmarkedStudents.length"
              type="button"
              class="att-mark-all"
              :disabled="studentSaving"
              @click="markAllPresent"
            >
              <i class="ni ni-check-bold"></i> Điểm danh hàng loạt
            </button>

            <div
              v-for="s in unmarkedStudents"
              :key="s.studentId"
              class="att-card"
            >
              <div class="att-card-info">
                <img
                  :src="studentAvatarSrc(s)"
                  class="att-avatar"
                  alt=""
                  referrerpolicy="no-referrer"
                  @error="onAvatarError($event, s)"
                />
                <span class="att-card-name">{{ s.studentName }}</span>
              </div>
              <div class="att-card-btns">
                <button
                  type="button"
                  class="att-btn att-btn--present"
                  @click="markStudent(s.studentId, 'present')"
                >
                  <i class="ni ni-check-bold"></i> Đi học
                </button>
                <button
                  type="button"
                  class="att-btn att-btn--absent"
                  @click="markStudent(s.studentId, 'absent')"
                >
                  <i class="ni ni-fat-remove"></i> Nghỉ học
                </button>
              </div>
              <button
                type="button"
                class="att-note-toggle"
                @click="toggleNote(s.studentId)"
              >
                <i class="ni ni-fat-add"></i> Thêm ghi chú
              </button>
              <div v-if="isNoteOpen(s.studentId)" class="att-note-box">
                <input
                  v-model="s.note"
                  type="text"
                  placeholder="Nhập ghi chú..."
                  class="att-note-input"
                />
              </div>
            </div>

            <div v-if="!unmarkedStudents.length" class="att-col-empty">
              <span class="att-col-empty-icon">✅</span>
              <p>Đã điểm danh hết</p>
            </div>
          </div>
        </div>

        <!-- ── Đi học ── -->
        <div class="att-col">
          <div class="att-col-header att-col-header--present">
            <div class="att-col-header-left">
              <span class="att-col-icon att-col-icon--present">
                <i class="ni ni-hat-3"></i>
              </span>
              <span class="att-col-title">Đi học</span>
            </div>
            <span class="att-col-count">{{ presentStudents.length }}/{{ totalStudents }}</span>
          </div>
          <div class="att-col-body">
            <div
              v-for="s in presentStudents"
              :key="s.studentId"
              class="att-card att-card--present"
            >
              <div class="att-card-info">
                <img
                  :src="studentAvatarSrc(s)"
                  class="att-avatar"
                  alt=""
                  referrerpolicy="no-referrer"
                  @error="onAvatarError($event, s)"
                />
                <span class="att-card-name">{{ s.studentName }}</span>
              </div>
              <div class="att-card-btns">
                <button
                  type="button"
                  class="att-btn att-btn--absent"
                  @click="markStudent(s.studentId, 'absent')"
                >
                  <i class="ni ni-fat-remove"></i> Nghỉ học
                </button>
                <button
                  type="button"
                  class="att-btn att-btn--muted"
                  @click="unmarkStudent(s.studentId)"
                >
                  <i class="ni ni-bold-left"></i> Hủy điểm danh
                </button>
              </div>
              <p v-if="s.note" class="att-card-note">{{ s.note }}</p>
            </div>

            <div v-if="!presentStudents.length" class="att-col-empty">
              <p>Chưa có thông tin bé đi học, có thể bắt đầu điểm danh để thông báo tới Phụ huynh.</p>
            </div>
          </div>
        </div>

        <!-- ── Nghỉ học ── -->
        <div class="att-col">
          <div class="att-col-header att-col-header--absent">
            <div class="att-col-header-left">
              <span class="att-col-icon att-col-icon--absent">
                <i class="ni ni-fat-remove"></i>
              </span>
              <span class="att-col-title">Nghỉ học</span>
            </div>
            <span class="att-col-count">{{ absentStudents.length }}/{{ totalStudents }}</span>
          </div>
          <div class="att-col-body">
            <div
              v-for="s in absentStudents"
              :key="s.studentId"
              class="att-card att-card--absent"
            >
              <div class="att-card-info">
                <img
                  :src="studentAvatarSrc(s)"
                  class="att-avatar"
                  alt=""
                  referrerpolicy="no-referrer"
                  @error="onAvatarError($event, s)"
                />
                <span class="att-card-name">{{ s.studentName }}</span>
              </div>
              <div class="att-card-btns">
                <button
                  type="button"
                  class="att-btn att-btn--present"
                  @click="markStudent(s.studentId, 'present')"
                >
                  <i class="ni ni-check-bold"></i> Đi học
                </button>
                <button
                  type="button"
                  class="att-btn att-btn--muted"
                  @click="unmarkStudent(s.studentId)"
                >
                  <i class="ni ni-bold-left"></i> Hủy điểm danh
                </button>
              </div>
              <p v-if="s.note" class="att-card-note">{{ s.note }}</p>
            </div>

            <div v-if="!absentStudents.length" class="att-col-empty">
              <p>Không có bé nào nghỉ học.</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Quản lý: không còn bảng điểm danh GV — dùng Lịch nghỉ GV -->
    <div
      v-else-if="activeTab === 'teachers' && isManager"
      class="att-content"
    >
      <div class="card">
        <div class="card-body py-5 text-center px-4">
          <h6 class="mb-2">Điểm danh giáo viên (bảng theo ngày) đã ngừng sử dụng</h6>
          <p class="text-sm text-secondary mb-3">
            Xem ai nghỉ ngày nào trong tháng tại trang <strong>Lịch nghỉ GV</strong> (menu bên trái).
          </p>
          <router-link
            to="/leave-calendar"
            class="btn btn-sm bg-gradient-primary text-white mb-0"
          >
            Mở lịch nghỉ giáo viên
          </router-link>
        </div>
      </div>
    </div>

    <!-- Giáo viên: xin nghỉ phép trước -->
    <div
      v-else-if="activeTab === 'teachers' && isTeacher"
      class="att-content att-teacher-self-wrap"
    >
      <div class="card att-teacher-leave-card mb-4">
        <div class="card-header pb-0">
          <h6 class="mb-1">
            <i class="ni ni-calendar-grid-61 text-warning me-1"></i>
            Xin nghỉ phép trước
          </h6>
          <p class="text-sm text-secondary mb-0">
            Đăng ký nghỉ có phép cho một ngày (hôm nay hoặc ngày tới). Quản lý xem trên trang <strong>Lịch nghỉ GV</strong>.
          </p>
        </div>
        <div class="card-body">
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
          <div class="row g-3 align-items-end">
            <div class="col-md-4">
              <label class="form-control-label">Ngày nghỉ</label>
              <app-date-field
                v-model="leaveDate"
                input-class="form-control form-control-sm"
                :min="localTodayStr()"
              />
            </div>
            <div class="col-md-5">
              <label class="form-control-label">Lý do / ghi chú (tùy chọn)</label>
              <input
                v-model="leaveNote"
                type="text"
                class="form-control form-control-sm"
                placeholder="VD: Việc gia đình, khám sức khỏe…"
                maxlength="500"
              />
            </div>
            <div class="col-md-3">
              <argon-button
                color="primary"
                variant="gradient"
                type="button"
                class="w-100"
                :disabled="leaveSubmitting"
                @click="openSubmitLeaveConfirm"
              >
                {{ leaveSubmitting ? 'Đang gửi…' : 'Gửi đăng ký nghỉ' }}
              </argon-button>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header pb-0 d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div>
            <h6 class="mb-0">Ngày đã đăng ký nghỉ phép</h6>
            <p class="text-xs text-secondary mb-0">Có thể hủy trước ngày nghỉ (chưa qua ngày đó).</p>
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
          <div v-if="myLeaveLoading" class="py-4 text-center text-sm text-secondary">
            Đang tải…
          </div>
          <div
            v-else-if="!myLeaveRows.length"
            class="py-4 text-center text-sm text-secondary att-teacher-empty"
          >
            Chưa có ngày nghỉ phép nào được đăng ký từ hôm nay trở đi.
          </div>
          <div v-else class="table-responsive">
            <table class="table table-hover mb-0">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Trạng thái</th>
                  <th>Ghi chú</th>
                  <th style="width: 120px"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in myLeaveRows" :key="row.attendanceDate">
                  <td class="font-weight-bold text-sm">{{ row.attendanceDate }}</td>
                  <td>
                    <span class="badge bg-gradient-secondary">Nghỉ phép</span>
                  </td>
                  <td class="text-sm text-secondary">{{ row.note || '—' }}</td>
                  <td>
                    <argon-button
                      size="sm"
                      color="danger"
                      variant="outline"
                      type="button"
                      @click="openCancelLeaveConfirm(row.attendanceDate)"
                    >
                      Hủy đăng ký
                    </argon-button>
                  </td>
                </tr>
              </tbody>
            </table>
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

      <div
        v-if="myOtherAttendanceRows.length"
        class="card mt-4"
      >
        <div class="card-header pb-0">
          <h6 class="mb-0 text-sm">Các ngày đã được ghi nhận khác</h6>
          <p class="text-xs text-secondary mb-0">
            Bản ghi trong hệ thống (chỉ xem).
          </p>
        </div>
        <div class="card-body pt-2">
          <div class="table-responsive">
            <table class="table table-sm mb-0">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Trạng thái</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in myOtherAttendanceRows" :key="row.attendanceDate + row.status">
                  <td>{{ row.attendanceDate }}</td>
                  <td>
                    <span class="text-xs">{{ teacherStatusOptions.find((o) => o.value === row.status)?.label || row.status }}</span>
                  </td>
                  <td class="text-xs text-secondary">{{ row.note || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <div
      v-else-if="activeTab === 'teachers'"
      class="att-content"
    >
      <div class="card">
        <div class="card-body py-5 text-center text-secondary text-sm">
          <p class="mb-2">
            Chức năng giáo viên cần đăng nhập bằng tài khoản <strong>Giáo viên</strong> (đã liên kết hồ sơ).
          </p>
          <p class="mb-0">
            Quản lý xem lịch nghỉ tại <router-link to="/leave-calendar">Lịch nghỉ GV</router-link>.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ===== Page layout ===== */
.att-page {
  padding: 1rem 1.5rem 1.5rem;
  gap: 1rem;
}

.att-hero {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.35rem 1.4rem;
  border: 1px solid rgba(255, 255, 255, 0.65);
  border-radius: 1.25rem;
  background:
    radial-gradient(circle at top left, rgba(17, 205, 239, 0.18), transparent 28%),
    radial-gradient(circle at bottom right, rgba(94, 114, 228, 0.18), transparent 26%),
    linear-gradient(135deg, #ffffff 0%, #f7fbff 50%, #eef4ff 100%);
  box-shadow: 0 1.4rem 2.6rem -2rem rgba(17, 24, 39, 0.32);
}

.att-hero-copy {
  max-width: 48rem;
}

.att-hero-eyebrow {
  display: inline-block;
  margin-bottom: 0.45rem;
  color: #11cdef;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.att-hero-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #1f2a44;
  font-size: 1.5rem;
  font-weight: 700;
}

.att-hero-title::before {
  content: "\f073";
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 0.9rem;
  background: linear-gradient(135deg, #3559d8, #5b77e6);
  color: #fff;
  font-family: "Font Awesome 5 Free";
  font-size: 0.95rem;
  font-weight: 900;
  box-shadow: 0 0.9rem 1.5rem -1rem rgba(53, 89, 216, 0.55);
  flex-shrink: 0;
}

.att-hero-subtitle {
  color: #67748e;
  font-size: 0.93rem;
  line-height: 1.6;
}

.att-hero-highlight {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 220px;
  padding: 1rem 1.1rem;
  border: 1px solid rgba(94, 114, 228, 0.12);
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 1rem 1.5rem -1.2rem rgba(94, 114, 228, 0.45);
}

.att-hero-highlight-label {
  margin-bottom: 0.35rem;
  color: #8392ab;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.att-hero-highlight strong {
  color: #344767;
  font-size: 1rem;
  line-height: 1.35;
}

.att-hero-highlight small {
  margin-top: 0.25rem;
  color: #67748e;
  font-size: 0.78rem;
}

.att-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.att-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.85rem;
}

.att-stat-card {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 1rem 1.05rem;
  border: 1px solid #eef2f7;
  border-radius: 1rem;
  background: #fff;
  box-shadow: 0 0.6rem 1.4rem -1.25rem rgba(15, 23, 42, 0.32);
}

.att-stat-card--neutral {
  background: linear-gradient(180deg, #ffffff, #f8fbff);
}

.att-stat-card--warning {
  background: linear-gradient(180deg, #fffaf0, #fff4dc);
}

.att-stat-card--success {
  background: linear-gradient(180deg, #f2fff7, #e7faef);
}

.att-stat-card--danger {
  background: linear-gradient(180deg, #fff4f4, #ffeaea);
}

.att-stat-label {
  color: #8392ab;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.att-stat-value {
  color: #1f2a44;
  font-size: 1.45rem;
  font-weight: 700;
  line-height: 1.2;
}

.att-stat-meta {
  color: #67748e;
  font-size: 0.79rem;
  line-height: 1.45;
}

/* ===== Toolbar ===== */
.att-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  background: #fff;
  padding: 0.9rem 1rem;
  border-radius: 1rem;
  border: 1px solid #eef2f7;
  box-shadow: 0 0.25rem 0.75rem rgba(15, 23, 42, 0.05);
  flex-shrink: 0;
}

.att-toolbar-left,
.att-toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  flex-wrap: wrap;
}

.att-filter-group {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 38px;
}

.att-filter-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #67748e;
  white-space: nowrap;
}

.att-date-input,
.att-class-select {
  border: 1px solid #e9ecef;
  border-radius: 0.5rem;
  min-height: 38px;
  padding: 0.45rem 0.75rem;
  font-size: 0.8rem;
  color: #344767;
  background: #fff;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.att-date-input:focus,
.att-class-select:focus {
  border-color: #5e72e4;
  box-shadow: 0 0 0 3px rgba(94, 114, 228, 0.12);
}

.att-class-select {
  min-width: 170px;
}

/* Search box */
.att-search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.att-search-icon {
  position: absolute;
  left: 0.6rem;
  font-size: 0.75rem;
  color: #8392ab;
  pointer-events: none;
}

.att-search-input {
  border: 1px solid #e9ecef;
  border-radius: 0.5rem;
  min-height: 38px;
  padding: 0.45rem 0.75rem 0.45rem 1.8rem;
  font-size: 0.8rem;
  color: #344767;
  background: #fff;
  width: 220px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s, width 0.2s;
}

.att-search-input:focus {
  border-color: #5e72e4;
  box-shadow: 0 0 0 3px rgba(94, 114, 228, 0.12);
  width: 260px;
}

/* View toggle */
.att-view-toggle {
  display: flex;
  border: 1px solid #e9ecef;
  border-radius: 0.5rem;
  overflow: hidden;
}

.att-view-toggle button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: none;
  background: #fff;
  color: #8392ab;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.15s;
}

.att-view-toggle button + button {
  border-left: 1px solid #e9ecef;
}

.att-view-toggle button.active {
  background: linear-gradient(310deg, #5e72e4, #825ee4);
  color: #fff;
}

.att-view-toggle button:hover:not(.active) {
  background: #f0f2f5;
  color: #344767;
}

/* ===== Placeholder / empty page ===== */
.att-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem 1.25rem;
  color: #8392ab;
  font-size: 0.875rem;
  text-align: center;
  border: 1px dashed #dbe3ee;
  border-radius: 1rem;
  background: linear-gradient(180deg, #ffffff, #fafbfc);
}

.att-placeholder-icon {
  font-size: 2.5rem;
  opacity: 0.4;
}

/* ===== 3-Column Kanban ===== */
.att-columns {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  min-height: 0;
  align-items: stretch;
}

@media (max-width: 900px) {
  .att-columns {
    grid-template-columns: 1fr;
  }
}

.att-col {
  display: flex;
  flex-direction: column;
  border-radius: 1rem;
  background: #fff;
  border: 1px solid #eef2f7;
  box-shadow: 0 0.25rem 0.75rem rgba(15, 23, 42, 0.05);
  overflow: hidden;
  min-height: 0;
}

/* ===== Column headers ===== */
.att-col-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  flex-shrink: 0;
  position: relative;
}

.att-col-header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.att-col-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 0.4rem;
  font-size: 0.75rem;
  flex-shrink: 0;
}

.att-col-icon--unmarked {
  background: #d1fae5;
  color: #059669;
}

.att-col-icon--present {
  background: #fce7f3;
  color: #db2777;
}

.att-col-icon--absent {
  background: #fee2e2;
  color: #dc2626;
}

.att-col-title {
  font-size: 0.8125rem;
  font-weight: 700;
  color: #344767;
}

.att-col-count {
  font-size: 0.8125rem;
  font-weight: 700;
}

.att-col-header--unmarked .att-col-count {
  color: #c2710a;
}

.att-col-header--present .att-col-count {
  color: #0f7b5f;
}

.att-col-header--absent .att-col-count {
  color: #dc2626;
}

.att-col-header--unmarked {
  background: linear-gradient(180deg, #fff3df, #ffe8c6);
  border-bottom: 2px solid rgb(235, 200, 160);
}

.att-col-header--present {
  background: linear-gradient(180deg, #d7f5ea, #bbeadb);
  border-bottom: 2px solid rgb(150, 210, 190);
}

.att-col-header--absent {
  background: linear-gradient(180deg, #ffe5e5, #ffd7d7);
  border-bottom: 2px solid rgb(235, 190, 190);
}

/* ===== Column body ===== */
.att-col-body {
  flex: 1;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  overflow-y: auto;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0)),
    #fafbfc;
}

/* ===== Mark-all button ===== */
.att-mark-all {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  width: 100%;
  padding: 0.55rem 1rem;
  border: 2px dashed #86efac;
  border-radius: 0.5rem;
  background: #f0fdf4;
  color: #16a34a;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.att-mark-all:hover:not(:disabled) {
  background: #dcfce7;
  border-color: #4ade80;
}

.att-mark-all:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ===== Student cards ===== */
.att-card {
  display: flex;
  flex-direction: column;
  padding: 0.8rem;
  border-radius: 0.75rem;
  background: #fff;
  border: 1px dashed #d1d5db;
  transition: box-shadow 0.15s, transform 0.15s;
}

.att-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 0.35rem 0.9rem rgba(15, 23, 42, 0.08);
}

.att-card--present {
  border-style: solid;
  border-color: #bbf7d0;
  border-left: 3px solid #22c55e;
  background: linear-gradient(180deg, #ffffff, #f7fff9);
}

.att-card--absent {
  border-style: solid;
  border-color: #fecaca;
  border-left: 3px solid #ef4444;
  background: linear-gradient(180deg, #ffffff, #fff8f8);
}

.att-card-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.att-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  background: #f0f2f5;
}

.att-card-name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #344767;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
}

/* Action buttons inside unmarked cards */
.att-card-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.65rem;
}

.att-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  flex: 1 1 0;
  min-height: 36px;
  border-radius: 0.375rem;
  border: 1px solid;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
  transition: all 0.15s;
  background: #fff;
}

.att-btn--present {
  color: #16a34a;
  border-color: #bbf7d0;
  background: #f0fdf4;
}

.att-btn--present:hover {
  background: #22c55e;
  color: #fff;
  border-color: #22c55e;
}

.att-btn--absent {
  color: #dc2626;
  border-color: #fecaca;
  background: #fef2f2;
}

.att-btn--absent:hover {
  background: #ef4444;
  color: #fff;
  border-color: #ef4444;
}

.att-btn--muted {
  color: #64748b;
  border-color: #e2e8f0;
  background: #f8fafc;
}

.att-btn--muted:hover {
  background: #64748b;
  color: #fff;
  border-color: #64748b;
}

/* Note toggle link */
.att-note-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.55rem;
  padding: 0;
  border: none;
  background: none;
  color: #3b82f6;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
}

.att-note-toggle:hover {
  color: #2563eb;
  text-decoration: underline;
}

.att-note-box {
  margin-top: 0.45rem;
}

.att-note-input {
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  min-height: 36px;
  padding: 0.45rem 0.65rem;
  font-size: 0.75rem;
  color: #344767;
  outline: none;
}

.att-note-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}

/* Note displayed on marked cards */
.att-card-note {
  margin: 0.45rem 0 0 0;
  padding-left: 2.9rem;
  font-size: 0.72rem;
  color: #8392ab;
  font-style: italic;
  line-height: 1.45;
}

/* ===== Empty column state ===== */
.att-col-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  text-align: center;
}

.att-col-empty-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.att-col-empty p {
  margin: 0;
  font-size: 0.8rem;
  color: #8392ab;
  max-width: 220px;
  line-height: 1.5;
}

/* Teacher self-service leave */
.att-teacher-self-wrap {
  gap: 0;
}

.att-teacher-leave-card {
  border-radius: 1rem;
  border: 1px solid #eef2f7;
  box-shadow: 0 0.25rem 0.75rem rgba(15, 23, 42, 0.05);
}

.att-teacher-empty {
  border: 1px dashed #dee2e6;
  border-radius: 0.5rem;
  background: #fafbfc;
}

@media (max-width: 991.98px) {
  .att-page {
    padding: 1rem;
  }

  .att-hero {
    flex-direction: column;
    padding: 1.1rem;
  }

  .att-overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .att-toolbar {
    padding: 0.85rem;
  }

  .att-toolbar-left,
  .att-toolbar-right {
    width: 100%;
  }

  .att-search-input {
    width: 100%;
  }

  .att-search-input:focus {
    width: 100%;
  }
}

@media (max-width: 767.98px) {
  .att-toolbar-left,
  .att-toolbar-right {
    align-items: stretch;
    gap: 0.65rem;
  }

  .att-filter-group,
  .att-search-box {
    width: 100%;
  }

  .att-filter-group {
    flex-direction: column;
    align-items: stretch;
    gap: 0.35rem;
  }

  .att-date-input,
  .att-class-select,
  .att-search-input {
    width: 100%;
  }

  .att-view-toggle {
    align-self: flex-start;
  }

  .att-col-body {
    overflow: visible;
  }
}

@media (max-width: 575.98px) {
  .att-page {
    padding: 0.85rem;
  }

  .att-hero {
    padding: 1rem;
    border-radius: 1rem;
  }

  .att-hero-title {
    font-size: 1.25rem;
  }

  .att-hero-subtitle {
    font-size: 0.86rem;
  }

  .att-overview {
    grid-template-columns: 1fr;
  }

  .att-toolbar {
    border-radius: 0.85rem;
  }

  .att-col {
    border-radius: 0.85rem;
  }

  .att-card {
    padding: 0.75rem;
  }

  .att-card-btns {
    flex-direction: column;
  }

  .att-btn {
    width: 100%;
  }

  .att-card-note {
    padding-left: 0;
  }
}
</style>
