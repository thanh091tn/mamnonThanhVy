<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { api } from "@/api/client.js";
import ArgonAlert from "@/components/ArgonAlert.vue";
import ArgonButton from "@/components/ArgonButton.vue";

const FEE_TYPE_OPTIONS = [
  {
    value: "monthly_fixed",
    label: "Cố định tháng",
    category: "fixed",
    unitName: "tháng",
    description: "Dùng cho học phí, bán trú hoặc khoản thu cố định theo tháng.",
  },
  {
    value: "meal_days",
    label: "Ngày ăn",
    category: "daily",
    unitName: "ngày",
    description: "Tính theo số ngày ăn thực tế từ điểm danh.",
  },
  {
    value: "attendance_days",
    label: "Ngày học",
    category: "daily",
    unitName: "ngày",
    description: "Tính theo số ngày đi học thực tế từ điểm danh.",
  },
  {
    value: "service_fixed",
    label: "Dịch vụ tháng",
    category: "service",
    unitName: "tháng",
    description: "Tính theo dịch vụ học sinh đã đăng ký theo tháng.",
  },
  {
    value: "service_usage",
    label: "Dịch vụ số lượng",
    category: "service",
    unitName: "lượt",
    description: "Tính theo số lượng sử dụng được nhập ở đăng ký dịch vụ.",
  },
  {
    value: "one_time",
    label: "Thu một lần",
    category: "one_time",
    unitName: "lần",
    description: "Dùng cho đồng phục, hồ sơ, sự kiện hoặc khoản phát sinh một lần.",
  },
];

const SCOPE_OPTIONS = [
  { value: "all", label: "Toàn trường" },
  { value: "classes", label: "Theo lớp" },
];

const CATEGORY_FILTER_OPTIONS = [
  { value: "fixed", label: "Cố định tháng" },
  { value: "daily", label: "Theo ngày" },
  { value: "service", label: "Dịch vụ" },
  { value: "one_time", label: "Thu một lần" },
];

const items = ref([]);
const classes = ref([]);
const loading = ref(false);
const saving = ref(false);
const loadErr = ref("");
const formErr = ref("");
const okMsg = ref("");
const editingId = ref(null);
const drawerOpen = ref(false);
const categoryFilter = ref("");
const searchQuery = ref("");

const form = ref({
  code: "",
  name: "",
  calcType: "monthly_fixed",
  unitPrice: 0,
  isOptional: false,
  active: true,
  scopeType: "all",
  applyClassIds: [],
  description: "",
  sortOrder: 1,
});

const selectedFeeType = computed(() => {
  return FEE_TYPE_OPTIONS.find((item) => item.value === form.value.calcType) || FEE_TYPE_OPTIONS[0];
});

const filtersActive = computed(
  () => Boolean(categoryFilter.value) || Boolean(searchQuery.value.trim())
);

const filteredItems = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return items.value.filter((item) => {
    const matchCategory = !categoryFilter.value || item.category === categoryFilter.value;
    const haystack = `${item.code} ${item.name}`.toLowerCase();
    const matchQuery = !q || haystack.includes(q);
    return matchCategory && matchQuery;
  });
});

function formatMoney(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function calcTypeLabel(value) {
  return FEE_TYPE_OPTIONS.find((item) => item.value === value)?.label || value;
}

function typeDescription(value) {
  return FEE_TYPE_OPTIONS.find((item) => item.value === value)?.description || "";
}

function applyScopeLabel(row) {
  if (row.scopeType === "all") return "Toàn trường";
  const ids = Array.isArray(row.applyClassIds) ? row.applyClassIds : [];
  if (!ids.length) return "Theo lớp";
  const names = classes.value
    .filter((item) => ids.includes(item.id))
    .map((item) => item.name);
  return names.length ? names.join(", ") : "Theo lớp";
}

function getPayloadDefaults(calcType) {
  const option = FEE_TYPE_OPTIONS.find((item) => item.value === calcType) || FEE_TYPE_OPTIONS[0];
  const isDaily = calcType === "meal_days" || calcType === "attendance_days";
  return {
    category: option.category,
    billingCycle: calcType === "one_time" ? "one_time" : "monthly",
    chargeTiming: isDaily || calcType === "service_usage" ? "arrears" : "advance",
    quantityMode: isDaily ? "actual_days" : "fixed",
    unitName: option.unitName,
    fixedQuantity: 1,
    formulaType: isDaily ? "actual_days_x_price" : "fixed_x_price",
    frequencyMultiplier: 1,
    chargeWeekdays: [1, 2, 3, 4, 5, 6],
    prorationMode: calcType === "monthly_fixed" || calcType === "service_fixed" ? "half_month" : "full_month",
  };
}

function resetForm() {
  editingId.value = null;
  form.value = {
    code: "",
    name: "",
    calcType: "monthly_fixed",
    unitPrice: 0,
    isOptional: false,
    active: true,
    scopeType: "all",
    applyClassIds: [],
    description: "",
    sortOrder: items.value.length + 1,
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

async function loadMeta() {
  loading.value = true;
  try {
    const [itemsRes, classesRes] = await Promise.all([
      api.get("/fees/item-templates"),
      api.get("/classes"),
    ]);
    items.value = Array.isArray(itemsRes.data) ? itemsRes.data : [];
    classes.value = Array.isArray(classesRes.data) ? classesRes.data : [];
  } finally {
    loading.value = false;
  }
}

function editItem(row) {
  editingId.value = row.id;
  form.value = {
    code: row.code || "",
    name: row.name || "",
    calcType: row.calcType || "monthly_fixed",
    unitPrice: row.unitPrice || 0,
    isOptional: Boolean(row.isOptional),
    active: Boolean(row.active),
    scopeType: row.scopeType || "all",
    applyClassIds: Array.isArray(row.applyClassIds) ? row.applyClassIds : [],
    description: row.description || "",
    sortOrder: row.sortOrder || 1,
  };
  formErr.value = "";
  drawerOpen.value = true;
}

async function saveItem() {
  saving.value = true;
  formErr.value = "";
  okMsg.value = "";
  try {
    const defaults = getPayloadDefaults(form.value.calcType);
    const payload = {
      code: form.value.code,
      name: form.value.name,
      category: defaults.category,
      calcType: form.value.calcType,
      billingCycle: defaults.billingCycle,
      chargeTiming: defaults.chargeTiming,
      quantityMode: defaults.quantityMode,
      unitPrice: Number(form.value.unitPrice || 0),
      unitName: defaults.unitName,
      fixedQuantity: defaults.fixedQuantity,
      formulaType: defaults.formulaType,
      frequencyMultiplier: defaults.frequencyMultiplier,
      chargeWeekdays: defaults.chargeWeekdays,
      isOptional: Boolean(form.value.isOptional),
      active: Boolean(form.value.active),
      scopeType: form.value.scopeType,
      applyClassIds: form.value.applyClassIds,
      prorationMode: defaults.prorationMode,
      description: form.value.description,
      sortOrder: Number(form.value.sortOrder || 0),
    };
    if (editingId.value) {
      await api.put(`/fees/item-templates/${editingId.value}`, payload);
      okMsg.value = "Đã cập nhật khoản thu.";
    } else {
      await api.post("/fees/item-templates", payload);
      okMsg.value = "Đã tạo khoản thu.";
    }
    await loadMeta();
    resetForm();
    closeDrawer();
  } catch (e) {
    formErr.value = e.response?.data?.error || e.message || "Lưu khoản thu thất bại";
  } finally {
    saving.value = false;
  }
}

watch(
  () => form.value.calcType,
  () => {
    if (!form.value.description.trim()) {
      form.value.description = selectedFeeType.value.description;
    }
  }
);

watch(drawerOpen, (open) => {
  setBodyScrollLocked(open);
});

onMounted(async () => {
  window.addEventListener("keydown", onEscape);
  try {
    await loadMeta();
    resetForm();
  } catch (e) {
    loadErr.value = e.response?.data?.error || e.message || "Không tải được cấu hình khoản thu";
  }
});

onUnmounted(() => {
  window.removeEventListener("keydown", onEscape);
  setBodyScrollLocked(false);
});
</script>

<template>
  <div class="fee-page page-fill">
    <section class="fee-hero">
      <div>
        <span class="fee-eyebrow">Danh mục</span>
        <h4 class="fee-title mb-1">Danh mục khoản thu</h4>
        <p class="fee-subtitle mb-0">
          Quản lý khoản thu theo cách kế toán thường dùng: chọn loại khoản thu, nhập đơn giá và phạm vi áp dụng.
        </p>
      </div>
      <argon-button color="primary" variant="gradient" type="button" @click="openCreateDrawer">
        Tạo khoản thu mới
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
            <select v-model="categoryFilter" class="form-select">
              <option value="">Tất cả loại</option>
              <option
                v-for="option in CATEGORY_FILTER_OPTIONS"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </div>
          <div class="col-md-8">
            <input
              v-model="searchQuery"
              type="text"
              class="form-control"
              placeholder="Tìm theo mã hoặc tên khoản thu"
            />
          </div>
        </div>
      </div>
      <div class="card-body pt-3">
        <div v-if="loading" class="fee-loading-block">Đang tải danh mục khoản thu...</div>
        <div v-else-if="!filteredItems.length" class="fee-empty-state">
          <p class="text-sm text-secondary mb-0">
            {{ filtersActive ? "Không có khoản thu khớp bộ lọc." : "Chưa có khoản thu nào." }}
          </p>
        </div>
        <div v-else class="table-responsive fee-table-wrap">
          <table class="table align-items-center mb-0 fee-manage-table">
            <colgroup>
              <col class="fee-item-col-name" />
              <col class="fee-item-col-type" />
              <col class="fee-item-col-price" />
              <col class="fee-item-col-scope" />
              <col class="fee-item-col-status" />
              <col class="fee-item-col-action" />
            </colgroup>
            <thead>
              <tr>
                <th class="fee-head-left">Mã / tên</th>
                <th class="fee-head-left">Loại khoản thu</th>
                <th class="fee-head-right">Đơn giá</th>
                <th class="fee-head-left">Áp dụng</th>
                <th class="fee-head-center">Trạng thái</th>
                <th class="fee-head-right"></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in filteredItems"
                :key="row.id"
                :class="{ 'fee-row-selected': drawerOpen && editingId === row.id }"
              >
                <td class="text-sm fee-cell-left">
                  <strong>{{ row.code }}</strong>
                  <div class="fee-subtext">{{ row.name }}</div>
                </td>
                <td class="text-sm fee-cell-left">{{ calcTypeLabel(row.calcType) }}</td>
                <td class="text-sm fee-cell-right">{{ formatMoney(row.unitPrice) }} / {{ row.unitName }}</td>
                <td class="text-sm fee-cell-left">{{ applyScopeLabel(row) }}</td>
                <td class="text-sm fee-cell-center">
                  <span class="fee-status" :class="row.active ? 'fee-status--active' : 'fee-status--inactive'">
                    {{ row.active ? "Đang dùng" : "Tạm ngưng" }}
                  </span>
                </td>
                <td class="text-end fee-cell-right">
                  <button type="button" class="btn btn-link text-primary mb-0 p-0" @click="editItem(row)">
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
      <aside v-if="drawerOpen" class="fee-drawer-panel">
        <div class="fee-drawer-header">
          <h5 class="fee-drawer-title">{{ editingId ? "Cập nhật khoản thu" : "Tạo khoản thu" }}</h5>
          <button type="button" class="btn-close" aria-label="Đóng" @click="closeDrawer"></button>
        </div>
        <div class="fee-drawer-body">
          <p class="text-sm text-secondary mb-3">
            Các quy tắc kỹ thuật sẽ được hệ thống tự chọn theo loại khoản thu.
          </p>
          <argon-alert v-if="formErr" color="danger" icon="ni ni-fat-remove" class="mb-3">
            {{ formErr }}
          </argon-alert>

          <div class="row g-3">
            <div class="col-md-4">
              <label class="form-control-label">Mã khoản thu</label>
              <input v-model="form.code" type="text" class="form-control" placeholder="HP01" />
            </div>
            <div class="col-md-8">
              <label class="form-control-label">Tên khoản thu</label>
              <input v-model="form.name" type="text" class="form-control" placeholder="Học phí chính khóa" />
            </div>
            <div class="col-12">
              <label class="form-control-label">Loại khoản thu</label>
              <select v-model="form.calcType" class="form-select">
                <option v-for="option in FEE_TYPE_OPTIONS" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
              <div class="text-xs text-secondary mt-1">{{ typeDescription(form.calcType) }}</div>
            </div>
            <div class="col-md-6">
              <label class="form-control-label">Đơn giá</label>
              <input v-model="form.unitPrice" type="number" min="0" step="1000" class="form-control" />
            </div>
            <div class="col-md-6">
              <label class="form-control-label">Đơn vị</label>
              <div class="fee-readonly-field">{{ selectedFeeType.unitName }}</div>
            </div>
            <div class="col-md-6">
              <label class="form-control-label">Phạm vi áp dụng</label>
              <select v-model="form.scopeType" class="form-select">
                <option v-for="option in SCOPE_OPTIONS" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>

            <div v-if="form.scopeType === 'classes'" class="col-12">
              <label class="form-control-label">Áp dụng cho lớp</label>
              <div class="fee-chip-list">
                <label v-for="row in classes" :key="row.id" class="fee-chip-check">
                  <input v-model="form.applyClassIds" type="checkbox" :value="row.id" />
                  <span>{{ row.name }}</span>
                </label>
              </div>
            </div>

            <div class="col-12">
              <label class="form-control-label">Mô tả / giải thích</label>
              <textarea
                v-model="form.description"
                rows="3"
                class="form-control"
                placeholder="Ví dụ: áp dụng cho học sinh bán trú từ tháng 05/2026"
              ></textarea>
            </div>
          </div>

          <div class="fee-inline-checks">
            <label class="fee-check">
              <input v-model="form.isOptional" type="checkbox" />
              <span>Tùy chọn</span>
            </label>
            <label class="fee-check">
              <input v-model="form.active" type="checkbox" />
              <span>Đang sử dụng</span>
            </label>
          </div>
        </div>
        <div class="fee-drawer-footer">
          <argon-button color="secondary" variant="outline" type="button" @click="closeDrawer">
            Đóng
          </argon-button>
          <argon-button color="primary" variant="gradient" type="button" :disabled="saving" @click="saveItem">
            {{ saving ? "Đang lưu..." : editingId ? "Cập nhật khoản thu" : "Lưu khoản thu" }}
          </argon-button>
        </div>
      </aside>
    </Transition>
  </div>
</template>

<style scoped>
.fee-item-col-name {
  width: 22%;
}

.fee-item-col-type {
  width: 18%;
}

.fee-item-col-price {
  width: 15%;
}

.fee-item-col-scope {
  width: 25%;
}

.fee-item-col-status {
  width: 12%;
}

.fee-item-col-action {
  width: 8%;
}
</style>
