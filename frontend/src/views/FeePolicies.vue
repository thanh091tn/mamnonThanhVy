<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { api } from "@/api/client.js";
import ArgonAlert from "@/components/ArgonAlert.vue";
import ArgonButton from "@/components/ArgonButton.vue";
import AppDateField from "@/components/AppDateField.vue";

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const CATEGORY_OPTIONS = [
  { value: "fixed", label: "Khoản cố định" },
  { value: "daily", label: "Khoản theo ngày" },
  { value: "service", label: "Dịch vụ" },
  { value: "one_time", label: "Khoản một lần" },
];

const students = ref([]);
const classes = ref([]);
const templates = ref([]);
const policies = ref([]);
const loading = ref(false);
const saving = ref(false);
const loadErr = ref("");
const formErr = ref("");
const okMsg = ref("");
const editingId = ref(null);
const drawerOpen = ref(false);
const activeFilter = ref("");
const searchQuery = ref("");
const studentSearch = ref("");
const studentClassFilter = ref("");
let searchTimer = null;

const form = ref({
  name: "",
  discountType: "amount",
  discountValue: 0,
  applyScope: "invoice",
  targetCategory: "",
  targetFeeItemCode: "",
  startMonth: currentMonthKey(),
  endMonth: "",
  active: true,
  note: "",
  studentIds: [],
});

const filteredStudents = computed(() => {
  const q = studentSearch.value.trim().toLowerCase();
  return students.value.filter((student) => {
    const matchClass = !studentClassFilter.value || String(student.classId || "") === String(studentClassFilter.value);
    const matchSearch = !q || student.name.toLowerCase().includes(q);
    return matchClass && matchSearch;
  });
});

function formatMoney(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function applyScopeLabel(row) {
  if (row.applyScope === "invoice") return "Toàn phiếu";
  if (row.applyScope === "item_category") {
    const match = CATEGORY_OPTIONS.find((option) => option.value === row.targetCategory);
    return match?.label || row.targetCategory || "Nhóm khoản";
  }
  if (row.applyScope === "item_code") return row.targetFeeItemCode || "Mã khoản";
  return row.applyScope || "";
}

function resetForm() {
  editingId.value = null;
  form.value = {
    name: "",
    discountType: "amount",
    discountValue: 0,
    applyScope: "invoice",
    targetCategory: "",
    targetFeeItemCode: "",
    startMonth: currentMonthKey(),
    endMonth: "",
    active: true,
    note: "",
    studentIds: [],
  };
  formErr.value = "";
  studentSearch.value = "";
  studentClassFilter.value = "";
}

function openCreateDrawer() {
  resetForm();
  drawerOpen.value = true;
}

function closeDrawer() {
  drawerOpen.value = false;
}

function setBodyScrollLocked(locked) {
  document.body.style.overflow = locked ? "hidden" : "";
}

function onEscape(e) {
  if (e.key === "Escape" && drawerOpen.value) closeDrawer();
}

function selectFilteredStudents() {
  const selected = new Set(form.value.studentIds);
  for (const student of filteredStudents.value) selected.add(student.id);
  form.value.studentIds = [...selected];
}

function deselectFilteredStudents() {
  const removeIds = new Set(filteredStudents.value.map((student) => student.id));
  form.value.studentIds = form.value.studentIds.filter((id) => !removeIds.has(id));
}

async function loadMeta() {
  const [studentsRes, classesRes, templatesRes] = await Promise.all([
    api.get("/students"),
    api.get("/classes"),
    api.get("/fees/item-templates", { params: { active: true } }),
  ]);
  students.value = Array.isArray(studentsRes.data) ? studentsRes.data : [];
  classes.value = Array.isArray(classesRes.data) ? classesRes.data : [];
  templates.value = Array.isArray(templatesRes.data) ? templatesRes.data : [];
}

async function loadPolicies() {
  loading.value = true;
  loadErr.value = "";
  try {
    const { data } = await api.get("/fees/discount-policies", {
      params: {
        active: activeFilter.value || undefined,
        q: searchQuery.value.trim() || undefined,
      },
    });
    policies.value = Array.isArray(data) ? data : [];
  } catch (e) {
    loadErr.value = e.response?.data?.error || e.message || "Không tải được chính sách miễn giảm";
    policies.value = [];
  } finally {
    loading.value = false;
  }
}

async function editPolicy(id) {
  formErr.value = "";
  okMsg.value = "";
  try {
    const { data } = await api.get(`/fees/discount-policies/${id}`);
    editingId.value = data.id;
    form.value = {
      name: data.name || "",
      discountType: data.discountType || "amount",
      discountValue: data.discountValue || 0,
      applyScope: data.applyScope || "invoice",
      targetCategory: data.targetCategory || "",
      targetFeeItemCode: data.targetFeeItemCode || "",
      startMonth: data.startMonth || currentMonthKey(),
      endMonth: data.endMonth || "",
      active: Boolean(data.active),
      note: data.note || "",
      studentIds: Array.isArray(data.students) ? data.students.map((row) => row.studentId) : [],
    };
    drawerOpen.value = true;
  } catch (e) {
    formErr.value = e.response?.data?.error || e.message || "Không tải được chính sách";
  }
}

function toggleStudent(studentId) {
  const selected = new Set(form.value.studentIds);
  if (selected.has(studentId)) selected.delete(studentId);
  else selected.add(studentId);
  form.value.studentIds = [...selected];
}

async function savePolicy() {
  saving.value = true;
  formErr.value = "";
  okMsg.value = "";
  try {
    const payload = {
      name: form.value.name,
      discountType: form.value.discountType,
      discountValue: Number(form.value.discountValue || 0),
      applyScope: form.value.applyScope,
      targetCategory: form.value.applyScope === "item_category" ? form.value.targetCategory : "",
      targetFeeItemCode: form.value.applyScope === "item_code" ? form.value.targetFeeItemCode : "",
      startMonth: form.value.startMonth,
      endMonth: form.value.endMonth || null,
      active: Boolean(form.value.active),
      note: form.value.note,
      studentIds: form.value.studentIds,
    };
    if (editingId.value) {
      await api.put(`/fees/discount-policies/${editingId.value}`, payload);
      okMsg.value = "Đã cập nhật chính sách miễn giảm.";
    } else {
      await api.post("/fees/discount-policies", payload);
      okMsg.value = "Đã tạo chính sách miễn giảm.";
    }
    await loadPolicies();
    resetForm();
    closeDrawer();
  } catch (e) {
    formErr.value = e.response?.data?.error || e.message || "Lưu chính sách thất bại";
  } finally {
    saving.value = false;
  }
}

watch(activeFilter, () => {
  loadPolicies();
});

watch(searchQuery, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    loadPolicies();
  }, 300);
});

watch(drawerOpen, (open) => {
  setBodyScrollLocked(open);
});

onMounted(async () => {
  window.addEventListener("keydown", onEscape);
  try {
    await loadMeta();
    await loadPolicies();
  } catch (e) {
    loadErr.value = e.response?.data?.error || e.message || "Không tải được dữ liệu miễn giảm";
  }
});

onUnmounted(() => {
  window.removeEventListener("keydown", onEscape);
  if (searchTimer) clearTimeout(searchTimer);
  setBodyScrollLocked(false);
});
</script>

<template>
  <div class="fee-page page-fill">
    <section class="fee-hero">
      <div>
        <span class="fee-eyebrow">Miễn giảm</span>
        <h4 class="fee-title mb-1">Chính sách miễn giảm học phí</h4>
        <p class="fee-subtitle mb-0">
          Hỗ trợ giảm theo tiền hoặc phần trăm, áp cho toàn phiếu hoặc từng nhóm khoản, và gán theo từng học sinh.
        </p>
      </div>
      <argon-button color="primary" variant="gradient" type="button" @click="openCreateDrawer">
        Tạo chính sách mới
      </argon-button>
    </section>

    <argon-alert v-if="loadErr" color="danger" icon="ni ni-fat-remove" class="mb-3">
      {{ loadErr }}
    </argon-alert>
    <argon-alert v-if="okMsg" color="success" icon="ni ni-check-bold" class="mb-3">
      {{ okMsg }}
    </argon-alert>

    <div class="card fee-card">
      <div class="card-header pb-0">
        <div class="row g-3">
          <div class="col-md-4">
            <select v-model="activeFilter" class="form-select">
              <option value="">Tất cả trạng thái</option>
              <option value="true">Đang áp dụng</option>
              <option value="false">Ngưng áp dụng</option>
            </select>
          </div>
          <div class="col-md-8">
            <input v-model="searchQuery" type="text" class="form-control" placeholder="Tìm chính sách" />
          </div>
        </div>
        <div class="fee-actions mt-3 mb-0">
          <span class="text-sm text-secondary">Tách rõ khoản nào được giảm giúp phụ huynh hiểu vì sao số tiền thay đổi.</span>
          <argon-button color="secondary" variant="outline" type="button" @click="loadPolicies">
            Tải lại
          </argon-button>
        </div>
      </div>
      <div class="card-body pt-3">
        <div v-if="loading" class="fee-loading-block">Đang tải...</div>
        <div v-else-if="!policies.length" class="text-sm text-secondary">
          {{ activeFilter || searchQuery.trim() ? "Không có chính sách khớp bộ lọc." : "Chưa có chính sách miễn giảm nào." }}
        </div>
        <div v-else class="table-responsive fee-table-wrap">
          <table class="table align-items-center mb-0 fee-manage-table">
            <colgroup>
              <col class="fee-policy-col-name" />
              <col class="fee-policy-col-scope" />
              <col class="fee-policy-col-value" />
              <col class="fee-policy-col-range" />
              <col class="fee-policy-col-count" />
              <col class="fee-policy-col-action" />
            </colgroup>
            <thead>
              <tr>
                <th class="fee-head-left">Tên chính sách</th>
                <th class="fee-head-left">Phạm vi</th>
                <th class="fee-head-right">Giá trị</th>
                <th class="fee-head-left">Hiệu lực</th>
                <th class="fee-head-center">Số HS</th>
                <th class="fee-head-right"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in policies" :key="row.id">
                <td class="text-sm fee-cell-left">
                  <strong>{{ row.name }}</strong>
                  <div class="text-secondary fee-subtext">{{ row.note || "Không có ghi chú" }}</div>
                </td>
                <td class="text-sm fee-cell-left">{{ applyScopeLabel(row) }}</td>
                <td class="text-sm fee-cell-right">
                  {{ row.discountType === "percent" ? `${row.discountValue}%` : `${formatMoney(row.discountValue)} đ` }}
                </td>
                <td class="text-sm fee-cell-left">{{ row.startMonth }}{{ row.endMonth ? ` → ${row.endMonth}` : "" }}</td>
                <td class="text-sm fee-cell-center">{{ row.studentCount }}</td>
                <td class="text-end fee-cell-right">
                  <button type="button" class="btn btn-link text-primary mb-0 p-0" @click="editPolicy(row.id)">
                    Sửa
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <Transition name="fee-drawer-backdrop">
      <div v-if="drawerOpen" class="fee-drawer-backdrop" @click="closeDrawer"></div>
    </Transition>
    <Transition name="fee-drawer-slide">
      <aside v-if="drawerOpen" class="fee-drawer-panel fee-policy-drawer">
        <div class="fee-drawer-header">
          <h5 class="fee-drawer-title">{{ editingId ? "Cập nhật miễn giảm" : "Tạo chính sách miễn giảm" }}</h5>
          <button type="button" class="btn-close" aria-label="Đóng" @click="closeDrawer"></button>
        </div>
        <div class="fee-drawer-body">
          <p class="text-sm text-secondary mb-3">
            Có thể dùng cho con thứ 2, diện chính sách hoặc miễn giảm theo từng khoản cụ thể.
          </p>
          <argon-alert v-if="formErr" color="danger" icon="ni ni-fat-remove" class="mb-3">
            {{ formErr }}
          </argon-alert>

          <div class="row g-3">
            <div class="col-12">
              <label class="form-control-label">Tên chính sách</label>
              <input v-model="form.name" type="text" class="form-control" placeholder="Ví dụ: Giảm học phí con thứ 2" />
            </div>
            <div class="col-md-6">
              <label class="form-control-label">Loại giảm</label>
              <select v-model="form.discountType" class="form-select">
                <option value="amount">Giảm theo tiền</option>
                <option value="percent">Giảm theo %</option>
              </select>
            </div>
            <div class="col-md-6">
              <label class="form-control-label">Giá trị</label>
              <input v-model="form.discountValue" type="number" min="0" step="1" class="form-control" />
            </div>
            <div class="col-12">
              <label class="form-control-label">Phạm vi áp dụng</label>
              <select v-model="form.applyScope" class="form-select">
                <option value="invoice">Toàn phiếu học phí</option>
                <option value="item_category">Theo nhóm khoản</option>
                <option value="item_code">Theo mã khoản thu</option>
              </select>
            </div>
            <div v-if="form.applyScope === 'item_category'" class="col-12">
              <label class="form-control-label">Nhóm khoản</label>
              <select v-model="form.targetCategory" class="form-select">
                <option value="">Chọn nhóm khoản</option>
                <option v-for="option in CATEGORY_OPTIONS" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>
            <div v-if="form.applyScope === 'item_code'" class="col-12">
              <label class="form-control-label">Khoản thu áp dụng</label>
              <select v-model="form.targetFeeItemCode" class="form-select">
                <option value="">Chọn khoản thu</option>
                <option v-for="item in templates" :key="item.id" :value="item.code">
                  {{ item.code }} - {{ item.name }}
                </option>
              </select>
            </div>
            <div class="col-md-6">
              <label class="form-control-label">Từ tháng</label>
              <app-date-field v-model="form.startMonth" month-picker />
            </div>
            <div class="col-md-6">
              <label class="form-control-label">Đến tháng</label>
              <app-date-field v-model="form.endMonth" month-picker />
            </div>
            <div class="col-12">
              <label class="form-control-label">Ghi chú</label>
              <textarea v-model="form.note" rows="3" class="form-control" placeholder="Ví dụ: áp theo hồ sơ chính sách năm học 2026"></textarea>
            </div>
          </div>

          <div class="fee-section-head">
            <h6 class="mb-0">Học sinh áp dụng</h6>
            <label class="fee-check mb-0">
              <input v-model="form.active" type="checkbox" />
              <span>Đang áp dụng</span>
            </label>
          </div>

          <div class="row g-2 mb-3">
            <div class="col-md-5">
              <select v-model="studentClassFilter" class="form-select">
                <option value="">Tất cả lớp</option>
                <option v-for="row in classes" :key="row.id" :value="row.id">{{ row.name }}</option>
              </select>
            </div>
            <div class="col-md-7">
              <input v-model="studentSearch" type="text" class="form-control" placeholder="Tìm học sinh" />
            </div>
          </div>

          <div class="fee-student-sticky">
            <span class="text-sm">Đã chọn {{ form.studentIds.length }} học sinh</span>
            <div class="fee-student-sticky-actions">
              <button type="button" class="btn btn-link text-primary mb-0 p-0 text-sm" @click="selectFilteredStudents">
                Chọn tất cả (lọc)
              </button>
              <button type="button" class="btn btn-link text-secondary mb-0 p-0 text-sm" @click="deselectFilteredStudents">
                Bỏ chọn (lọc)
              </button>
            </div>
          </div>

          <div class="fee-student-list">
            <label
              v-for="student in filteredStudents"
              :key="student.id"
              class="fee-student-row"
              :class="{ 'fee-student-row--selected': form.studentIds.includes(student.id) }"
            >
              <input :checked="form.studentIds.includes(student.id)" type="checkbox" @change="toggleStudent(student.id)" />
              <span>
                <strong>{{ student.name }}</strong>
                <small>{{ student.className || "Chưa xếp lớp" }}</small>
              </span>
            </label>
          </div>
        </div>
        <div class="fee-drawer-footer">
          <argon-button color="secondary" variant="outline" type="button" @click="closeDrawer">
            Đóng
          </argon-button>
          <argon-button color="primary" variant="gradient" type="button" :disabled="saving" @click="savePolicy">
            {{ saving ? "Đang lưu..." : editingId ? "Cập nhật" : "Lưu chính sách" }}
          </argon-button>
        </div>
      </aside>
    </Transition>
  </div>
</template>

<style scoped>
.fee-policy-col-name {
  width: 28%;
}

.fee-policy-col-scope {
  width: 17%;
}

.fee-policy-col-value {
  width: 14%;
}

.fee-policy-col-range {
  width: 19%;
}

.fee-policy-col-count {
  width: 10%;
}

.fee-policy-col-action {
  width: 12%;
}

.fee-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin: 1.2rem 0 0.75rem;
}

.fee-check {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.fee-student-sticky {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.65rem 0.75rem;
  margin-bottom: 0.65rem;
  border: 1px solid #e7edf5;
  border-radius: 0.75rem;
  background: #f8fafc;
}

.fee-student-sticky-actions {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  flex-wrap: wrap;
}

.fee-student-list {
  max-height: 23rem;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.fee-student-row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.75rem 0.85rem;
  border: 1px solid #e7edf5;
  border-radius: 0.9rem;
  background: #fff;
}

.fee-student-row--selected {
  border-color: #93c5fd;
  background: #eff6ff;
}

.fee-student-row span {
  display: flex;
  flex-direction: column;
}

.fee-student-row small {
  color: #64748b;
}

.fee-policy-drawer {
  width: min(36rem, 100vw);
}

@media (max-width: 991.98px) {
  .fee-manage-table {
    table-layout: auto;
  }
}
</style>
