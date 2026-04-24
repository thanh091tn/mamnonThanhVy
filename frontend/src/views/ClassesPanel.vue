<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Modal } from 'bootstrap'
import { api } from '../api/client.js'
import ArgonInput from '@/components/ArgonInput.vue'
import ArgonButton from '@/components/ArgonButton.vue'
import ArgonAlert from '@/components/ArgonAlert.vue'

const items = ref([])
const teachers = ref([])
const loading = ref(false)
const loadErr = ref('')
const formErr = ref('')
const editingId = ref(null)
const saving = ref(false)
const modalEl = ref(null)
const attendanceSummary = ref(null)
const attendanceSummaryLoading = ref(false)
const attendanceSummaryErr = ref('')
const attendanceMonth = ref(new Date().toISOString().slice(0, 7))
const classDetailTab = ref('info')
const studentAttendanceRows = ref([])
const studentAttendanceLoading = ref(false)
const studentAttendanceErr = ref('')

const PAGE_SIZE = 10
const currentPage = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(items.value.length / PAGE_SIZE)))
const paginationBarClass = 'tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-3 tw-px-5 tw-pb-1 tw-pt-[0.9rem]'
const paginationInfoClass = 'tw-text-[0.78rem] tw-font-semibold tw-text-slate-500'
const paginationControlsClass = 'tw-flex tw-flex-wrap tw-items-center tw-gap-[0.35rem]'
const pageBtnClass = 'tw-h-8 tw-min-w-8 tw-rounded-[0.65rem] tw-border tw-border-[#d9e2ee] tw-bg-white tw-px-[0.55rem] tw-text-[0.78rem] tw-font-bold tw-text-slate-600 tw-transition-all tw-duration-[180ms] enabled:hover:tw-border-[#bfd0ea] enabled:hover:tw-bg-[#f8fbff] enabled:hover:tw-text-[#1f2a44] disabled:tw-cursor-not-allowed disabled:tw-opacity-[0.45]'
const activePageBtnClass = 'tw-border-transparent tw-bg-gradient-to-br tw-from-[#3559d8] tw-to-[#5b77e6] tw-text-white tw-shadow-[0_0.75rem_1.25rem_-1rem_rgba(53,89,216,0.6)]'
const pageEllipsisClass = 'tw-px-[0.2rem] tw-font-bold tw-text-slate-400'
const pagedItems = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return items.value.slice(start, start + PAGE_SIZE)
})
const assignedClassesCount = computed(() => items.value.filter((c) => c.teacherName || Number(c.teacherId || 0) > 0 || (Array.isArray(c.teacherIds) && c.teacherIds.length)).length)
const teacherAssignmentCount = computed(() => {
  const ids = new Set()
  for (const c of items.value) {
    if (Array.isArray(c.teacherIds)) c.teacherIds.forEach((id) => ids.add(String(id)))
    else if (c.teacherId != null) ids.add(String(c.teacherId))
  }
  return ids.size
})
const roomCount = computed(() => new Set(items.value.map((c) => c.room).filter(Boolean)).size)

function goToPage(page) {
  currentPage.value = Math.max(1, Math.min(page, totalPages.value))
}

const form = ref({
  name: '',
  level: '',
  room: '',
  teacherIds: [],
})

function getModal() {
  if (!modalEl.value) return null
  return Modal.getOrCreateInstance(modalEl.value)
}

function resetForm() {
  editingId.value = null
  form.value = { name: '', level: '', room: '', teacherIds: [] }
  attendanceSummary.value = null
  attendanceSummaryErr.value = ''
  classDetailTab.value = 'info'
  studentAttendanceRows.value = []
  studentAttendanceErr.value = ''
}

function onModalHidden() {
  resetForm()
  formErr.value = ''
  saving.value = false
}

function openCreate() {
  resetForm()
  formErr.value = ''
  getModal()?.show()
}

function openEdit(row) {
  editingId.value = row.id
  form.value = {
    name: row.name,
    level: row.level || '',
    room: row.room || '',
    teacherIds: Array.isArray(row.teacherIds)
      ? row.teacherIds.map((id) => String(id))
      : row.teacherId != null
        ? [String(row.teacherId)]
        : [],
  }
  formErr.value = ''
  getModal()?.show()
  loadAttendanceSummary(row.id)
}

function switchClassDetailTab(tab) {
  classDetailTab.value = tab
  if (tab === 'attendance' && editingId.value && !studentAttendanceRows.value.length && !studentAttendanceLoading.value) {
    loadStudentAttendanceSummary()
  }
}

function buildPayload() {
  return {
    name: form.value.name.trim(),
    level: form.value.level,
    room: form.value.room,
    teacherIds: form.value.teacherIds.map((id) => Number(id)),
  }
}

async function loadTeachers() {
  try {
    const { data } = await api.get('/teachers')
    teachers.value = data
  } catch {
    teachers.value = []
  }
}

async function load() {
  loading.value = true
  loadErr.value = ''
  try {
    const { data } = await api.get('/classes')
    items.value = data
    currentPage.value = 1
  } catch (e) {
    loadErr.value = e.response?.data?.error || e.message || 'Failed to load classes'
  } finally {
    loading.value = false
  }
}

async function loadAttendanceSummary(classId = editingId.value) {
  if (!classId) return
  const [year, month] = String(attendanceMonth.value || '').split('-')
  if (!year || !month) return
  attendanceSummaryLoading.value = true
  attendanceSummaryErr.value = ''
  try {
    const { data } = await api.get(`/attendance/students/classes/${classId}/month-summary`, {
      params: { year: Number(year), month: Number(month) },
    })
    attendanceSummary.value = data
  } catch (e) {
    attendanceSummary.value = null
    attendanceSummaryErr.value = e.response?.data?.error || e.message || 'Không tải được thống kê điểm danh'
  } finally {
    attendanceSummaryLoading.value = false
  }
}

async function loadStudentAttendanceSummary(classId = editingId.value) {
  if (!classId) return
  const [year, month] = String(attendanceMonth.value || '').split('-')
  if (!year || !month) return
  studentAttendanceLoading.value = true
  studentAttendanceErr.value = ''
  try {
    const { data } = await api.get(`/attendance/students/classes/${classId}/student-month-summary`, {
      params: { year: Number(year), month: Number(month) },
    })
    studentAttendanceRows.value = Array.isArray(data?.students) ? data.students : []
  } catch (e) {
    studentAttendanceRows.value = []
    studentAttendanceErr.value = e.response?.data?.error || e.message || 'Không tải được điểm danh từng học sinh'
  } finally {
    studentAttendanceLoading.value = false
  }
}

function loadAttendanceTabData() {
  loadAttendanceSummary()
  loadStudentAttendanceSummary()
}

async function save() {
  formErr.value = ''
  if (!form.value.name?.trim()) {
    formErr.value = 'Class name is required'
    return
  }
  saving.value = true
  try {
    const payload = buildPayload()
    if (editingId.value) {
      await api.put(`/classes/${editingId.value}`, payload)
    } else {
      await api.post('/classes', payload)
    }
    getModal()?.hide()
    resetForm()
    await load()
  } catch (e) {
    formErr.value = e.response?.data?.error || e.message || 'Save failed'
  } finally {
    saving.value = false
  }
}

async function remove(row) {
  if (!confirm(`Delete class "${row.name}"? Students in this class will be unassigned.`)) return
  loadErr.value = ''
  try {
    await api.delete(`/classes/${row.id}`)
    if (editingId.value === row.id) {
      getModal()?.hide()
      resetForm()
    }
    await load()
  } catch (e) {
    loadErr.value = e.response?.data?.error || e.message || 'Delete failed'
  }
}

onMounted(() => {
  loadTeachers()
  load()
  nextTick(() => {
    modalEl.value?.addEventListener('hidden.bs.modal', onModalHidden)
  })
})

onBeforeUnmount(() => {
  modalEl.value?.removeEventListener('hidden.bs.modal', onModalHidden)
  getModal()?.dispose()
})

defineExpose({ load })
</script>

<template>
  <div class="py-4 container-fluid page-fill classes-page">
    <div class="row">
      <div class="col-12">
        <div class="card class-list-card">
          <div class="card-header class-list-header">
            <div class="class-list-title">
              <span class="class-list-eyebrow">Tổ chức lớp</span>
              <h6>Danh sách lớp</h6>
              <p class="mb-0 text-sm text-secondary">Theo dõi lớp học, phòng học và giáo viên phụ trách trong một bảng gọn hơn.</p>
            </div>
            <div class="class-list-stats">
              <div class="class-stat-card">
                <span>Tổng lớp</span>
                <strong>{{ items.length }}</strong>
              </div>
              <div class="class-stat-card class-stat-card--assigned">
                <span>Có GV</span>
                <strong>{{ assignedClassesCount }}</strong>
              </div>
              <div class="class-stat-card class-stat-card--teacher">
                <span>GV phân công</span>
                <strong>{{ teacherAssignmentCount }}</strong>
              </div>
              <div class="class-stat-card class-stat-card--room">
                <span>Phòng</span>
                <strong>{{ roomCount }}</strong>
              </div>
            </div>
            <argon-button color="primary" variant="gradient" type="button" class="class-add-btn" @click="openCreate">
              Thêm lớp
            </argon-button>
          </div>
          <div class="card-body px-0 pt-0 pb-2">
            <argon-alert v-if="loadErr" color="danger" icon="ni ni-fat-remove" class="mx-4 mt-3">
              {{ loadErr }}
            </argon-alert>
            <div v-if="loading" class="px-4 py-5 text-center text-sm text-secondary">
              Đang tải…
            </div>
            <div v-else class="panel-table-wrap">
              <div class="table-responsive">
                <table class="table align-items-center panel-data-table table-hover mb-0">
                  <thead>
                    <tr>
                      <th scope="col">Tên lớp</th>
                      <th scope="col">Cấp</th>
                      <th scope="col">Phòng</th>
                      <th scope="col">Giáo viên phụ trách</th>
                      <th scope="col" class="text-end">
                        <span class="visually-hidden">Actions</span>
                      </th>
                    </tr>
                  </thead>
                <tbody>
                  <tr v-for="c in pagedItems" :key="c.id">
                    <td>
                      <div class="d-flex px-2 py-1">
                        <div class="d-flex flex-column justify-content-center">
                          <h6 class="mb-0 text-sm panel-primary-text">{{ c.name }}</h6>
                        </div>
                      </div>
                    </td>
                    <td>
                      <p class="mb-0 text-xs font-weight-bold">{{ c.level || '—' }}</p>
                    </td>
                    <td>
                      <p class="mb-0 text-xs text-secondary">{{ c.room || '—' }}</p>
                    </td>
                    <td>
                      <p class="mb-0 text-xs text-secondary">{{ c.teacherName || '—' }}</p>
                    </td>
                    <td class="align-middle text-end panel-table-actions">
                      <a
                        href="javascript:;"
                        class="text-xs font-weight-bold text-secondary me-3"
                        @click.prevent="openEdit(c)"
                        >Sửa</a
                      >
                      <a
                        href="javascript:;"
                        class="text-xs font-weight-bold text-danger"
                        @click.prevent="remove(c)"
                        >Xóa</a
                      >
                    </td>
                  </tr>
                  <tr v-if="!items.length" class="panel-table-empty">
                    <td colspan="5">Chưa có lớp nào.</td>
                  </tr>
                </tbody>
              </table>
              </div>
              <div v-if="items.length > PAGE_SIZE" :class="paginationBarClass">
                <span :class="paginationInfoClass">
                  {{ (currentPage - 1) * PAGE_SIZE + 1 }}–{{ Math.min(currentPage * PAGE_SIZE, items.length) }} / {{ items.length }}
                </span>
                <div :class="paginationControlsClass">
                  <button
                    :class="pageBtnClass"
                    :disabled="currentPage === 1"
                    @click="goToPage(1)"
                    title="Trang đầu"
                  ><i class="ni ni-bold-left"></i><i class="ni ni-bold-left"></i></button>
                  <button
                    :class="pageBtnClass"
                    :disabled="currentPage === 1"
                    @click="goToPage(currentPage - 1)"
                    title="Trang trước"
                  ><i class="ni ni-bold-left"></i></button>
                  <template v-for="p in totalPages" :key="p">
                    <button
                      v-if="p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2)"
                      :class="[pageBtnClass, p === currentPage ? activePageBtnClass : '']"
                      @click="goToPage(p)"
                    >{{ p }}</button>
                    <span
                      v-else-if="p === currentPage - 3 || p === currentPage + 3"
                      :class="pageEllipsisClass"
                    >…</span>
                  </template>
                  <button
                    :class="pageBtnClass"
                    :disabled="currentPage === totalPages"
                    @click="goToPage(currentPage + 1)"
                    title="Trang sau"
                  ><i class="ni ni-bold-right"></i></button>
                  <button
                    :class="pageBtnClass"
                    :disabled="currentPage === totalPages"
                    @click="goToPage(totalPages)"
                    title="Trang cuối"
                  ><i class="ni ni-bold-right"></i><i class="ni ni-bold-right"></i></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      id="classes-form-modal"
      ref="modalEl"
      class="modal fade"
      tabindex="-1"
      aria-labelledby="classes-form-modal-title"
      aria-hidden="true"
    >
      <div class="modal-dialog modal-dialog-centered modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 id="classes-form-modal-title" class="modal-title">
              {{ editingId ? 'Sửa lớp' : 'Thêm lớp' }}
            </h5>
            <button
              type="button"
              class="btn-close"
              data-bs-dismiss="modal"
              aria-label="Close"
            ></button>
          </div>
          <form @submit.prevent="save">
            <div class="modal-body">
              <argon-alert v-if="formErr" color="danger" icon="ni ni-fat-remove">
                {{ formErr }}
              </argon-alert>
              <ul v-if="editingId" class="class-detail-tabs nav nav-tabs mb-3" role="tablist">
                <li class="nav-item" role="presentation">
                  <button
                    class="nav-link"
                    :class="{ active: classDetailTab === 'info' }"
                    type="button"
                    @click="switchClassDetailTab('info')"
                  >
                    Thông tin lớp học
                  </button>
                </li>
                <li class="nav-item" role="presentation">
                  <button
                    class="nav-link"
                    :class="{ active: classDetailTab === 'attendance' }"
                    type="button"
                    @click="switchClassDetailTab('attendance')"
                  >
                    Điểm danh học sinh
                  </button>
                </li>
              </ul>

              <div v-show="!editingId || classDetailTab === 'info'">
                <p class="text-sm text-uppercase text-muted">Thông tin lớp học</p>
                <div class="row">
                  <div class="col-md-6">
                    <label for="class-name" class="form-control-label">Tên lớp *</label>
                    <argon-input
                      id="class-name"
                      v-model="form.name"
                      placeholder="e.g. Lớp mầm 3A"
                      name="name"
                      autocomplete="off"
                    />
                  </div>
                  <div class="col-md-6">
                    <label for="class-level" class="form-control-label">Cấp / nhóm tuổi</label>
                    <argon-input
                      id="class-level"
                      v-model="form.level"
                      placeholder="VD: Mầm non 3–4 tuổi"
                      name="level"
                    />
                  </div>
                  <div class="col-md-6">
                    <label for="class-room" class="form-control-label">Phòng</label>
                    <argon-input id="class-room" v-model="form.room" placeholder="VD: A12" name="room" />
                  </div>
                  <div class="col-md-6">
                    <label class="form-control-label">Giáo viên phụ trách</label>
                    <div class="class-teacher-checklist">
                      <label
                        v-for="t in teachers"
                        :key="t.id"
                        class="class-teacher-option"
                      >
                        <input
                          v-model="form.teacherIds"
                          type="checkbox"
                          :value="String(t.id)"
                        />
                        <span>{{ t.name }}{{ t.phone ? ` (${t.phone})` : t.subject ? ` (${t.subject})` : '' }}</span>
                      </label>
                      <div v-if="!teachers.length" class="class-teacher-empty">
                        Chưa có giáo viên để chọn.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="editingId" v-show="classDetailTab === 'attendance'" class="class-attendance-summary mt-2">
                <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                  <div>
                    <p class="mb-0 text-sm text-uppercase text-muted">Điểm danh tháng</p>
                    <p class="mb-0 text-xs text-secondary">Tổng hợp điểm danh của lớp và từng học sinh trong tháng đã chọn</p>
                  </div>
                  <input
                    v-model="attendanceMonth"
                    type="month"
                    class="form-control form-control-sm class-attendance-month"
                    @change="loadAttendanceTabData"
                  />
                </div>
                <argon-alert v-if="attendanceSummaryErr" color="danger" icon="ni ni-fat-remove">
                  {{ attendanceSummaryErr }}
                </argon-alert>
                <argon-alert v-if="studentAttendanceErr" color="danger" icon="ni ni-fat-remove">
                  {{ studentAttendanceErr }}
                </argon-alert>
                <div v-if="attendanceSummaryLoading" class="py-3 text-center text-sm text-secondary">
                  Đang tải thống kê...
                </div>
                <div v-else-if="attendanceSummary" class="class-attendance-grid">
                  <div class="class-attendance-stat">
                    <span>Sĩ số</span>
                    <strong>{{ attendanceSummary.studentCount }}</strong>
                  </div>
                  <div class="class-attendance-stat stat-present">
                    <span>Đi học</span>
                    <strong>{{ attendanceSummary.present }}</strong>
                  </div>
                  <div class="class-attendance-stat stat-absent">
                    <span>Nghỉ</span>
                    <strong>{{ attendanceSummary.absent }}</strong>
                  </div>
                  <div class="class-attendance-stat stat-late">
                    <span>Trễ</span>
                    <strong>{{ attendanceSummary.late }}</strong>
                  </div>
                  <div class="class-attendance-stat stat-excused">
                    <span>Có phép</span>
                    <strong>{{ attendanceSummary.excused }}</strong>
                  </div>
                  <div class="class-attendance-stat">
                    <span>Chưa ghi nhận</span>
                    <strong>{{ attendanceSummary.noRecord }}</strong>
                  </div>
                </div>

                <div class="student-attendance-panel mt-3">
                  <div class="student-attendance-heading">
                    <div>
                      <h6 class="mb-1">Điểm danh từng học sinh</h6>
                      <p class="mb-0 text-xs text-secondary">Mỗi dòng là tổng điểm danh của một học sinh trong tháng.</p>
                    </div>
                  </div>
                  <div v-if="studentAttendanceLoading" class="py-4 text-center text-sm text-secondary">
                    Đang tải danh sách học sinh...
                  </div>
                  <div v-else class="table-responsive student-attendance-table-wrap">
                    <table class="table align-items-center mb-0 student-attendance-table">
                      <thead>
                        <tr>
                          <th scope="col">Học sinh</th>
                          <th scope="col">Tổng ghi nhận</th>
                          <th scope="col">Đi học</th>
                          <th scope="col">Nghỉ</th>
                          <th scope="col">Trễ</th>
                          <th scope="col">Có phép</th>
                          <th scope="col">Chưa ghi nhận</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="row in studentAttendanceRows" :key="row.studentId">
                          <td>
                            <div class="student-attendance-name">
                              <span>{{ row.studentName }}</span>
                            </div>
                          </td>
                          <td>{{ row.totalRecords }}</td>
                          <td class="stat-present-text">{{ row.present }}</td>
                          <td class="stat-absent-text">{{ row.absent }}</td>
                          <td class="stat-late-text">{{ row.late }}</td>
                          <td class="stat-excused-text">{{ row.excused }}</td>
                          <td>{{ row.noRecord }}</td>
                        </tr>
                        <tr v-if="!studentAttendanceRows.length">
                          <td colspan="7" class="text-center text-sm text-secondary py-4">
                            Chưa có học sinh trong lớp này.
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <argon-button
                color="secondary"
                variant="outline"
                type="button"
                data-bs-dismiss="modal"
                :disabled="saving"
              >
                Hủy
              </argon-button>
              <argon-button
                color="primary"
                variant="gradient"
                type="submit"
                :disabled="saving"
              >
                {{ saving ? 'Đang lưu…' : editingId ? 'Cập nhật' : 'Tạo mới' }}
              </argon-button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.classes-page {
  padding-top: 1rem !important;
}

.class-list-card {
  overflow: hidden;
  border: 1px solid #e5edf6;
  background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
  box-shadow: 0 1.35rem 2.8rem -2.2rem rgba(15, 23, 42, 0.42);
}

.class-list-card .card-body {
  padding-bottom: 0 !important;
}

.class-list-card .panel-table-wrap {
  margin: 0;
  border-right: 0;
  border-bottom: 0;
  border-left: 0;
  border-radius: 0;
  box-shadow: none;
}

.class-list-card .panel-data-table {
  min-width: 760px;
}

.class-list-header {
  display: grid;
  grid-template-columns: minmax(15rem, 1fr) auto auto;
  align-items: center;
  gap: 0.9rem;
  padding: 1rem 1.35rem 0.9rem;
  border-bottom: 1px solid #edf2f7;
  background:
    radial-gradient(circle at top left, rgba(251, 99, 64, 0.14), transparent 30%),
    linear-gradient(135deg, #ffffff 0%, #fffbf7 54%, #fff3ed 100%);
}

.class-list-title h6 {
  margin: 0 0 0.15rem;
  color: #1f2a44;
  font-size: 1.05rem;
  font-weight: 900;
}

.class-list-eyebrow {
  display: inline-flex;
  margin-bottom: 0.2rem;
  color: #c2410c;
  font-size: 0.68rem;
  font-weight: 850;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.class-list-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(4.8rem, 1fr));
  gap: 0.45rem;
}

.class-stat-card {
  min-width: 4.8rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid #e5edf6;
  border-radius: 0.8rem;
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 0.65rem 1.35rem -1.2rem rgba(15, 23, 42, 0.34);
}

.class-stat-card span {
  display: block;
  color: #64748b;
  font-size: 0.64rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.class-stat-card strong {
  display: block;
  color: #1f2a44;
  font-size: 1.05rem;
  font-weight: 900;
  line-height: 1.15;
}

.class-stat-card--assigned {
  border-color: rgba(45, 206, 137, 0.22);
  background: rgba(236, 253, 245, 0.9);
}

.class-stat-card--teacher {
  border-color: rgba(94, 114, 228, 0.22);
  background: rgba(238, 242, 255, 0.92);
}

.class-stat-card--room {
  border-color: rgba(251, 99, 64, 0.22);
  background: rgba(255, 247, 237, 0.92);
}

.class-add-btn {
  white-space: nowrap;
  box-shadow: 0 0.8rem 1.5rem -1rem rgba(94, 114, 228, 0.72);
}

.class-teacher-checklist {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  max-height: 180px;
  overflow-y: auto;
  padding: 0.75rem;
  border: 1px solid #d9e2ee;
  border-radius: 0.65rem;
  background: #fff;
}

.class-teacher-option {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin: 0;
  color: #344767;
  font-size: 0.85rem;
  cursor: pointer;
}

.class-teacher-option input {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
}

.class-teacher-empty {
  color: #8392ab;
  font-size: 0.82rem;
}

.class-detail-tabs {
  gap: 0.35rem;
  border-bottom: 1px solid #e2e8f0;
}

.class-detail-tabs .nav-link {
  border: 0;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  color: #67748e;
  font-size: 0.84rem;
  font-weight: 800;
  background: transparent;
}

.class-detail-tabs .nav-link.active {
  color: #0f766e;
  border-bottom-color: #10b981;
  background: transparent;
}

.class-attendance-summary {
  padding: 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.85rem;
  background: #f8fafc;
}

.class-attendance-month {
  width: 11rem;
}

.class-attendance-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.65rem;
}

.class-attendance-stat {
  min-height: 4.8rem;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  background: #ffffff;
}

.class-attendance-stat span {
  display: block;
  color: #67748e;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
}

.class-attendance-stat strong {
  display: block;
  margin-top: 0.35rem;
  color: #1f2a44;
  font-size: 1.25rem;
}

.stat-present strong { color: #2dce89; }
.stat-absent strong { color: #f5365c; }
.stat-late strong { color: #fb6340; }
.stat-excused strong { color: #11cdef; }

.student-attendance-panel {
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 0.85rem;
  background: #ffffff;
}

.student-attendance-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1rem;
  border-bottom: 1px solid #e2e8f0;
  background: #ffffff;
}

.student-attendance-heading h6 {
  color: #1f2a44;
  font-weight: 850;
}

.student-attendance-table-wrap {
  max-height: 380px;
  overflow: auto;
}

.student-attendance-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 0.65rem 0.75rem;
  color: #67748e;
  font-size: 0.68rem;
  font-weight: 800;
  white-space: nowrap;
  background: #f8fafc;
}

.student-attendance-table tbody td {
  padding: 0.65rem 0.75rem;
  color: #344767;
  font-size: 0.82rem;
  font-weight: 700;
  vertical-align: middle;
  border-bottom: 1px solid #f1f3f5;
}

.student-attendance-name {
  min-width: 10rem;
  color: #1f2a44;
  font-weight: 850;
}

.stat-present-text { color: #2dce89 !important; }
.stat-absent-text { color: #f5365c !important; }
.stat-late-text { color: #fb6340 !important; }
.stat-excused-text { color: #11cdef !important; }

@media (max-width: 991.98px) {
  .class-list-header {
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .class-list-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .class-add-btn {
    justify-self: flex-start;
  }

  .class-attendance-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 575.98px) {
  .class-attendance-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .class-attendance-month {
    width: 100%;
  }
}
</style>

