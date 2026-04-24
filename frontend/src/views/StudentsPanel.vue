<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from 'vuex'
import { api } from '../api/client.js'
import ArgonInput from '@/components/ArgonInput.vue'
import ArgonButton from '@/components/ArgonButton.vue'
import ArgonAlert from '@/components/ArgonAlert.vue'
import AppDateField from '@/components/AppDateField.vue'
import SearchableDropdown from '@/components/SearchableDropdown.vue'
import defaultAvatarMale from '@/assets/img/logos/betrai.png'
import defaultAvatarFemale from '@/assets/img/logos/begai.png'
import { findProvinceByName, hasWardInProvince, provinces, wardsForProvinceName } from '@/utils/vnAdministrativeUnits.js'

const store = useStore()
const router = useRouter()
const isAdmin = computed(() => store.state.authUser?.role === 'admin')
const isTeacher = computed(() => store.state.authUser?.role === 'teacher')
const canManageStudents = computed(() => isAdmin.value || isTeacher.value)

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

function namePartsForSort(row) {
  const full = String(row?.name || '').trim().replace(/\s+/g, ' ')
  const parts = full ? full.split(' ') : []
  return {
    firstName: String(row?.firstName || parts[parts.length - 1] || '').trim(),
    lastName: String(row?.lastName || parts.slice(0, -1).join(' ') || '').trim(),
    fullName: full,
  }
}

function compareStudentByFirstName(a, b) {
  const left = namePartsForSort(a)
  const right = namePartsForSort(b)
  return (
    left.firstName.localeCompare(right.firstName, 'vi', { sensitivity: 'base' }) ||
    left.lastName.localeCompare(right.lastName, 'vi', { sensitivity: 'base' }) ||
    left.fullName.localeCompare(right.fullName, 'vi', { sensitivity: 'base' }) ||
    Number(a.id || 0) - Number(b.id || 0)
  )
}

const filteredItems = computed(() => {
  let list = items.value
  if (filterStatuses.value.length) {
    list = list.filter((s) => filterStatuses.value.includes(s.status || 'active'))
  }
  if (filterClassId.value != null) {
    list = list.filter((s) => s.classId === filterClassId.value)
  }
  return [...list].sort(compareStudentByFirstName)
})

const activeStudentsCount = computed(() => items.value.filter((s) => (s.status || 'active') === 'active').length)
const femaleStudentsCount = computed(() => items.value.filter((s) => s.gender === 'female').length)
const maleStudentsCount = computed(() => items.value.filter((s) => s.gender !== 'female').length)

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
const isViewingExistingStudent = computed(() => Boolean(editingId.value))
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
  lastName: '',
  firstName: '',
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
  houseNumber: '',
  street: '',
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
  bhytNumber: '',
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

const selectedProvince = computed(() => findProvinceByName(form.value.province))
const wardOptions = computed(() => wardsForProvinceName(form.value.province))

watch(
  () => form.value.province,
  (province) => {
    if (form.value.ward && !hasWardInProvince(province, form.value.ward)) {
      form.value.ward = ''
    }
  }
)

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
  phone: '', nationality: '', religion: '', houseNumber: '', street: '', province: '', ward: '', hamlet: '',
  birthPlace: '', fatherBirthYear: '', motherBirthYear: '',
  fatherName: '', fatherBirthDate: '', fatherPhone: '', fatherEmail: '',
  fatherLogin: '', fatherIdNumber: '', fatherOccupation: '',
  motherName: '', motherBirthDate: '', motherPhone: '', motherEmail: '',
  motherLogin: '', motherIdNumber: '', motherOccupation: '',
  idNumber: '', idIssuedPlace: '', idIssuedDate: '', area: '', bhytNumber: '',
  disabilityType: '', policyBeneficiary: '', eyeDisease: '',
  guardianName: '', guardianOccupation: '', guardianBirthYear: '',
}

function resetForm() {
  editingId.value = null
  form.value = {
    name: '', lastName: '', firstName: '', classId: '', grade: '', email: '', dateOfBirth: '',
    avatar: '', joinDate: '', status: 'active', gender: 'male',
    ...EXTRA_FIELDS_DEFAULTS,
  }
}

function splitFullName(value) {
  const full = String(value || '').trim().replace(/\s+/g, ' ')
  if (!full) return { lastName: '', firstName: '' }
  const parts = full.split(' ')
  if (parts.length === 1) return { lastName: '', firstName: parts[0] }
  return { lastName: parts.slice(0, -1).join(' '), firstName: parts[parts.length - 1] }
}

function fullNameFromParts(lastName, firstName) {
  return [lastName, firstName].map((v) => String(v || '').trim()).filter(Boolean).join(' ')
}

function formFullName() {
  return fullNameFromParts(form.value.lastName, form.value.firstName)
}

function displayValue(value) {
  const text = String(value ?? '').trim()
  return text || '—'
}

function genderLabel(value) {
  const found = GENDER_OPTIONS.find((o) => o.value === value)
  return found ? found.label : displayValue(value)
}

function studentAddressLine() {
  const parts = [form.value.houseNumber, form.value.street, form.value.ward, form.value.province]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
  return parts.length ? parts.join(', ') : '—'
}

function currentAddressLine() {
  return form.value.hamlet ? displayValue(form.value.hamlet) : studentAddressLine()
}

function openCreate() {
  if (!canManageStudents.value) return
  router.push({ name: 'StudentCreate' })
}

function goToStudentEdit() {
  if (!editingId.value) return
  const id = editingId.value
  closeDrawer()
  router.push({ name: 'StudentDetail', params: { id } })
}

function openStudentDetail(row) {
  resetAll()
  editingId.value = row.id
  viewingStudent.value = row
  form.value = {
    name: row.name,
    lastName: row.lastName || splitFullName(row.name).lastName,
    firstName: row.firstName || splitFullName(row.name).firstName,
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
    houseNumber: row.houseNumber || '',
    street: row.street || '',
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
    bhytNumber: row.bhytNumber || '',
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
  const fullName = formFullName()
  if (!fullName) {
    formErr.value = 'Name is required'
    return
  }
  saving.value = true
  try {
    const payload = {
      name: fullName,
      lastName: form.value.lastName,
      firstName: form.value.firstName,
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
      houseNumber: form.value.houseNumber,
      street: form.value.street,
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
      bhytNumber: form.value.bhytNumber,
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
  <div class="py-4 container-fluid page-fill students-page">
    <div :class="studentsLayoutClass">
      <!-- LEFT FILTER SIDEBAR -->
      <div :class="filterSidebarClass" class="student-filter-panel">
        <div class="student-filter-heading">
          <span class="student-filter-kicker">Bộ lọc</span>
          <strong>{{ filteredItems.length }} học sinh</strong>
        </div>

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
      <div class="card tw-min-w-0 tw-flex-1 student-list-card">
        <div class="card-header student-list-header">
          <div class="student-list-title">
            <span class="student-list-eyebrow">Hồ sơ học sinh</span>
            <h6>Danh sách học sinh</h6>
            <p class="mb-0 text-sm text-secondary">
              Sắp xếp theo tên gọi, rồi mới đến họ để dễ dò danh sách trong lớp.
            </p>
          </div>
          <div class="student-list-stats">
            <div class="student-stat-card">
              <span>Tổng</span>
              <strong>{{ items.length }}</strong>
            </div>
            <div class="student-stat-card student-stat-card--active">
              <span>Đang học</span>
              <strong>{{ activeStudentsCount }}</strong>
            </div>
            <div class="student-stat-card student-stat-card--girl">
              <span>Bé gái</span>
              <strong>{{ femaleStudentsCount }}</strong>
            </div>
            <div class="student-stat-card student-stat-card--boy">
              <span>Bé trai</span>
              <strong>{{ maleStudentsCount }}</strong>
            </div>
          </div>
          <argon-button v-if="canManageStudents" color="primary" variant="gradient" type="button" class="student-add-btn" @click="openCreate">
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
                    <th scope="col">Avatar</th>
                    <th scope="col">Tên</th>
                    <th scope="col">Lớp</th>
                    <th scope="col">Ghi chú</th>
                    <th scope="col">SĐT ba</th>
                    <th scope="col">SĐT mẹ</th>
                    <th scope="col">Giới tính</th>
                    <th scope="col">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="s in pagedItems" :key="s.id" class="cursor-pointer" @click="openStudentDetail(s)">
                    <td>
                      <img
                        :key="`${s.id}-${s.avatar}-${s.gender}`"
                        :src="studentAvatarSrc(s)"
                        class="avatar student-avatar-table rounded-circle object-fit-cover bg-light"
                        width="54"
                        height="54"
                        alt=""
                        referrerpolicy="no-referrer"
                        @error="onStudentImgError($event, s)"
                      />
                    </td>
                    <td>
                      <div class="student-name-cell">
                        <h6 class="mb-0 text-sm panel-primary-text">{{ s.name }}</h6>
                        <span>{{ namePartsForSort(s).firstName ? `Tên: ${namePartsForSort(s).firstName}` : 'Chưa tách tên' }}</span>
                      </div>
                    </td>
                    <td>
                      <p class="mb-0 text-xs font-weight-bold">{{ s.className || '—' }}</p>
                    </td>
                    <td>
                      <p class="mb-0 text-xs text-secondary">{{ s.grade || '—' }}</p>
                    </td>
                    <td>
                      <p class="mb-0 text-xs text-secondary">{{ s.fatherPhone || '—' }}</p>
                    </td>
                    <td>
                      <p class="mb-0 text-xs text-secondary">{{ s.motherPhone || '—' }}</p>
                    </td>
                    <td>
                      <p class="mb-0 text-xs text-secondary">{{ s.gender === 'female' ? 'Bé gái' : 'Bé trai' }}</p>
                    </td>
                    <td class="align-middle text-sm">
                      <span class="badge badge-sm text-white" :class="statusBadgeClass(s.status)">
                        {{ statusLabel(s.status) }}
                      </span>
                    </td>
                  </tr>
                  <tr v-if="!filteredItems.length" class="panel-table-empty">
                    <td colspan="8">{{ items.length ? 'Không có học sinh phù hợp bộ lọc.' : 'Chưa có học sinh nào.' }}</td>
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
        <div v-if="editingId" class="student-view-header">
          <button type="button" class="btn-close student-view-close" aria-label="Close" @click="closeDrawer"></button>
          <div class="student-view-identity">
            <div class="student-view-avatar-wrap">
              <img
                :key="`${form.avatar}-${form.gender}`"
                :src="formAvatarSrc()"
                alt=""
                class="student-view-avatar"
                referrerpolicy="no-referrer"
                @error="onFormAvatarImgError"
              />
              <span class="student-view-camera"><i class="ni ni-camera-compact"></i></span>
            </div>
            <div class="student-view-heading">
              <div class="student-view-title-row">
                <h5 class="student-view-name">{{ formFullName() || 'Học sinh' }}</h5>
                <span class="student-view-gender-dot" :class="`student-view-gender-dot--${form.gender}`"></span>
                <span class="badge student-view-status" :class="statusBadgeClass(form.status)">{{ statusLabel(form.status) }}</span>
              </div>
              <p class="student-view-dob">{{ displayValue(form.dateOfBirth) }}</p>
              <div class="student-view-actions">
                <button
                  v-if="canManageStudents"
                  type="button"
                  class="btn btn-sm btn-outline-primary mb-0 student-view-action"
                  @click="goToStudentEdit"
                >
                  <i class="ni ni-ruler-pencil me-1"></i> Sửa thông tin
                </button>
                <button
                  v-if="canManageStudents"
                  type="button"
                  class="btn btn-sm btn-outline-secondary mb-0 student-view-action"
                  @click="goToStudentEdit"
                >
                  Chuyển trạng thái
                </button>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="drawer-header">
          <h5 class="drawer-title mb-0">{{ editingId ? formFullName() || 'Học sinh' : 'Thêm học sinh' }}</h5>
          <button type="button" class="btn-close" aria-label="Close" @click="closeDrawer"></button>
        </div>

        <!-- Tabs (only when editing) -->
        <ul v-if="editingId" class="drawer-tabs student-view-tabs nav nav-tabs px-3 mb-0" role="tablist">
          <li class="nav-item" role="presentation">
            <button
              class="nav-link"
              :class="{ active: detailTab === 'info' }"
              type="button"
              @click="switchDetailTab('info')"
            >
              Thông tin
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button
              class="nav-link"
              :class="{ active: detailTab === 'history' }"
              type="button"
              @click="switchDetailTab('history')"
            >
              Lịch sử trạng thái
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button
              class="nav-link"
              :class="{ active: detailTab === 'parent' }"
              type="button"
              @click="switchDetailTab('parent')"
            >
              Tài khoản phụ huynh
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button
              class="nav-link"
              :class="{ active: detailTab === 'note' }"
              type="button"
              @click="switchDetailTab('note')"
            >
              Ghi chú
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button
              class="nav-link"
              :class="{ active: detailTab === 'attendance' }"
              type="button"
              @click="switchDetailTab('attendance')"
            >
              Điểm danh
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button
              class="nav-link"
              :class="{ active: detailTab === 'review' }"
              type="button"
              @click="switchDetailTab('review')"
            >
              Nhận xét
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button
              class="nav-link"
              :class="{ active: detailTab === 'files' }"
              type="button"
              @click="switchDetailTab('files')"
            >
              Hồ sơ đính kèm
            </button>
          </li>
        </ul>

        <!-- ====== INFO TAB ====== -->
        <div v-if="editingId" v-show="detailTab === 'info'" class="drawer-body-form student-view-pane">
          <div class="drawer-body student-view-body">
            <section class="student-view-card">
              <h6>Thông tin chung</h6>
              <div class="student-view-two-cols">
                <div class="student-info-list">
                  <div class="student-info-row">
                    <span>Họ tên mẹ</span>
                    <strong>{{ displayValue(form.motherName) }}</strong>
                  </div>
                  <div class="student-info-row">
                    <span>Ngày sinh</span>
                    <strong>{{ displayValue(form.motherBirthDate) }}</strong>
                  </div>
                  <div class="student-info-row">
                    <span>Số điện thoại</span>
                    <strong>{{ displayValue(form.motherPhone) }}</strong>
                  </div>
                  <div class="student-info-row">
                    <span>Email</span>
                    <strong>{{ displayValue(form.motherEmail) }}</strong>
                  </div>
                  <div class="student-info-row">
                    <span>Căn cước công dân</span>
                    <strong>{{ displayValue(form.motherIdNumber) }}</strong>
                  </div>
                  <div class="student-info-row">
                    <span>Nghề nghiệp</span>
                    <strong>{{ displayValue(form.motherOccupation) }}</strong>
                  </div>
                </div>
                <div class="student-info-list">
                  <div class="student-info-row">
                    <span>Họ tên bố</span>
                    <strong>{{ displayValue(form.fatherName) }}</strong>
                  </div>
                  <div class="student-info-row">
                    <span>Ngày sinh</span>
                    <strong>{{ displayValue(form.fatherBirthDate) }}</strong>
                  </div>
                  <div class="student-info-row">
                    <span>Số điện thoại</span>
                    <strong>{{ displayValue(form.fatherPhone) }}</strong>
                  </div>
                  <div class="student-info-row">
                    <span>Email</span>
                    <strong>{{ displayValue(form.fatherEmail) }}</strong>
                  </div>
                  <div class="student-info-row">
                    <span>Căn cước công dân</span>
                    <strong>{{ displayValue(form.fatherIdNumber) }}</strong>
                  </div>
                  <div class="student-info-row">
                    <span>Nghề nghiệp</span>
                    <strong>{{ displayValue(form.fatherOccupation) }}</strong>
                  </div>
                </div>
              </div>
            </section>

            <section class="student-view-card">
              <h6>Thông tin địa chỉ</h6>
              <div class="student-info-list student-info-list--wide">
                <div class="student-info-row">
                  <span>Địa chỉ thường trú</span>
                  <strong>{{ studentAddressLine() }}</strong>
                </div>
                <div class="student-info-row">
                  <span>Địa chỉ hiện tại</span>
                  <strong>{{ currentAddressLine() }}</strong>
                </div>
              </div>
            </section>

            <section class="student-view-card">
              <h6>Thông tin phục vụ CSDLQG ngành Giáo dục</h6>
              <div class="student-view-two-cols">
                <div class="student-info-list">
                  <div class="student-info-row">
                    <span>Quốc tịch</span>
                    <strong>{{ displayValue(form.nationality) }}</strong>
                  </div>
                  <div class="student-info-row">
                    <span>Tôn giáo</span>
                    <strong>{{ displayValue(form.religion) }}</strong>
                  </div>
                  <div class="student-info-row">
                    <span>Số điện thoại</span>
                    <strong>{{ displayValue(form.phone) }}</strong>
                  </div>
                  <div class="student-info-row">
                    <span>Tỉnh/Thành phố</span>
                    <strong>{{ displayValue(form.province) }}</strong>
                  </div>
                  <div class="student-info-row">
                    <span>Xã/Phường</span>
                    <strong>{{ displayValue(form.ward) }}</strong>
                  </div>
                  <div class="student-info-row">
                    <span>Tổ/Thôn/Xóm</span>
                    <strong>{{ displayValue(form.hamlet) }}</strong>
                  </div>
                  <div class="student-info-row">
                    <span>Nơi sinh</span>
                    <strong>{{ displayValue(form.birthPlace) }}</strong>
                  </div>
                  <div class="student-info-row">
                    <span>Năm sinh bố</span>
                    <strong>{{ displayValue(form.fatherBirthYear) }}</strong>
                  </div>
                  <div class="student-info-row">
                    <span>Năm sinh mẹ</span>
                    <strong>{{ displayValue(form.motherBirthYear) }}</strong>
                  </div>
                </div>
                <div class="student-info-list">
                  <div class="student-info-row">
                    <span>Giới tính</span>
                    <strong>{{ genderLabel(form.gender) }}</strong>
                  </div>
                  <div class="student-info-row">
                    <span>Số CMND/TCC</span>
                    <strong>{{ displayValue(form.idNumber) }}</strong>
                  </div>
                  <div class="student-info-row">
                    <span>Nơi cấp</span>
                    <strong>{{ displayValue(form.idIssuedPlace) }}</strong>
                  </div>
                  <div class="student-info-row">
                    <span>Ngày cấp</span>
                    <strong>{{ displayValue(form.idIssuedDate) }}</strong>
                  </div>
                  <div class="student-info-row">
                    <span>Số nhà</span>
                    <strong>{{ displayValue(form.houseNumber) }}</strong>
                  </div>
                  <div class="student-info-row">
                    <span>Mã số thẻ BHYT</span>
                    <strong>{{ displayValue(form.bhytNumber) }}</strong>
                  </div>
                  <div class="student-info-row">
                    <span>Loại khuyết tật</span>
                    <strong>{{ displayValue(form.disabilityType) }}</strong>
                  </div>
                  <div class="student-info-row">
                    <span>Đối tượng chính sách</span>
                    <strong>{{ displayValue(form.policyBeneficiary) }}</strong>
                  </div>
                  <div class="student-info-row">
                    <span>Bệnh về mắt</span>
                    <strong>{{ displayValue(form.eyeDisease) }}</strong>
                  </div>
                </div>
              </div>

              <div class="student-view-checkboxes">
                <label><input type="checkbox" disabled /> Miễn học phí</label>
                <label><input type="checkbox" disabled /> Học sinh tuyển mới</label>
                <label><input type="checkbox" disabled /> Giảm học phí</label>
                <label><input type="checkbox" disabled /> Học 2 buổi/ngày</label>
              </div>
            </section>
          </div>
        </div>

        <form v-if="false" v-show="detailTab === 'info'" class="drawer-body-form" @submit.prevent="isViewingExistingStudent ? undefined : save()">
          <div class="drawer-body">
            <argon-alert v-if="formErr && detailTab === 'info'" color="danger" icon="ni ni-fat-remove">
              {{ formErr }}
            </argon-alert>
            <fieldset class="student-form-fieldset" :disabled="isViewingExistingStudent">
            <p class="text-sm text-uppercase text-muted">Thông tin học sinh</p>
            <div class="row student-detail-grid">
              <div class="col-8">
                <label for="student-last-name" class="form-control-label">Họ *</label>
                <argon-input
                  id="student-last-name"
                  v-model="form.lastName"
                  placeholder="VD: Nguyễn Văn"
                  name="lastName"
                  autocomplete="family-name"
                />
              </div>
              <div class="col-4">
                <label for="student-first-name" class="form-control-label">Tên *</label>
                <argon-input
                  id="student-first-name"
                  v-model="form.firstName"
                  placeholder="VD: An"
                  name="firstName"
                  autocomplete="given-name"
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
                <p v-if="editingId && isAdmin" class="mt-1 mb-0 text-xs text-secondary">
                  Thay đổi lớp sẽ ghi lại lịch sử chuyển lớp khi cập nhật.
                </p>
              </div>
              <div v-if="editingId && classIsChanging && isAdmin" class="col-12">
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
            <div class="row student-detail-grid">
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
                <label for="student-house-number" class="form-control-label text-xs">Số nhà</label>
                <argon-input id="student-house-number" v-model="form.houseNumber" placeholder="Số nhà" name="houseNumber" />
              </div>
              <div class="col-6">
                <label for="student-street" class="form-control-label text-xs">Đường</label>
                <argon-input id="student-street" v-model="form.street" placeholder="Đường" name="street" />
              </div>
              <div class="col-6">
                <label for="student-province" class="form-control-label text-xs">Tỉnh/Thành phố</label>
                <searchable-dropdown
                  v-model="form.province"
                  :options="provinces"
                  placeholder="Gõ để tìm tỉnh/thành phố"
                />
              </div>
              <div class="col-6">
                <label for="student-ward" class="form-control-label text-xs">Xã/Phường</label>
                <searchable-dropdown
                  v-model="form.ward"
                  :options="wardOptions"
                  :disabled="!selectedProvince"
                  :placeholder="selectedProvince ? 'Gõ để tìm xã/phường' : 'Chọn tỉnh/thành trước'"
                />
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
                <div class="student-detail-subtitle">Thông tin mẹ</div>
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
                <div class="student-detail-subtitle">Thông tin bố</div>
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
              <div class="col-12">
                <div class="student-detail-subtitle">Giấy tờ và chính sách</div>
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
                <label for="student-area" class="form-control-label">Số nhà</label>
                <argon-input id="student-area" v-model="form.houseNumber" placeholder="Số nhà" name="houseNumber" />
              </div>
              <div class="col-6">
                <label for="student-bhyt-number" class="form-control-label">Mã số thẻ BHYT</label>
                <argon-input id="student-bhyt-number" v-model="form.bhytNumber" placeholder="Mã số thẻ BHYT" name="bhytNumber" />
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
            </fieldset>
          </div>
          <div class="drawer-footer">
            <argon-button color="secondary" variant="outline" size="sm" type="button" :disabled="saving" @click="closeDrawer">
              {{ editingId ? 'Đóng' : 'Hủy' }}
            </argon-button>
            <argon-button
              v-if="editingId && canManageStudents"
              color="primary"
              variant="gradient"
              size="sm"
              type="button"
              :disabled="saving"
              @click="goToStudentEdit"
            >
              <i class="ni ni-ruler-pencil me-1"></i> Sửa
            </argon-button>
            <argon-button
              v-if="!editingId && canManageStudents"
              color="primary"
              variant="gradient"
              size="sm"
              type="submit"
              :disabled="saving"
            >
              {{ saving ? 'Đang lưu…' : editingId ? 'Cập nhật' : 'Tạo mới' }}
            </argon-button>
          </div>
        </form>

        <div v-if="editingId" v-show="detailTab === 'parent'" class="drawer-body-form student-view-pane">
          <div class="drawer-body student-view-body">
            <section class="student-view-card">
              <h6>Tài khoản phụ huynh</h6>
              <p class="student-view-note">Thông tin đăng nhập luôn đồng nhất với số điện thoại/email khai báo ở trên.</p>
              <div class="student-info-list student-info-list--wide">
                <div class="student-info-row">
                  <span>Mẹ</span>
                  <strong>{{ displayValue(form.motherLogin || form.motherPhone || form.motherEmail) }}</strong>
                </div>
                <div class="student-info-row">
                  <span>Bố</span>
                  <strong>{{ displayValue(form.fatherLogin || form.fatherPhone || form.fatherEmail) }}</strong>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div v-if="editingId" v-show="detailTab === 'note'" class="drawer-body-form student-view-pane">
          <div class="drawer-body student-view-body">
            <section class="student-view-card">
              <h6>Ghi chú</h6>
              <p class="student-view-empty">{{ displayValue(form.grade) }}</p>
            </section>
          </div>
        </div>

        <div v-if="editingId" v-show="detailTab === 'review'" class="drawer-body-form student-view-pane">
          <div class="drawer-body student-view-body">
            <section class="student-view-card">
              <h6>Nhận xét</h6>
              <p class="student-view-empty">Chưa có nhận xét.</p>
            </section>
          </div>
        </div>

        <div v-if="editingId" v-show="detailTab === 'files'" class="drawer-body-form student-view-pane">
          <div class="drawer-body student-view-body">
            <section class="student-view-card">
              <h6>Hồ sơ đính kèm</h6>
              <p class="student-view-empty">Chưa có hồ sơ đính kèm.</p>
            </section>
          </div>
        </div>

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

.students-page {
  padding-top: 1rem !important;
}

.student-filter-panel {
  position: relative;
  border: 1px solid rgba(15, 118, 110, 0.12);
  background:
    linear-gradient(180deg, rgba(240, 253, 250, 0.86), rgba(255, 255, 255, 0.98) 42%),
    radial-gradient(circle at top left, rgba(45, 212, 191, 0.16), transparent 38%) !important;
  box-shadow: 0 1.1rem 2rem -1.7rem rgba(15, 23, 42, 0.3) !important;
}

.student-filter-heading {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(15, 118, 110, 0.1);
}

.student-filter-kicker {
  color: #0f766e;
  font-size: 0.68rem;
  font-weight: 850;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.student-filter-heading strong {
  color: #1f2a44;
  font-size: 1.05rem;
  font-weight: 900;
}

.student-list-card {
  overflow: hidden;
  border: 1px solid #e5edf6;
  background:
    linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
  box-shadow: 0 1.35rem 2.8rem -2.2rem rgba(15, 23, 42, 0.42);
}

.student-list-card .card-body {
  padding-bottom: 0 !important;
}

.student-list-card .panel-table-wrap {
  margin: 0;
  border-right: 0;
  border-bottom: 0;
  border-left: 0;
  border-radius: 0;
  box-shadow: none;
}

.student-list-card .panel-data-table {
  min-width: 920px;
}

.student-list-header {
  display: grid;
  grid-template-columns: minmax(15rem, 1fr) auto auto;
  align-items: center;
  gap: 0.9rem;
  padding: 1rem 1.35rem 0.9rem;
  border-bottom: 1px solid #edf2f7;
  background:
    radial-gradient(circle at top left, rgba(20, 184, 166, 0.14), transparent 30%),
    linear-gradient(135deg, #ffffff 0%, #f8fcff 54%, #eefdf8 100%);
}

.student-list-title h6 {
  margin: 0 0 0.15rem;
  color: #1f2a44;
  font-size: 1.05rem;
  font-weight: 900;
}

.student-list-eyebrow {
  display: inline-flex;
  margin-bottom: 0.2rem;
  color: #0f766e;
  font-size: 0.68rem;
  font-weight: 850;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.student-list-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(4.6rem, 1fr));
  gap: 0.45rem;
}

.student-stat-card {
  min-width: 4.6rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid #e5edf6;
  border-radius: 0.8rem;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 0.65rem 1.35rem -1.2rem rgba(15, 23, 42, 0.34);
}

.student-stat-card span {
  display: block;
  color: #64748b;
  font-size: 0.64rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.student-stat-card strong {
  display: block;
  color: #1f2a44;
  font-size: 1.05rem;
  font-weight: 900;
  line-height: 1.15;
}

.student-stat-card--active {
  border-color: rgba(45, 206, 137, 0.22);
  background: rgba(236, 253, 245, 0.9);
}

.student-stat-card--girl {
  border-color: rgba(244, 114, 182, 0.22);
  background: rgba(253, 242, 248, 0.9);
}

.student-stat-card--boy {
  border-color: rgba(59, 130, 246, 0.22);
  background: rgba(239, 246, 255, 0.9);
}

.student-add-btn {
  white-space: nowrap;
  box-shadow: 0 0.8rem 1.5rem -1rem rgba(94, 114, 228, 0.72);
}

.student-name-cell {
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
}

.student-name-cell span {
  color: #0f766e;
  font-size: 0.68rem;
  font-weight: 800;
}

/* ===== Drawer ===== */
.drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(15, 23, 42, 0.34);
  backdrop-filter: blur(7px);
}

.drawer-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 10010;
  width: 50vw;
  min-width: min(760px, 100vw);
  max-width: 100vw;
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
  margin: 1rem 0 0;
  padding: 0.85rem 1rem 0;
  border: 1px solid #e2e8f0;
  border-bottom: 0;
  border-radius: 1rem 1rem 0 0;
  background: #ffffff;
  color: #64748b !important;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.student-form-fieldset {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.student-form-fieldset:disabled {
  cursor: default;
}

.student-form-fieldset:disabled :deep(.form-control),
.student-form-fieldset:disabled :deep(.form-select),
.student-form-fieldset:disabled select.form-control,
.student-form-fieldset:disabled textarea.form-control {
  color: #344767;
  background-color: #f8fafc;
  opacity: 1;
}

.drawer-body > .text-sm.text-uppercase.text-muted:first-of-type {
  margin-top: 0;
}

.drawer-body .row {
  --bs-gutter-x: 1rem;
  --bs-gutter-y: 0.95rem;
}

.drawer-body > .student-detail-grid {
  margin-left: 0;
  margin-right: 0;
  margin-bottom: 1rem;
  padding: 1rem;
  border: 1px solid #e2e8f0;
  border-top: 0;
  border-radius: 0 0 1rem 1rem;
  background: #ffffff;
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.06);
}

.student-detail-subtitle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.15rem;
  padding-top: 0.9rem;
  border-top: 1px solid #eef2f7;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #0f766e;
}

.student-detail-subtitle::before {
  content: "";
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 999px;
  background: #14b8a6;
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

.student-view-header {
  position: relative;
  padding: 1.4rem 1.5rem 1rem;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
  flex-shrink: 0;
}

.student-view-close {
  position: absolute;
  top: 0.85rem;
  right: 1rem;
  z-index: 1;
}

.student-view-identity {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-width: 0;
  padding-right: 2.5rem;
}

.student-view-avatar-wrap {
  position: relative;
  width: 7.25rem;
  height: 7.25rem;
  flex: 0 0 auto;
}

.student-view-avatar {
  width: 100%;
  height: 100%;
  border-radius: 999px;
  object-fit: cover;
  background: #f8fafc;
}

.student-view-camera {
  position: absolute;
  right: 0.35rem;
  bottom: 0.65rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.65rem;
  height: 1.65rem;
  border: 3px solid #ffffff;
  border-radius: 999px;
  color: #10b981;
  background: #c6f6e7;
  font-size: 0.7rem;
}

.student-view-heading {
  min-width: 0;
  flex: 1 1 auto;
}

.student-view-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
}

.student-view-name {
  margin: 0;
  color: #344767;
  font-size: 1.15rem;
  font-weight: 800;
  line-height: 1.25;
}

.student-view-gender-dot {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 999px;
  background: #93c5fd;
}

.student-view-gender-dot--female {
  background: #fecdd3;
}

.student-view-status {
  border-radius: 0.35rem;
  padding: 0.35rem 0.65rem;
  text-transform: none;
}

.student-view-dob {
  margin: 0.45rem 0 0.8rem;
  color: #67748e;
  font-size: 0.92rem;
  font-weight: 600;
}

.student-view-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.student-view-action {
  min-height: 2.2rem;
  border-radius: 0.45rem;
  font-weight: 700;
}

.student-view-tabs {
  gap: 0;
  padding-top: 0;
  padding-bottom: 0;
  overflow-x: auto;
  flex-wrap: nowrap;
  border-bottom: 1px solid #d9e2ec;
  background: #ffffff;
}

.student-view-tabs .nav-link {
  white-space: nowrap;
  border: 0;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: #67748e;
  padding: 0.85rem 0.9rem;
  font-size: 0.8rem;
}

.student-view-tabs .nav-link:hover {
  border-color: transparent;
  border-bottom-color: #99f6e4;
  background: transparent;
  color: #0f766e;
}

.student-view-tabs .nav-link.active {
  color: #10b981;
  border-bottom-color: #10b981;
  background: transparent;
  box-shadow: none;
}

.student-view-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: #ffffff;
  padding-top: 1.1rem;
}

.student-view-card {
  padding: 1rem;
  border: 1px solid #dfe7ef;
  border-radius: 0.8rem;
  background: #ffffff;
}

.student-view-card h6 {
  margin: 0 0 0.9rem;
  color: #344767;
  font-size: 1rem;
  font-weight: 800;
}

.student-view-two-cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 1rem;
}

.student-info-list {
  display: grid;
  gap: 0.65rem;
  min-width: 0;
}

.student-info-list + .student-info-list {
  padding-left: 1rem;
  border-left: 1px solid #e5e7eb;
}

.student-info-list--wide + .student-info-list--wide,
.student-info-list--wide {
  padding-left: 0;
  border-left: 0;
}

.student-info-list--wide .student-info-row {
  grid-template-columns: minmax(9.5rem, max-content) minmax(0, 1fr);
}

.student-info-row {
  display: grid;
  grid-template-columns: minmax(7.5rem, 0.7fr) minmax(0, 1fr);
  gap: 0.6rem;
  align-items: start;
  color: #344767;
  font-size: 0.86rem;
  line-height: 1.35;
}

.student-info-row span {
  font-weight: 700;
}

.student-info-row strong {
  min-width: 0;
  color: #344767;
  font-weight: 600;
  word-break: break-word;
}

.student-view-checkboxes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem 1.4rem;
  margin-top: 1.4rem;
}

.student-view-checkboxes label {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  margin: 0;
  color: #344767;
  font-size: 0.86rem;
  font-weight: 600;
}

.student-view-checkboxes input {
  width: 1rem;
  height: 1rem;
}

.student-view-note,
.student-view-empty {
  margin: 0;
  color: #67748e;
  font-size: 0.9rem;
  line-height: 1.6;
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
  .student-list-header {
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .student-list-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .student-add-btn {
    justify-self: flex-start;
  }

  .student-filter-panel {
    max-height: none;
  }

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

  .student-view-header {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .student-view-identity {
    align-items: flex-start;
    gap: 0.8rem;
  }

  .student-view-avatar-wrap {
    width: 5.25rem;
    height: 5.25rem;
  }

  .student-view-two-cols {
    grid-template-columns: 1fr;
  }

  .student-info-list + .student-info-list {
    padding-left: 0;
    padding-top: 0.85rem;
    border-left: 0;
    border-top: 1px solid #e5e7eb;
  }

  .student-info-row {
    grid-template-columns: 1fr;
    gap: 0.2rem;
  }

  .student-view-checkboxes {
    grid-template-columns: 1fr;
  }
}

</style>
