<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { api } from '../api/client.js'
import ArgonInput from '@/components/ArgonInput.vue'
import ArgonButton from '@/components/ArgonButton.vue'
import ArgonAlert from '@/components/ArgonAlert.vue'
import AppDateField from '@/components/AppDateField.vue'
import defaultAvatarMale from '@/assets/img/logos/betrai.png'
import defaultAvatarFemale from '@/assets/img/logos/begai.png'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Đang học' },
  { value: 'inactive', label: 'Nghỉ học' },
  { value: 'graduated', label: 'Tốt nghiệp' },
  { value: 'leave', label: 'Tạm nghỉ' },
]

const GENDER_OPTIONS = [
  { value: 'male', label: 'Bé trai' },
  { value: 'female', label: 'Bé gái' },
]

const items = ref([])
const classOptions = ref([])
const loading = ref(false)
const filterStatuses = ref([])
const filterClassId = ref(null)

const filteredItems = computed(() => {
  let list = items.value
  if (filterStatuses.value.length) {
    list = list.filter((s) => filterStatuses.value.includes(s.status || 'active'))
  }
  if (filterClassId.value != null) {
    list = list.filter((s) => s.classId === filterClassId.value)
  }
  return list
})

const PAGE_SIZE = 10
const currentPage = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(filteredItems.value.length / PAGE_SIZE)))
const paginationBarClass = 'tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-2 tw-border-t tw-border-[#f1f3f5] tw-px-4 tw-py-3'
const paginationInfoClass = 'tw-text-[0.78rem] tw-text-[#8392ab]'
const paginationControlsClass = 'tw-flex tw-items-center tw-gap-1'
const pageBtnClass = 'tw-inline-flex tw-h-8 tw-min-w-8 tw-cursor-pointer tw-items-center tw-justify-center tw-rounded-md tw-border tw-border-[#e9ecef] tw-bg-white tw-px-[0.4rem] tw-text-[0.8rem] tw-font-medium tw-leading-none tw-text-[#344767] tw-transition-all tw-duration-150 enabled:hover:tw-border-[#d2d6da] enabled:hover:tw-bg-[#f0f2f5] disabled:tw-cursor-default disabled:tw-opacity-[0.38]'
const activePageBtnClass = 'tw-border-transparent tw-bg-[linear-gradient(310deg,#5e72e4,#825ee4)] tw-font-semibold tw-text-white'
const pageEllipsisClass = 'tw-inline-flex tw-h-8 tw-min-w-6 tw-items-center tw-justify-center tw-text-[0.85rem] tw-text-[#8392ab]'
const studentsLayoutClass = 'tw-flex tw-min-h-0 tw-flex-1 tw-gap-4 max-[900px]:tw-flex-col'
const filterSidebarClass = 'tw-flex tw-w-[200px] tw-shrink-0 tw-flex-col tw-gap-4 tw-overflow-y-auto tw-rounded-xl tw-bg-white tw-p-4 tw-shadow-[0_1px_4px_rgba(0,0,0,0.06)] max-[900px]:tw-w-full max-[900px]:tw-flex-row max-[900px]:tw-flex-wrap'
const filterSectionClass = 'tw-flex tw-flex-col tw-gap-[0.35rem] max-[900px]:tw-min-w-[140px] max-[900px]:tw-flex-1'
const filterClassItemClass = 'tw-cursor-pointer tw-rounded-[0.4rem] tw-px-[0.6rem] tw-py-[0.4rem] tw-text-[0.8rem] tw-font-medium tw-text-[#344767] tw-transition-all tw-duration-150 hover:tw-bg-[#f0f2f5]'
const activeFilterClassItemClass = 'tw-bg-[linear-gradient(310deg,#5e72e4,#825ee4)] tw-font-semibold tw-text-white hover:tw-bg-[linear-gradient(310deg,#5e72e4,#825ee4)]'
const pagedItems = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredItems.value.slice(start, start + PAGE_SIZE)
})

watch(filteredItems, () => { currentPage.value = 1 })

function goToPage(page) {
  currentPage.value = Math.max(1, Math.min(page, totalPages.value))
}
const loadErr = ref('')
const formErr = ref('')
const editingId = ref(null)
const saving = ref(false)
const drawerOpen = ref(false)
const avatarFileInput = ref(null)
const uploadingAvatar = ref(false)
const avatarUploadErr = ref('')

const classHistory = ref([])
const classHistoryLoading = ref(false)
/** Class id when edit modal opened (`''` = none), used to detect promotion / class change. */
const initialClassIdSnapshot = ref('')
const classChangeEffectiveDate = ref('')
const classChangeNote = ref('')

const detailTab = ref('info')
const viewingStudent = ref(null)

const form = ref({
  name: '',
  classId: '',
  grade: '',
  email: '',
  dateOfBirth: '',
  avatar: '',
  joinDate: '',
  status: 'active',
  gender: 'male',
  phone: '',
  nationality: '',
  religion: '',
  province: '',
  ward: '',
  hamlet: '',
  birthPlace: '',
  fatherBirthYear: '',
  motherBirthYear: '',
  fatherName: '',
  fatherBirthDate: '',
  fatherPhone: '',
  fatherEmail: '',
  fatherLogin: '',
  fatherIdNumber: '',
  fatherOccupation: '',
  motherName: '',
  motherBirthDate: '',
  motherPhone: '',
  motherEmail: '',
  motherLogin: '',
  motherIdNumber: '',
  motherOccupation: '',
  idNumber: '',
  idIssuedPlace: '',
  idIssuedDate: '',
  area: '',
  disabilityType: '',
  policyBeneficiary: '',
  eyeDisease: '',
  guardianName: '',
  guardianOccupation: '',
  guardianBirthYear: '',
})

function todayISODate() {
  return new Date().toISOString().slice(0, 10)
}

const classIsChanging = computed(() => {
  if (!editingId.value) return false
  const cur = form.value.classId === '' ? '' : String(form.value.classId)
  const snap = initialClassIdSnapshot.value === '' ? '' : String(initialClassIdSnapshot.value)
  return cur !== snap
})

function closeDrawer() {
  drawerOpen.value = false
  resetAll()
}

function resetAll() {
  resetForm()
  formErr.value = ''
  avatarUploadErr.value = ''
  saving.value = false
  classHistory.value = []
  classHistoryLoading.value = false
  initialClassIdSnapshot.value = ''
  classChangeEffectiveDate.value = ''
  classChangeNote.value = ''
  if (avatarFileInput.value) avatarFileInput.value.value = ''
  detailTab.value = 'info'
  viewingStudent.value = null
  attRecords.value = []
}

const EXTRA_FIELDS_DEFAULTS = {
  phone: '', nationality: '', religion: '', province: '', ward: '', hamlet: '',
  birthPlace: '', fatherBirthYear: '', motherBirthYear: '',
  fatherName: '', fatherBirthDate: '', fatherPhone: '', fatherEmail: '',
  fatherLogin: '', fatherIdNumber: '', fatherOccupation: '',
  motherName: '', motherBirthDate: '', motherPhone: '', motherEmail: '',
  motherLogin: '', motherIdNumber: '', motherOccupation: '',
  idNumber: '', idIssuedPlace: '', idIssuedDate: '', area: '',
  disabilityType: '', policyBeneficiary: '', eyeDisease: '',
  guardianName: '', guardianOccupation: '', guardianBirthYear: '',
}

function resetForm() {
  editingId.value = null
  form.value = {
    name: '', classId: '', grade: '', email: '', dateOfBirth: '',
    avatar: '', joinDate: '', status: 'active', gender: 'male',
    ...EXTRA_FIELDS_DEFAULTS,
  }
}

function openCreate() {
  resetAll()
  classChangeEffectiveDate.value = todayISODate()
  drawerOpen.value = true
}

function openStudentDetail(row) {
  resetAll()
  editingId.value = row.id
  viewingStudent.value = row
  form.value = {
    name: row.name,
    classId: row.classId != null ? String(row.classId) : '',
    grade: row.grade || '',
    email: row.email || '',
    dateOfBirth: row.dateOfBirth || '',
    avatar: row.avatar || '',
    joinDate: row.joinDate || '',
    status: row.status || 'active',
    gender: row.gender === 'female' ? 'female' : 'male',
    phone: row.phone || '',
    nationality: row.nationality || '',
    religion: row.religion || '',
    province: row.province || '',
    ward: row.ward || '',
    hamlet: row.hamlet || '',
    birthPlace: row.birthPlace || '',
    fatherBirthYear: row.fatherBirthYear || '',
    motherBirthYear: row.motherBirthYear || '',
    fatherName: row.fatherName || '',
    fatherBirthDate: row.fatherBirthDate || '',
    fatherPhone: row.fatherPhone || '',
    fatherEmail: row.fatherEmail || '',
    fatherLogin: row.fatherLogin || '',
    fatherIdNumber: row.fatherIdNumber || '',
    fatherOccupation: row.fatherOccupation || '',
    motherName: row.motherName || '',
    motherBirthDate: row.motherBirthDate || '',
    motherPhone: row.motherPhone || '',
    motherEmail: row.motherEmail || '',
    motherLogin: row.motherLogin || '',
    motherIdNumber: row.motherIdNumber || '',
    motherOccupation: row.motherOccupation || '',
    idNumber: row.idNumber || '',
    idIssuedPlace: row.idIssuedPlace || '',
    idIssuedDate: row.idIssuedDate || '',
    area: row.area || '',
    disabilityType: row.disabilityType || '',
    policyBeneficiary: row.policyBeneficiary || '',
    eyeDisease: row.eyeDisease || '',
    guardianName: row.guardianName || '',
    guardianOccupation: row.guardianOccupation || '',
    guardianBirthYear: row.guardianBirthYear || '',
  }
  initialClassIdSnapshot.value =
    form.value.classId === '' ? '' : String(form.value.classId)
  classChangeEffectiveDate.value = todayISODate()
  const now = new Date()
  attYear.value = now.getFullYear()
  attMonth.value = now.getMonth()
  loadClassHistory(row.id)
  drawerOpen.value = true
}

function switchDetailTab(tab) {
  detailTab.value = tab
  if (tab === 'attendance' && viewingStudent.value && !attRecords.value.length) {
    loadAttMonth()
  }
  if (tab === 'history' && viewingStudent.value && !classHistory.value.length && !classHistoryLoading.value) {
    loadClassHistory(viewingStudent.value.id)
  }
}

async function loadClassHistory(studentId) {
  classHistoryLoading.value = true
  classHistory.value = []
  try {
    const { data } = await api.get(`/students/${studentId}/class-history`)
    classHistory.value = Array.isArray(data) ? data : []
  } catch {
    classHistory.value = []
  } finally {
    classHistoryLoading.value = false
  }
}

function resolveAvatarUrl(avatar) {
  if (!avatar || typeof avatar !== 'string') return ''
  return avatar.trim()
}

function defaultAvatarSrc(gender) {
  return String(gender) === 'female' ? defaultAvatarFemale : defaultAvatarMale
}

/** Custom photo URL if set; otherwise default boy/girl artwork from assets. */
function studentAvatarSrc(row) {
  const custom = resolveAvatarUrl(row.avatar)
  if (custom) return custom
  return defaultAvatarSrc(row.gender)
}

function formAvatarSrc() {
  const custom = resolveAvatarUrl(form.value.avatar)
  if (custom) return custom
  return defaultAvatarSrc(form.value.gender)
}

function onStudentImgError(ev, row) {
  const el = ev?.target
  if (!el || el.dataset.fallbackApplied) return
  el.dataset.fallbackApplied = '1'
  el.src = defaultAvatarSrc(row.gender)
}

function onFormAvatarImgError(ev) {
  const el = ev?.target
  if (!el || el.dataset.fallbackApplied) return
  el.dataset.fallbackApplied = '1'
  el.src = defaultAvatarSrc(form.value.gender)
}

async function onAvatarFile(ev) {
  const file = ev.target?.files?.[0]
  if (!file) return
  avatarUploadErr.value = ''
  uploadingAvatar.value = true
  try {
    const fd = new FormData()
    fd.append('image', file)
    const { data } = await api.post('/upload/avatar', fd)
    if (data?.url) form.value.avatar = data.url
  } catch (e) {
    avatarUploadErr.value = e.response?.data?.error || e.message || 'Upload failed'
  } finally {
    uploadingAvatar.value = false
    if (avatarFileInput.value) avatarFileInput.value.value = ''
  }
}

function clearAvatar() {
  form.value.avatar = ''
  avatarUploadErr.value = ''
  if (avatarFileInput.value) avatarFileInput.value.value = ''
}

function statusBadgeClass(status) {
  const s = String(status || 'active').toLowerCase()
  if (s === 'active') return 'bg-gradient-success'
  if (s === 'inactive') return 'bg-gradient-secondary'
  if (s === 'graduated') return 'bg-gradient-info'
  return 'bg-gradient-warning'
}

function statusLabel(status) {
  const s = String(status || 'active').toLowerCase()
  const found = STATUS_OPTIONS.find((o) => o.value === s)
  return found ? found.label : status
}

async function loadClasses() {
  try {
    const { data } = await api.get('/classes')
    classOptions.value = data
  } catch {
    classOptions.value = []
  }
}

async function load() {
  loading.value = true
  loadErr.value = ''
  try {
    const { data } = await api.get('/students')
    items.value = data
  } catch (e) {
    loadErr.value = e.response?.data?.error || e.message || 'Failed to load students'
  } finally {
    loading.value = false
  }
}

async function save() {
  formErr.value = ''
  if (!form.value.name?.trim()) {
    formErr.value = 'Name is required'
    return
  }
  saving.value = true
  try {
    const payload = {
      name: form.value.name.trim(),
      grade: form.value.grade,
      email: form.value.email,
      dateOfBirth: form.value.dateOfBirth,
      classId: form.value.classId === '' ? null : Number(form.value.classId),
      avatar: form.value.avatar,
      joinDate: form.value.joinDate,
      status: form.value.status,
      gender: form.value.gender,
      phone: form.value.phone,
      nationality: form.value.nationality,
      religion: form.value.religion,
      province: form.value.province,
      ward: form.value.ward,
      hamlet: form.value.hamlet,
      birthPlace: form.value.birthPlace,
      fatherBirthYear: form.value.fatherBirthYear,
      motherBirthYear: form.value.motherBirthYear,
      fatherName: form.value.fatherName,
      fatherBirthDate: form.value.fatherBirthDate,
      fatherPhone: form.value.fatherPhone,
      fatherEmail: form.value.fatherEmail,
      fatherLogin: form.value.fatherLogin,
      fatherIdNumber: form.value.fatherIdNumber,
      fatherOccupation: form.value.fatherOccupation,
      motherName: form.value.motherName,
      motherBirthDate: form.value.motherBirthDate,
      motherPhone: form.value.motherPhone,
      motherEmail: form.value.motherEmail,
      motherLogin: form.value.motherLogin,
      motherIdNumber: form.value.motherIdNumber,
      motherOccupation: form.value.motherOccupation,
      idNumber: form.value.idNumber,
      idIssuedPlace: form.value.idIssuedPlace,
      idIssuedDate: form.value.idIssuedDate,
      area: form.value.area,
      disabilityType: form.value.disabilityType,
      policyBeneficiary: form.value.policyBeneficiary,
      eyeDisease: form.value.eyeDisease,
      guardianName: form.value.guardianName,
      guardianOccupation: form.value.guardianOccupation,
      guardianBirthYear: form.value.guardianBirthYear,
    }
    if (editingId.value) {
      if (classIsChanging.value) {
        payload.classChangeEffectiveDate = classChangeEffectiveDate.value || undefined
        payload.classChangeNote = classChangeNote.value
      }
      await api.put(`/students/${editingId.value}`, payload)
    } else {
      await api.post('/students', payload)
    }
    closeDrawer()
    await load()
  } catch (e) {
    formErr.value = e.response?.data?.error || e.message || 'Save failed'
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!editingId.value) return
  const name = form.value.name || 'this student'
  if (!confirm(`Delete student "${name}"?`)) return
  try {
    await api.delete(`/students/${editingId.value}`)
    closeDrawer()
    await load()
  } catch (e) {
    formErr.value = e.response?.data?.error || e.message || 'Delete failed'
  }
}

// ---- Attendance calendar ----
const attYear = ref(new Date().getFullYear())
const attMonth = ref(new Date().getMonth())
const attRecords = ref([])
const attLoading = ref(false)

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

async function loadAttMonth() {
  if (!viewingStudent.value) return
  attLoading.value = true
  try {
    const y = attYear.value
    const m = attMonth.value
    const from = `${y}-${String(m + 1).padStart(2, '0')}-01`
    const lastDay = new Date(y, m + 1, 0).getDate()
    const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    const { data } = await api.get(`/attendance/students/student/${viewingStudent.value.id}`, {
      params: { from, to },
    })
    attRecords.value = Array.isArray(data) ? data : []
  } catch {
    attRecords.value = []
  } finally {
    attLoading.value = false
  }
}

function attPrevMonth() {
  if (attMonth.value === 0) {
    attMonth.value = 11
    attYear.value--
  } else {
    attMonth.value--
  }
  loadAttMonth()
}

function attNextMonth() {
  if (attMonth.value === 11) {
    attMonth.value = 0
    attYear.value++
  } else {
    attMonth.value++
  }
  loadAttMonth()
}

const attStatusMap = computed(() => {
  const map = {}
  for (const r of attRecords.value) {
    const key = r.attendanceDate
    if (!map[key]) map[key] = r
  }
  return map
})

const calendarWeeks = computed(() => {
  const y = attYear.value
  const m = attMonth.value
  const firstOfMonth = new Date(y, m, 1)
  const lastOfMonth = new Date(y, m + 1, 0)
  const totalDays = lastOfMonth.getDate()

  let startDow = firstOfMonth.getDay()
  if (startDow === 0) startDow = 7

  const todayStr = new Date().toISOString().slice(0, 10)
  const cells = []

  for (let i = 1; i < startDow; i++) {
    cells.push({ dayNum: 0, date: '', status: null, note: '', isCurrentMonth: false, isToday: false })
  }

  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const rec = attStatusMap.value[dateStr]
    cells.push({
      dayNum: d,
      date: dateStr,
      status: rec ? rec.status : null,
      note: rec ? rec.note || '' : '',
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
    })
  }

  while (cells.length % 7 !== 0) {
    cells.push({ dayNum: 0, date: '', status: null, note: '', isCurrentMonth: false, isToday: false })
  }

  const weeks = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }
  return weeks
})

const attSummary = computed(() => {
  const counts = { present: 0, absent: 0, late: 0, excused: 0, total: 0 }
  for (const r of attRecords.value) {
    counts.total++
    if (counts[r.status] !== undefined) counts[r.status]++
  }
  return counts
})

function attDayClass(cell) {
  if (!cell.isCurrentMonth) return 'att-day att-day--outside'
  if (!cell.status) return 'att-day att-day--none'
  return `att-day att-day--${cell.status}`
}

function attDayTooltip(cell) {
  if (!cell.isCurrentMonth) return ''
  if (!cell.status) return 'No record'
  let tip = cell.status.charAt(0).toUpperCase() + cell.status.slice(1)
  if (cell.note) tip += `: ${cell.note}`
  return tip
}

function onKeydown(e) {
  if (e.key === 'Escape' && drawerOpen.value) closeDrawer()
}

onMounted(() => {
  loadClasses()
  load()
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
})

defineExpose({ load })
</script>

<template>
  <div class="py-4 container-fluid page-fill">
    <div :class="studentsLayoutClass">
      <!-- LEFT FILTER SIDEBAR -->
      <div :class="filterSidebarClass">
        <h6 class="tw-m-0 tw-text-[0.85rem] tw-font-bold tw-text-[#344767]">Bộ lọc</h6>

        <div :class="filterSectionClass">
          <span class="tw-mb-[0.15rem] tw-text-[0.7rem] tw-font-bold tw-uppercase tw-tracking-[0.04em] tw-text-[#8392ab]">Trạng thái</span>
          <label
            v-for="opt in STATUS_OPTIONS"
            :key="opt.value"
            class="tw-flex tw-cursor-pointer tw-items-center tw-gap-[0.4rem] tw-py-[0.2rem] tw-text-[0.8rem] tw-text-[#344767] [&_input]:tw-h-[14px] [&_input]:tw-w-[14px] [&_input]:tw-cursor-pointer [&_input]:tw-accent-[#5e72e4]"
          >
            <input
              type="checkbox"
              v-model="filterStatuses"
              :value="opt.value"
            />
            <span class="badge badge-sm text-white" :class="statusBadgeClass(opt.value)">
              {{ opt.label }}
            </span>
          </label>
        </div>

        <div :class="filterSectionClass">
          <span class="tw-mb-[0.15rem] tw-text-[0.7rem] tw-font-bold tw-uppercase tw-tracking-[0.04em] tw-text-[#8392ab]">Lớp</span>
          <div
            :class="[filterClassItemClass, filterClassId == null ? activeFilterClassItemClass : '']"
            @click="filterClassId = null"
          >
            <i class="ni ni-books me-1"></i> Tất cả
          </div>
          <div
            v-for="c in classOptions"
            :key="c.id"
            :class="[filterClassItemClass, filterClassId === c.id ? activeFilterClassItemClass : '']"
            @click="filterClassId = c.id"
          >
            {{ c.name }}
          </div>
        </div>
      </div>

      <!-- STUDENT TABLE CARD -->
      <div class="card tw-min-w-0 tw-flex-1">
        <div class="card-header d-flex flex-wrap align-items-center gap-2 pb-0">
          <div class="flex-grow-1">
            <h6>Danh sách học sinh</h6>
            <p class="mb-2 text-sm text-secondary">Quản lý hồ sơ học sinh</p>
          </div>
          <argon-button color="primary" variant="gradient" type="button" @click="openCreate">
            Thêm học sinh
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
                    <th scope="col">Học sinh</th>
                    <th scope="col">Lớp</th>
                    <th scope="col">Ghi chú</th>
                    <th scope="col">Email</th>
                    <th scope="col">Ngày sinh</th>
                    <th scope="col">Ngày nhập học</th>
                    <th scope="col">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="s in pagedItems" :key="s.id" class="cursor-pointer" @click="openStudentDetail(s)">
                    <td>
                      <div class="d-flex px-2 py-1 align-items-center">
                        <img
                          :key="`${s.id}-${s.avatar}-${s.gender}`"
                          :src="studentAvatarSrc(s)"
                          class="avatar student-avatar-table me-3 rounded-circle object-fit-cover bg-light"
                          width="54"
                          height="54"
                          alt=""
                          referrerpolicy="no-referrer"
                          @error="onStudentImgError($event, s)"
                        />
                        <div class="d-flex flex-column justify-content-center">
                          <h6 class="mb-0 text-sm panel-primary-text">{{ s.name }}</h6>
                        </div>
                      </div>
                    </td>
                    <td>
                      <p class="mb-0 text-xs font-weight-bold">{{ s.className || '—' }}</p>
                    </td>
                    <td>
                      <p class="mb-0 text-xs text-secondary">{{ s.grade || '—' }}</p>
                    </td>
                    <td>
                      <p class="mb-0 text-xs text-secondary">{{ s.email || '—' }}</p>
                    </td>
                    <td>
                      <p class="mb-0 text-xs text-secondary">{{ s.dateOfBirth || '—' }}</p>
                    </td>
                    <td>
                      <p class="mb-0 text-xs text-secondary">{{ s.joinDate || '—' }}</p>
                    </td>
                    <td class="align-middle text-sm">
                      <span class="badge badge-sm text-white" :class="statusBadgeClass(s.status)">
                        {{ statusLabel(s.status) }}
                      </span>
                    </td>
                  </tr>
                  <tr v-if="!filteredItems.length" class="panel-table-empty">
                    <td colspan="7">{{ items.length ? 'Không có học sinh phù hợp bộ lọc.' : 'Chưa có học sinh nào.' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <!-- Pagination -->
            <div v-if="filteredItems.length > PAGE_SIZE" :class="paginationBarClass">
              <span :class="paginationInfoClass">
                {{ (currentPage - 1) * PAGE_SIZE + 1 }}–{{ Math.min(currentPage * PAGE_SIZE, filteredItems.length) }} / {{ filteredItems.length }}
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

    <!-- Drawer backdrop -->
    <Transition name="drawer-backdrop">
      <div v-if="drawerOpen" class="drawer-backdrop" @click="closeDrawer"></div>
    </Transition>

    <!-- Right sidebar drawer -->
    <Transition name="drawer-slide">
      <aside v-if="drawerOpen" class="drawer-panel">
        <div class="drawer-header">
          <h5 class="drawer-title mb-0">{{ editingId ? form.name || 'Học sinh' : 'Thêm học sinh' }}</h5>
          <button type="button" class="btn-close" aria-label="Close" @click="closeDrawer"></button>
        </div>

        <!-- Tabs (only when editing) -->
        <ul v-if="editingId" class="drawer-tabs nav nav-tabs px-3 mb-0" role="tablist">
          <li class="nav-item" role="presentation">
            <button
              class="nav-link"
              :class="{ active: detailTab === 'info' }"
              type="button"
              @click="switchDetailTab('info')"
            >
              <i class="ni ni-single-02 me-1"></i> Thông tin
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button
              class="nav-link"
              :class="{ active: detailTab === 'history' }"
              type="button"
              @click="switchDetailTab('history')"
            >
              <i class="ni ni-bullet-list-67 me-1"></i> Lịch sử lớp
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button
              class="nav-link"
              :class="{ active: detailTab === 'attendance' }"
              type="button"
              @click="switchDetailTab('attendance')"
            >
              <i class="ni ni-calendar-grid-61 me-1"></i> Điểm danh
            </button>
          </li>
        </ul>

        <!-- ====== INFO TAB ====== -->
        <form v-show="detailTab === 'info'" class="drawer-body-form" @submit.prevent="save">
          <div class="drawer-body">
            <argon-alert v-if="formErr && detailTab === 'info'" color="danger" icon="ni ni-fat-remove">
              {{ formErr }}
            </argon-alert>
            <p class="text-sm text-uppercase text-muted">Thông tin học sinh</p>
            <div class="row">
              <div class="col-12">
                <label for="student-name" class="form-control-label">Họ tên *</label>
                <argon-input
                  id="student-name"
                  v-model="form.name"
                  placeholder="Họ và tên"
                  name="name"
                  autocomplete="name"
                />
              </div>
              <div class="col-12">
                <label for="student-class" class="form-control-label">Lớp</label>
                <select id="student-class" v-model="form.classId" class="form-control">
                  <option value="">— Chưa chọn —</option>
                  <option v-for="c in classOptions" :key="c.id" :value="String(c.id)">
                    {{ c.name }}
                  </option>
                </select>
                <p v-if="editingId" class="mt-1 mb-0 text-xs text-secondary">
                  Thay đổi lớp sẽ ghi lại lịch sử chuyển lớp khi cập nhật.
                </p>
              </div>
              <div v-if="editingId && classIsChanging" class="col-12">
                <div class="p-3 border border-radius-lg bg-light">
                  <p class="mb-2 text-sm font-weight-bold text-dark">Chuyển lớp / lên lớp</p>
                  <div class="row">
                    <div class="col-12">
                      <label for="class-change-date" class="form-control-label">Ngày hiệu lực</label>
                      <app-date-field
                        id="class-change-date"
                        v-model="classChangeEffectiveDate"
                        name="classChangeEffectiveDate"
                      />
                    </div>
                    <div class="col-12">
                      <label for="class-change-note" class="form-control-label">Ghi chú (tùy chọn)</label>
                      <textarea
                        id="class-change-note"
                        v-model="classChangeNote"
                        class="form-control"
                        rows="2"
                        placeholder="VD: Lên lớp sau khi hoàn thành Chồi (2024–2025)"
                        :disabled="saving"
                      ></textarea>
                    </div>
                  </div>
                </div>
              </div>
              <div class="col-12">
                <label for="student-gender" class="form-control-label">Giới tính</label>
                <select id="student-gender" v-model="form.gender" class="form-control">
                  <option v-for="g in GENDER_OPTIONS" :key="g.value" :value="g.value">
                    {{ g.label }}
                  </option>
                </select>
              </div>
              <div class="col-12">
                <label class="form-control-label d-block">Ảnh đại diện</label>
                <div class="d-flex flex-wrap align-items-start gap-3 mb-2">
                  <div class="border border-radius-lg overflow-hidden bg-light rounded-circle student-avatar-preview">
                    <img
                      :key="`${form.avatar}-${form.gender}`"
                      :src="formAvatarSrc()"
                      alt=""
                      class="w-100 h-100 object-fit-cover"
                      referrerpolicy="no-referrer"
                      @error="onFormAvatarImgError"
                    />
                  </div>
                  <div class="flex-grow-1" style="min-width: 160px">
                    <input
                      id="student-avatar-file"
                      ref="avatarFileInput"
                      type="file"
                      class="form-control form-control-sm"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      :disabled="uploadingAvatar || saving"
                      @change="onAvatarFile"
                    />
                    <p class="mt-1 mb-0 text-xs text-secondary">Tối đa 2 MB. Hoặc dán URL bên dưới.</p>
                    <p v-if="uploadingAvatar" class="mt-1 mb-0 text-xs text-info">Đang tải lên…</p>
                    <p v-if="avatarUploadErr" class="mt-1 mb-0 text-xs text-danger">{{ avatarUploadErr }}</p>
                  </div>
                </div>
                <argon-input
                  id="student-avatar"
                  v-model="form.avatar"
                  type="url"
                  placeholder="Hoặc nhập URL ảnh (https://…)"
                  name="avatar"
                  autocomplete="off"
                />
                <button
                  v-if="resolveAvatarUrl(form.avatar)"
                  type="button"
                  class="btn btn-link btn-sm text-secondary px-0 mt-1"
                  :disabled="saving"
                  @click="clearAvatar"
                >
                  Xóa ảnh
                </button>
              </div>
              <div class="col-12">
                <label for="student-grade" class="form-control-label">Ghi chú</label>
                <argon-input id="student-grade" v-model="form.grade" placeholder="Ghi chú ngắn (tùy chọn)" name="grade" />
              </div>
              <div class="col-12">
                <label for="student-email" class="form-control-label">Email</label>
                <argon-input id="student-email" v-model="form.email" type="email" placeholder="email@example.com" name="email" autocomplete="email" />
              </div>
              <div class="col-6">
                <label for="student-dob" class="form-control-label">Ngày sinh</label>
                <app-date-field id="student-dob" v-model="form.dateOfBirth" name="dateOfBirth" />
              </div>
              <div class="col-6">
                <label for="student-join" class="form-control-label">Ngày nhập học</label>
                <app-date-field id="student-join" v-model="form.joinDate" name="joinDate" />
              </div>
              <div class="col-12">
                <label for="student-status" class="form-control-label">Trạng thái</label>
                <select id="student-status" v-model="form.status" class="form-control">
                  <option v-for="o in STATUS_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
                </select>
              </div>
              <div class="col-12">
                <label for="student-phone" class="form-control-label">Số điện thoại</label>
                <argon-input id="student-phone" v-model="form.phone" type="tel" placeholder="Số điện thoại" name="phone" />
              </div>
            </div>

            <!-- CSDLQG Section -->
            <p class="text-sm text-uppercase text-muted mt-3">Thông tin phục vụ CSDLQG ngành Giáo dục</p>
            <div class="row">
              <div class="col-6">
                <label for="student-nationality" class="form-control-label">Quốc tịch</label>
                <argon-input id="student-nationality" v-model="form.nationality" placeholder="VD: Việt Nam" name="nationality" />
              </div>
              <div class="col-6">
                <label for="student-religion" class="form-control-label">Tôn giáo</label>
                <argon-input id="student-religion" v-model="form.religion" placeholder="VD: Không, Phật giáo…" name="religion" />
              </div>
              <div class="col-12">
                <label for="student-birthplace" class="form-control-label">Nơi sinh</label>
                <argon-input id="student-birthplace" v-model="form.birthPlace" placeholder="Nơi sinh" name="birthPlace" />
              </div>
              <div class="col-12">
                <label class="form-control-label">Quê quán</label>
              </div>
              <div class="col-6">
                <label for="student-province" class="form-control-label text-xs">Tỉnh/Thành phố</label>
                <argon-input id="student-province" v-model="form.province" placeholder="Tỉnh/Thành phố" name="province" />
              </div>
              <div class="col-6">
                <label for="student-ward" class="form-control-label text-xs">Xã/Phường</label>
                <argon-input id="student-ward" v-model="form.ward" placeholder="Xã/Phường" name="ward" />
              </div>
              <div class="col-12">
                <label for="student-hamlet" class="form-control-label text-xs">Tổ/Thôn/Xóm</label>
                <argon-input id="student-hamlet" v-model="form.hamlet" placeholder="Tổ/Thôn/Xóm" name="hamlet" />
              </div>
              <div class="col-6">
                <label for="student-father-by" class="form-control-label">Năm sinh bố</label>
                <argon-input id="student-father-by" v-model="form.fatherBirthYear" placeholder="VD: 1985" name="fatherBirthYear" />
              </div>
              <div class="col-6">
                <label for="student-mother-by" class="form-control-label">Năm sinh mẹ</label>
                <argon-input id="student-mother-by" v-model="form.motherBirthYear" placeholder="VD: 1987" name="motherBirthYear" />
              </div>
              <div class="col-12">
                <label for="student-mother-name" class="form-control-label">Họ tên mẹ</label>
                <argon-input id="student-mother-name" v-model="form.motherName" placeholder="Họ tên mẹ" name="motherName" />
              </div>
              <div class="col-6">
                <label for="student-mother-birthdate" class="form-control-label">Ngày sinh mẹ</label>
                <app-date-field id="student-mother-birthdate" v-model="form.motherBirthDate" name="motherBirthDate" />
              </div>
              <div class="col-6">
                <label for="student-mother-phone" class="form-control-label">Số điện thoại mẹ</label>
                <argon-input id="student-mother-phone" v-model="form.motherPhone" type="tel" placeholder="Số điện thoại mẹ" name="motherPhone" />
              </div>
              <div class="col-6">
                <label for="student-mother-login" class="form-control-label">Thông tin đăng nhập mẹ</label>
                <argon-input id="student-mother-login" v-model="form.motherLogin" placeholder="Thông tin đăng nhập mẹ" name="motherLogin" />
              </div>
              <div class="col-6">
                <label for="student-mother-email" class="form-control-label">Email mẹ</label>
                <argon-input id="student-mother-email" v-model="form.motherEmail" type="email" placeholder="Email mẹ" name="motherEmail" />
              </div>
              <div class="col-6">
                <label for="student-mother-id" class="form-control-label">CCCD mẹ</label>
                <argon-input id="student-mother-id" v-model="form.motherIdNumber" placeholder="CCCD mẹ" name="motherIdNumber" />
              </div>
              <div class="col-6">
                <label for="student-mother-occ" class="form-control-label">Nghề nghiệp mẹ</label>
                <argon-input id="student-mother-occ" v-model="form.motherOccupation" placeholder="Nghề nghiệp mẹ" name="motherOccupation" />
              </div>
              <div class="col-12">
                <label for="student-father-name" class="form-control-label">Họ tên bố</label>
                <argon-input id="student-father-name" v-model="form.fatherName" placeholder="Họ tên bố" name="fatherName" />
              </div>
              <div class="col-6">
                <label for="student-father-birthdate" class="form-control-label">Ngày sinh bố</label>
                <app-date-field id="student-father-birthdate" v-model="form.fatherBirthDate" name="fatherBirthDate" />
              </div>
              <div class="col-6">
                <label for="student-father-phone" class="form-control-label">Số điện thoại bố</label>
                <argon-input id="student-father-phone" v-model="form.fatherPhone" type="tel" placeholder="Số điện thoại bố" name="fatherPhone" />
              </div>
              <div class="col-6">
                <label for="student-father-login" class="form-control-label">Thông tin đăng nhập bố</label>
                <argon-input id="student-father-login" v-model="form.fatherLogin" placeholder="Thông tin đăng nhập bố" name="fatherLogin" />
              </div>
              <div class="col-6">
                <label for="student-father-email" class="form-control-label">Email bố</label>
                <argon-input id="student-father-email" v-model="form.fatherEmail" type="email" placeholder="Email bố" name="fatherEmail" />
              </div>
              <div class="col-6">
                <label for="student-father-id" class="form-control-label">CCCD bố</label>
                <argon-input id="student-father-id" v-model="form.fatherIdNumber" placeholder="CCCD bố" name="fatherIdNumber" />
              </div>
              <div class="col-6">
                <label for="student-father-occ" class="form-control-label">Nghề nghiệp bố</label>
                <argon-input id="student-father-occ" v-model="form.fatherOccupation" placeholder="Nghề nghiệp bố" name="fatherOccupation" />
              </div>
              <div class="col-6">
                <label for="student-idnumber" class="form-control-label">Số CMND/TCC</label>
                <argon-input id="student-idnumber" v-model="form.idNumber" placeholder="Số CMND/TCC" name="idNumber" />
              </div>
              <div class="col-6">
                <label for="student-iddate" class="form-control-label">Ngày cấp</label>
                <app-date-field id="student-iddate" v-model="form.idIssuedDate" name="idIssuedDate" />
              </div>
              <div class="col-12">
                <label for="student-idplace" class="form-control-label">Nơi cấp</label>
                <argon-input id="student-idplace" v-model="form.idIssuedPlace" placeholder="Nơi cấp CMND/TCC" name="idIssuedPlace" />
              </div>
              <div class="col-6">
                <label for="student-area" class="form-control-label">Khu vực</label>
                <argon-input id="student-area" v-model="form.area" placeholder="Khu vực" name="area" />
              </div>
              <div class="col-6">
                <label for="student-disability" class="form-control-label">Loại khuyết tật</label>
                <argon-input id="student-disability" v-model="form.disabilityType" placeholder="Không / Loại…" name="disabilityType" />
              </div>
              <div class="col-6">
                <label for="student-policy" class="form-control-label">Đối tượng chính sách</label>
                <argon-input id="student-policy" v-model="form.policyBeneficiary" placeholder="VD: Con liệt sĩ…" name="policyBeneficiary" />
              </div>
              <div class="col-6">
                <label for="student-eyedisease" class="form-control-label">Bệnh về mắt</label>
                <argon-input id="student-eyedisease" v-model="form.eyeDisease" placeholder="Không / Loại…" name="eyeDisease" />
              </div>
            </div>

            <!-- Guardian Section -->
            <p class="text-sm text-uppercase text-muted mt-3">Thông tin người giám hộ</p>
            <div class="row">
              <div class="col-12">
                <label for="student-guardian-name" class="form-control-label">Họ tên người giám hộ</label>
                <argon-input id="student-guardian-name" v-model="form.guardianName" placeholder="Họ tên" name="guardianName" />
              </div>
              <div class="col-6">
                <label for="student-guardian-occ" class="form-control-label">Nghề nghiệp</label>
                <argon-input id="student-guardian-occ" v-model="form.guardianOccupation" placeholder="Nghề nghiệp" name="guardianOccupation" />
              </div>
              <div class="col-6">
                <label for="student-guardian-by" class="form-control-label">Năm sinh</label>
                <argon-input id="student-guardian-by" v-model="form.guardianBirthYear" placeholder="VD: 1980" name="guardianBirthYear" />
              </div>
            </div>
          </div>
          <div class="drawer-footer">
            <argon-button
              v-if="editingId"
              color="danger"
              variant="outline"
              type="button"
              size="sm"
              :disabled="saving"
              class="me-auto"
              @click="remove"
            >
              Xóa
            </argon-button>
            <argon-button color="secondary" variant="outline" size="sm" type="button" :disabled="saving" @click="closeDrawer">
              Hủy
            </argon-button>
            <argon-button color="primary" variant="gradient" size="sm" type="submit" :disabled="saving">
              {{ saving ? 'Đang lưu…' : editingId ? 'Cập nhật' : 'Tạo mới' }}
            </argon-button>
          </div>
        </form>

        <!-- ====== HISTORY TAB ====== -->
        <div v-if="editingId" v-show="detailTab === 'history'" class="drawer-body-form">
          <div class="drawer-body">
            <p class="text-sm text-uppercase text-muted mb-3">Lịch sử lớp</p>
            <p v-if="classHistoryLoading" class="class-history-empty">Đang tải…</p>
            <div v-else-if="!classHistory.length" class="class-history-empty">
              Chưa có lịch sử chuyển lớp. Thay đổi lớp ở tab Thông tin để ghi nhận.
            </div>
            <div v-else class="class-history-card">
              <div class="table-responsive class-history-scroll-full">
                <table class="table table-hover mb-0 class-history-table">
                  <thead>
                    <tr>
                      <th scope="col">Ngày hiệu lực</th>
                      <th scope="col">Từ lớp</th>
                      <th scope="col">Đến lớp</th>
                      <th scope="col">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="h in classHistory" :key="h.id">
                      <td class="class-history-date">{{ h.effectiveDate || '—' }}</td>
                      <td class="class-history-class">{{ h.fromClassName || '—' }}</td>
                      <td class="class-history-class class-history-to">{{ h.toClassName || '—' }}</td>
                      <td class="class-history-note">{{ h.note || '—' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- ====== ATTENDANCE TAB ====== -->
        <div v-if="editingId" v-show="detailTab === 'attendance'" class="drawer-body-form">
          <div class="drawer-body">
            <div class="d-flex align-items-center justify-content-between mb-3">
              <button type="button" class="btn btn-sm btn-outline-secondary mb-0" @click="attPrevMonth">
                <i class="ni ni-bold-left"></i>
              </button>
              <h6 class="mb-0">{{ MONTH_NAMES[attMonth] }} {{ attYear }}</h6>
              <button type="button" class="btn btn-sm btn-outline-secondary mb-0" @click="attNextMonth">
                <i class="ni ni-bold-right"></i>
              </button>
            </div>

            <div v-if="attLoading" class="py-5 text-center text-sm text-secondary">Đang tải…</div>
            <template v-else>
              <div class="att-calendar">
                <div class="att-calendar-header">
                  <div v-for="day in ['T2','T3','T4','T5','T6','T7','CN']" :key="day" class="att-header-cell">
                    {{ day }}
                  </div>
                </div>
                <div v-for="(week, wi) in calendarWeeks" :key="wi" class="att-calendar-row">
                  <div
                    v-for="(cell, ci) in week"
                    :key="ci"
                    :class="attDayClass(cell)"
                    :title="attDayTooltip(cell)"
                  >
                    <span v-if="cell.isCurrentMonth" class="att-day-num" :class="{ 'att-day-today': cell.isToday }">
                      {{ cell.dayNum }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="att-legend mt-3">
                <span class="att-legend-item"><span class="att-legend-dot att-dot--present"></span> Đi học ({{ attSummary.present }})</span>
                <span class="att-legend-item"><span class="att-legend-dot att-dot--absent"></span> Nghỉ ({{ attSummary.absent }})</span>
                <span class="att-legend-item"><span class="att-legend-dot att-dot--late"></span> Trễ ({{ attSummary.late }})</span>
                <span class="att-legend-item"><span class="att-legend-dot att-dot--excused"></span> Có phép ({{ attSummary.excused }})</span>
                <span class="att-legend-item"><span class="att-legend-dot att-dot--none"></span> Chưa ghi nhận</span>
              </div>
            </template>
          </div>
          <div class="drawer-footer">
            <button type="button" class="btn btn-sm btn-secondary mb-0" @click="closeDrawer">Đóng</button>
          </div>
        </div>
      </aside>
    </Transition>
  </div>
</template>

<style scoped>
.object-fit-cover {
  object-fit: cover;
}

.cursor-pointer {
  cursor: pointer;
}

/* ===== Drawer ===== */
.drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1040;
  background: rgba(15, 23, 42, 0.34);
  backdrop-filter: blur(7px);
}

.drawer-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 1045;
  width: min(760px, 100vw);
  max-width: 96vw;
  background:
    linear-gradient(180deg, rgba(248, 250, 252, 0.96) 0%, rgba(255, 255, 255, 0.98) 18%, #ffffff 100%);
  display: flex;
  flex-direction: column;
  border-left: 1px solid rgba(148, 163, 184, 0.2);
  box-shadow: -18px 0 48px rgba(15, 23, 42, 0.18);
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.2rem 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  flex-shrink: 0;
}

.drawer-title {
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: #0f172a;
}

.drawer-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 1.35rem 1.5rem 1.5rem;
  background: linear-gradient(180deg, #f8fafc 0%, #ffffff 18%);
}

.drawer-body-form {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  overflow: hidden;
}

.drawer-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid #e2e8f0;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(10px);
  flex-shrink: 0;
}

.drawer-panel .btn-close {
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  background-color: #eef2ff;
  box-shadow: none;
  opacity: 1;
  transition: transform 0.18s ease, background-color 0.18s ease;
}

.drawer-panel .btn-close:hover {
  transform: rotate(90deg);
  background-color: #e0e7ff;
}

.drawer-tabs {
  gap: 0.45rem;
  padding-top: 0.85rem;
  padding-bottom: 0.85rem;
  border-bottom: 1px solid #e2e8f0;
  background: rgba(255, 255, 255, 0.94);
}

.drawer-tabs .nav-item {
  margin-bottom: 0;
}

.drawer-tabs .nav-link {
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 0.55rem 1rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: #475569;
  background: #f8fafc;
  transition: all 0.18s ease;
}

.drawer-tabs .nav-link:hover {
  border-color: #dbeafe;
  background: #eff6ff;
  color: #1d4ed8;
}

.drawer-tabs .nav-link.active {
  color: #ffffff;
  border-color: transparent;
  background: linear-gradient(135deg, #0f766e, #14b8a6);
  box-shadow: 0 12px 24px rgba(20, 184, 166, 0.22);
}

.drawer-body > .text-sm.text-uppercase.text-muted {
  margin-bottom: 1rem;
  color: #64748b !important;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.drawer-body .row {
  --bs-gutter-x: 1rem;
  --bs-gutter-y: 0.95rem;
}

.drawer-body .form-control-label {
  margin-bottom: 0.45rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #475569;
}

.drawer-body :deep(.form-control),
.drawer-body :deep(.form-select),
.drawer-body select.form-control,
.drawer-body textarea.form-control {
  min-height: 2.9rem;
  border: 1px solid #dbe4f0;
  border-radius: 0.9rem;
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
}

.drawer-body textarea.form-control {
  min-height: 5.5rem;
  padding-top: 0.8rem;
}

.drawer-body :deep(.form-control:focus),
.drawer-body :deep(.form-select:focus),
.drawer-body select.form-control:focus,
.drawer-body textarea.form-control:focus {
  border-color: #38bdf8;
  box-shadow: 0 0 0 0.22rem rgba(56, 189, 248, 0.16);
}

.drawer-body .border.border-radius-lg.bg-light,
.drawer-body .p-3.border.border-radius-lg.bg-light {
  border: 1px solid #dbeafe !important;
  border-radius: 1rem !important;
  background: linear-gradient(180deg, #eff6ff 0%, #f8fbff 100%) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
}

.drawer-body .text-xs.text-secondary,
.drawer-body .text-xs.text-info,
.drawer-body .text-xs.text-danger {
  line-height: 1.5;
}

/* Slide transition */
.drawer-slide-enter-active,
.drawer-slide-leave-active {
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}

.drawer-slide-enter-from,
.drawer-slide-leave-to {
  transform: translateX(100%);
}

/* Backdrop fade */
.drawer-backdrop-enter-active,
.drawer-backdrop-leave-active {
  transition: opacity 0.28s ease;
}

.drawer-backdrop-enter-from,
.drawer-backdrop-leave-to {
  opacity: 0;
}

/* Avatars */
.student-avatar-table {
  width: 54px !important;
  height: 54px !important;
  flex-shrink: 0;
}

.student-avatar-preview {
  width: 88px;
  height: 88px;
  flex-shrink: 0;
  border: 4px solid #ffffff;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.14);
}

/* Class history */
.class-history-section {
  margin-top: 0.25rem;
}

.class-history-title {
  margin: 0.75rem 0 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #8392ab;
}

.class-history-empty {
  margin: 0;
  padding: 0.9rem 1rem;
  font-size: 0.875rem;
  color: #67748e;
  background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
  border-radius: 0.9rem;
  border: 1px dashed #cbd5e1;
}

.class-history-card {
  border-radius: 1rem;
  border: 1px solid #e2e8f0;
  background: #fff;
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.08);
  overflow: hidden;
}

.class-history-scroll {
  max-height: 200px;
  overflow-y: auto;
}

.class-history-scroll-full {
  overflow-y: auto;
}

.class-history-table {
  --history-border: #f1f3f5;
}

.class-history-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 0.5rem 0.65rem;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #8392ab;
  white-space: nowrap;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 1px 0 var(--history-border);
}

.class-history-table tbody td {
  padding: 0.5rem 0.65rem;
  vertical-align: middle;
  border-bottom: 1px solid var(--history-border);
  font-size: 0.8125rem;
}

.class-history-table tbody tr:last-child td {
  border-bottom: none;
}

.class-history-table tbody tr:hover td {
  background-color: rgba(20, 184, 166, 0.08);
}

.class-history-date {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  font-weight: 600;
  color: #344767;
}

.class-history-class {
  color: #344767;
  max-width: 6rem;
  word-wrap: break-word;
}

.class-history-to {
  font-weight: 600;
  color: #5e72e4;
}

.class-history-note {
  font-size: 0.75rem;
  color: #67748e;
  max-width: 8rem;
  line-height: 1.45;
  word-break: break-word;
}

/* Attendance calendar */
.att-calendar {
  border: 1px solid #e2e8f0;
  border-radius: 1rem;
  overflow: hidden;
  background: #ffffff;
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.08);
}

.att-calendar-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.att-header-cell {
  text-align: center;
  padding: 0.4rem 0;
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #8392ab;
}

.att-calendar-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}

.att-day {
  position: relative;
  text-align: center;
  padding: 0.3rem 0;
  min-height: 2.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid #f1f3f5;
  border-right: 1px solid #f1f3f5;
  cursor: default;
  transition: background 0.15s;
}

.att-calendar-row:last-child .att-day {
  border-bottom: none;
}

.att-day:nth-child(7n) {
  border-right: none;
}

.att-day-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.att-day-today {
  box-shadow: 0 0 0 2px #5e72e4;
}

.att-day--present .att-day-num { background: #2dce89; color: #fff; }
.att-day--absent .att-day-num  { background: #f5365c; color: #fff; }
.att-day--late .att-day-num    { background: #fb6340; color: #fff; }
.att-day--excused .att-day-num { background: #11cdef; color: #fff; }
.att-day--none .att-day-num    { background: #e9ecef; color: #8392ab; }
.att-day--outside              { background: #fcfcfd; }

/* Legend */
.att-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.att-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.7rem;
  color: #67748e;
}

.att-legend-dot {
  display: inline-block;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  flex-shrink: 0;
}

.att-dot--present { background: #2dce89; }
.att-dot--absent  { background: #f5365c; }
.att-dot--late    { background: #fb6340; }
.att-dot--excused { background: #11cdef; }
.att-dot--none    { background: #e9ecef; }

@media (max-width: 900px) {
  .drawer-panel {
    width: 100vw;
    max-width: 100vw;
  }

  .drawer-header,
  .drawer-body,
  .drawer-footer {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .drawer-tabs {
    padding-left: 1rem !important;
    padding-right: 1rem !important;
    overflow-x: auto;
    flex-wrap: nowrap;
  }

  .drawer-tabs .nav-link {
    white-space: nowrap;
  }
}

</style>
