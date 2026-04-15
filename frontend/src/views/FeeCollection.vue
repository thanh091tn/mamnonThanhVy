<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { api } from "@/api/client.js";
import ArgonAlert from "@/components/ArgonAlert.vue";
import ArgonButton from "@/components/ArgonButton.vue";

function formatMoney(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function currentDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getPaymentStatusLabel(status) {
  if (status === "paid") return "Đã đủ";
  if (status === "partial") return "Thu một phần";
  return "Chưa thu";
}

const periods = ref([]);
const classes = ref([]);
const rows = ref([]);
const report = ref(null);
const selectedPeriodId = ref("");
const classFilter = ref("");
const paymentStatusFilter = ref("");
const hasDiscountFilter = ref("");
const searchQuery = ref("");
const loading = ref(false);
const reportLoading = ref(false);
const loadErr = ref("");
const okMsg = ref("");
const selectedDetail = ref(null);
const detailLoading = ref(false);
const paymentSaving = ref(false);
const adjustmentSaving = ref(false);
const detailErr = ref("");

const paymentForm = ref({
  amount: "",
  paidDate: currentDate(),
  method: "cash",
  invoiceNumber: "",
  note: "",
});

const adjustmentForm = ref({
  lineName: "",
  adjustmentType: "charge",
  quantity: 1,
  unitPrice: 0,
  amount: "",
  note: "",
});

const totals = computed(() => {
  const summary = report.value?.summary;
  if (!summary) {
    return {
      finalAmount: rows.value.reduce((sum, row) => sum + Number(row.finalAmount || 0), 0),
      paidAmount: rows.value.reduce((sum, row) => sum + Number(row.paidAmount || 0), 0),
      remainingAmount: rows.value.reduce((sum, row) => sum + Number(row.remainingAmount || 0), 0),
      studentCount: rows.value.length,
      paidCount: rows.value.filter((row) => row.paymentStatus === "paid").length,
      partialCount: rows.value.filter((row) => row.paymentStatus === "partial").length,
      unpaidCount: rows.value.filter((row) => row.paymentStatus === "unpaid").length,
    };
  }
  return {
    finalAmount: Number(summary.finalAmount || 0),
    paidAmount: Number(summary.paidAmount || 0),
    remainingAmount: Number(summary.remainingAmount || 0),
    studentCount: Number(summary.studentCount || 0),
    paidCount: Number(summary.paidCount || 0),
    partialCount: Number(summary.partialCount || 0),
    unpaidCount: Number(summary.unpaidCount || 0),
  };
});

function resetPaymentForm() {
  paymentForm.value = {
    amount: "",
    paidDate: currentDate(),
    method: "cash",
    invoiceNumber: "",
    note: "",
  };
}

function resetAdjustmentForm() {
  adjustmentForm.value = {
    lineName: "",
    adjustmentType: "charge",
    quantity: 1,
    unitPrice: 0,
    amount: "",
    note: "",
  };
}

async function loadMeta() {
  const [periodsRes, classesRes] = await Promise.all([api.get("/fees/periods"), api.get("/classes")]);
  periods.value = Array.isArray(periodsRes.data) ? periodsRes.data : [];
  classes.value = Array.isArray(classesRes.data) ? classesRes.data : [];
  if (!selectedPeriodId.value && periods.value.length) {
    selectedPeriodId.value = String(periods.value[0].id);
  }
}

async function loadRows() {
  if (!selectedPeriodId.value) {
    rows.value = [];
    return;
  }
  loading.value = true;
  loadErr.value = "";
  try {
    const { data } = await api.get(`/fees/periods/${selectedPeriodId.value}/students`, {
      params: {
        classId: classFilter.value || undefined,
        paymentStatus: paymentStatusFilter.value || undefined,
        hasDiscount: hasDiscountFilter.value || undefined,
        q: searchQuery.value.trim() || undefined,
      },
    });
    rows.value = Array.isArray(data) ? data : [];
  } catch (e) {
    loadErr.value = e.response?.data?.error || e.message || "Không tải được bảng tính học phí";
    rows.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadReport() {
  if (!selectedPeriodId.value) {
    report.value = null;
    return;
  }
  reportLoading.value = true;
  try {
    const { data } = await api.get(`/fees/reports/period/${selectedPeriodId.value}`);
    report.value = data;
  } catch {
    report.value = null;
  } finally {
    reportLoading.value = false;
  }
}

async function loadDetail(id) {
  detailLoading.value = true;
  detailErr.value = "";
  try {
    const { data } = await api.get(`/fees/student-periods/${id}`);
    selectedDetail.value = data;
    resetPaymentForm();
    resetAdjustmentForm();
  } catch (e) {
    detailErr.value = e.response?.data?.error || e.message || "Không tải được phiếu học phí";
  } finally {
    detailLoading.value = false;
  }
}

async function generateSelectedPeriod() {
  if (!selectedPeriodId.value) return;
  loadErr.value = "";
  okMsg.value = "";
  try {
    const { data } = await api.post(`/fees/periods/${selectedPeriodId.value}/generate`);
    okMsg.value = `Đã tạo bảng tính cho ${data.generatedCount || 0} học sinh.`;
    await Promise.all([loadMeta(), loadRows(), loadReport()]);
  } catch (e) {
    loadErr.value = e.response?.data?.error || e.message || "Generate bảng tính thất bại";
  }
}

async function submitPayment() {
  if (!selectedDetail.value) return;
  paymentSaving.value = true;
  detailErr.value = "";
  okMsg.value = "";
  try {
    await api.post(`/fees/student-periods/${selectedDetail.value.id}/payments`, {
      amount: Number(paymentForm.value.amount || 0),
      paidDate: paymentForm.value.paidDate || null,
      method: paymentForm.value.method,
      invoiceNumber: paymentForm.value.invoiceNumber,
      note: paymentForm.value.note,
    });
    okMsg.value = "Đã ghi nhận thanh toán.";
    await Promise.all([loadRows(), loadDetail(selectedDetail.value.id), loadMeta(), loadReport()]);
  } catch (e) {
    detailErr.value = e.response?.data?.error || e.message || "Ghi nhận thanh toán thất bại";
  } finally {
    paymentSaving.value = false;
  }
}

async function submitAdjustment() {
  if (!selectedDetail.value) return;
  adjustmentSaving.value = true;
  detailErr.value = "";
  okMsg.value = "";
  try {
    await api.post(`/fees/student-periods/${selectedDetail.value.id}/adjustments`, {
      lineName: adjustmentForm.value.lineName,
      adjustmentType: adjustmentForm.value.adjustmentType,
      quantity: Number(adjustmentForm.value.quantity || 1),
      unitPrice: Number(adjustmentForm.value.unitPrice || 0),
      amount: adjustmentForm.value.amount === "" ? null : Number(adjustmentForm.value.amount),
      note: adjustmentForm.value.note,
    });
    okMsg.value = "Đã tạo phiếu điều chỉnh.";
    await Promise.all([loadRows(), loadDetail(selectedDetail.value.id), loadReport()]);
    resetAdjustmentForm();
  } catch (e) {
    detailErr.value = e.response?.data?.error || e.message || "Lưu điều chỉnh thất bại";
  } finally {
    adjustmentSaving.value = false;
  }
}

watch(selectedPeriodId, async () => {
  selectedDetail.value = null;
  await Promise.all([loadRows(), loadReport()]);
});

onMounted(async () => {
  try {
    await loadMeta();
    await Promise.all([loadRows(), loadReport()]);
  } catch (e) {
    loadErr.value = e.response?.data?.error || e.message || "Không tải được dữ liệu học phí";
  }
});
</script>

<template>
  <div class="fee-page page-fill">
    <section class="fee-hero">
      <div>
        <span class="fee-eyebrow">Bảng tính</span>
        <h4 class="fee-title mb-1">Tính học phí tháng</h4>
        <p class="fee-subtitle mb-0">
          Theo dõi tổng phải thu, đã thu, còn thiếu và giải thích rõ từng dòng tiền cho phụ huynh và kế toán.
        </p>
      </div>
      <div class="fee-hero-actions">
        <select v-model="selectedPeriodId" class="form-select fee-period-select">
          <option value="">Chọn kỳ thu</option>
          <option v-for="row in periods" :key="row.id" :value="String(row.id)">
            {{ row.title }} ({{ row.monthKey }})
          </option>
        </select>
        <argon-button color="primary" variant="gradient" type="button" @click="generateSelectedPeriod">
          Tạo bảng tính
        </argon-button>
      </div>
    </section>

    <argon-alert v-if="loadErr" color="danger" icon="ni ni-fat-remove" class="mb-3">
      {{ loadErr }}
    </argon-alert>
    <argon-alert v-if="okMsg" color="success" icon="ni ni-check-bold" class="mb-3">
      {{ okMsg }}
    </argon-alert>

    <div class="fee-stats">
      <div class="fee-stat-card">
        <span>Tổng phải thu</span>
        <strong>{{ formatMoney(totals.finalAmount) }} đ</strong>
      </div>
      <div class="fee-stat-card">
        <span>Đã thu</span>
        <strong>{{ formatMoney(totals.paidAmount) }} đ</strong>
      </div>
      <div class="fee-stat-card">
        <span>Còn thiếu</span>
        <strong>{{ formatMoney(totals.remainingAmount) }} đ</strong>
      </div>
      <div class="fee-stat-card">
        <span>Đã đủ</span>
        <strong>{{ totals.paidCount }}/{{ totals.studentCount }}</strong>
      </div>
    </div>

    <div class="row g-4">
      <div class="col-xl-8">
        <div class="card fee-card">
          <div class="card-header pb-0">
            <div class="row g-3">
              <div class="col-md-3">
                <select v-model="classFilter" class="form-select">
                  <option value="">Tất cả lớp</option>
                  <option v-for="row in classes" :key="row.id" :value="row.id">{{ row.name }}</option>
                </select>
              </div>
              <div class="col-md-3">
                <select v-model="paymentStatusFilter" class="form-select">
                  <option value="">Tất cả trạng thái</option>
                  <option value="unpaid">Chưa thu</option>
                  <option value="partial">Thu một phần</option>
                  <option value="paid">Đã đủ</option>
                </select>
              </div>
              <div class="col-md-2">
                <select v-model="hasDiscountFilter" class="form-select">
                  <option value="">Miễn giảm</option>
                  <option value="true">Có miễn giảm</option>
                  <option value="false">Không miễn giảm</option>
                </select>
              </div>
              <div class="col-md-3">
                <input v-model="searchQuery" type="text" class="form-control" placeholder="Tìm học sinh" />
              </div>
              <div class="col-md-1">
                <argon-button color="secondary" variant="outline" type="button" class="w-100" @click="loadRows">
                  Lọc
                </argon-button>
              </div>
            </div>
          </div>
          <div class="card-body pt-3">
            <div v-if="loading" class="text-sm text-secondary">Đang tải bảng tính...</div>
            <div v-else-if="!rows.length" class="text-sm text-secondary">Chưa có dữ liệu học phí cho kỳ này.</div>
            <div v-else class="table-responsive">
              <table class="table align-items-center mb-0">
                <thead>
                  <tr>
                    <th>Học sinh</th>
                    <th>Học phí</th>
                    <th>Theo ngày</th>
                    <th>Dịch vụ</th>
                    <th>Giảm trừ</th>
                    <th>Nợ cũ</th>
                    <th>Tổng</th>
                    <th>Đã thu</th>
                    <th>Còn thiếu</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in rows" :key="row.id">
                    <td class="text-sm">
                      <strong>{{ row.studentName }}</strong>
                      <div class="text-secondary">
                        {{ row.className || "Chưa xếp lớp" }}
                        <span v-if="row.hasAlert" class="text-danger">• tăng bất thường</span>
                      </div>
                    </td>
                    <td class="text-sm">{{ formatMoney(row.fixedAmount) }}</td>
                    <td class="text-sm">{{ formatMoney(row.dailyAmount) }}</td>
                    <td class="text-sm">{{ formatMoney(row.serviceAmount + row.oneTimeAmount) }}</td>
                    <td class="text-sm text-success">-{{ formatMoney(row.discountAmount - Math.min(row.adjustmentAmount, 0)) }}</td>
                    <td class="text-sm">{{ formatMoney(row.balanceAmount) }}</td>
                    <td class="text-sm font-weight-bold">{{ formatMoney(row.finalAmount) }}</td>
                    <td class="text-sm">{{ formatMoney(row.paidAmount) }}</td>
                    <td class="text-sm">{{ formatMoney(row.remainingAmount) }}</td>
                    <td class="text-end">
                      <button type="button" class="btn btn-link text-primary mb-0 p-0" @click="loadDetail(row.id)">
                        Giải thích số tiền
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="card fee-card mt-4">
          <div class="card-header pb-0">
            <h6 class="mb-1">Tổng hợp theo lớp</h6>
            <p class="text-sm text-secondary mb-0">Giúp kế toán và ban giám hiệu theo dõi công nợ theo từng lớp.</p>
          </div>
          <div class="card-body pt-3">
            <div v-if="reportLoading" class="text-sm text-secondary">Đang tải báo cáo...</div>
            <div v-else-if="!report?.byClass?.length" class="text-sm text-secondary">Chưa có dữ liệu tổng hợp.</div>
            <div v-else class="table-responsive">
              <table class="table align-items-center mb-0">
                <thead>
                  <tr>
                    <th>Lớp</th>
                    <th>HS</th>
                    <th>Phải thu</th>
                    <th>Đã thu</th>
                    <th>Còn thiếu</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in report.byClass" :key="row.className">
                    <td class="text-sm font-weight-bold">{{ row.className }}</td>
                    <td class="text-sm">{{ row.studentCount }}</td>
                    <td class="text-sm">{{ formatMoney(row.finalAmount) }}</td>
                    <td class="text-sm">{{ formatMoney(row.paidAmount) }}</td>
                    <td class="text-sm">{{ formatMoney(row.remainingAmount) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div class="col-xl-4">
        <div class="card fee-card">
          <div class="card-header pb-0">
            <h6 class="mb-1">Phiếu học phí chi tiết</h6>
            <p class="text-sm text-secondary mb-0">Hiển thị từng dòng, công thức và nguồn dữ liệu để phụ huynh nhìn vào là hiểu ngay.</p>
          </div>
          <div class="card-body">
            <div v-if="detailLoading" class="text-sm text-secondary">Đang tải phiếu học phí...</div>
            <div v-else-if="!selectedDetail" class="text-sm text-secondary">Chọn một học sinh để xem phiếu chi tiết.</div>
            <template v-else>
              <div class="fee-detail-head">
                <strong>{{ selectedDetail.studentName }}</strong>
                <small>{{ selectedDetail.className || "Chưa xếp lớp" }} • {{ selectedDetail.monthKey }} • Hạn đóng {{ selectedDetail.dueDate || "chưa đặt" }}</small>
              </div>

              <div v-if="selectedDetail.hasAlert" class="fee-alert-note">
                Tổng tiền tháng này tăng {{ formatMoney(selectedDetail.finalAmount - selectedDetail.previousFinalAmount) }} đ so với tháng trước.
              </div>

              <div class="fee-summary-box">
                <div><span>Tổng phải thu</span><strong>{{ formatMoney(selectedDetail.finalAmount) }}</strong></div>
                <div><span>Đã thanh toán</span><strong>{{ formatMoney(selectedDetail.paidAmount) }}</strong></div>
                <div><span>Còn phải nộp</span><strong>{{ formatMoney(selectedDetail.remainingAmount) }}</strong></div>
              </div>

              <h6 class="fee-section-title">Chi tiết khoản thu</h6>
              <div class="fee-line-list">
                <div v-for="item in selectedDetail.items" :key="item.id" class="fee-line-row">
                  <div>
                    <strong>{{ item.name }}</strong>
                    <div class="text-secondary text-sm">{{ item.formulaText || item.note || item.sourceType }}</div>
                    <div v-if="item.note && item.formulaText" class="text-secondary text-xs">{{ item.note }}</div>
                  </div>
                  <strong :class="item.finalAmount < 0 ? 'text-success' : ''">
                    {{ item.finalAmount < 0 ? "-" : "" }}{{ formatMoney(Math.abs(item.finalAmount)) }}
                  </strong>
                </div>
              </div>

              <h6 class="fee-section-title">Lịch sử thanh toán</h6>
              <div v-if="selectedDetail.payments.length" class="fee-line-list">
                <div v-for="payment in selectedDetail.payments" :key="payment.id" class="fee-line-row">
                  <div>
                    <strong>{{ payment.method }}</strong>
                    <div class="text-secondary text-sm">
                      {{ payment.paidAt.slice(0, 10) }}{{ payment.invoiceNumber ? ` • HĐ ${payment.invoiceNumber}` : "" }}
                    </div>
                  </div>
                  <strong>{{ formatMoney(payment.amount) }}</strong>
                </div>
              </div>
              <p v-else class="text-sm text-secondary">Chưa có thanh toán nào.</p>

              <h6 class="fee-section-title">Phiếu điều chỉnh</h6>
              <div v-if="selectedDetail.adjustments.length" class="fee-line-list mb-3">
                <div v-for="adjustment in selectedDetail.adjustments" :key="adjustment.id" class="fee-line-row">
                  <div>
                    <strong>{{ adjustment.lineName }}</strong>
                    <div class="text-secondary text-sm">{{ adjustment.adjustmentType }} • {{ adjustment.createdAt.slice(0, 10) }}</div>
                  </div>
                  <strong>{{ adjustment.amount < 0 ? "-" : "" }}{{ formatMoney(Math.abs(adjustment.amount)) }}</strong>
                </div>
              </div>

              <argon-alert v-if="detailErr" color="danger" icon="ni ni-fat-remove" class="mb-3">
                {{ detailErr }}
              </argon-alert>

              <h6 class="fee-section-title">Ghi nhận thanh toán</h6>
              <div class="row g-3">
                <div class="col-12">
                  <input v-model="paymentForm.amount" type="number" min="0" step="1000" class="form-control" placeholder="Số tiền thu" />
                </div>
                <div class="col-md-6">
                  <input v-model="paymentForm.paidDate" type="date" class="form-control" />
                </div>
                <div class="col-md-6">
                  <select v-model="paymentForm.method" class="form-select">
                    <option value="cash">Tiền mặt</option>
                    <option value="transfer">Chuyển khoản</option>
                    <option value="card">Thẻ</option>
                  </select>
                </div>
                <div class="col-12">
                  <input v-model="paymentForm.invoiceNumber" type="text" class="form-control" placeholder="Số hóa đơn / biên lai" />
                </div>
                <div class="col-12">
                  <textarea v-model="paymentForm.note" rows="2" class="form-control" placeholder="Ghi chú thanh toán"></textarea>
                </div>
              </div>
              <div class="fee-actions">
                <argon-button color="primary" variant="gradient" type="button" :disabled="paymentSaving" @click="submitPayment">
                  {{ paymentSaving ? "Đang lưu..." : "Xác nhận thu tiền" }}
                </argon-button>
              </div>

              <h6 class="fee-section-title">Thêm điều chỉnh</h6>
              <div class="row g-3">
                <div class="col-12">
                  <input v-model="adjustmentForm.lineName" type="text" class="form-control" placeholder="Ví dụ: Hoàn tiền nghỉ dài ngày" />
                </div>
                <div class="col-md-6">
                  <select v-model="adjustmentForm.adjustmentType" class="form-select">
                    <option value="charge">Phụ thu</option>
                    <option value="discount">Giảm trừ</option>
                    <option value="refund">Hoàn tiền</option>
                    <option value="carry_forward">Khấu trừ số dư</option>
                  </select>
                </div>
                <div class="col-md-6">
                  <input v-model="adjustmentForm.amount" type="number" step="1000" class="form-control" placeholder="Số tiền (có thể bỏ trống)" />
                </div>
                <div class="col-md-6">
                  <input v-model="adjustmentForm.quantity" type="number" min="0" step="0.5" class="form-control" placeholder="Số lượng" />
                </div>
                <div class="col-md-6">
                  <input v-model="adjustmentForm.unitPrice" type="number" min="0" step="1000" class="form-control" placeholder="Đơn giá" />
                </div>
                <div class="col-12">
                  <textarea v-model="adjustmentForm.note" rows="2" class="form-control" placeholder="Lý do điều chỉnh"></textarea>
                </div>
              </div>
              <div class="fee-actions">
                <argon-button color="secondary" variant="outline" type="button" :disabled="adjustmentSaving" @click="submitAdjustment">
                  {{ adjustmentSaving ? "Đang lưu..." : "Lưu phiếu điều chỉnh" }}
                </argon-button>
              </div>
            </template>
          </div>
        </div>

        <div class="card fee-card mt-4">
          <div class="card-header pb-0">
            <h6 class="mb-1">Tiến độ thu</h6>
            <p class="text-sm text-secondary mb-0">Theo dõi nhanh số phiếu đã đủ, còn thiếu và chưa thu.</p>
          </div>
          <div class="card-body pt-3">
            <div class="fee-progress-row">
              <span>Chưa thu</span>
              <strong>{{ totals.unpaidCount }}</strong>
            </div>
            <div class="fee-progress-row">
              <span>Thu một phần</span>
              <strong>{{ totals.partialCount }}</strong>
            </div>
            <div class="fee-progress-row">
              <span>Đã đủ</span>
              <strong>{{ totals.paidCount }}</strong>
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
  background: linear-gradient(135deg, #ffffff, #eef8ff);
}

.fee-hero-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.fee-period-select {
  min-width: 20rem;
}

.fee-eyebrow {
  display: inline-block;
  margin-bottom: 0.25rem;
  color: #0f766e;
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
  font-size: 1.35rem;
}

.fee-detail-head {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  margin-bottom: 0.9rem;
}

.fee-alert-note {
  padding: 0.8rem 0.9rem;
  margin-bottom: 0.9rem;
  border: 1px solid #fcd34d;
  border-radius: 0.9rem;
  background: #fffbeb;
  color: #92400e;
  font-size: 0.9rem;
}

.fee-summary-box,
.fee-line-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.fee-summary-box {
  margin-bottom: 1rem;
}

.fee-summary-box div,
.fee-line-row,
.fee-progress-row,
.fee-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.fee-summary-box div,
.fee-line-row,
.fee-progress-row {
  padding: 0.75rem 0.85rem;
  border: 1px solid #e7edf5;
  border-radius: 0.9rem;
}

.fee-section-title {
  margin: 1rem 0 0.65rem;
}

.fee-actions {
  margin-top: 1rem;
  justify-content: flex-end;
}

.fee-progress-row + .fee-progress-row {
  margin-top: 0.75rem;
}

@media (max-width: 991.98px) {
  .fee-hero,
  .fee-hero-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .fee-period-select {
    min-width: 0;
  }

  .fee-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
