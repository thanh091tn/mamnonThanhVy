<script setup>
import { computed, onMounted, ref } from "vue";
import { api } from "@/api/client.js";
import ArgonAlert from "@/components/ArgonAlert.vue";
import ArgonButton from "@/components/ArgonButton.vue";

function nextMonthKey() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

const periods = ref([]);
const templates = ref([]);
const loading = ref(false);
const saving = ref(false);
const generatingId = ref(null);
const loadErr = ref("");
const formErr = ref("");
const okMsg = ref("");
const editingId = ref(null);
const monthFilter = ref("");
const statusFilter = ref("");
const searchQuery = ref("");

const form = ref({
  monthKey: nextMonthKey(),
  title: "",
  dueDate: "",
  status: "draft",
  selectedTemplateIds: [],
});

const stats = computed(() => ({
  total: periods.value.length,
  published: periods.value.filter((row) => row.status === "published").length,
  draft: periods.value.filter((row) => row.status === "draft").length,
  selectedItems: form.value.selectedTemplateIds.length,
}));

const selectedTemplates = computed(() => {
  return templates.value.filter((row) => form.value.selectedTemplateIds.includes(row.id));
});

function resetForm() {
  editingId.value = null;
  form.value = {
    monthKey: nextMonthKey(),
    title: "",
    dueDate: "",
    status: "draft",
    selectedTemplateIds: templates.value.filter((row) => row.active).map((row) => row.id),
  };
  formErr.value = "";
}

async function loadTemplates() {
  const { data } = await api.get("/fees/item-templates", { params: { active: true } });
  templates.value = Array.isArray(data) ? data : [];
  if (!editingId.value) {
    form.value.selectedTemplateIds = templates.value.map((row) => row.id);
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
    editingId.value = data.id;
    form.value = {
      monthKey: data.monthKey || nextMonthKey(),
      title: data.title || "",
      dueDate: data.dueDate || "",
      status: data.status || "draft",
      selectedTemplateIds: Array.isArray(data.items) ? data.items.map((row) => row.templateId).filter(Boolean) : [],
    };
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
  } catch (e) {
    formErr.value = e.response?.data?.error || e.message || "Lưu kỳ thu thất bại";
  } finally {
    saving.value = false;
  }
}

async function generatePeriod(id) {
  generatingId.value = id;
  loadErr.value = "";
  okMsg.value = "";
  try {
    const { data } = await api.post(`/fees/periods/${id}/generate`);
    okMsg.value = `Đã tạo bảng tính cho ${data.generatedCount || 0} học sinh.`;
    await loadPeriods();
  } catch (e) {
    loadErr.value = e.response?.data?.error || e.message || "Generate kỳ thu thất bại";
  } finally {
    generatingId.value = null;
  }
}

onMounted(async () => {
  try {
    await Promise.all([loadTemplates(), loadPeriods()]);
    resetForm();
  } catch (e) {
    loadErr.value = e.response?.data?.error || e.message || "Không tải được dữ liệu kỳ thu";
  }
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
      <argon-button color="secondary" variant="outline" type="button" @click="resetForm">
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
        <span>Khoản đang chọn</span>
        <strong>{{ stats.selectedItems }}</strong>
      </div>
    </div>

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
            <h6 class="mb-1">{{ editingId ? "Cập nhật kỳ thu" : "Tạo kỳ thu" }}</h6>
            <p class="text-sm text-secondary mb-0">Kỳ thu là ảnh chụp danh sách khoản thu được áp dụng trong một tháng cụ thể.</p>
          </div>
          <div class="card-body">
            <argon-alert v-if="formErr" color="danger" icon="ni ni-fat-remove" class="mb-3">
              {{ formErr }}
            </argon-alert>

            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-control-label">Tháng</label>
                <input v-model="form.monthKey" type="month" class="form-control" />
              </div>
              <div class="col-md-6">
                <label class="form-control-label">Hạn đóng</label>
                <input v-model="form.dueDate" type="date" class="form-control" />
              </div>
              <div class="col-12">
                <label class="form-control-label">Tên kỳ thu</label>
                <input v-model="form.title" type="text" class="form-control" placeholder="Ví dụ: Học phí tháng 05/2026" />
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
            <div class="fee-template-list">
              <label v-for="row in templates" :key="row.id" class="fee-template-row">
                <input :checked="form.selectedTemplateIds.includes(row.id)" type="checkbox" @change="toggleTemplate(row.id)" />
                <span>
                  <strong>{{ row.code }} - {{ row.name }}</strong>
                  <small>
                    {{ row.category }} • {{ row.calcType }} • {{ formatMoney(row.unitPrice) }} / {{ row.unitName }}
                  </small>
                </span>
              </label>
            </div>

            <div class="fee-actions">
              <argon-button color="secondary" variant="outline" type="button" @click="resetForm">
                Làm mới
              </argon-button>
              <argon-button color="primary" variant="gradient" type="button" :disabled="saving" @click="savePeriod">
                {{ saving ? "Đang lưu..." : editingId ? "Cập nhật kỳ thu" : "Lưu kỳ thu" }}
              </argon-button>
            </div>
          </div>
        </div>
      </div>

      <div class="col-xl-7">
        <div class="card fee-card">
          <div class="card-header pb-0">
            <div class="row g-3">
              <div class="col-md-3">
                <input v-model="monthFilter" type="month" class="form-control" />
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
                  Lọc
                </argon-button>
              </div>
            </div>
          </div>
          <div class="card-body pt-3">
            <div v-if="loading" class="text-sm text-secondary">Đang tải dữ liệu kỳ thu...</div>
            <div v-else-if="!periods.length" class="text-sm text-secondary">Chưa có kỳ thu nào.</div>
            <div v-else class="table-responsive">
              <table class="table align-items-center mb-0">
                <thead>
                  <tr>
                    <th>Tháng</th>
                    <th>Tên kỳ</th>
                    <th>Khoản</th>
                    <th>HS</th>
                    <th>Phải thu</th>
                    <th>Đã thu</th>
                    <th>Trạng thái</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in periods" :key="row.id">
                    <td class="text-sm font-weight-bold">{{ row.monthKey }}</td>
                    <td class="text-sm">
                      <strong>{{ row.title }}</strong>
                      <div class="text-secondary">Hạn đóng: {{ row.dueDate || "Chưa đặt" }}</div>
                    </td>
                    <td class="text-sm">{{ row.itemCount }}</td>
                    <td class="text-sm">{{ row.studentCount }}</td>
                    <td class="text-sm">{{ formatMoney(row.totalFinalAmount) }}</td>
                    <td class="text-sm">{{ formatMoney(row.totalPaidAmount) }}</td>
                    <td class="text-sm">
                      <span class="fee-status" :class="`fee-status--${row.status}`">{{ row.status }}</span>
                    </td>
                    <td class="text-end">
                      <div class="fee-table-actions">
                        <button type="button" class="btn btn-link text-secondary mb-0 p-0" @click="editPeriod(row.id)">
                          Sửa
                        </button>
                        <button type="button" class="btn btn-link text-primary mb-0 p-0" :disabled="generatingId === row.id" @click="generatePeriod(row.id)">
                          {{ generatingId === row.id ? "Đang tạo..." : "Tạo bảng tính" }}
                        </button>
                      </div>
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
  background: linear-gradient(135deg, #ffffff, #eef4ff);
}

.fee-eyebrow {
  display: inline-block;
  margin-bottom: 0.25rem;
  color: #1d4ed8;
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

.fee-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.fee-stat-card,
.fee-card {
  border: 1px solid #e7edf5;
  border-radius: 1rem;
  box-shadow: 0 1rem 2rem -1.8rem rgba(15, 23, 42, 0.35);
}

.fee-stat-card {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 1rem 1.1rem;
  background: #fff;
}

.fee-stat-card span {
  color: #64748b;
  font-size: 0.82rem;
}

.fee-stat-card strong {
  color: #1f2a44;
  font-size: 1.4rem;
}

.fee-section-head,
.fee-actions,
.fee-table-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.fee-section-head {
  margin: 1.25rem 0 0.75rem;
}

.fee-template-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  max-height: 26rem;
  overflow: auto;
}

.fee-template-row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.8rem 0.9rem;
  border: 1px solid #e7edf5;
  border-radius: 0.9rem;
  background: #fff;
}

.fee-template-row span {
  display: flex;
  flex-direction: column;
}

.fee-template-row small {
  color: #64748b;
}

.fee-actions {
  margin-top: 1rem;
  justify-content: flex-end;
}

.fee-status {
  display: inline-flex;
  align-items: center;
  padding: 0.22rem 0.65rem;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: capitalize;
}

.fee-status--draft {
  color: #92400e;
  background: #fef3c7;
}

.fee-status--published {
  color: #1d4ed8;
  background: #dbeafe;
}

.fee-status--closed {
  color: #166534;
  background: #dcfce7;
}

@media (max-width: 991.98px) {
  .fee-hero {
    flex-direction: column;
    align-items: stretch;
  }

  .fee-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
