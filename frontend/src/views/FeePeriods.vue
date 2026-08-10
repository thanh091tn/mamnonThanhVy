<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { api } from "@/api/client.js";
import ArgonAlert from "@/components/ArgonAlert.vue";
import ArgonButton from "@/components/ArgonButton.vue";
import AppDateField from "@/components/AppDateField.vue";

function nextMonthKey() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function feeTypeLabel(value) {
  const labels = {
    monthly_fixed: "Cố định tháng",
    meal_days: "Ngày ăn",
    attendance_days: "Ngày học",
    service_fixed: "Dịch vụ tháng",
    service_usage: "Dịch vụ số lượng",
    one_time: "Thu một lần",
    manual: "Điều chỉnh tay",
  };
  return labels[value] || value;
}

function periodStatusLabel(value) {
  if (value === "draft") return "Nháp";
  if (value === "published") return "Đã phát hành";
  if (value === "closed") return "Đã khóa";
  return value;
}

const periods = ref([]);
const templates = ref([]);
const loading = ref(false);
const saving = ref(false);
const loadErr = ref("");
const formErr = ref("");
const okMsg = ref("");
const editingId = ref(null);
const drawerOpen = ref(false);
const monthFilter = ref("");
const statusFilter = ref("");
const searchQuery = ref("");
const templateSearch = ref("");
let searchTimer = null;

const filtersActive = computed(
  () => Boolean(monthFilter.value) || Boolean(statusFilter.value) || Boolean(searchQuery.value.trim())
);

const form = ref({
  monthKey: nextMonthKey(),
  title: "",
  dueDate: "",
  status: "draft",
  selectedTemplateIds: [],
});

const visibleTemplates = computed(() => {
  const q = templateSearch.value.trim().toLowerCase();
  let list = !editingId.value
    ? templates.value.filter((row) => row.active)
    : templates.value.filter((row) => row.active || form.value.selectedTemplateIds.includes(row.id));
  if (q) {
    list = list.filter((row) => `${row.code} ${row.name}`.toLowerCase().includes(q));
  }
  return list;
});

const stats = computed(() => ({
  total: periods.value.length,
  published: periods.value.filter((row) => row.status === "published").length,
  draft: periods.value.filter((row) => row.status === "draft").length,
  closed: periods.value.filter((row) => row.status === "closed").length,
}));

const selectedTemplates = computed(() => {
  return templates.value.filter((row) => form.value.selectedTemplateIds.includes(row.id));
});

function resetForm() {
  editingId.value = null;
  templateSearch.value = "";
  form.value = {
    monthKey: nextMonthKey(),
    title: "",
    dueDate: "",
    status: "draft",
    selectedTemplateIds: templates.value.filter((row) => row.active).map((row) => row.id),
  };
  formErr.value = "";
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

function selectVisibleTemplates() {
  const selected = new Set(form.value.selectedTemplateIds);
  for (const row of visibleTemplates.value) selected.add(row.id);
  form.value.selectedTemplateIds = [...selected];
}

function deselectVisibleTemplates() {
  const removeIds = new Set(visibleTemplates.value.map((row) => row.id));
  form.value.selectedTemplateIds = form.value.selectedTemplateIds.filter((id) => !removeIds.has(id));
}

async function loadTemplates() {
  const { data } = await api.get("/fees/item-templates");
  templates.value = Array.isArray(data) ? data : [];
  if (!editingId.value && !drawerOpen.value) {
    form.value.selectedTemplateIds = templates.value.filter((row) => row.active).map((row) => row.id);
  }
}

async function loadPeriods() {
  loading.value = true;
  loadErr.value = "";
  try {
    const { data } = await api.get("/fees/periods", {
      params: {
        monthKey: monthFilter.value || undefined,
        status: statusFilter.value || undefined,
        q: searchQuery.value.trim() || undefined,
      },
    });
    periods.value = Array.isArray(data) ? data : [];
  } catch (e) {
    loadErr.value = e.response?.data?.error || e.message || "Không tải được kỳ thu";
    periods.value = [];
  } finally {
    loading.value = false;
  }
}

function toggleTemplate(id) {
  const selected = new Set(form.value.selectedTemplateIds);
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);
  form.value.selectedTemplateIds = [...selected];
}

async function editPeriod(id) {
  formErr.value = "";
  okMsg.value = "";
  try {
    const { data } = await api.get(`/fees/periods/${id}`);
    const listRow = periods.value.find((row) => row.id === id);
    editingId.value = data.id;
    templateSearch.value = "";
    form.value = {
      monthKey: data.monthKey || nextMonthKey(),
      title: data.title || "",
      dueDate: data.dueDate || listRow?.dueDate || "",
      status: data.status || "draft",
      selectedTemplateIds: Array.isArray(data.items) ? data.items.map((row) => row.templateId).filter(Boolean) : [],
    };
    drawerOpen.value = true;
  } catch (e) {
    formErr.value = e.response?.data?.error || e.message || "Không tải được kỳ thu";
  }
}

async function savePeriod() {
  saving.value = true;
  formErr.value = "";
  okMsg.value = "";
  try {
    const items = templates.value
      .filter((row) => form.value.selectedTemplateIds.includes(row.id))
      .map((row) => ({
        templateId: row.id,
        code: row.code,
        name: row.name,
        category: row.category,
        calcType: row.calcType,
        billingCycle: row.billingCycle,
        description: row.description,
        amount: Number(row.defaultAmount || 0),
        chargeTiming: row.chargeTiming,
        quantityMode: row.quantityMode,
        unitPrice: Number(row.unitPrice || 0),
        unitName: row.unitName,
        fixedQuantity: Number(row.fixedQuantity || 0),
        formulaType: row.formulaType,
        frequencyMultiplier: Number(row.frequencyMultiplier || 1),
        chargeWeekdays: row.chargeWeekdays,
        isOptional: Boolean(row.isOptional),
        sortOrder: Number(row.sortOrder || 0),
        scopeType: row.scopeType,
        applyLevels: row.applyLevels,
        applyClassIds: row.applyClassIds,
        prorationMode: row.prorationMode,
      }));

    const payload = {
      monthKey: form.value.monthKey,
      title: form.value.title,
      dueDate: form.value.dueDate || null,
      status: form.value.status,
      items,
    };

    if (editingId.value) {
      await api.put(`/fees/periods/${editingId.value}`, payload);
      okMsg.value = "Đã cập nhật kỳ thu.";
    } else {
      await api.post("/fees/periods", payload);
      okMsg.value = "Đã tạo kỳ thu.";
    }
    await loadPeriods();
    resetForm();
    closeDrawer();
  } catch (e) {
    formErr.value = e.response?.data?.error || e.message || "Lưu kỳ thu thất bại";
  } finally {
    saving.value = false;
  }
}

watch([monthFilter, statusFilter], () => {
  loadPeriods();
});

watch(searchQuery, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    loadPeriods();
  }, 300);
});

watch(drawerOpen, (open) => {
  setBodyScrollLocked(open);
});

onMounted(async () => {
  window.addEventListener("keydown", onEscape);
  try {
    await Promise.all([loadTemplates(), loadPeriods()]);
    resetForm();
  } catch (e) {
    loadErr.value = e.response?.data?.error || e.message || "Không tải được dữ liệu kỳ thu";
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
        <span class="fee-eyebrow">Biểu phí</span>
        <h4 class="fee-title mb-1">Biểu phí và kỳ thu tháng</h4>
        <p class="fee-subtitle mb-0">
          Chọn khoản thu áp dụng cho từng tháng, chốt hạn đóng và sinh bảng tính học phí tự động cho toàn trường.
        </p>
      </div>
      <argon-button color="primary" variant="gradient" type="button" @click="openCreateDrawer">
        Tạo kỳ mới
      </argon-button>
    </section>

    <div class="fee-stats">
      <div class="fee-stat-card">
        <span>Tổng kỳ thu</span>
        <strong>{{ stats.total }}</strong>
      </div>
      <div class="fee-stat-card">
        <span>Kỳ nháp</span>
        <strong>{{ stats.draft }}</strong>
      </div>
      <div class="fee-stat-card">
        <span>Đã phát hành</span>
        <strong>{{ stats.published }}</strong>
      </div>
      <div class="fee-stat-card">
        <span>Đã khóa</span>
        <strong>{{ stats.closed }}</strong>
      </div>
    </div>

    <argon-alert v-if="loadErr" color="danger" icon="ni ni-fat-remove" class="mb-3">
      {{ loadErr }}
    </argon-alert>
    <argon-alert v-if="okMsg" color="success" icon="ni ni-check-bold" class="mb-3">
      {{ okMsg }}
    </argon-alert>

    <div class="card fee-card">
      <div class="card-header pb-0">
        <div class="row g-3">
          <div class="col-md-3">
            <app-date-field v-model="monthFilter" month-picker />
          </div>
          <div class="col-md-3">
            <select v-model="statusFilter" class="form-select">
              <option value="">Tất cả trạng thái</option>
              <option value="draft">Nháp</option>
              <option value="published">Đã phát hành</option>
              <option value="closed">Đã khóa</option>
            </select>
          </div>
          <div class="col-md-4">
            <input v-model="searchQuery" type="text" class="form-control" placeholder="Tìm tên kỳ thu" />
          </div>
          <div class="col-md-2">
            <argon-button color="secondary" variant="outline" type="button" class="w-100" @click="loadPeriods">
              Tải lại
            </argon-button>
          </div>
        </div>
      </div>
      <div class="card-body pt-3">
        <div v-if="loading" class="fee-loading-block">Đang tải dữ liệu kỳ thu...</div>
        <div v-else-if="!periods.length" class="fee-empty-state">
          <p class="text-sm text-secondary mb-0">
            {{ filtersActive ? "Không có kỳ thu khớp bộ lọc." : "Chưa có kỳ thu nào." }}
          </p>
        </div>
        <div v-else class="table-responsive fee-table-wrap">
          <table class="table align-items-center mb-0 fee-manage-table">
            <colgroup>
              <col class="fee-period-col-month" />
              <col class="fee-period-col-title" />
              <col class="fee-period-col-count" />
              <col class="fee-period-col-count" />
              <col class="fee-period-col-money" />
              <col class="fee-period-col-money" />
              <col class="fee-period-col-status" />
              <col class="fee-period-col-action" />
            </colgroup>
            <thead>
              <tr>
                <th class="fee-head-left">Tháng</th>
                <th class="fee-head-left">Tên kỳ</th>
                <th class="fee-head-center">Khoản</th>
                <th class="fee-head-center">HS</th>
                <th class="fee-head-right">Phải thu</th>
                <th class="fee-head-right">Đã thu</th>
                <th class="fee-head-center">Trạng thái</th>
                <th class="fee-head-right"></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in periods"
                :key="row.id"
                :class="{ 'fee-row-selected': drawerOpen && editingId === row.id }"
              >
                <td class="text-sm font-weight-bold fee-cell-left">{{ row.monthKey }}</td>
                <td class="text-sm fee-cell-left">
                  <strong>{{ row.title }}</strong>
                  <div class="text-secondary fee-subtext">Hạn đóng: {{ row.dueDate || "Chưa đặt" }}</div>
                </td>
                <td class="text-sm fee-cell-center">{{ row.itemCount }}</td>
                <td class="text-sm fee-cell-center">{{ row.studentCount }}</td>
                <td class="text-sm fee-cell-right">{{ formatMoney(row.totalFinalAmount) }}</td>
                <td class="text-sm fee-cell-right">{{ formatMoney(row.totalPaidAmount) }}</td>
                <td class="text-sm fee-cell-center">
                  <span class="fee-status" :class="`fee-status--${row.status}`">{{ periodStatusLabel(row.status) }}</span>
                </td>
                <td class="text-end fee-cell-right">
                  <button type="button" class="btn btn-link text-primary mb-0 p-0" @click="editPeriod(row.id)">
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
      <aside v-if="drawerOpen" class="fee-drawer-panel fee-drawer-panel--wide">
        <div class="fee-drawer-header">
          <h5 class="fee-drawer-title">{{ editingId ? "Cập nhật kỳ thu" : "Tạo kỳ thu" }}</h5>
          <button type="button" class="btn-close" aria-label="Đóng" @click="closeDrawer"></button>
        </div>
        <div class="fee-drawer-body">
          <p class="text-sm text-secondary mb-3">
            Kỳ thu là ảnh chụp danh sách khoản thu được áp dụng trong một tháng cụ thể.
          </p>
          <argon-alert v-if="formErr" color="danger" icon="ni ni-fat-remove" class="mb-3">
            {{ formErr }}
          </argon-alert>

          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-control-label">Tháng</label>
              <app-date-field v-model="form.monthKey" month-picker />
            </div>
            <div class="col-md-6">
              <label class="form-control-label">Hạn đóng</label>
              <app-date-field v-model="form.dueDate" />
            </div>
            <div class="col-12">
              <label class="form-control-label">Tên kỳ thu</label>
              <input
                v-model="form.title"
                type="text"
                class="form-control"
                placeholder="Ví dụ: Học phí tháng 05/2026"
              />
            </div>
            <div class="col-12">
              <label class="form-control-label">Trạng thái</label>
              <select v-model="form.status" class="form-select">
                <option value="draft">Nháp</option>
                <option value="published">Đã phát hành</option>
                <option value="closed">Đã khóa</option>
              </select>
            </div>
          </div>

          <div class="fee-section-head">
            <h6 class="mb-0">Khoản thu áp dụng trong tháng</h6>
            <span class="text-sm text-secondary">{{ selectedTemplates.length }} khoản</span>
          </div>

          <div class="fee-sticky-bar">
            <strong class="text-sm">Đã chọn {{ selectedTemplates.length }} khoản</strong>
            <div class="fee-sticky-actions">
              <button type="button" class="btn btn-link text-primary mb-0 p-0 text-sm" @click="selectVisibleTemplates">
                Chọn tất cả (lọc)
              </button>
              <button type="button" class="btn btn-link text-secondary mb-0 p-0 text-sm" @click="deselectVisibleTemplates">
                Bỏ chọn (lọc)
              </button>
            </div>
          </div>

          <div class="mb-2">
            <input
              v-model="templateSearch"
              type="text"
              class="form-control"
              placeholder="Lọc khoản thu theo mã hoặc tên"
            />
          </div>

          <div class="fee-selectable-list">
            <label
              v-for="row in visibleTemplates"
              :key="row.id"
              class="fee-selectable-row"
              :class="{ 'is-selected': form.selectedTemplateIds.includes(row.id) }"
            >
              <input
                :checked="form.selectedTemplateIds.includes(row.id)"
                type="checkbox"
                @change="toggleTemplate(row.id)"
              />
              <span>
                <strong>{{ row.code }} - {{ row.name }}</strong>
                <small>
                  {{ feeTypeLabel(row.calcType) }} • {{ formatMoney(row.unitPrice) }} / {{ row.unitName }}
                </small>
              </span>
            </label>
            <div v-if="!visibleTemplates.length" class="text-sm text-secondary px-1 py-2">
              Không có khoản thu khớp bộ lọc.
            </div>
          </div>
        </div>
        <div class="fee-drawer-footer">
          <argon-button color="secondary" variant="outline" type="button" @click="closeDrawer">
            Đóng
          </argon-button>
          <argon-button color="primary" variant="gradient" type="button" :disabled="saving" @click="savePeriod">
            {{ saving ? "Đang lưu..." : editingId ? "Cập nhật kỳ thu" : "Lưu kỳ thu" }}
          </argon-button>
        </div>
      </aside>
    </Transition>
  </div>
</template>

<style scoped>
.fee-sticky-actions {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  flex-wrap: wrap;
}

.fee-period-col-month {
  width: 10%;
}

.fee-period-col-title {
  width: 28%;
}

.fee-period-col-count {
  width: 8%;
}

.fee-period-col-money {
  width: 14%;
}

.fee-period-col-status {
  width: 10%;
}

.fee-period-col-action {
  width: 8%;
}
</style>
