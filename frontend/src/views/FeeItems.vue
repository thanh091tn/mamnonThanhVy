<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { api } from "@/api/client.js";
import ArgonAlert from "@/components/ArgonAlert.vue";
import ArgonButton from "@/components/ArgonButton.vue";

const FEE_TYPE_OPTIONS = [
  {
    value: "monthly_fixed",
    label: "Thu cố định hằng tháng",
    category: "fixed",
    unitName: "tháng",
    description: "Dùng cho học phí, bán trú hoặc khoản thu cố định.",
  },
  {
    value: "meal_days",
    label: "Thu theo ngày ăn",
    category: "daily",
    unitName: "ngày",
    description: "Số ngày lấy từ điểm danh chuyên cần.",
  },
  {
    value: "attendance_days",
    label: "Thu theo ngày học",
    category: "daily",
    unitName: "ngày",
    description: "Số ngày lấy từ điểm danh đi học.",
  },
  {
    value: "service_fixed",
    label: "Dịch vụ đăng ký hằng tháng",
    category: "service",
    unitName: "tháng",
    description: "Chỉ tính cho học sinh có đăng ký dịch vụ.",
  },
  {
    value: "service_usage",
    label: "Dịch vụ theo số lượng",
    category: "service",
    unitName: "lượt",
    description: "Số lượng nhập tại màn đăng ký dịch vụ.",
  },
  {
    value: "one_time",
    label: "Thu một lần",
    category: "one_time",
    unitName: "lần",
    description: "Dùng cho đồng phục, hồ sơ, sự kiện hoặc khoản phát sinh theo kỳ.",
  },
];

const SCOPE_OPTIONS = [
  { value: "all", label: "Toàn trường" },
  { value: "levels", label: "Theo khối/lứa tuổi" },
  { value: "classes", label: "Theo lớp" },
];

const items = ref([]);
const classes = ref([]);
const loading = ref(false);
const saving = ref(false);
const loadErr = ref("");
const formErr = ref("");
const okMsg = ref("");
const editingId = ref(null);
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
  applyLevels: [],
  applyClassIds: [],
  effectiveStartMonth: "",
  effectiveEndMonth: "",
  description: "",
  sortOrder: 1,
});

const selectedFeeType = computed(() => {
  return FEE_TYPE_OPTIONS.find((item) => item.value === form.value.calcType) || FEE_TYPE_OPTIONS[0];
});

const levelOptions = computed(() => {
  return [...new Set(classes.value.map((row) => row.level).filter(Boolean))];
});

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

function categoryLabel(value) {
  return FEE_TYPE_OPTIONS.find((item) => item.category === value)?.label || value;
}

function calcTypeLabel(value) {
  return FEE_TYPE_OPTIONS.find((item) => item.value === value)?.label || value;
}

function typeDescription(value) {
  return FEE_TYPE_OPTIONS.find((item) => item.value === value)?.description || "";
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
    applyLevels: [],
    applyClassIds: [],
    effectiveStartMonth: "",
    effectiveEndMonth: "",
    description: "",
    sortOrder: items.value.length + 1,
  };
  formErr.value = "";
}

async function loadMeta() {
  const [itemsRes, classesRes] = await Promise.all([
    api.get("/fees/item-templates"),
    api.get("/classes"),
  ]);
  items.value = Array.isArray(itemsRes.data) ? itemsRes.data : [];
  classes.value = Array.isArray(classesRes.data) ? classesRes.data : [];
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
    applyLevels: Array.isArray(row.applyLevels) ? row.applyLevels : [],
    applyClassIds: Array.isArray(row.applyClassIds) ? row.applyClassIds : [],
    effectiveStartMonth: row.effectiveStartMonth || "",
    effectiveEndMonth: row.effectiveEndMonth || "",
    description: row.description || "",
    sortOrder: row.sortOrder || 1,
  };
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
      applyLevels: form.value.applyLevels,
      applyClassIds: form.value.applyClassIds,
      effectiveStartMonth: form.value.effectiveStartMonth || "",
      effectiveEndMonth: form.value.effectiveEndMonth || "",
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
  } catch (e) {
    formErr.value = e.response?.data?.error || e.message || "Lưu khoản thu thất bại";
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  try {
    await loadMeta();
    resetForm();
  } catch (e) {
    loadErr.value = e.response?.data?.error || e.message || "Không tải được cấu hình khoản thu";
  }
});

watch(
  () => form.value.calcType,
  () => {
    if (!form.value.description.trim()) {
      form.value.description = selectedFeeType.value.description;
    }
  }
);
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
      <argon-button color="secondary" variant="outline" type="button" @click="resetForm">
        Tạo khoản thu mới
      </argon-button>
    </section>

    <argon-alert v-if="loadErr" color="danger" icon="ni ni-fat-remove" class="mb-3">
      {{ loadErr }}
    </argon-alert>
    <argon-alert v-if="okMsg" color="success" icon="ni ni-check-bold" class="mb-3">
      {{ okMsg }}
    </argon-alert>

    <div class="row g-4">
      <div class="col-xl-5">
        <div class="card fee-card">
          <div class="card-header pb-0">
            <h6 class="mb-1">{{ editingId ? "Cập nhật khoản thu" : "Tạo khoản thu" }}</h6>
            <p class="text-sm text-secondary mb-0">Các quy tắc kỹ thuật sẽ được hệ thống tự chọn theo loại khoản thu.</p>
          </div>
          <div class="card-body">
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

              <div v-if="form.scopeType === 'levels'" class="col-12">
                <label class="form-control-label">Áp dụng cho khối/lứa tuổi</label>
                <div class="chip-list">
                  <label v-for="level in levelOptions" :key="level" class="chip-check">
                    <input v-model="form.applyLevels" type="checkbox" :value="level" />
                    <span>{{ level }}</span>
                  </label>
                </div>
              </div>

              <div v-if="form.scopeType === 'classes'" class="col-12">
                <label class="form-control-label">Áp dụng cho lớp</label>
                <div class="chip-list">
                  <label v-for="row in classes" :key="row.id" class="chip-check">
                    <input v-model="form.applyClassIds" type="checkbox" :value="row.id" />
                    <span>{{ row.name }}</span>
                  </label>
                </div>
              </div>

              <div class="col-md-6">
                <label class="form-control-label">Hiệu lực từ tháng</label>
                <input v-model="form.effectiveStartMonth" type="month" class="form-control" />
              </div>
              <div class="col-md-6">
                <label class="form-control-label">Đến tháng</label>
                <input v-model="form.effectiveEndMonth" type="month" class="form-control" />
              </div>

              <div class="col-12">
                <label class="form-control-label">Mô tả / giải thích</label>
                <textarea v-model="form.description" rows="3" class="form-control" placeholder="Ví dụ: áp dụng cho học sinh bán trú từ tháng 05/2026"></textarea>
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

            <div class="fee-actions">
              <argon-button color="secondary" variant="outline" type="button" @click="resetForm">
                Làm mới
              </argon-button>
              <argon-button color="primary" variant="gradient" type="button" :disabled="saving" @click="saveItem">
                {{ saving ? "Đang lưu..." : editingId ? "Cập nhật khoản thu" : "Lưu khoản thu" }}
              </argon-button>
            </div>
          </div>
        </div>
      </div>

      <div class="col-xl-7">
        <div class="card fee-card">
          <div class="card-header pb-0">
            <div class="row g-3">
              <div class="col-md-4">
                <select v-model="categoryFilter" class="form-select">
                  <option value="">Tất cả loại</option>
                  <option v-for="option in FEE_TYPE_OPTIONS" :key="option.value" :value="option.category">
                    {{ option.label }}
                  </option>
                </select>
              </div>
              <div class="col-md-8">
                <input v-model="searchQuery" type="text" class="form-control" placeholder="Tìm theo mã hoặc tên khoản thu" />
              </div>
            </div>
          </div>
          <div class="card-body pt-3">
            <div v-if="loading" class="text-sm text-secondary">Đang tải...</div>
            <div v-else-if="!filteredItems.length" class="text-sm text-secondary">Chưa có khoản thu nào.</div>
            <div v-else class="table-responsive">
              <table class="table align-items-center mb-0">
                <thead>
                  <tr>
                    <th>Mã / tên</th>
                    <th>Loại khoản thu</th>
                    <th>Đơn giá</th>
                    <th>Áp dụng</th>
                    <th>Trạng thái</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in filteredItems" :key="row.id">
                    <td class="text-sm">
                      <strong>{{ row.code }}</strong>
                      <div>{{ row.name }}</div>
                    </td>
                    <td class="text-sm">{{ calcTypeLabel(row.calcType) }}</td>
                    <td class="text-sm">{{ formatMoney(row.unitPrice) }} / {{ row.unitName }}</td>
                    <td class="text-sm">
                      {{
                        row.scopeType === "all"
                          ? "Toàn trường"
                              : row.scopeType === "levels"
                                ? row.applyLevels.join(", ")
                                : row.applyClassIds.length
                              ? classes.value.filter((item) => row.applyClassIds.includes(item.id)).map((item) => item.name).join(", ")
                              : "Theo lớp"
                      }}
                    </td>
                    <td class="text-sm">
                      <span class="fee-status" :class="row.active ? 'fee-status--active' : 'fee-status--inactive'">
                        {{ row.active ? "Đang dùng" : "Tạm ngưng" }}
                      </span>
                    </td>
                    <td class="text-end">
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
      </div>
    </div>
  </div>
</template>

<style scoped>
.fee-page {
  padding: 1rem 1.5rem 1.5rem;
}

.fee-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.1rem 1.25rem;
  margin-bottom: 1rem;
  border: 1px solid #e7edf5;
  border-radius: 1rem;
  background: linear-gradient(135deg, #ffffff, #eef6ff);
}

.fee-eyebrow {
  display: inline-block;
  margin-bottom: 0.25rem;
  color: #2563eb;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.fee-title {
  color: #1f2a44;
  font-weight: 700;
}

.fee-subtitle {
  color: #64748b;
}

.fee-card {
  border: 1px solid #e7edf5;
  border-radius: 1rem;
  box-shadow: 0 1rem 2rem -1.8rem rgba(15, 23, 42, 0.35);
}

.chip-list,
.fee-inline-checks,
.fee-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.chip-check {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid #dbe5f0;
  border-radius: 999px;
  background: #fff;
}

.weekday-chip {
  min-width: 3rem;
  padding: 0.5rem 0.7rem;
  border: 1px solid #d4dbe8;
  border-radius: 999px;
  background: #fff;
}

.weekday-chip--active {
  border-color: #2563eb;
  background: #eff6ff;
  color: #1d4ed8;
}

.fee-check {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.fee-readonly-field {
  min-height: calc(1.5em + 0.75rem + 2px);
  padding: 0.5rem 0.75rem;
  border: 1px solid #e7edf5;
  border-radius: 0.5rem;
  background: #f8fafc;
  color: #475569;
  font-size: 0.875rem;
}

.fee-inline-checks,
.fee-actions {
  margin-top: 1rem;
}

.fee-actions {
  justify-content: flex-end;
}

.fee-status {
  display: inline-flex;
  align-items: center;
  padding: 0.22rem 0.65rem;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 700;
}

.fee-status--active {
  color: #166534;
  background: #dcfce7;
}

.fee-status--inactive {
  color: #991b1b;
  background: #fee2e2;
}

@media (max-width: 991.98px) {
  .fee-hero {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
