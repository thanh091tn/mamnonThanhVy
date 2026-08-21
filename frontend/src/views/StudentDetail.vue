<script setup>
import { computed, nextTick, onBeforeMount, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStore } from 'vuex'
import { api } from '../api/client.js'
import ArgonAlert from '@/components/ArgonAlert.vue'
import ArgonButton from '@/components/ArgonButton.vue'
import ArgonInput from '@/components/ArgonInput.vue'
import AppDateField from '@/components/AppDateField.vue'
import SearchableDropdown from '@/components/SearchableDropdown.vue'
import defaultAvatarMale from '@/assets/img/logos/betrai.png'
import defaultAvatarFemale from '@/assets/img/logos/begai.png'
import { findProvinceByName, hasWardInProvince, provinces, wardsForProvinceName } from '@/utils/vnAdministrativeUnits.js'

const route = useRoute()
const router = useRouter()
const store = useStore()

const isAdmin = computed(() => store.state.authUser?.role === 'admin')
const canManageStudents = computed(() => ['admin', 'teacher'].includes(store.state.authUser?.role))
const studyInfoLocked = computed(() => !canManageStudents.value)
/** Temporarily hidden on student detail page. */
const showParentInfo = false
const showEducationRegistryInfo = false

const STATUS_OPTIONS = [
  { value: 'active', label: '\u0110ang h\u1ecdc' },
  { value: 'monitoring', label: '\u0110ang theo d\u00f5i' },
  { value: 'inactive', label: 'Ngh\u1ec9 h\u1ecdc' },
  { value: 'graduated', label: 'T\u1ed1t nghi\u1ec7p' },
  { value: 'leave', label: 'T\u1ea1m ngh\u1ec9' },
]

const GENDER_OPTIONS = [
  { value: 'male', label: 'Bé trai' },
  { value: 'female', label: 'Bé gái' },
]

const EXTRA_FIELDS_DEFAULTS = {
  phone: '', nationality: '', religion: '', houseNumber: '', street: '', province: '', ward: '', hamlet: '',
  birthPlace: '', fatherBirthYear: '', motherBirthYear: '',
  birthAddress: '', birthWard: '', birthProvince: '',
  hometownWard: '', hometownProvince: '',
  birthRegistrationWard: '', birthRegistrationDistrict: '', birthRegistrationProvince: '',
  birthRegistrationNewWard: '', birthRegistrationNewProvince: '', studentIdIssuedDate: '',
  fatherName: '', fatherBirthDate: '', fatherPhone: '', fatherEmail: '',
  fatherLogin: '', fatherIdNumber: '', fatherIdIssuedDate: '', fatherEducation: '', fatherOccupation: '',
  motherName: '', motherBirthDate: '', motherPhone: '', motherEmail: '',
  motherLogin: '', motherIdNumber: '', motherIdIssuedDate: '', motherEducation: '', motherOccupation: '',
  idNumber: '', idIssuedPlace: '', idIssuedDate: '', area: '', bhytNumber: '',
  householdHouseNumber: '', householdStreet: '', householdWard: '', householdProvince: '', householdAddress: '',
  docHouseholdRegistration: '', docParentId: '', docBirthCertificate: '', docStudentIdForm: '',
  docHealthCheck: '', docResidenceConfirmation: '', docBirthCertificateCopy: '',
  doc2HouseholdRegistration: '', doc2ParentId: '', doc2BirthCertificate: '', doc2StudentIdForm: '',
  doc2HealthCheck: '', doc2ResidenceConfirmation: '', doc2BirthCertificate04: '',
  disabilityType: '', policyBeneficiary: '', eyeDisease: '',
  guardianName: '', guardianOccupation: '', guardianBirthYear: '',
}

const DOC_FIELDS = [
  ['docHouseholdRegistration', 'Hồ sơ HK'],
  ['docParentId', 'Hồ sơ CCCD'],
  ['docBirthCertificate', 'Hồ sơ KS'],
  ['docStudentIdForm', 'Hồ sơ ĐNH'],
  ['docHealthCheck', 'Hồ sơ KSK'],
  ['docResidenceConfirmation', 'Hồ sơ ĐTTL/DTTL'],
  ['docBirthCertificateCopy', 'Hồ sơ KS bản sao'],
  ['doc2HouseholdRegistration', 'Hồ sơ 2 - HK'],
  ['doc2ParentId', 'Hồ sơ 2 - CCCD'],
  ['doc2BirthCertificate', 'Hồ sơ 2 - KS'],
  ['doc2StudentIdForm', 'Hồ sơ 2 - ĐNH'],
  ['doc2HealthCheck', 'Hồ sơ 2 - KSK'],
  ['doc2ResidenceConfirmation', 'Hồ sơ 2 - ĐTTL/DTTL'],
  ['doc2BirthCertificate04', 'Hồ sơ 2 - KS 04'],
]

const form = ref({
  name: '',
  lastName: '',
  firstName: '',
  academicYearId: '',
  classId: '',
  grade: '',
  email: '',
  dateOfBirth: '',
  avatar: '',
  joinDate: '',
  status: 'active',
  gender: 'male',
  ...EXTRA_FIELDS_DEFAULTS,
})

const isCreateMode = computed(() => route.name === 'StudentCreate')
const studentId = computed(() => Number(route.params.id))
const academicYearOptions = ref([])
const classOptions = ref([])
const loading = ref(false)
const saving = ref(false)
const loadErr = ref('')
const formErr = ref('')
const avatarFileInput = ref(null)
const uploadingAvatar = ref(false)
const avatarUploadErr = ref('')
const currentAddressSame = ref(true)
const initialAcademicYearIdSnapshot = ref('')
const initialClassIdSnapshot = ref('')
const classChangeEffectiveDate = ref(new Date().toISOString().slice(0, 10))
const classChangeNote = ref('')
const createdAt = ref('')
const updatedAt = ref('')

const filteredClassOptions = computed(() => {
  if (!form.value.academicYearId) return classOptions.value
  const filtered = classOptions.value.filter(
    (item) => item.academicYearId === Number(form.value.academicYearId)
  )
  return filtered.length ? filtered : classOptions.value
})

const classIsChanging = computed(() => {
  if (isCreateMode.value) return false
  const curYear = form.value.academicYearId === '' ? '' : String(form.value.academicYearId)
  const snapYear = initialAcademicYearIdSnapshot.value === '' ? '' : String(initialAcademicYearIdSnapshot.value)
  const cur = form.value.classId === '' ? '' : String(form.value.classId)
  const snap = initialClassIdSnapshot.value === '' ? '' : String(initialClassIdSnapshot.value)
  return cur !== snap || curYear !== snapYear
})

const selectedProvince = computed(() => findProvinceByName(form.value.province))
const wardOptions = computed(() => wardsForProvinceName(form.value.province))
const selectedHouseholdProvince = computed(() => findProvinceByName(form.value.householdProvince))
const householdWardOptions = computed(() => wardsForProvinceName(form.value.householdProvince))

function currentAddressText() {
  const parts = [
    form.value.householdHouseNumber,
    form.value.householdStreet,
    form.value.householdWard,
    form.value.householdProvince,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
  return parts.join(', ')
}

function addressesMatch() {
  return (
    String(form.value.householdHouseNumber || '').trim() === String(form.value.houseNumber || '').trim() &&
    String(form.value.householdStreet || '').trim() === String(form.value.street || '').trim() &&
    String(form.value.householdProvince || '').trim() === String(form.value.province || '').trim() &&
    String(form.value.householdWard || '').trim() === String(form.value.ward || '').trim()
  )
}

function hasCurrentAddress() {
  return [
    form.value.householdHouseNumber,
    form.value.householdStreet,
    form.value.householdProvince,
    form.value.householdWard,
  ].some((value) => String(value || '').trim())
}

function hasPermanentAddress() {
  return [form.value.houseNumber, form.value.street, form.value.province, form.value.ward].some((value) =>
    String(value || '').trim()
  )
}

/** Khi tick: Địa chỉ thường trú = Địa chỉ hiện tại */
function syncPermanentAddressFromCurrent() {
  form.value.houseNumber = form.value.householdHouseNumber
  form.value.street = form.value.householdStreet
  form.value.province = form.value.householdProvince
  form.value.ward = form.value.householdWard
  form.value.hamlet = currentAddressText()
}

function seedCurrentAddressFromPermanent() {
  form.value.householdHouseNumber = form.value.houseNumber
  form.value.householdStreet = form.value.street
  form.value.householdProvince = form.value.province
  form.value.householdWard = form.value.ward
}

watch(
  () => form.value.province,
  (province) => {
    if (form.value.ward && !hasWardInProvince(province, form.value.ward)) {
      form.value.ward = ''
    }
  }
)

watch(
  () => form.value.householdProvince,
  (province) => {
    if (form.value.householdWard && !hasWardInProvince(province, form.value.householdWard)) {
      form.value.householdWard = ''
    }
  }
)

watch(
  () => currentAddressSame.value,
  (checked) => {
    if (checked) syncPermanentAddressFromCurrent()
  }
)

watch(
  () => [
    form.value.householdHouseNumber,
    form.value.householdStreet,
    form.value.householdWard,
    form.value.householdProvince,
  ],
  () => {
    if (currentAddressSame.value) syncPermanentAddressFromCurrent()
  }
)

watch(
  () => form.value.academicYearId,
  () => {
    if (!classOptions.value.length || !form.value.classId || !form.value.academicYearId) return
    const selectedClass = classOptions.value.find((item) => String(item.id) === String(form.value.classId))
    if (selectedClass?.academicYearId != null && selectedClass.academicYearId !== Number(form.value.academicYearId)) {
      form.value.classId = ''
    }
  }
)

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

const displayName = computed(() => {
  const name = fullNameFromParts(form.value.lastName, form.value.firstName) || form.value.name
  if (name) return name
  return isCreateMode.value ? 'Thêm học sinh' : 'Học sinh'
})

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${day}.${month}.${date.getFullYear()} ${hour}:${minute}`
}

function fillForm(row) {
  const split = splitFullName(row.name)
  currentAddressSame.value = false
  form.value = {
    name: row.name || '',
    lastName: row.lastName || split.lastName,
    firstName: row.firstName || split.firstName,
    academicYearId: row.academicYearId != null ? String(row.academicYearId) : '',
    classId: row.classId != null ? String(row.classId) : '',
    grade: row.grade || '',
    email: row.email || '',
    dateOfBirth: row.dateOfBirth || '',
    avatar: row.avatar || '',
    joinDate: row.joinDate || '',
    status: row.status || 'active',
    gender: row.gender === 'female' ? 'female' : 'male',
    ...Object.fromEntries(Object.keys(EXTRA_FIELDS_DEFAULTS).map((key) => [key, row[key] || ''])),
  }
  createdAt.value = row.createdAt || ''
  updatedAt.value = row.updatedAt || ''
  initialAcademicYearIdSnapshot.value = form.value.academicYearId === '' ? '' : String(form.value.academicYearId)
  initialClassIdSnapshot.value = form.value.classId === '' ? '' : String(form.value.classId)
  if (!hasCurrentAddress() && hasPermanentAddress()) {
    seedCurrentAddressFromPermanent()
    currentAddressSame.value = true
  } else {
    currentAddressSame.value = !hasCurrentAddress() || addressesMatch()
  }
  if (currentAddressSame.value) syncPermanentAddressFromCurrent()
}

function defaultAvatarSrc(gender) {
  return String(gender) === 'female' ? defaultAvatarFemale : defaultAvatarMale
}

function formAvatarSrc() {
  const custom = String(form.value.avatar || '').trim()
  return custom || defaultAvatarSrc(form.value.gender)
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

function goBack() {
  router.push('/school')
}

function setDefaultAcademicYear() {
  if (form.value.academicYearId) return
  const currentYear = academicYearOptions.value.find((item) => item.isCurrent) || academicYearOptions.value[0]
  form.value.academicYearId = currentYear?.id ? String(currentYear.id) : ''
}

async function loadMetadata() {
  try {
    const { data } = await api.get('/students/metadata')
    academicYearOptions.value = Array.isArray(data?.academicYears) ? data.academicYears : []
    classOptions.value = Array.isArray(data?.classes) ? data.classes : []
    if (isCreateMode.value) setDefaultAcademicYear()
  } catch {
    academicYearOptions.value = []
    classOptions.value = []
  }
}

async function loadStudent() {
  if (isCreateMode.value) return
  loading.value = true
  loadErr.value = ''
  try {
    const { data } = await api.get(`/students/${studentId.value}`)
    fillForm(data)
  } catch (e) {
    loadErr.value = e.response?.data?.error || e.message || 'Không tải được hồ sơ học sinh'
  } finally {
    loading.value = false
  }
}

function buildPayload() {
  if (currentAddressSame.value) syncPermanentAddressFromCurrent()
  const fullName = fullNameFromParts(form.value.lastName, form.value.firstName)
  return {
    name: fullName,
    lastName: form.value.lastName,
    firstName: form.value.firstName,
    grade: form.value.grade,
    email: form.value.email,
    dateOfBirth: form.value.dateOfBirth,
    academicYearId: form.value.academicYearId === '' ? null : Number(form.value.academicYearId),
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
    houseNumber: form.value.houseNumber,
    street: form.value.street,
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
    ...Object.fromEntries(Object.keys(EXTRA_FIELDS_DEFAULTS).map((key) => [key, form.value[key]])),
  }
}

async function save() {
  formErr.value = ''
  if (!canManageStudents.value) return
  const payload = buildPayload()
  if (!payload.name) {
    formErr.value = 'Vui lòng nhập họ tên học sinh'
    return
  }
  if (!form.value.academicYearId) {
    formErr.value = 'Vui lòng chọn năm học'
    return
  }
  if (!form.value.classId) {
    formErr.value = 'Vui lòng chọn lớp'
    return
  }
  if (!isCreateMode.value && classIsChanging.value) {
    payload.classChangeEffectiveDate = classChangeEffectiveDate.value || undefined
    payload.classChangeNote = classChangeNote.value
  }
  saving.value = true
  try {
    const { data } = isCreateMode.value
      ? await api.post('/students', payload)
      : await api.put(`/students/${studentId.value}`, payload)
    fillForm(data)
    router.push('/school')
  } catch (e) {
    formErr.value = e.response?.data?.error || e.message || (isCreateMode.value ? 'Tạo học sinh thất bại' : 'Lưu hồ sơ thất bại')
  } finally {
    saving.value = false
  }
}

async function removeStudent() {
  if (isCreateMode.value || !studentId.value) return
  if (!confirm(`Xóa hồ sơ "${displayName.value}"?`)) return
  saving.value = true
  formErr.value = ''
  try {
    await api.delete(`/students/${studentId.value}`)
    router.push('/school')
  } catch (e) {
    formErr.value = e.response?.data?.error || e.message || 'Xóa hồ sơ thất bại'
  } finally {
    saving.value = false
  }
}

onBeforeMount(() => {
  store.state.showFooter = false
})

const activeSection = ref('student-info')
let sectionObserver = null

function setupSectionObserver() {
  const ids = ['student-info', 'study-info', 'family-info', 'parent-account', 'address-info', 'extra-info', 'note-info']
  const nodes = ids.map((id) => document.getElementById(id)).filter(Boolean)
  if (!nodes.length || typeof IntersectionObserver === 'undefined') return
  sectionObserver?.disconnect()
  sectionObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
      if (visible[0]?.target?.id) activeSection.value = visible[0].target.id
    },
    { rootMargin: '-20% 0px -55% 0px', threshold: [0.15, 0.35, 0.55] }
  )
  nodes.forEach((node) => sectionObserver.observe(node))
}

onMounted(async () => {
  await loadMetadata()
  await loadStudent()
  await nextTick()
  setupSectionObserver()
})

onBeforeUnmount(() => {
  sectionObserver?.disconnect()
  sectionObserver = null
  store.state.showFooter = true
})
</script>

<template>
  <div class="student-profile-page">
    <div class="profile-shell">
      <header class="profile-topbar">
        <button type="button" class="profile-back" @click="goBack">
          <i class="ni ni-bold-left" aria-hidden="true"></i>
          <span>{{ isCreateMode ? 'Thêm hồ sơ học sinh' : 'Sửa hồ sơ học sinh' }}</span>
        </button>
        <div class="profile-actions">
          <button
            v-if="!isCreateMode"
            type="button"
            class="btn btn-sm btn-outline-danger profile-action-btn"
            :disabled="saving || loading || !canManageStudents"
            @click="removeStudent"
          >
            Xóa
          </button>
          <button type="button" class="btn btn-sm btn-outline-secondary profile-action-btn" :disabled="saving" @click="goBack">
            Hủy
          </button>
          <argon-button
            class="profile-action-btn"
            color="success"
            variant="gradient"
            size="sm"
            type="button"
            :disabled="saving || loading || !canManageStudents"
            @click="save"
          >
            {{ saving ? 'Đang lưu...' : isCreateMode ? 'Tạo' : 'Lưu' }}
          </argon-button>
        </div>
      </header>

      <aside class="profile-sidebar">
        <div class="profile-avatar-wrap">
          <img :src="formAvatarSrc()" alt="" class="profile-avatar" referrerpolicy="no-referrer" @error="onFormAvatarImgError" />
          <label class="profile-avatar-edit" title="Đổi ảnh">
            <input
              ref="avatarFileInput"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              :disabled="uploadingAvatar || saving"
              @change="onAvatarFile"
            />
            <i class="ni ni-camera-compact"></i>
          </label>
        </div>
        <p class="profile-sidebar-name">{{ displayName }}</p>
        <p v-if="uploadingAvatar" class="profile-upload-note">Đang tải ảnh...</p>
        <p v-if="avatarUploadErr" class="profile-upload-error">{{ avatarUploadErr }}</p>

        <nav class="profile-nav">
          <a href="#student-info" :class="{ active: activeSection === 'student-info' }">Thông tin học sinh</a>
          <a href="#study-info" :class="{ active: activeSection === 'study-info' }">Thông tin học tập</a>
          <a v-if="showParentInfo" href="#family-info" :class="{ active: activeSection === 'family-info' }">Thông tin gia đình</a>
          <a v-if="showParentInfo" href="#parent-account" :class="{ active: activeSection === 'parent-account' }">Tài khoản phụ huynh</a>
          <a href="#address-info" :class="{ active: activeSection === 'address-info' }">Thông tin địa chỉ</a>
          <a v-if="showEducationRegistryInfo" href="#extra-info" :class="{ active: activeSection === 'extra-info' }">Thông tin phục vụ CSDLQG ngành Giáo dục</a>
          <a href="#note-info" :class="{ active: activeSection === 'note-info' }">Ghi chú</a>
        </nav>
      </aside>

      <main class="profile-main">
        <argon-alert v-if="loadErr" color="danger" icon="ni ni-fat-remove" class="mb-3">
          {{ loadErr }}
        </argon-alert>
        <argon-alert v-if="formErr" color="danger" icon="ni ni-fat-remove" class="mb-3">
          {{ formErr }}
        </argon-alert>

        <div v-if="loading" class="profile-card">
          <div class="py-5 text-center text-sm text-secondary">Đang tải...</div>
        </div>

        <form v-else class="profile-form" @submit.prevent="save">
          <section id="student-info" class="profile-card profile-card-mint">
            <h6 class="profile-section-title">Thông tin học sinh</h6>
            <div class="profile-grid profile-grid-3">
              <div class="field field-span-2">
                <label>Họ và tên *</label>
                <div class="split-name-grid">
                  <argon-input v-model="form.lastName" placeholder="Họ" name="lastName" autocomplete="family-name" />
                  <argon-input v-model="form.firstName" placeholder="Tên" name="firstName" autocomplete="given-name" />
                </div>
              </div>
              <div class="field">
                <label>Tên gọi ở nhà (Biệt danh)</label>
                <argon-input v-model="form.grade" placeholder="Nhập biệt danh" name="grade" />
              </div>
              <div class="field">
                <label>Ngày sinh *</label>
                <app-date-field v-model="form.dateOfBirth" name="dateOfBirth" />
              </div>
              <div class="field">
                <label>Giới tính *</label>
                <select v-model="form.gender" class="form-control">
                  <option v-for="g in GENDER_OPTIONS" :key="g.value" :value="g.value">{{ g.label }}</option>
                </select>
              </div>
              <div class="field">
                <label>Mã học sinh (Mã HS)</label>
                <argon-input v-model="form.idNumber" placeholder="Nhập mã học sinh" name="idNumber" />
              </div>
              <div class="field">
                <label>Ngày cấp SĐD</label>
                <app-date-field v-model="form.studentIdIssuedDate" name="studentIdIssuedDate" />
              </div>
              <div class="field">
                <label>Số định danh cá nhân</label>
                <argon-input v-model="form.phone" placeholder="Nhập số định danh cá nhân" name="phone" />
              </div>
              <div class="field">
                <label>Dân tộc</label>
                <argon-input v-model="form.nationality" placeholder="Chọn dân tộc" name="nationality" />
              </div>
              <div class="field">
                <label>Mã số thẻ BHYT</label>
                <argon-input v-model="form.bhytNumber" placeholder="Nhập mã số thẻ BHYT" name="bhytNumber" />
              </div>
            </div>
          </section>

          <section id="study-info" class="profile-card">
            <div class="profile-card-header">
              <h6 class="profile-section-title mb-0">Thông tin học tập</h6>
            </div>
            <div class="profile-grid profile-grid-3">
              <div class="field">
                <label>Năm học *</label>
                <select v-model="form.academicYearId" class="form-control" :disabled="studyInfoLocked">
                  <option value="">Chọn năm học</option>
                  <option v-for="year in academicYearOptions" :key="year.id" :value="String(year.id)">{{ year.name }}</option>
                </select>
              </div>
              <div class="field">
                <label>Lớp chính *</label>
                <select v-model="form.classId" class="form-control" :disabled="studyInfoLocked">
                  <option value="">Chọn lớp</option>
                  <option v-for="c in filteredClassOptions" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
                </select>
              </div>
              <div class="field">
                <label>Ngày nhập học *</label>
                <app-date-field v-model="form.joinDate" name="joinDate" :disabled="studyInfoLocked" />
              </div>
              <div v-if="!isCreateMode" class="field">
                <label>Ngày tạo hồ sơ</label>
                <div class="field-readonly" aria-readonly="true">{{ formatDateTime(createdAt) }}</div>
              </div>
              <div v-if="!isCreateMode" class="field">
                <label>Ngày cập nhật</label>
                <div class="field-readonly" aria-readonly="true">{{ formatDateTime(updatedAt) }}</div>
              </div>
              <div class="field">
                <label>Trạng thái *</label>
                <select v-model="form.status" class="form-control" :disabled="studyInfoLocked">
                  <option v-for="o in STATUS_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
                </select>
                <p class="field-hint">Có thể đổi từ Đã nghỉ → Đang học bất cứ lúc nào</p>
              </div>
            </div>
            <div v-if="classIsChanging && isAdmin && !studyInfoLocked" class="profile-subpanel">
              <div class="profile-grid profile-grid-2">
                <div class="field">
                  <label>Ngày hiệu lực chuyển lớp</label>
                  <app-date-field v-model="classChangeEffectiveDate" name="classChangeEffectiveDate" />
                </div>
                <div class="field">
                  <label>Ghi chú chuyển lớp</label>
                  <textarea v-model="classChangeNote" class="form-control" rows="2"></textarea>
                </div>
              </div>
            </div>
          </section>

          <section v-if="showParentInfo" id="family-info" class="profile-card">
            <h6 class="profile-section-title">Thông tin gia đình</h6>
            <div class="family-band mother-band">Thông tin của mẹ</div>
            <div class="profile-grid profile-grid-3">
              <div class="field"><label>Họ và tên mẹ</label><argon-input v-model="form.motherName" placeholder="Nhập họ tên mẹ" name="motherName" /></div>
              <div class="field"><label>Ngày sinh mẹ</label><app-date-field v-model="form.motherBirthDate" name="motherBirthDate" /></div>
              <div class="field"><label>Số điện thoại mẹ</label><argon-input v-model="form.motherPhone" placeholder="Nhập số điện thoại mẹ" name="motherPhone" /></div>
              <div class="field"><label>Email mẹ</label><argon-input v-model="form.motherEmail" type="email" placeholder="Nhập email mẹ" name="motherEmail" /></div>
              <div class="field"><label>Căn cước công dân mẹ</label><argon-input v-model="form.motherIdNumber" placeholder="Nhập căn cước công dân mẹ" name="motherIdNumber" /></div>
              <div class="field"><label>Ngày cấp CCCD mẹ</label><app-date-field v-model="form.motherIdIssuedDate" name="motherIdIssuedDate" /></div>
              <div class="field"><label>Trình độ mẹ</label><argon-input v-model="form.motherEducation" placeholder="VD: ĐH, CĐ, 12/12" name="motherEducation" /></div>
              <div class="field"><label>Nghề nghiệp mẹ</label><argon-input v-model="form.motherOccupation" placeholder="Nhập nghề nghiệp mẹ" name="motherOccupation" /></div>
            </div>

            <div class="family-band father-band">Thông tin của bố</div>
            <div class="profile-grid profile-grid-3">
              <div class="field"><label>Họ và tên bố</label><argon-input v-model="form.fatherName" placeholder="Nhập họ tên bố" name="fatherName" /></div>
              <div class="field"><label>Ngày sinh bố</label><app-date-field v-model="form.fatherBirthDate" name="fatherBirthDate" /></div>
              <div class="field"><label>Số điện thoại bố</label><argon-input v-model="form.fatherPhone" placeholder="Nhập số điện thoại bố" name="fatherPhone" /></div>
              <div class="field"><label>Email bố</label><argon-input v-model="form.fatherEmail" type="email" placeholder="Nhập email bố" name="fatherEmail" /></div>
              <div class="field"><label>Căn cước công dân bố</label><argon-input v-model="form.fatherIdNumber" placeholder="Nhập căn cước công dân bố" name="fatherIdNumber" /></div>
              <div class="field"><label>Ngày cấp CCCD bố</label><app-date-field v-model="form.fatherIdIssuedDate" name="fatherIdIssuedDate" /></div>
              <div class="field"><label>Trình độ bố</label><argon-input v-model="form.fatherEducation" placeholder="VD: ĐH, CĐ, 12/12" name="fatherEducation" /></div>
              <div class="field"><label>Nghề nghiệp bố</label><argon-input v-model="form.fatherOccupation" placeholder="Nhập nghề nghiệp bố" name="fatherOccupation" /></div>
            </div>
          </section>

          <section v-if="showParentInfo" id="parent-account" class="profile-card profile-card-mint">
            <h6 class="profile-section-title">Thông tin phụ huynh</h6>
            <p class="profile-muted">Thông tin đăng nhập luôn đồng nhất với Số điện thoại/email khai báo ở trên</p>
            <div class="account-table">
              <div class="account-head">Danh xưng</div>
              <div class="account-head">Thông tin đăng nhập</div>
              <div>Mẹ</div>
              <argon-input v-model="form.motherLogin" placeholder="Nhập số điện thoại" name="motherLogin" />
              <div>Bố</div>
              <argon-input v-model="form.fatherLogin" placeholder="Nhập số điện thoại" name="fatherLogin" />
            </div>
          </section>

          <section id="address-info" class="profile-card profile-card-address">
            <h6 class="profile-section-title">Thông tin địa chỉ</h6>

            <div class="address-block address-block-current">
              <div class="address-block-head">
                <span class="address-block-label">Địa chỉ hiện tại</span>
              </div>
              <div class="profile-grid profile-grid-4 address-group">
                <div class="field"><label>Số nhà</label><argon-input v-model="form.householdHouseNumber" placeholder="Nhập số nhà" name="householdHouseNumber" /></div>
                <div class="field"><label>Đường</label><argon-input v-model="form.householdStreet" placeholder="Nhập đường" name="householdStreet" /></div>
                <div class="field">
                  <label>Tỉnh/Thành phố</label>
                  <searchable-dropdown v-model="form.householdProvince" :options="provinces" placeholder="Chọn Tỉnh/Thành phố" />
                </div>
                <div class="field">
                  <label>Phường/Xã</label>
                  <searchable-dropdown
                    v-model="form.householdWard"
                    :options="householdWardOptions"
                    :disabled="!selectedHouseholdProvince"
                    :placeholder="selectedHouseholdProvince ? 'Chọn Xã/Phường' : 'Chọn tỉnh trước'"
                  />
                </div>
              </div>
            </div>

            <div class="address-block" :class="currentAddressSame ? 'address-block-locked' : 'address-block-permanent'">
              <div class="address-block-head">
                <span class="address-block-label">Địa chỉ thường trú</span>
                <label class="same-address" :class="{ checked: currentAddressSame }">
                  <input v-model="currentAddressSame" type="checkbox" />
                  <i class="ni ni-check-bold" aria-hidden="true"></i>
                  <span>Lấy theo Địa chỉ hiện tại</span>
                </label>
              </div>
              <div class="profile-grid profile-grid-4 address-group">
                <div class="field"><label>Số nhà</label><argon-input v-model="form.houseNumber" placeholder="Nhập số nhà" name="houseNumber" :disabled="currentAddressSame" /></div>
                <div class="field"><label>Đường/Thôn/Xóm</label><argon-input v-model="form.street" placeholder="Nhập Đường/Thôn/Xóm" name="street" :disabled="currentAddressSame" /></div>
                <div class="field">
                  <label>Tỉnh/Thành phố</label>
                  <searchable-dropdown v-model="form.province" :options="provinces" placeholder="Chọn Tỉnh/Thành phố" :disabled="currentAddressSame" />
                </div>
                <div class="field">
                  <label>Phường/Xã</label>
                  <searchable-dropdown
                    v-model="form.ward"
                    :options="wardOptions"
                    :disabled="currentAddressSame || !selectedProvince"
                    :placeholder="selectedProvince ? 'Chọn Xã/Phường' : 'Chọn tỉnh trước'"
                  />
                </div>
              </div>
            </div>
          </section>

          <section v-if="showEducationRegistryInfo" id="extra-info" class="profile-card">
            <h6 class="profile-section-title">Thông tin phục vụ CSDLQG ngành Giáo dục</h6>
            <div class="profile-grid profile-grid-3">
              <div class="field"><label>Quốc tịch</label><argon-input v-model="form.nationality" placeholder="VD: Việt Nam" name="nationality" /></div>
              <div class="field"><label>Tôn giáo</label><argon-input v-model="form.religion" placeholder="VD: Không" name="religion" /></div>
              <div class="field"><label>Nơi sinh</label><argon-input v-model="form.birthPlace" placeholder="Nơi sinh" name="birthPlace" /></div>
              <div class="field"><label>Địa chỉ nơi sinh</label><argon-input v-model="form.birthAddress" placeholder="Địa chỉ nơi sinh" name="birthAddress" /></div>
              <div class="field"><label>Phường nơi sinh</label><argon-input v-model="form.birthWard" placeholder="Phường/Xã nơi sinh" name="birthWard" /></div>
              <div class="field"><label>Tỉnh/TP nơi sinh</label><argon-input v-model="form.birthProvince" placeholder="Tỉnh/TP nơi sinh" name="birthProvince" /></div>
              <div class="field"><label>Quê quán - Phường/Xã</label><argon-input v-model="form.hometownWard" placeholder="Quê quán phường/xã" name="hometownWard" /></div>
              <div class="field"><label>Quê quán - Tỉnh/TP</label><argon-input v-model="form.hometownProvince" placeholder="Quê quán tỉnh/TP" name="hometownProvince" /></div>
              <div class="field"><label>Khai sinh - Phường/Xã</label><argon-input v-model="form.birthRegistrationWard" placeholder="Nơi khai sinh phường/xã" name="birthRegistrationWard" /></div>
              <div class="field"><label>Khai sinh - Quận/Huyện</label><argon-input v-model="form.birthRegistrationDistrict" placeholder="Nơi khai sinh quận/huyện" name="birthRegistrationDistrict" /></div>
              <div class="field"><label>Khai sinh - Tỉnh/TP</label><argon-input v-model="form.birthRegistrationProvince" placeholder="Nơi khai sinh tỉnh/TP" name="birthRegistrationProvince" /></div>
              <div class="field"><label>Khai sinh mới - Phường/Xã</label><argon-input v-model="form.birthRegistrationNewWard" placeholder="Nơi khai sinh mới phường/xã" name="birthRegistrationNewWard" /></div>
              <div class="field"><label>Khai sinh mới - Tỉnh/TP</label><argon-input v-model="form.birthRegistrationNewProvince" placeholder="Nơi khai sinh mới tỉnh/TP" name="birthRegistrationNewProvince" /></div>
              <div class="field"><label>Ngày cấp giấy tờ</label><app-date-field v-model="form.idIssuedDate" name="idIssuedDate" /></div>
              <div class="field"><label>Loại khuyết tật</label><argon-input v-model="form.disabilityType" name="disabilityType" /></div>
              <div class="field"><label>Đối tượng chính sách</label><argon-input v-model="form.policyBeneficiary" name="policyBeneficiary" /></div>
              <div class="field"><label>Bệnh về mắt</label><argon-input v-model="form.eyeDisease" name="eyeDisease" /></div>
            </div>
          </section>

          <section id="document-info" class="profile-card" style="display: none;">
            <h6 class="profile-section-title">Hồ sơ học sinh</h6>
            <div class="profile-grid profile-grid-4">
              <div v-for="[field, label] in DOC_FIELDS" :key="field" class="field">
                <label>{{ label }}</label>
                <argon-input v-model="form[field]" placeholder="VD: x, 2, ghi chú" :name="field" />
              </div>
            </div>
          </section>

          <section id="note-info" class="profile-card">
            <h6 class="profile-section-title">Ghi chú</h6>
            <textarea v-model="form.grade" class="form-control" rows="3" placeholder="Nhập ghi chú"></textarea>
          </section>
        </form>
      </main>
    </div>
  </div>
</template>

<style scoped>
.student-profile-page {
  --profile-topbar-h: 3.15rem;
  --profile-page-x: 1.25rem;
  --profile-gap: 1rem;
  --profile-accent: #0f9f7a;
  --profile-accent-soft: #edf9f4;
  --profile-border: #e4ebf2;
  --profile-text: #1f2a44;
  --profile-muted: #667085;
  min-height: 100vh;
  margin: 0 -1.5rem;
  padding: 1rem var(--profile-page-x) 1.75rem;
  background: #f3f6fa;
  color: var(--profile-text);
}

.profile-shell {
  display: grid;
  grid-template-columns: 15.5rem minmax(0, 1fr);
  grid-template-areas:
    "topbar topbar"
    "sidebar main";
  gap: var(--profile-gap);
  align-items: start;
}

.profile-topbar {
  grid-area: topbar;
  position: sticky;
  top: 0.65rem;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem;
  height: var(--profile-topbar-h);
  padding: 0 0.9rem 0 0.75rem;
  border: 1px solid var(--profile-border);
  border-radius: 0.85rem;
  background: #ffffff;
  box-shadow: 0 0.2rem 0.7rem rgba(31, 42, 68, 0.04);
}

.profile-back {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  height: 2.15rem;
  margin: 0;
  padding: 0 0.35rem;
  border: 0;
  border-radius: 0.5rem;
  background: transparent;
  color: var(--profile-text);
  font-size: 0.92rem;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;
}

.profile-back i {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  font-size: 0.82rem;
  line-height: 1;
  color: var(--profile-accent);
}

.profile-back:hover {
  background: var(--profile-accent-soft);
  color: #0f766e;
}

.profile-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
  gap: 0.4rem;
  height: 2.15rem;
}

.profile-actions :deep(.profile-action-btn),
.profile-actions .profile-action-btn {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  height: 2.15rem !important;
  min-height: 2.15rem !important;
  margin: 0 !important;
  padding: 0 0.85rem !important;
  border-radius: 0.55rem !important;
  font-size: 0.78rem !important;
  font-weight: 700 !important;
  line-height: 1 !important;
  white-space: nowrap;
}

.profile-sidebar {
  grid-area: sidebar;
  position: sticky;
  top: calc(var(--profile-topbar-h) + 1.4rem);
  align-self: start;
  padding: 1.15rem 0.9rem 1rem;
  border: 1px solid var(--profile-border);
  border-radius: 0.9rem;
  background: #ffffff;
  box-shadow: 0 0.35rem 1rem rgba(31, 42, 68, 0.035);
}

.profile-avatar-wrap {
  position: relative;
  width: 5.75rem;
  height: 5.75rem;
  margin: 0.15rem auto 0.75rem;
}

.profile-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border: 3px solid #e8f5ef;
  border-radius: 999px;
  background: #eef6f2;
}

.profile-avatar-edit {
  position: absolute;
  right: -0.05rem;
  bottom: 0.3rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.7rem;
  height: 1.7rem;
  border: 3px solid #ffffff;
  border-radius: 999px;
  background: #8ee2c4;
  color: #08956f;
  cursor: pointer;
  box-shadow: 0 0.2rem 0.55rem rgba(15, 118, 110, 0.16);
}

.profile-avatar-edit input { display: none; }

.profile-sidebar-name {
  margin: 0 0 0.85rem;
  color: var(--profile-text);
  font-size: 0.86rem;
  font-weight: 800;
  line-height: 1.3;
  text-align: center;
}

.profile-upload-note,
.profile-upload-error {
  margin: -0.35rem 0 0.7rem;
  font-size: 0.72rem;
  text-align: center;
}

.profile-upload-note { color: #08956f; }
.profile-upload-error { color: #ef4444; }

.profile-nav {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding-top: 0.35rem;
  border-top: 1px solid #eef2f6;
}

.profile-nav a {
  display: flex;
  align-items: center;
  min-height: 2.3rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.55rem;
  color: #445066;
  font-size: 0.8rem;
  font-weight: 750;
  line-height: 1.28;
  text-decoration: none;
  transition: background 0.15s ease, color 0.15s ease;
}

.profile-nav a:hover {
  background: #f3faf7;
  color: #0f766e;
}

.profile-nav a.active {
  background: #dff5eb;
  color: #0f766e;
}

.profile-main {
  grid-area: main;
  min-width: 0;
}

.profile-form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.profile-card {
  scroll-margin-top: calc(var(--profile-topbar-h) + 1.5rem);
  padding: 1.05rem 1.1rem 1.15rem;
  border: 1px solid var(--profile-border);
  border-radius: 0.9rem;
  background: #ffffff;
  box-shadow: 0 0.2rem 0.75rem rgba(31, 42, 68, 0.025);
}

.profile-card-mint {
  border-color: #d5ebe2;
  background: linear-gradient(180deg, #f5fbf8 0%, #ffffff 42%);
}

.profile-card-address {
  border-color: #d5ebe2;
  background: #ffffff;
}

.profile-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.85rem;
}

.profile-section-title {
  margin: 0 0 0.85rem;
  color: var(--profile-text);
  font-size: 0.95rem;
  font-weight: 850;
}

.profile-subtitle {
  margin: 0.4rem 0 0.8rem;
  color: var(--profile-text);
  font-size: 0.82rem;
  font-weight: 800;
}

.address-block {
  margin-top: 0.7rem;
  border: 1px solid #e3ebe7;
  border-radius: 0.55rem;
  background: #fbfcfd;
  overflow: hidden;
}

.address-block:first-of-type {
  margin-top: 0;
}

.address-block-current {
  border-color: #cfe8de;
  background: #fbfcfd;
}

.address-block-permanent,
.address-block-locked {
  border-color: #e2e8ee;
  background: #fbfcfd;
}

.address-block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  min-height: 2.15rem;
  padding: 0.45rem 0.8rem;
  border-bottom: 1px solid #e6eee9;
}

.address-block-current .address-block-head {
  border-bottom-color: #d7ebe3;
  background: #eaf7f1;
}

.address-block-permanent .address-block-head,
.address-block-locked .address-block-head {
  border-bottom-color: #e6edf2;
  background: #eef2f6;
}

.address-block-label {
  color: #0f9f7a;
  font-size: 0.8rem;
  font-weight: 800;
}

.address-group {
  margin: 0;
  padding: 0.75rem 0.8rem 0.85rem;
  border: 0;
  background: #fbfcfd;
}

.profile-card-address .profile-grid { gap: 0.55rem 0.65rem; }

.profile-card-address .field label {
  color: #4a5d6d;
  font-size: 0.74rem;
  margin-bottom: 0.32rem;
}

.profile-card :deep(.form-control),
.profile-card select.form-control,
.profile-card :deep(.dp__input) {
  min-height: 2.35rem;
  border-color: #d7e1ea;
  border-radius: 0.55rem;
  background-color: #ffffff;
}

.profile-card :deep(.form-control:focus),
.profile-card select.form-control:focus {
  border-color: #8ed2bb;
  box-shadow: 0 0 0 0.15rem rgba(15, 159, 122, 0.12);
}

.profile-card-address :deep(.form-control),
.profile-card-address select.form-control {
  min-height: 2.25rem;
  border-color: #d5e3db;
}

.profile-card-address :deep(input:disabled),
.profile-card-address :deep(.form-control:disabled),
.address-block-locked :deep(input),
.address-block-locked :deep(.form-control) {
  color: #667085;
  border-color: #d9e4de;
  background-color: #eef3f0;
  cursor: not-allowed;
  opacity: 1;
}

.profile-card :deep(.mb-3),
.profile-card :deep(.form-group),
.profile-card-address :deep(.mb-3),
.profile-card-address :deep(.form-group) {
  margin-bottom: 0 !important;
}

.profile-muted {
  margin: -0.35rem 0 0.85rem;
  color: var(--profile-muted);
  font-size: 0.8rem;
  font-style: italic;
  font-weight: 650;
}

.profile-link-button {
  border: 0;
  background: transparent;
  color: #0f9f7a;
  font-size: 0.78rem;
  font-weight: 850;
}

.profile-grid {
  display: grid;
  gap: 0.8rem 0.85rem;
}

.profile-grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.profile-grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.profile-grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }

.field-full { grid-column: 1 / -1; }
.field-wide { grid-column: span 1; }
.field-span-2 { grid-column: span 2; }

.field-hint {
  margin: 0.35rem 0 0;
  color: #7a8799;
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1.35;
}

.field-readonly {
  display: flex;
  align-items: center;
  min-height: 2.25rem;
  padding: 0.45rem 0.75rem;
  border: 1px solid #d9e4de;
  border-radius: 0.5rem;
  background: #eef3f0;
  color: #667085;
  font-size: 0.875rem;
  font-weight: 650;
  line-height: 1.3;
  cursor: default;
  user-select: text;
}

.field label,
.account-head {
  display: block;
  margin-bottom: 0.35rem;
  color: #334155;
  font-size: 0.76rem;
  font-weight: 800;
}

.split-name-grid {
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  gap: 0.55rem;
}

.profile-subpanel {
  margin-top: 0.85rem;
  padding: 0.85rem;
  border: 1px solid #d7ebe3;
  border-radius: 0.65rem;
  background: #f7fffc;
}

.family-band {
  display: flex;
  align-items: center;
  min-height: 1.7rem;
  margin: 0.3rem 0 0.75rem;
  padding: 0.25rem 0.75rem;
  border-radius: 0.3rem;
  color: #1f2a44;
  font-size: 0.82rem;
  font-weight: 850;
}

.mother-band { background: #ffd7dc; }
.father-band { background: #d7ebff; margin-top: 1rem; }

.account-table {
  display: grid;
  grid-template-columns: 9rem minmax(0, 1fr);
  gap: 0.75rem;
  align-items: center;
}

.same-address {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: #0f9f7a;
  font-size: 0.76rem;
  font-weight: 750;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.same-address i {
  font-size: 0.78rem;
  opacity: 0.35;
}

.same-address.checked i {
  opacity: 1;
}

.same-address:hover {
  color: #0b7d60;
}

.same-address input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

:global(html) { scroll-behavior: smooth; }

@media (max-width: 1199.98px) {
  .profile-grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .field-span-2 { grid-column: 1 / -1; }
}

@media (max-width: 991.98px) {
  .student-profile-page {
    margin: 0 -1rem;
    padding: 0.85rem 1rem 1.4rem;
  }

  .profile-shell {
    grid-template-columns: 1fr;
    grid-template-areas:
      "topbar"
      "sidebar"
      "main";
  }

  .profile-sidebar {
    position: static;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.75rem 1rem;
    align-items: center;
  }

  .profile-avatar-wrap {
    margin: 0;
    width: 4.5rem;
    height: 4.5rem;
  }

  .profile-sidebar-name {
    margin: 0;
    text-align: left;
    grid-column: 2;
    grid-row: 1;
  }

  .profile-upload-note,
  .profile-upload-error {
    grid-column: 1 / -1;
    margin: 0;
    text-align: left;
  }

  .profile-nav {
    grid-column: 1 / -1;
    flex-direction: row;
    overflow-x: auto;
    padding-top: 0.65rem;
    gap: 0.35rem;
  }

  .profile-nav a { white-space: nowrap; }

  .profile-grid-3,
  .profile-grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }

  .field-span-2 { grid-column: 1 / -1; }
}

@media (max-width: 575.98px) {
  .student-profile-page { margin: 0; }

  .profile-topbar {
    height: auto;
    min-height: var(--profile-topbar-h);
    padding: 0.55rem 0.7rem;
    flex-wrap: wrap;
  }

  .profile-actions {
    width: 100%;
    height: auto;
    flex-wrap: wrap;
    justify-content: flex-start;
  }

  .same-address { white-space: normal; }

  .field-span-2 { grid-column: 1 / -1; }

  .profile-grid-2,
  .profile-grid-3,
  .profile-grid-4,
  .split-name-grid,
  .account-table { grid-template-columns: 1fr; }
}
</style>
