<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { api } from '../api/client.js'
import ArgonInput from '@/components/ArgonInput.vue'
import ArgonButton from '@/components/ArgonButton.vue'
import ArgonAlert from '@/components/ArgonAlert.vue'

const items = ref([])
const loading = ref(false)
const loadErr = ref('')

const PAGE_SIZE = 10
const currentPage = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(items.value.length / PAGE_SIZE)))
const pagedItems = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return items.value.slice(start, start + PAGE_SIZE)
})

function goToPage(page) {
  currentPage.value = Math.max(1, Math.min(page, totalPages.value))
}
const formErr = ref('')
const editingId = ref(null)
const saving = ref(false)
const drawerOpen = ref(false)

const STATUS_OPTIONS = [
  { value: 'active', label: 'Đang dạy' },
  { value: 'inactive', label: 'Nghỉ việc' },
  { value: 'leave', label: 'Tạm nghỉ' },
]

const GENDER_OPTIONS = [
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
]

const form = ref({
  name: '',
  email: '',
  phone: '',
  address: '',
  status: 'active',
  gender: 'male',
})

function resetForm() {
  editingId.value = null
  form.value = { name: '', email: '', phone: '', address: '', status: 'active', gender: 'male' }
}

function statusLabel(val) {
  return STATUS_OPTIONS.find(o => o.value === val)?.label || val
}

function genderLabel(val) {
  return GENDER_OPTIONS.find(o => o.value === val)?.label || val
}

function resetAll() {
  resetForm()
  formErr.value = ''
  saving.value = false
}

function closeDrawer() {
  drawerOpen.value = false
  resetAll()
}

function openCreate() {
  resetAll()
  drawerOpen.value = true
}

function openEdit(row) {
  resetAll()
  editingId.value = row.id
  form.value = {
    name: row.name,
    email: row.email || '',
    phone: row.phone || '',
    address: row.address || '',
    status: row.status || 'active',
    gender: row.gender || 'male',
  }
  drawerOpen.value = true
}

async function load() {
  loading.value = true
  loadErr.value = ''
  try {
    const { data } = await api.get('/teachers')
    items.value = data
    currentPage.value = 1
  } catch (e) {
    loadErr.value = e.response?.data?.error || e.message || 'Failed to load teachers'
  } finally {
    loading.value = false
  }
}

async function save() {
  formErr.value = ''
  if (!form.value.name?.trim()) {
    formErr.value = 'Vui lòng nhập họ tên'
    return
  }
  saving.value = true
  try {
    const payload = {
      name: form.value.name.trim(),
      email: form.value.email,
      phone: form.value.phone,
      address: form.value.address,
      status: form.value.status,
      gender: form.value.gender,
    }
    if (editingId.value) {
      await api.put(`/teachers/${editingId.value}`, payload)
    } else {
      await api.post('/teachers', payload)
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
  const name = form.value.name || 'this teacher'
  if (!confirm(`Delete teacher "${name}"?`)) return
  try {
    await api.delete(`/teachers/${editingId.value}`)
    closeDrawer()
    await load()
  } catch (e) {
    formErr.value = e.response?.data?.error || e.message || 'Delete failed'
  }
}

function onKeydown(e) {
  if (e.key === 'Escape' && drawerOpen.value) closeDrawer()
}

onMounted(() => {
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
    <div class="row">
      <div class="col-12">
        <div class="card">
          <div class="card-header d-flex flex-wrap align-items-center gap-2 pb-0">
            <div class="flex-grow-1">
              <h6>Danh sách giáo viên</h6>
              <p class="mb-2 text-sm text-secondary">Quản lý hồ sơ giáo viên</p>
            </div>
            <argon-button color="primary" variant="gradient" type="button" @click="openCreate">
              Thêm giáo viên
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
                      <th scope="col">Họ tên</th>
                      <th scope="col">Giới tính</th>
                      <th scope="col">Điện thoại</th>
                      <th scope="col">Địa chỉ</th>
                      <th scope="col">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="t in pagedItems" :key="t.id" class="cursor-pointer" @click="openEdit(t)">
                      <td>
                        <div class="d-flex px-2 py-1">
                          <div class="d-flex flex-column justify-content-center">
                            <h6 class="mb-0 text-sm panel-primary-text">{{ t.name }}</h6>
                            <p class="mb-0 text-xs text-secondary">{{ t.email || '' }}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <p class="mb-0 text-xs font-weight-bold">{{ genderLabel(t.gender) }}</p>
                      </td>
                      <td>
                        <p class="mb-0 text-xs text-secondary">{{ t.phone || '—' }}</p>
                      </td>
                      <td>
                        <p class="mb-0 text-xs text-secondary">{{ t.address || '—' }}</p>
                      </td>
                      <td>
                        <span class="badge" :class="t.status === 'active' ? 'bg-gradient-success' : t.status === 'leave' ? 'bg-gradient-warning' : 'bg-gradient-secondary'">
                          {{ statusLabel(t.status) }}
                        </span>
                      </td>
                    </tr>
                    <tr v-if="!items.length" class="panel-table-empty">
                      <td colspan="5">Chưa có giáo viên nào.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <!-- Pagination -->
              <div v-if="items.length > PAGE_SIZE" class="pagination-bar">
                <span class="pagination-info">
                  {{ (currentPage - 1) * PAGE_SIZE + 1 }}–{{ Math.min(currentPage * PAGE_SIZE, items.length) }} / {{ items.length }}
                </span>
                <div class="pagination-controls">
                  <button
                    class="page-btn"
                    :disabled="currentPage === 1"
                    @click="goToPage(1)"
                    title="Trang đầu"
                  ><i class="ni ni-bold-left"></i><i class="ni ni-bold-left"></i></button>
                  <button
                    class="page-btn"
                    :disabled="currentPage === 1"
                    @click="goToPage(currentPage - 1)"
                    title="Trang trước"
                  ><i class="ni ni-bold-left"></i></button>
                  <template v-for="p in totalPages" :key="p">
                    <button
                      v-if="p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2)"
                      class="page-btn"
                      :class="{ active: p === currentPage }"
                      @click="goToPage(p)"
                    >{{ p }}</button>
                    <span
                      v-else-if="p === currentPage - 3 || p === currentPage + 3"
                      class="page-ellipsis"
                    >…</span>
                  </template>
                  <button
                    class="page-btn"
                    :disabled="currentPage === totalPages"
                    @click="goToPage(currentPage + 1)"
                    title="Trang sau"
                  ><i class="ni ni-bold-right"></i></button>
                  <button
                    class="page-btn"
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

    <!-- Drawer backdrop -->
    <Transition name="drawer-backdrop">
      <div v-if="drawerOpen" class="drawer-backdrop" @click="closeDrawer"></div>
    </Transition>

    <!-- Right sidebar drawer -->
    <Transition name="drawer-slide">
      <aside v-if="drawerOpen" class="drawer-panel">
        <div class="drawer-header">
          <h5 class="drawer-title mb-0">{{ editingId ? form.name || 'Giáo viên' : 'Thêm giáo viên' }}</h5>
          <button type="button" class="btn-close" aria-label="Close" @click="closeDrawer"></button>
        </div>

        <form class="drawer-body-form" @submit.prevent="save">
          <div class="drawer-body">
            <argon-alert v-if="formErr" color="danger" icon="ni ni-fat-remove">
              {{ formErr }}
            </argon-alert>
            <p class="text-sm text-uppercase text-muted">Thông tin giáo viên</p>
            <div class="row">
              <div class="col-12">
                <label for="teacher-name" class="form-control-label">Họ tên *</label>
                <argon-input
                  id="teacher-name"
                  v-model="form.name"
                  placeholder="Họ và tên"
                  name="name"
                  autocomplete="name"
                />
              </div>
              <div class="col-6">
                <label for="teacher-gender" class="form-control-label">Giới tính</label>
                <select id="teacher-gender" v-model="form.gender" class="form-select form-select-sm mb-3">
                  <option v-for="g in GENDER_OPTIONS" :key="g.value" :value="g.value">{{ g.label }}</option>
                </select>
              </div>
              <div class="col-6">
                <label for="teacher-status" class="form-control-label">Trạng thái</label>
                <select id="teacher-status" v-model="form.status" class="form-select form-select-sm mb-3">
                  <option v-for="s in STATUS_OPTIONS" :key="s.value" :value="s.value">{{ s.label }}</option>
                </select>
              </div>
              <div class="col-12">
                <label for="teacher-email" class="form-control-label">Email</label>
                <argon-input
                  id="teacher-email"
                  v-model="form.email"
                  type="email"
                  placeholder="email@example.com"
                  name="email"
                  autocomplete="email"
                />
              </div>
              <div class="col-12">
                <label for="teacher-phone" class="form-control-label">Điện thoại</label>
                <argon-input
                  id="teacher-phone"
                  v-model="form.phone"
                  type="tel"
                  placeholder="Số điện thoại"
                  name="phone"
                  autocomplete="tel"
                />
              </div>
              <div class="col-12">
                <label for="teacher-address" class="form-control-label">Địa chỉ</label>
                <argon-input
                  id="teacher-address"
                  v-model="form.address"
                  placeholder="Địa chỉ"
                  name="address"
                />
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
      </aside>
    </Transition>
  </div>
</template>

<style scoped>
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
  width: min(500px, 100vw);
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
.drawer-body select.form-select,
.drawer-body select.form-control {
  min-height: 2.9rem;
  border: 1px solid #dbe4f0;
  border-radius: 0.9rem;
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
}

.drawer-body :deep(.form-control:focus),
.drawer-body :deep(.form-select:focus),
.drawer-body select.form-select:focus,
.drawer-body select.form-control:focus {
  border-color: #38bdf8;
  box-shadow: 0 0 0 0.22rem rgba(56, 189, 248, 0.16);
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

@media (max-width: 768px) {
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

  .drawer-footer {
    flex-wrap: wrap;
  }

  .drawer-footer :deep(.btn),
  .drawer-footer button {
    flex: 1 1 calc(50% - 0.25rem);
  }
}

/* ===== Pagination ===== */
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid #f1f3f5;
}

.pagination-info {
  font-size: 0.78rem;
  color: #8392ab;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.page-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  height: 2rem;
  padding: 0 0.4rem;
  border: 1px solid #e9ecef;
  border-radius: 0.375rem;
  background: #fff;
  color: #344767;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  line-height: 1;
}

.page-btn:hover:not(:disabled):not(.active) {
  background: #f0f2f5;
  border-color: #d2d6da;
}

.page-btn.active {
  background: linear-gradient(310deg, #5e72e4, #825ee4);
  border-color: transparent;
  color: #fff;
  font-weight: 600;
}

.page-btn:disabled {
  opacity: 0.38;
  cursor: default;
}

.page-ellipsis {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  height: 2rem;
  font-size: 0.85rem;
  color: #8392ab;
}
</style>
