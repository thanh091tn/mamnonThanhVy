<script setup>
import { computed, onMounted, ref } from "vue";
import { api } from "@/api/client.js";
import ArgonAlert from "@/components/ArgonAlert.vue";
import ArgonButton from "@/components/ArgonButton.vue";

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const students = ref([]);
const classes = ref([]);
const serviceTemplates = ref([]);
const subscriptions = ref([]);
const selectedSubscription = ref(null);
const loading = ref(false);
const saving = ref(false);
const usageSaving = ref(false);
const loadErr = ref("");
const formErr = ref("");
const okMsg = ref("");
const editingId = ref(null);
const classFilter = ref("");
const statusFilter = ref("");
const searchQuery = ref("");

const form = ref({
  studentId: "",
  feeItemTemplateId: "",
  startDate: "",
  endDate: "",
  status: "active",
  quantityOverride: "",
  unitPriceOverride: "",
  note: "",
});

const usageForm = ref({
  monthKey: currentMonthKey(),
  quantity: "",
  note: "",
});

const levelOptions = computed(() => {
  return [...new Set(classes.value.map((row) => row.level).filter(Boolean))];
});

function resetForm() {
  editingId.value = null;
  form.value = {
    studentId: "",
    feeItemTemplateId: "",
    startDate: "",
    endDate: "",
    status: "active",
    quantityOverride: "",
    unitPriceOverride: "",
    note: "",
  };
  formErr.value = "";
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

async function loadMeta() {
  const [studentsRes, classesRes, templateRes] = await Promise.all([
    api.get("/students"),
    api.get("/classes"),
    api.get("/fees/item-templates", { params: { category: "service", active: true } }),
  ]);
  students.value = Array.isArray(studentsRes.data) ? studentsRes.data : [];
  classes.value = Array.isArray(classesRes.data) ? classesRes.data : [];
  serviceTemplates.value = Array.isArray(templateRes.data) ? templateRes.data : [];
}

async function loadSubscriptions() {
  loading.value = true;
  loadErr.value = "";
  try {
    const { data } = await api.get("/fees/service-subscriptions", {
      params: {
        classId: classFilter.value || undefined,
        status: statusFilter.value || undefined,
        q: searchQuery.value.trim() || undefined,
        monthKey: usageForm.value.monthKey || undefined,
      },
    });
    subscriptions.value = Array.isArray(data) ? data : [];
  } catch (e) {
    loadErr.value = e.response?.data?.error || e.message || "Không tải được đăng ký dịch vụ";
    subscriptions.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadSubscriptionDetail(id) {
  try {
    const { data } = await api.get(`/fees/service-subscriptions/${id}`);
    selectedSubscription.value = data;
    usageForm.value.quantity = data.usages?.find((row) => row.monthKey === usageForm.value.monthKey)?.quantity ?? "";
    usageForm.value.note = data.usages?.find((row) => row.monthKey === usageForm.value.monthKey)?.note ?? "";
  } catch (e) {
    loadErr.value = e.response?.data?.error || e.message || "Không tải được chi tiết dịch vụ";
  }
}

function editSubscription(row) {
  editingId.value = row.id;
  form.value = {
    studentId: row.studentId,
    feeItemTemplateId: row.feeItemTemplateId,
    startDate: row.startDate || "",
    endDate: row.endDate || "",
    status: row.status || "active",
    quantityOverride: row.quantityOverride ?? "",
    unitPriceOverride: row.unitPriceOverride ?? "",
    note: row.note || "",
  };
  formErr.value = "";
}

async function saveSubscription() {
  saving.value = true;
  formErr.value = "";
  okMsg.value = "";
  try {
    const payload = {
      studentId: Number(form.value.studentId),
      feeItemTemplateId: Number(form.value.feeItemTemplateId),
      startDate: form.value.startDate,
      endDate: form.value.endDate || null,
      status: form.value.status,
      quantityOverride: form.value.quantityOverride === "" ? null : Number(form.value.quantityOverride),
      unitPriceOverride: form.value.unitPriceOverride === "" ? null : Number(form.value.unitPriceOverride),
      note: form.value.note,
    };
    if (editingId.value) {
      await api.put(`/fees/service-subscriptions/${editingId.value}`, payload);
      okMsg.value = "Đã cập nhật đăng ký dịch vụ.";
    } else {
      await api.post("/fees/service-subscriptions", payload);
      okMsg.value = "Đã tạo đăng ký dịch vụ.";
    }
    await loadSubscriptions();
    resetForm();
  } catch (e) {
    formErr.value = e.response?.data?.error || e.message || "Lưu đăng ký dịch vụ thất bại";
  } finally {
    saving.value = false;
  }
}

async function saveUsage() {
  if (!selectedSubscription.value) return;
  usageSaving.value = true;
  formErr.value = "";
  okMsg.value = "";
  try {
    await api.put(`/fees/service-subscriptions/${selectedSubscription.value.id}/usage`, {
      monthKey: usageForm.value.monthKey,
      quantity: Number(usageForm.value.quantity || 0),
      note: usageForm.value.note,
    });
    okMsg.value = "Đã lưu số lượng dịch vụ theo tháng.";
    await Promise.all([loadSubscriptions(), loadSubscriptionDetail(selectedSubscription.value.id)]);
  } catch (e) {
    formErr.value = e.response?.data?.error || e.message || "Lưu số lượng dịch vụ thất bại";
  } finally {
    usageSaving.value = false;
  }
}

onMounted(async () => {
  try {
    await loadMeta();
    await loadSubscriptions();
  } catch (e) {
    loadErr.value = e.response?.data?.error || e.message || "Không tải được dữ liệu dịch vụ";
  }
});
</script>

<template>
  <div class="fee-page page-fill">
    <section class="fee-hero">
      <div>
        <span class="fee-eyebrow">Dịch vụ</span>
        <h4 class="fee-title mb-1">Đăng ký dịch vụ học sinh</h4>
        <p class="fee-subtitle mb-0">
          Quản lý xe đưa đón, năng khiếu, câu lạc bộ và số lượng sử dụng theo từng tháng.
        </p>
      </div>
      <argon-button color="secondary" variant="outline" type="button" @click="resetForm">
        Tạo đăng ký mới
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
            <h6 class="mb-1">{{ editingId ? "Cập nhật đăng ký" : "Tạo đăng ký dịch vụ" }}</h6>
            <p class="text-sm text-secondary mb-0">Áp dụng theo từng học sinh, có ngày bắt đầu/kết thúc và đơn giá riêng nếu cần.</p>
          </div>
          <div class="card-body">
            <argon-alert v-if="formErr" color="danger" icon="ni ni-fat-remove" class="mb-3">
              {{ formErr }}
            </argon-alert>

            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-control-label">Học sinh</label>
                <select v-model="form.studentId" class="form-select">
                  <option value="">Chọn học sinh</option>
                  <option v-for="student in students" :key="student.id" :value="student.id">
                    {{ student.name }}{{ student.className ? ` - ${student.className}` : "" }}
                  </option>
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-control-label">Dịch vụ</label>
                <select v-model="form.feeItemTemplateId" class="form-select">
                  <option value="">Chọn dịch vụ</option>
                  <option v-for="item in serviceTemplates" :key="item.id" :value="item.id">
                    {{ item.code }} - {{ item.name }}
                  </option>
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-control-label">Ngày bắt đầu</label>
                <input v-model="form.startDate" type="date" class="form-control" />
              </div>
              <div class="col-md-6">
                <label class="form-control-label">Ngày kết thúc</label>
                <input v-model="form.endDate" type="date" class="form-control" />
              </div>
              <div class="col-md-6">
                <label class="form-control-label">Trạng thái</label>
                <select v-model="form.status" class="form-select">
                  <option value="active">Đang áp dụng</option>
                  <option value="paused">Tạm dừng</option>
                  <option value="stopped">Ngừng hẳn</option>
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-control-label">Số lượng riêng</label>
                <input v-model="form.quantityOverride" type="number" min="0" step="0.5" class="form-control" />
              </div>
              <div class="col-md-6">
                <label class="form-control-label">Đơn giá riêng</label>
                <input v-model="form.unitPriceOverride" type="number" min="0" step="1000" class="form-control" />
              </div>
              <div class="col-12">
                <label class="form-control-label">Ghi chú</label>
                <textarea v-model="form.note" rows="3" class="form-control" placeholder="Ví dụ: xe tuyến A, đón tại nhà bà ngoại"></textarea>
              </div>
            </div>

            <div class="fee-actions">
              <argon-button color="secondary" variant="outline" type="button" @click="resetForm">
                Làm mới
              </argon-button>
              <argon-button color="primary" variant="gradient" type="button" :disabled="saving" @click="saveSubscription">
                {{ saving ? "Đang lưu..." : editingId ? "Cập nhật đăng ký" : "Lưu đăng ký" }}
              </argon-button>
            </div>
          </div>
        </div>
      </div>

      <div class="col-xl-7">
        <div class="card fee-card mb-4">
          <div class="card-header pb-0">
            <div class="row g-3">
              <div class="col-md-3">
                <select v-model="classFilter" class="form-select">
                  <option value="">Tất cả lớp</option>
                  <option v-for="row in classes" :key="row.id" :value="row.id">{{ row.name }}</option>
                </select>
              </div>
              <div class="col-md-3">
                <select v-model="statusFilter" class="form-select">
                  <option value="">Tất cả trạng thái</option>
                  <option value="active">Đang áp dụng</option>
                  <option value="paused">Tạm dừng</option>
                  <option value="stopped">Ngừng hẳn</option>
                </select>
              </div>
              <div class="col-md-3">
                <input v-model="usageForm.monthKey" type="month" class="form-control" />
              </div>
              <div class="col-md-3">
                <input v-model="searchQuery" type="text" class="form-control" placeholder="Tìm học sinh/dịch vụ" />
              </div>
            </div>
            <div class="fee-actions mt-3 mb-0">
              <span class="text-sm text-secondary">Theo dõi được cả gói cố định lẫn số buổi thực tế trong tháng.</span>
              <argon-button color="secondary" variant="outline" type="button" @click="loadSubscriptions">
                Tải lại
              </argon-button>
            </div>
          </div>
          <div class="card-body pt-3">
            <div v-if="loading" class="text-sm text-secondary">Đang tải...</div>
            <div v-else-if="!subscriptions.length" class="text-sm text-secondary">Chưa có đăng ký dịch vụ nào.</div>
            <div v-else class="table-responsive">
              <table class="table align-items-center mb-0">
                <thead>
                  <tr>
                    <th>Học sinh</th>
                    <th>Dịch vụ</th>
                    <th>Thời gian</th>
                    <th>SL tháng</th>
                    <th>Trạng thái</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in subscriptions" :key="row.id">
                    <td class="text-sm">
                      <strong>{{ row.studentName }}</strong>
                      <div class="text-secondary">{{ row.className || "Chưa xếp lớp" }}</div>
                    </td>
                    <td class="text-sm">
                      <strong>{{ row.feeItemName }}</strong>
                      <div class="text-secondary">{{ row.feeItemCode }}</div>
                    </td>
                    <td class="text-sm">{{ row.startDate }}{{ row.endDate ? ` → ${row.endDate}` : "" }}</td>
                    <td class="text-sm">{{ row.usageQuantity ?? row.quantityOverride ?? "-" }}</td>
                    <td class="text-sm">
                      <span class="fee-status" :class="`fee-status--${row.status}`">
                        {{ row.status }}
                      </span>
                    </td>
                    <td class="text-end">
                      <div class="fee-table-actions">
                        <button type="button" class="btn btn-link text-secondary mb-0 p-0" @click="editSubscription(row)">
                          Sửa
                        </button>
                        <button type="button" class="btn btn-link text-primary mb-0 p-0" @click="loadSubscriptionDetail(row.id)">
                          Chi tiết
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="card fee-card">
          <div class="card-header pb-0">
            <h6 class="mb-1">Số lượng dịch vụ theo tháng</h6>
            <p class="text-sm text-secondary mb-0">Dùng cho dịch vụ tính theo buổi/lượt thực tế như năng khiếu hoặc tuyến xe theo lượt.</p>
          </div>
          <div class="card-body">
            <div v-if="!selectedSubscription" class="text-sm text-secondary">Chọn một đăng ký dịch vụ để cập nhật số lượng tháng.</div>
            <template v-else>
              <div class="fee-detail-head">
                <strong>{{ selectedSubscription.studentName }}</strong>
                <small>{{ selectedSubscription.feeItemName }} • {{ selectedSubscription.className || "Chưa xếp lớp" }}</small>
              </div>
              <div class="row g-3">
                <div class="col-md-4">
                  <label class="form-control-label">Tháng</label>
                  <input v-model="usageForm.monthKey" type="month" class="form-control" />
                </div>
                <div class="col-md-4">
                  <label class="form-control-label">Số lượng</label>
                  <input v-model="usageForm.quantity" type="number" min="0" step="0.5" class="form-control" />
                </div>
                <div class="col-md-4">
                  <label class="form-control-label">Đơn giá áp dụng</label>
                  <input
                    :value="formatMoney(selectedSubscription.unitPriceOverride || serviceTemplates.value.find((item) => item.id === selectedSubscription.feeItemTemplateId)?.unitPrice || 0)"
                    type="text"
                    class="form-control"
                    disabled
                  />
                </div>
                <div class="col-12">
                  <label class="form-control-label">Ghi chú</label>
                  <textarea v-model="usageForm.note" rows="2" class="form-control" placeholder="Ví dụ: tham gia đủ 8 buổi"></textarea>
                </div>
              </div>
              <div class="fee-actions">
                <span class="text-sm text-secondary">Lưu tháng {{ usageForm.monthKey || currentMonthKey() }}</span>
                <argon-button color="primary" variant="gradient" type="button" :disabled="usageSaving" @click="saveUsage">
                  {{ usageSaving ? "Đang lưu..." : "Lưu số lượng" }}
                </argon-button>
              </div>
            </template>
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
  background: linear-gradient(135deg, #ffffff, #eef9ff);
}

.fee-eyebrow {
  display: inline-block;
  margin-bottom: 0.25rem;
  color: #0891b2;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.fee-title {
  color: #1f2a44;
  font-weight: 700;
}

.fee-subtitle,
.fee-detail-head small {
  color: #64748b;
}

.fee-card {
  border: 1px solid #e7edf5;
  border-radius: 1rem;
  box-shadow: 0 1rem 2rem -1.8rem rgba(15, 23, 42, 0.35);
}

.fee-actions,
.fee-table-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.fee-actions {
  margin-top: 1rem;
}

.fee-detail-head {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-bottom: 0.9rem;
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

.fee-status--active {
  color: #166534;
  background: #dcfce7;
}

.fee-status--paused {
  color: #92400e;
  background: #fef3c7;
}

.fee-status--stopped {
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
