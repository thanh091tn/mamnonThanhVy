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
  <div class="py-4 container-fluid page-fill">
    <div class="row">
      <div class="col-12">
        <div class="card">
          <div class="card-header d-flex flex-wrap align-items-center gap-2 pb-0">
            <div class="flex-grow-1">
              <h6>Danh sách lớp</h6>
              <p class="mb-2 text-sm text-secondary">Quản lý lớp học và giáo viên chủ nhiệm</p>
            </div>
            <argon-button color="primary" variant="gradient" type="button" @click="openCreate">
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
      <div class="modal-dialog modal-dialog-centered modal-lg">
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
</style>

