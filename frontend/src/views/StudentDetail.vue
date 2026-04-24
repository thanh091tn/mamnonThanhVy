<script setup>
import { computed, onMounted, ref, watch } from 'vue'
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
  ...EXTRA_FIELDS_DEFAULTS,
})

const isCreateMode = computed(() => route.name === 'StudentCreate')
const studentId = computed(() => Number(route.params.id))
const classOptions = ref([])
const loading = ref(false)
const saving = ref(false)
const loadErr = ref('')
const formErr = ref('')
const avatarFileInput = ref(null)
const uploadingAvatar = ref(false)
const avatarUploadErr = ref('')
const currentAddressSame = ref(true)
const initialClassIdSnapshot = ref('')
const classChangeEffectiveDate = ref(new Date().toISOString().slice(0, 10))
const classChangeNote = ref('')

const classIsChanging = computed(() => {
  if (isCreateMode.value) return false
  const cur = form.value.classId === '' ? '' : String(form.value.classId)
  const snap = initialClassIdSnapshot.value === '' ? '' : String(initialClassIdSnapshot.value)
  return cur !== snap
})

const selectedProvince = computed(() => findProvinceByName(form.value.province))
const wardOptions = computed(() => wardsForProvinceName(form.value.province))

function permanentAddressText() {
  const parts = [form.value.houseNumber, form.value.street, form.value.ward, form.value.province]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
  return parts.join(', ')
}

function syncCurrentAddressFromPermanent() {
  form.value.hamlet = permanentAddressText()
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
  () => currentAddressSame.value,
  (checked) => {
    if (checked) syncCurrentAddressFromPermanent()
  }
)

watch(
  () => [form.value.houseNumber, form.value.street, form.value.ward, form.value.province],
  () => {
    if (currentAddressSame.value) syncCurrentAddressFromPermanent()
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

function fillForm(row) {
  const split = splitFullName(row.name)
  currentAddressSame.value = false
  form.value = {
    name: row.name || '',
    lastName: row.lastName || split.lastName,
    firstName: row.firstName || split.firstName,
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
  initialClassIdSnapshot.value = form.value.classId === '' ? '' : String(form.value.classId)
  const permanentAddress = permanentAddressText()
  currentAddressSame.value = !form.value.hamlet || form.value.hamlet === permanentAddress
  if (currentAddressSame.value) syncCurrentAddressFromPermanent()
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

async function loadClasses() {
  try {
    const { data } = await api.get('/classes')
    classOptions.value = Array.isArray(data) ? data : []
  } catch {
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
  if (currentAddressSame.value) syncCurrentAddressFromPermanent()
  const fullName = fullNameFromParts(form.value.lastName, form.value.firstName)
  return {
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

onMounted(async () => {
  await Promise.all([loadClasses(), loadStudent()])
})
</script>

<template>
  <div class="student-profile-page">
    <header class="profile-topbar">
      <button type="button" class="profile-back" @click="goBack">
        <i class="ni ni-bold-left"></i>
        <span>{{ isCreateMode ? 'Thêm hồ sơ học sinh' : 'Sửa hồ sơ học sinh' }}</span>
      </button>
      <div class="profile-actions">
        <button type="button" class="btn btn-sm btn-outline-secondary mb-0" :disabled="saving" @click="goBack">Hủy</button>
        <argon-button color="success" variant="gradient" size="sm" type="button" :disabled="saving || loading || !canManageStudents" @click="save">
          {{ saving ? 'Đang lưu...' : isCreateMode ? 'Tạo' : 'Lưu' }}
        </argon-button>
      </div>
    </header>

    <div class="profile-shell">
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
        <p v-if="uploadingAvatar" class="profile-upload-note">Đang tải ảnh...</p>
        <p v-if="avatarUploadErr" class="profile-upload-error">{{ avatarUploadErr }}</p>

        <nav class="profile-nav">
          <a href="#student-info" class="active">Thông tin học sinh</a>
          <a href="#study-info">Thông tin học tập</a>
          <a href="#family-info">Thông tin gia đình</a>
          <a href="#parent-account">Tài khoản phụ huynh</a>
          <a href="#address-info">Thông tin địa chỉ</a>
          <a href="#extra-info">Thông tin phục vụ CSDLQG ngành Giáo dục</a>
          <a href="#note-info">Ghi chú</a>
        </nav>
      </aside>

      <main class="profile-main">
        <div class="profile-status-row">
          <span class="profile-status-dot">!</span>
          <span>Có thể thay đổi trạng thái từ <strong>Đã nghỉ</strong> → <strong>Đang học</strong> bất cứ lúc nào</span>
        </div>

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
          <div class="profile-floating-actions">
            <button v-if="!isCreateMode" type="button" class="btn btn-sm btn-outline-danger mb-0" :disabled="saving" @click="removeStudent">Xóa hồ sơ</button>
            <argon-button color="success" variant="outline" size="sm" type="submit" :disabled="saving || !canManageStudents">
              {{ saving ? 'Đang lưu...' : isCreateMode ? 'Tạo học sinh' : 'Bảo lưu/Đã nghỉ' }}
            </argon-button>
          </div>

          <section id="student-info" class="profile-card profile-card-mint">
            <h6 class="profile-section-title">Thông tin học sinh</h6>
            <div class="profile-grid profile-grid-3">
              <div class="field field-wide">
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
                <label>Số định danh cá nhân</label>
                <argon-input v-model="form.phone" placeholder="Nhập số định danh cá nhân" name="phone" />
              </div>
              <div class="field">
                <label>Dân tộc</label>
                <argon-input v-model="form.nationality" placeholder="Chọn dân tộc" name="nationality" />
              </div>
              <div class="field">
                <label>Số nhà</label>
                <argon-input v-model="form.houseNumber" placeholder="Nhập số nhà" name="houseNumber" />
              </div>
              <div class="field">
                <label>Mã số thẻ BHYT</label>
                <argon-input v-model="form.bhytNumber" placeholder="Nhập mã số thẻ BHYT" name="bhytNumber" />
              </div>
              <div class="field">
                <label>Nơi đăng ký khám chữa bệnh ban đầu</label>
                <argon-input v-model="form.idIssuedPlace" placeholder="Nhập nơi đăng ký khám chữa bệnh ban đầu" name="idIssuedPlace" />
              </div>
            </div>
          </section>

          <section id="study-info" class="profile-card">
            <div class="profile-card-header">
              <h6 class="profile-section-title mb-0">Thông tin học tập</h6>
              <button v-if="!isCreateMode" type="button" class="profile-link-button">Chuyển trạng thái</button>
            </div>
            <div class="profile-grid profile-grid-3">
              <div class="field">
                <label>Lớp chính *</label>
                <select v-model="form.classId" class="form-control">
                  <option value="">Chọn lớp</option>
                  <option v-for="c in classOptions" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
                </select>
              </div>
              <div class="field">
                <label>Ngày nhập học *</label>
                <app-date-field v-model="form.joinDate" name="joinDate" />
              </div>
              <div class="field">
                <label>Trạng thái *</label>
                <select v-model="form.status" class="form-control">
                  <option v-for="o in STATUS_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
                </select>
              </div>
              <div class="field field-full">
                <label>Lớp năng khiếu</label>
                <argon-input v-model="form.email" placeholder="Chọn lớp" name="email" />
              </div>
            </div>
            <div v-if="classIsChanging && isAdmin" class="profile-subpanel">
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

          <section id="family-info" class="profile-card">
            <h6 class="profile-section-title">Thông tin gia đình</h6>
            <div class="family-band mother-band">Thông tin của mẹ</div>
            <div class="profile-grid profile-grid-3">
              <div class="field"><label>Họ và tên mẹ</label><argon-input v-model="form.motherName" placeholder="Nhập họ tên mẹ" name="motherName" /></div>
              <div class="field"><label>Ngày sinh mẹ</label><app-date-field v-model="form.motherBirthDate" name="motherBirthDate" /></div>
              <div class="field"><label>Số điện thoại mẹ</label><argon-input v-model="form.motherPhone" placeholder="Nhập số điện thoại mẹ" name="motherPhone" /></div>
              <div class="field"><label>Email mẹ</label><argon-input v-model="form.motherEmail" type="email" placeholder="Nhập email mẹ" name="motherEmail" /></div>
              <div class="field"><label>Căn cước công dân mẹ</label><argon-input v-model="form.motherIdNumber" placeholder="Nhập căn cước công dân mẹ" name="motherIdNumber" /></div>
              <div class="field"><label>Nghề nghiệp mẹ</label><argon-input v-model="form.motherOccupation" placeholder="Nhập nghề nghiệp mẹ" name="motherOccupation" /></div>
            </div>

            <div class="family-band father-band">Thông tin của bố</div>
            <div class="profile-grid profile-grid-3">
              <div class="field"><label>Họ và tên bố</label><argon-input v-model="form.fatherName" placeholder="Nhập họ tên bố" name="fatherName" /></div>
              <div class="field"><label>Ngày sinh bố</label><app-date-field v-model="form.fatherBirthDate" name="fatherBirthDate" /></div>
              <div class="field"><label>Số điện thoại bố</label><argon-input v-model="form.fatherPhone" placeholder="Nhập số điện thoại bố" name="fatherPhone" /></div>
              <div class="field"><label>Email bố</label><argon-input v-model="form.fatherEmail" type="email" placeholder="Nhập email bố" name="fatherEmail" /></div>
              <div class="field"><label>Căn cước công dân bố</label><argon-input v-model="form.fatherIdNumber" placeholder="Nhập căn cước công dân bố" name="fatherIdNumber" /></div>
              <div class="field"><label>Nghề nghiệp bố</label><argon-input v-model="form.fatherOccupation" placeholder="Nhập nghề nghiệp bố" name="fatherOccupation" /></div>
            </div>
          </section>

          <section id="parent-account" class="profile-card profile-card-mint">
            <h6 class="profile-section-title">Tài khoản phụ huynh</h6>
            <p class="profile-muted">Thông tin đăng nhập luôn đồng nhất với Số điện thoại/email khai báo ở trên</p>
            <div class="account-table">
              <div class="account-head">Danh xưng</div>
              <div class="account-head">Thông tin đăng nhập</div>
              <div>Mẹ</div>
              <argon-input v-model="form.motherLogin" placeholder="Nhập số điện thoại/email" name="motherLogin" />
              <div>Bố</div>
              <argon-input v-model="form.fatherLogin" placeholder="Nhập số điện thoại/email" name="fatherLogin" />
            </div>
          </section>

          <section id="address-info" class="profile-card profile-card-address">
            <h6 class="profile-section-title">Thông tin địa chỉ</h6>
            <p class="profile-subtitle">Địa chỉ thường trú</p>
            <div class="profile-grid profile-grid-4">
              <div class="field"><label>Số nhà</label><argon-input v-model="form.houseNumber" placeholder="Nhập số nhà" name="houseNumber" /></div>
              <div class="field"><label>Đường/Thôn/Xóm</label><argon-input v-model="form.street" placeholder="Nhập Đường/Thôn/Xóm" name="street" /></div>
              <div class="field">
                <label>Tỉnh/Thành phố</label>
                <searchable-dropdown v-model="form.province" :options="provinces" placeholder="Chọn Tỉnh/Thành phố" />
              </div>
              <div class="field">
                <label>Xã/Phường</label>
                <searchable-dropdown
                  v-model="form.ward"
                  :options="wardOptions"
                  :disabled="!selectedProvince"
                  :placeholder="selectedProvince ? 'Chọn Xã/Phường' : 'Chọn tỉnh trước'"
                />
              </div>
            </div>
            <div class="address-current-header">
              <p class="profile-subtitle">Địa chỉ hiện tại</p>
              <label class="same-address">
                <input v-model="currentAddressSame" type="checkbox" />
                <span>Lấy theo Địa chỉ thường trú</span>
              </label>
            </div>
            <argon-input
              v-model="form.hamlet"
              placeholder="Nhập địa chỉ hiện tại"
              name="hamlet"
              :disabled="currentAddressSame"
            />
          </section>

          <section id="extra-info" class="profile-card">
            <h6 class="profile-section-title">Thông tin phục vụ CSDLQG ngành Giáo dục</h6>
            <div class="profile-grid profile-grid-3">
              <div class="field"><label>Quốc tịch</label><argon-input v-model="form.nationality" placeholder="VD: Việt Nam" name="nationality" /></div>
              <div class="field"><label>Tôn giáo</label><argon-input v-model="form.religion" placeholder="VD: Không" name="religion" /></div>
              <div class="field"><label>Nơi sinh</label><argon-input v-model="form.birthPlace" placeholder="Nơi sinh" name="birthPlace" /></div>
              <div class="field"><label>Ngày cấp giấy tờ</label><app-date-field v-model="form.idIssuedDate" name="idIssuedDate" /></div>
              <div class="field"><label>Loại khuyết tật</label><argon-input v-model="form.disabilityType" name="disabilityType" /></div>
              <div class="field"><label>Đối tượng chính sách</label><argon-input v-model="form.policyBeneficiary" name="policyBeneficiary" /></div>
              <div class="field"><label>Bệnh về mắt</label><argon-input v-model="form.eyeDisease" name="eyeDisease" /></div>
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
  min-height: 100vh;
  background: #f4f7fb;
  color: #1f2a44;
}

.profile-topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 3.2rem;
  padding: 0.6rem 1.25rem;
  border-bottom: 1px solid #e9eef7;
  background: #ffffff;
}

.profile-back {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  border: 0;
  background: transparent;
  color: #1f2a44;
  font-size: 1rem;
  font-weight: 800;
  cursor: pointer;
}

.profile-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.profile-shell {
  display: grid;
  grid-template-columns: 13.75rem minmax(0, 1fr);
  gap: 1.25rem;
  padding: 0.9rem 1rem 1.5rem;
}

.profile-sidebar {
  position: sticky;
  top: 4.1rem;
  align-self: start;
  min-height: calc(100vh - 5rem);
  padding: 0.9rem;
  border-radius: 0.9rem;
  background: #ffffff;
}

.profile-avatar-wrap {
  position: relative;
  width: 6.9rem;
  height: 6.9rem;
  margin: 0 auto 1rem;
}

.profile-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 999px;
  background: #eef6f2;
}

.profile-avatar-edit {
  position: absolute;
  right: 0.2rem;
  bottom: 0.2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  border: 2px solid #ffffff;
  border-radius: 999px;
  background: #bfeedd;
  color: #08956f;
  cursor: pointer;
}

.profile-avatar-edit input {
  display: none;
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
  gap: 0.35rem;
}

.profile-nav a {
  display: flex;
  align-items: center;
  min-height: 2.55rem;
  padding: 0.65rem 0.8rem;
  border-radius: 0.35rem;
  color: #1f2a44;
  font-size: 0.83rem;
  font-weight: 750;
}

.profile-nav a:hover,
.profile-nav a.active {
  background: #bfeedd;
  color: #0f766e;
}

.profile-main {
  min-width: 0;
}

.profile-status-row {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0.3rem 0 0.75rem;
  color: #667085;
  font-size: 0.78rem;
  font-style: italic;
  font-weight: 650;
}

.profile-status-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  border-radius: 999px;
  background: #bfeedd;
  color: #0f766e;
  font-style: normal;
}

.profile-form {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.profile-floating-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.45rem;
  margin-bottom: -0.1rem;
}

.profile-card {
  padding: 1rem;
  border: 1px solid #dfe7f0;
  border-radius: 0.85rem;
  background: #ffffff;
}

.profile-card-mint {
  border-color: #cfeee3;
  background: #edf9f4;
}

.profile-card-address {
  padding-bottom: 0.75rem;
}

.profile-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.8rem;
}

.profile-section-title {
  margin: 0 0 0.9rem;
  color: #1f2a44;
  font-size: 0.98rem;
  font-weight: 850;
}

.profile-subtitle {
  margin: 0.4rem 0 0.8rem;
  color: #1f2a44;
  font-size: 0.82rem;
  font-weight: 800;
}

.profile-card-address .profile-subtitle {
  margin-bottom: 0.5rem;
}

.profile-card-address .profile-grid {
  gap: 0.65rem;
}

.profile-card-address :deep(.mb-3),
.profile-card-address :deep(.form-group) {
  margin-bottom: 0 !important;
}

.profile-muted {
  margin: -0.4rem 0 0.9rem;
  color: #667085;
  font-size: 0.82rem;
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
  gap: 0.85rem;
}

.profile-grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.profile-grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.profile-grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }

.field-full { grid-column: 1 / -1; }
.field-wide { grid-column: span 1; }

.field label,
.account-head {
  display: block;
  margin-bottom: 0.35rem;
  color: #1f2a44;
  font-size: 0.78rem;
  font-weight: 800;
}

.split-name-grid {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: 0.5rem;
}

:deep(.form-control),
select.form-control,
textarea.form-control {
  min-height: 2rem;
  border: 1px solid #d9e2ee;
  border-radius: 0.35rem;
  background-color: #ffffff;
  color: #1f2a44;
  font-size: 0.86rem;
}

:deep(.form-control:focus),
select.form-control:focus,
textarea.form-control:focus {
  border-color: #56c9ad;
  box-shadow: 0 0 0 0.18rem rgba(86, 201, 173, 0.15);
}

.profile-card-mint :deep(.form-control),
.profile-card-mint select.form-control {
  background-color: rgba(255, 255, 255, 0.92);
}

.profile-subpanel {
  grid-column: 1 / -1;
  padding: 0.85rem;
  border: 1px solid #cfeee3;
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
  gap: 0.5rem;
  margin-bottom: 0;
  color: #1f2a44;
  font-size: 0.84rem;
  font-weight: 750;
}

.address-current-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin: 0.7rem 0 0.45rem;
}

.address-current-header .profile-subtitle {
  margin: 0;
}

.same-address input {
  width: 1rem;
  height: 1rem;
  accent-color: #12b886;
}

:global(html) {
  scroll-behavior: smooth;
}

@media (max-width: 1199.98px) {
  .profile-grid-4 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 991.98px) {
  .profile-shell {
    grid-template-columns: 1fr;
  }

  .profile-sidebar {
    position: static;
    min-height: auto;
  }

  .profile-nav {
    flex-direction: row;
    overflow-x: auto;
  }

  .profile-nav a {
    white-space: nowrap;
  }

  .profile-grid-3,
  .profile-grid-4 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 575.98px) {
  .profile-topbar,
  .profile-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .profile-grid-2,
  .profile-grid-3,
  .profile-grid-4,
  .split-name-grid,
  .account-table {
    grid-template-columns: 1fr;
  }

  .profile-floating-actions {
    flex-direction: column;
  }
}
</style>
