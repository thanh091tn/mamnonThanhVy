<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { api } from '../api/client.js'

const steps = [
  { key: 1, label: 'Chọn học sinh', icon: 'ni ni-bullet-list-67' },
  { key: 2, label: 'Cấu hình', icon: 'ni ni-settings-gear-65' },
  { key: 3, label: 'Kiểm tra', icon: 'ni ni-check-bold' },
]

const statusLabels = {
  active: 'Đang học',
  inactive: 'Thôi học',
  graduated: 'Tốt nghiệp/Ra trường',
  leave: 'Bảo lưu',
}

const currentStep = ref(1)
const loading = ref(false)
const error = ref('')
const metadata = ref({ academicYears: [], classes: [] })
const students = ref([])
const selectedIds = ref([])
const preview = ref(null)
const executing = ref(false)
const job = ref(null)
const pollTimer = ref(null)
const confirmModalOpen = ref(false)

const filters = ref({
  academicYearId: '',
  classId: '',
  status: 'active,leave',
  keyword: '',
})

const config = ref({
  action: 'transfer',
  transferMode: 'direct',
  targetAcademicYearId: '',
  targetClassId: '',
  status: 'graduated',
  effectiveDate: new Date().toISOString().slice(0, 10),
  note: '',
})

const filteredTargetClasses = computed(() => {
  if (!config.value.targetAcademicYearId) return metadata.value.classes
  const filtered = metadata.value.classes.filter(
    (c) => c.academicYearId === Number(config.value.targetAcademicYearId)
  )
  return filtered.length ? filtered : metadata.value.classes
})

const selectedCount = computed(() => selectedIds.value.length)
const visibleStudents = computed(() => {
  const keyword = String(filters.value.keyword || '').trim().toLowerCase()
  if (!keyword) return students.value
  return students.value.filter((student) => String(student.name || '').toLowerCase().includes(keyword))
})
const allVisibleSelected = computed(() => visibleStudents.value.length > 0 && visibleStudents.value.every((s) => selectedIds.value.includes(s.id)))
const hasPreviewErrors = computed(() => (preview.value?.summary?.errors || 0) > 0)
const jobProgress = computed(() => job.value?.progress || 0)

function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(-2).map((p) => p[0]).join('').toUpperCase()
}

function className(id) {
  return metadata.value.classes.find((c) => c.id === Number(id))?.name || ''
}

function statusText(status) {
  return statusLabels[status] || status || ''
}

function canGoNext() {
  if (currentStep.value === 1) return selectedCount.value > 0
  if (currentStep.value === 2) {
    if (config.value.action === 'transfer') return Boolean(config.value.targetClassId)
    return Boolean(config.value.status)
  }
  if (currentStep.value === 3) return preview.value && !hasPreviewErrors.value
  return false
}

async function loadMetadata() {
  const res = await api.get('/year-end-transition/metadata')
  metadata.value = res.data
  const currentYear = metadata.value.academicYears.find((y) => y.isCurrent) || metadata.value.academicYears[0] || null
  const nextYear =
    metadata.value.academicYears.find((y) => currentYear && y.id !== currentYear.id) ||
    metadata.value.academicYears[1] ||
    currentYear
  filters.value.academicYearId = currentYear?.id ? String(currentYear.id) : ''
  config.value.targetAcademicYearId = nextYear?.id ? String(nextYear.id) : ''
}

async function loadStudents() {
  loading.value = true
  error.value = ''
  try {
    const params = {
      academicYearId: filters.value.academicYearId || undefined,
      classId: filters.value.classId || undefined,
      status: filters.value.status || undefined,
    }
    const res = await api.get('/year-end-transition/students', { params })
    students.value = res.data
    selectedIds.value = selectedIds.value.filter((id) => students.value.some((s) => s.id === id))
  } catch (e) {
    error.value = e.response?.data?.error || 'Không tải được danh sách học sinh'
  } finally {
    loading.value = false
  }
}

function toggleAll() {
  if (allVisibleSelected.value) {
    const visibleIds = new Set(visibleStudents.value.map((s) => s.id))
    selectedIds.value = selectedIds.value.filter((id) => !visibleIds.has(id))
    return
  }
  const merged = new Set([...selectedIds.value, ...visibleStudents.value.map((s) => s.id)])
  selectedIds.value = [...merged]
}

function toggleStudent(id) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((v) => v !== id)
    : [...selectedIds.value, id]
}

async function buildPreview() {
  loading.value = true
  error.value = ''
  try {
    const res = await api.post('/year-end-transition/preview', {
      studentIds: selectedIds.value,
      action: config.value.action,
      effectiveDate: config.value.effectiveDate,
      config: {
        targetAcademicYearId: config.value.targetAcademicYearId || null,
        targetClassId: config.value.targetClassId || null,
        status: config.value.status,
      },
    })
    preview.value = res.data
  } catch (e) {
    error.value = e.response?.data?.error || 'Không kiểm tra được dữ liệu'
  } finally {
    loading.value = false
  }
}

async function nextStep() {
  if (currentStep.value === 2) await buildPreview()
  if (currentStep.value === 3) {
    confirmModalOpen.value = true
    return
  }
  if (!error.value && currentStep.value < 3) currentStep.value += 1
}

function prevStep() {
  if (currentStep.value > 1) currentStep.value -= 1
}

function resetWizardState() {
  currentStep.value = 1
  selectedIds.value = []
  preview.value = null
  job.value = null
  confirmModalOpen.value = false
  config.value.action = 'transfer'
  config.value.transferMode = 'direct'
  config.value.targetAcademicYearId = ''
  config.value.targetClassId = ''
  config.value.status = 'graduated'
  config.value.effectiveDate = new Date().toISOString().slice(0, 10)
  config.value.note = ''
}

async function redirectToYearEndTransition() {
  resetWizardState()
  if (typeof window !== 'undefined') {
    window.location.href = '/year-end-transition'
  }
}

async function execute() {
  executing.value = true
  error.value = ''
  try {
    const res = await api.post('/year-end-transition/execute', {
      studentIds: selectedIds.value,
      action: config.value.action,
      effectiveDate: config.value.effectiveDate,
      note: config.value.note,
      config: {
        targetAcademicYearId: config.value.targetAcademicYearId || null,
        targetClassId: config.value.targetClassId || null,
        status: config.value.status,
      },
    })
    if (res.data.mode === 'background') {
      job.value = { ...res.data.job, progress: 0 }
      await redirectToYearEndTransition()
    } else {
      job.value = { status: 'completed', progress: 100, processedCount: res.data.processed, totalCount: res.data.processed }
      await redirectToYearEndTransition()
    }
  } catch (e) {
    error.value = e.response?.data?.error || 'Không thể thực thi'
  } finally {
    executing.value = false
  }
}

function closeConfirmModal() {
  if (executing.value) return
  confirmModalOpen.value = false
}

async function pollJob() {
  if (!job.value?.id) return
  clearInterval(pollTimer.value)
  pollTimer.value = setInterval(async () => {
    const res = await api.get(`/year-end-transition/jobs/${job.value.id}`)
    job.value = res.data
    if (['completed', 'failed'].includes(job.value.status)) clearInterval(pollTimer.value)
  }, 1200)
}

onMounted(async () => {
  await loadMetadata()
  await loadStudents()
})

watch(
  () => [filters.value.academicYearId, filters.value.classId, filters.value.status],
  async () => {
    if (!metadata.value.classes.length && !metadata.value.academicYears.length) return
    await loadStudents()
  }
)

onBeforeUnmount(() => clearInterval(pollTimer.value))
</script>

<template>
  <div class="container-fluid py-4 year-end-page">
    <div class="year-end-hero">
      <div>
        <span class="year-end-eyebrow">Chuyển lớp</span>
        <h4>Quản lý chuyển lớp và trạng thái hàng loạt</h4>
        <p>Chọn học sinh, kiểm tra thay đổi trước/sau và thực thi an toàn có lưu lịch sử.</p>
      </div>
      <div class="year-end-count">
        <strong>{{ selectedCount }}</strong>
        <span>đã chọn</span>
      </div>
    </div>

    <div class="wizard-line">
      <div v-for="step in steps" :key="step.key" class="wizard-step" :class="{ done: currentStep > step.key, active: currentStep === step.key }">
        <span><i :class="currentStep > step.key ? 'ni ni-check-bold' : step.icon"></i></span>
        <small>{{ step.label }}</small>
      </div>
    </div>

    <div v-if="error" class="alert alert-danger border-0 shadow-sm">{{ error }}</div>

    <section v-if="currentStep === 1" class="year-end-card">
      <div class="filter-grid">
        <label>
          <span>Tên học sinh</span>
          <input v-model="filters.keyword" class="form-control" placeholder="Nhập tên để lọc nhanh" />
        </label>
        <label>
          <span>Năm học</span>
          <select v-model="filters.academicYearId" class="form-control">
            <option value="">Tất cả</option>
            <option v-for="year in metadata.academicYears" :key="year.id" :value="String(year.id)">
              {{ year.name }}
            </option>
          </select>
        </label>
        <label>
          <span>Lớp</span>
          <select v-model="filters.classId" class="form-control">
            <option value="">Tất cả</option>
            <option v-for="c in metadata.classes" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>
        <label>
          <span>Trạng thái</span>
          <select v-model="filters.status" class="form-control">
            <option value="active,leave">Đang học + Bảo lưu</option>
            <option value="active">Đang học</option>
            <option value="leave">Bảo lưu</option>
          </select>
        </label>
      </div>

      <div class="table-responsive mt-4 year-end-table-wrap">
        <table class="table align-items-center mb-0 year-end-table">
          <thead>
            <tr>
              <th><input type="checkbox" :checked="allVisibleSelected" @change="toggleAll" /></th>
              <th>Học sinh</th>
              <th>Lớp hiện tại</th>
              <th>Ngày sinh</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="student in visibleStudents" :key="student.id" :class="{ selected: selectedIds.includes(student.id) }" @click="toggleStudent(student.id)">
              <td><input type="checkbox" :checked="selectedIds.includes(student.id)" @click.stop @change="toggleStudent(student.id)" /></td>
              <td>
                <div class="student-cell">
                  <span class="student-avatar">{{ initials(student.name) }}</span>
                  <strong>{{ student.name }}</strong>
                </div>
              </td>
              <td>{{ student.className || 'Chưa phân lớp' }}</td>
              <td>{{ student.dateOfBirth || '—' }}</td>
              <td><span class="soft-badge info">{{ statusText(student.status) }}</span></td>
            </tr>
            <tr v-if="!visibleStudents.length">
              <td colspan="5" class="text-center py-4 text-muted">Không có học sinh phù hợp</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-else-if="currentStep === 2" class="year-end-card">
      <div class="action-grid">
        <button class="action-tile" :class="{ active: config.action === 'transfer' }" @click="config.action = 'transfer'">
          <i class="ni ni-curved-next"></i>
          <strong>Chuyển lớp</strong>
          <span>Chọn lớp mới cho danh sách học sinh.</span>
        </button>
        <button class="action-tile" :class="{ active: config.action === 'status' }" @click="config.action = 'status'">
          <i class="ni ni-badge"></i>
          <strong>Cập nhật trạng thái</strong>
          <span>Tốt nghiệp, thôi học hoặc bảo lưu.</span>
        </button>
      </div>

      <div v-if="config.action === 'transfer'" class="config-grid mt-4">
        <label>
          <span>Năm học mới</span>
          <select v-model="config.targetAcademicYearId" class="form-control">
            <option value="">Chọn năm học</option>
            <option v-for="year in metadata.academicYears" :key="year.id" :value="String(year.id)">
              {{ year.name }}
            </option>
          </select>
        </label>
        <label>
          <span>Lớp mới</span>
          <select v-model="config.targetClassId" class="form-control">
            <option value="">Chọn lớp</option>
            <option v-for="c in filteredTargetClasses" :key="c.id" :value="c.id">
              {{ c.name }} ({{ c.currentStudents }} Học sinh)
            </option>
          </select>
        </label>
        <label>
          <span>Cơ chế</span>
          <select v-model="config.transferMode" class="form-control" disabled>
            <option value="direct">Chuyển thẳng</option>
          </select>
        </label>
      </div>

      <div v-else class="config-grid mt-4">
        <label>
          <span>Trạng thái mới</span>
          <select v-model="config.status" class="form-control">
            <option value="graduated">Tốt nghiệp/Ra trường</option>
            <option value="inactive">Thôi học</option>
            <option value="leave">Bảo lưu</option>
          </select>
        </label>
      </div>

      <div class="config-grid mt-4">
        <label>
          <span>Ngày hiệu lực</span>
          <input v-model="config.effectiveDate" type="date" class="form-control" />
        </label>
        <label>
          <span>Ghi chú</span>
          <input v-model="config.note" class="form-control" placeholder="VD: Chuyển lớp cuối năm 2025-2026" />
        </label>
      </div>
    </section>

    <section v-else-if="currentStep === 3" class="year-end-card">
      <div class="table-responsive mt-3 preview-table-wrap">
        <table class="table align-items-center mb-0 preview-table">
          <thead>
            <tr>
              <th>Học sinh</th>
              <th>Trước</th>
              <th>Sau</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in preview?.items || []" :key="row.student.id">
              <td class="preview-student-cell">
                <strong>{{ row.student.name }}</strong>
              </td>
              <td>
                <div class="compare old">
                  <strong>{{ row.before.className || className(row.before.classId) || '—' }}</strong>
                  <small>{{ statusText(row.before.status) }}</small>
                </div>
              </td>
              <td>
                <div class="compare new">
                  <strong>{{ row.after.className || className(row.after.classId) || '—' }}</strong>
                  <small>{{ statusText(row.after.status) }}</small>
                  
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div class="wizard-actions">
      <button class="btn btn-outline-secondary" :disabled="currentStep === 1 || executing" @click="prevStep">Quay lại</button>
      <button class="btn btn-primary" :disabled="!canGoNext() || loading" @click="nextStep">
        {{ currentStep === 3 ? 'Thực thi' : 'Tiếp tục' }}
      </button>
    </div>

    <div v-if="confirmModalOpen" class="confirm-modal-backdrop" @click.self="closeConfirmModal">
      <div class="confirm-modal-card">
        <div class="confirm-modal-header">
          <h5>Thực thi cập nhật</h5>
          <p>{{ selectedCount }} học sinh sẽ được cập nhật.</p>
        </div>

        <div v-if="job" class="job-box">
          <div class="d-flex justify-content-between mb-2">
            <strong>{{ job.status === 'completed' ? 'Hoàn tất' : 'Đang xử lý' }}</strong>
            <span>{{ jobProgress }}%</span>
          </div>
          <div class="progress">
            <div class="progress-bar bg-success" :style="{ width: `${jobProgress}%` }"></div>
          </div>
        </div>

        <div class="confirm-modal-actions">
          <button class="btn btn-outline-secondary mb-0" :disabled="executing" @click="closeConfirmModal">Đóng</button>
          <button class="btn btn-warning mb-0" :disabled="executing" @click="execute">
            <i class="ni ni-send me-2"></i>Thực thi
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.year-end-page { color: #1f2a44; }
.year-end-hero {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.2rem;
  border-radius: 1rem;
  background: linear-gradient(135deg, #f8fffd, #eff8ff);
  border: 1px solid #dcebf3;
  box-shadow: 0 1rem 2rem -1.7rem rgba(15, 23, 42, 0.35);
}
.year-end-hero h4 { margin: 0; font-weight: 800; color: #1f2a44; }
.year-end-hero p { margin: 0.25rem 0 0; color: #67748e; }
.year-end-eyebrow { color: #0f9f8f; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; }
.year-end-count { min-width: 6rem; text-align: center; padding: 0.75rem; border-radius: 0.9rem; background: #fff; }
.year-end-count strong { display: block; color: #f59e0b; font-size: 1.6rem; line-height: 1; }
.wizard-line { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.75rem; margin: 1rem 0; }
.wizard-step { display: flex; align-items: center; gap: 0.55rem; padding: 0.75rem; border-radius: 0.9rem; background: #f5f7fb; color: #8392ab; transition: all 0.2s ease; }
.wizard-step span { display: inline-flex; width: 2rem; height: 2rem; align-items: center; justify-content: center; border-radius: 999px; background: #e9eef7; }
.wizard-step.active { background: #e8f7ff; color: #1177a8; box-shadow: 0 0.8rem 1.6rem -1.4rem rgba(17, 119, 168, 0.5); }
.wizard-step.done { background: #e9fbf2; color: #15905f; }
.year-end-card { padding: 1rem; border-radius: 1rem; background: #fff; box-shadow: 0 0.8rem 1.8rem -1.7rem rgba(15, 23, 42, 0.35); }
.filter-grid, .config-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)) auto; gap: 0.85rem; align-items: end; }
.config-grid { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
label span { display: block; margin-bottom: 0.35rem; color: #67748e; font-size: 0.78rem; font-weight: 700; }
.year-end-card :deep(.form-control) {
  color: #1f2a44;
  border-color: #d7e2ee;
  background: #fff;
}
.year-end-card :deep(.form-control::placeholder) {
  color: #94a3b8;
}
.year-end-card :deep(select.form-control) {
  color: #1f2a44;
}
.year-end-card :deep(select.form-control option) {
  color: #1f2a44;
  background: #fff;
}
.year-end-card :deep(.form-control:focus) {
  color: #1f2a44;
  border-color: #4cc9b0;
  box-shadow: 0 0 0 0.15rem rgba(76, 201, 176, 0.18);
}
.year-end-table-wrap {
  width: 100%;
  overflow-x: auto;
  border: 1px solid #edf2f7;
  border-radius: 0.9rem;
  background: #fff;
}
.year-end-table {
  min-width: 760px;
  table-layout: fixed;
}
.year-end-table th,
.year-end-table td {
  vertical-align: middle;
}
.year-end-table th:first-child,
.year-end-table td:first-child {
  width: 3.25rem;
  padding-left: 1rem;
  padding-right: 0.5rem;
  text-align: center;
}
.year-end-table th:nth-child(2),
.year-end-table td:nth-child(2) {
  width: 34%;
}
.year-end-table th:nth-child(4),
.year-end-table td:nth-child(4) {
  width: 8.5rem;
  white-space: nowrap;
}
.year-end-table th:nth-child(5),
.year-end-table td:nth-child(5) {
  width: 9.5rem;
}
.year-end-table input[type="checkbox"] {
  width: 1rem;
  height: 1rem;
  margin: 0;
}
.year-end-table thead th { color: #8392ab; font-size: 0.72rem; text-transform: uppercase; }
.year-end-table tbody tr { cursor: pointer; transition: background 0.16s ease; }
.year-end-table tbody tr:nth-child(even) { background: #fbfdff; }
.year-end-table tbody tr:hover { background: #f0fbff; }
.year-end-table tbody tr.selected { background: #ecfdf5; }
.preview-table-wrap {
  width: 100%;
  overflow-x: auto;
  border: 1px solid #edf2f7;
  border-radius: 0.9rem;
  background: #fff;
}
.preview-table {
  min-width: 700px;
  table-layout: fixed;
}
.preview-table th,
.preview-table td {
  vertical-align: top;
  padding-top: 0.95rem;
  padding-bottom: 0.95rem;
}
.preview-table th:first-child,
.preview-table td:first-child {
  width: 24%;
}
.preview-table th:nth-child(2),
.preview-table td:nth-child(2),
.preview-table th:nth-child(3),
.preview-table td:nth-child(3) {
  width: 38%;
}
.preview-table thead th {
  color: #8392ab;
  font-size: 0.72rem;
  text-transform: uppercase;
}
.preview-table tbody tr:nth-child(even) {
  background: #fbfdff;
}
.preview-student-cell strong {
  display: inline-block;
  color: #1f2a44;
  line-height: 1.45;
}
.student-cell {
  display: grid;
  grid-template-columns: 2.15rem minmax(0, 1fr);
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
}
.student-cell strong {
  min-width: 0;
  overflow: hidden;
  color: #1f2a44;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.student-avatar {
  display: inline-flex;
  width: 2.15rem;
  height: 2.15rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #dff7f1;
  color: #047b6e;
  font-size: 0.78rem;
  font-weight: 800;
}
.action-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.85rem; }
.action-tile { text-align: left; padding: 1rem; border: 1px solid #e9eef7; border-radius: 1rem; background: #fff; transition: all 0.2s ease; }
.action-tile i { color: #0f9f8f; font-size: 1.4rem; }
.action-tile strong, .action-tile span { display: block; }
.action-tile strong { color: #1f2a44; font-weight: 800; }
.action-tile span { color: #67748e; font-size: 0.84rem; }
.action-tile.active { border-color: #8ddfd0; background: #f0fffb; box-shadow: 0 1rem 1.7rem -1.5rem rgba(15, 159, 143, 0.4); }
.action-tile.active strong { color: #0f5f53; }
.action-tile.active span { color: #176c45; }
.preview-summary, .badge-stack { display: flex; flex-wrap: wrap; gap: 0.45rem; }
.soft-badge { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.35rem 0.55rem; border-radius: 999px; font-size: 0.75rem; font-weight: 800; }
.soft-badge.info { background: #e8f7ff; color: #1177a8; }
.soft-badge.success { background: #e9fbf2; color: #15905f; }
.soft-badge.warning { background: #fff7e6; color: #b7791f; }
.soft-badge.danger { background: #fff0f0; color: #c24141; }
.compare { display: grid; gap: 0.15rem; padding: 0.7rem; border-radius: 0.8rem; }
.compare.old { background: #f6f7fb; color: #64748b; }
.compare.new { background: #eefbf3; color: #176c45; }
.preview-badges {
  margin-top: 0.55rem;
}
.job-box { padding: 1rem; border-radius: 0.9rem; background: #f8fafc; }
.wizard-actions { display: flex; justify-content: flex-end; gap: 0.65rem; margin-top: 1rem; }
.confirm-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1050;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(4px);
}
.confirm-modal-card {
  width: min(100%, 42rem);
  display: grid;
  gap: 0.85rem;
  padding: 1rem 1rem 0.95rem;
  border-radius: 0.9rem;
  background: #fff;
  box-shadow: 0 1.5rem 3rem -1.8rem rgba(15, 23, 42, 0.45);
}
.confirm-modal-header h5 {
  margin: 0;
  color: #1f2a44;
  font-size: 1rem;
  font-weight: 800;
}
.confirm-modal-header p {
  margin: 0.2rem 0 0;
  color: #67748e;
  font-size: 0.88rem;
}
.confirm-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.65rem;
}
@media (max-width: 991.98px) {
  .filter-grid, .config-grid, .action-grid { grid-template-columns: 1fr; }
  .wizard-line { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 575.98px) {
  .year-end-hero { flex-direction: column; }
  .wizard-line { grid-template-columns: 1fr; }
  .year-end-card { padding: 0.75rem; }
  .year-end-table { min-width: 660px; }
  .preview-table { min-width: 620px; }
  .confirm-modal-card {
    padding: 0.85rem;
  }
  .confirm-modal-actions {
    flex-direction: column-reverse;
  }
}
</style>
