<script setup>
import { ref, computed, onMounted, onBeforeMount, onBeforeUnmount, watch } from "vue";
import { useStore } from "vuex";
import setTooltip from "@/assets/js/tooltip.js";
import ProfileCard from "./components/ProfileCard.vue";
import ArgonInput from "@/components/ArgonInput.vue";
import ArgonAlert from "@/components/ArgonAlert.vue";
import { api } from "@/api/client.js";

const body = document.getElementsByTagName("body")[0];
const store = useStore();

const user = ref(null);
const teacher = ref(null);
const loading = ref(true);
const loadErr = ref("");

const TEACHER_STATUS = {
  active: "Đang dạy",
  inactive: "Nghỉ việc",
  leave: "Tạm nghỉ",
};
const GENDER_LABEL = { male: "Nam", female: "Nữ" };

const roleLabel = computed(() => {
  const r = user.value?.role;
  if (r === "admin") return "Quản trị viên";
  if (r === "teacher") return "Giáo viên";
  return "—";
});

const displayName = computed(() => {
  if (!user.value) return "";
  return user.value.name?.trim() || user.value.phone || user.value.email || "";
});

const teacherStatusLabel = computed(() => {
  if (!teacher.value?.status) return "—";
  return TEACHER_STATUS[teacher.value.status] || teacher.value.status;
});

const teacherGenderLabel = computed(() => {
  if (!teacher.value?.gender) return "—";
  return GENDER_LABEL[teacher.value.gender] || teacher.value.gender;
});

async function loadProfile() {
  loading.value = true;
  loadErr.value = "";
  teacher.value = null;
  try {
    const { data } = await api.get("/auth/me");
    user.value = data.user;
    if (store.state.authToken) {
      store.commit("setAuth", {
        token: store.state.authToken,
        user: data.user,
      });
    }
    if (data.user?.role === "teacher" && data.user?.teacherId) {
      const { data: t } = await api.get(`/teachers/${data.user.teacherId}`);
      teacher.value = t;
    }
  } catch (e) {
    loadErr.value =
      e.response?.data?.error || e.message || "Không tải được hồ sơ.";
    user.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  store.state.isAbsolute = true;
  setTooltip();
  loadProfile();
});

onBeforeMount(() => {
  store.state.imageLayout = "profile-overview";
  store.state.showNavbar = false;
  store.state.showFooter = true;
  store.state.hideConfigButton = true;
  body.classList.add("profile-overview");
});

onBeforeUnmount(() => {
  store.state.isAbsolute = false;
  store.state.imageLayout = "default";
  store.state.showNavbar = true;
  store.state.showFooter = true;
  store.state.hideConfigButton = false;
  body.classList.remove("profile-overview");
});

watch(
  () => store.state.authToken,
  (tok) => {
    if (tok) loadProfile();
  }
);
</script>

<template>
  <main class="page-fill profile-page">
    <div class="container-fluid profile-shell">
      <div
        class="page-header min-height-300 profile-hero"
        style="
          background-image: url('https://images.unsplash.com/photo-1531512073830-ba890ca4eba2?ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&ixlib=rb-1.2.1&auto=format&fit=crop&w=1920&q=80');
          margin-right: -24px;
          margin-left: -34%;
        "
      >
        <span class="mask profile-hero-mask"></span>
      </div>

      <div class="card shadow-lg mt-n6 profile-summary-card">
        <div class="card-body p-3 p-md-4">
          <div class="row gx-4 align-items-center">
            <div class="col-auto">
              <div class="avatar avatar-xl position-relative profile-avatar">
                <span
                  class="d-flex w-100 h-100 align-items-center justify-content-center text-white text-lg font-weight-bold"
                >
                  {{ displayName ? displayName.charAt(0).toUpperCase() : "?" }}
                </span>
              </div>
            </div>
            <div class="col-auto my-auto">
              <div class="h-100">
                <h5 class="mb-1 profile-name">{{ displayName || "Đang tải…" }}</h5>
                <p class="mb-0 font-weight-bold text-sm profile-role">
                  {{ roleLabel }}
                </p>
                <p v-if="user?.phone" class="mb-0 text-xs profile-email">{{ user.phone }}</p>
                <p v-if="user?.email" class="mb-0 text-xs profile-email">{{ user.email }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="py-4 container-fluid profile-content">
      <argon-alert v-if="loadErr" color="danger" icon="ni ni-fat-remove" class="mb-3">
        {{ loadErr }}
      </argon-alert>

      <div v-if="loading" class="text-center py-5 text-secondary text-sm">
        Đang tải hồ sơ…
      </div>

      <div v-else-if="user" class="row g-4">
        <div class="col-md-8">
          <div class="card profile-info-card">
            <div class="card-header pb-0 profile-card-header">
              <p class="mb-0 font-weight-bold profile-card-title">Thông tin tài khoản</p>
              <p class="text-xs text-secondary mb-0 profile-card-subtitle">
                Dữ liệu từ hệ thống, chỉ dùng để xem.
              </p>
            </div>

            <div class="card-body profile-card-body">
              <p class="text-uppercase text-xs text-muted mb-3 profile-section-title">
                Tài khoản đăng nhập
              </p>
              <div class="row profile-field-grid">
                <div class="col-md-6">
                  <label class="form-control-label">Họ tên</label>
                  <argon-input :model-value="user.name || ''" disabled />
                </div>
                <div class="col-md-6">
                  <label class="form-control-label">Email</label>
                  <argon-input :model-value="user.email || ''" disabled />
                </div>
                <div class="col-md-6">
                  <label class="form-control-label">Số điện thoại đăng nhập</label>
                  <argon-input :model-value="user.phone || '—'" disabled />
                </div>
                <div class="col-md-6">
                  <label class="form-control-label">Vai trò</label>
                  <argon-input :model-value="roleLabel" disabled />
                </div>
                <div class="col-md-6">
                  <label class="form-control-label">Mã người dùng</label>
                  <argon-input :model-value="String(user.id)" disabled />
                </div>
              </div>

              <template v-if="teacher">
                <hr class="horizontal dark profile-divider" />
                <p class="text-uppercase text-xs text-muted mb-3 profile-section-title">
                  Hồ sơ giáo viên
                </p>
                <div class="row profile-field-grid">
                  <div class="col-md-6">
                    <label class="form-control-label">Họ tên giáo viên</label>
                    <argon-input :model-value="teacher.name || ''" disabled />
                  </div>
                  <div class="col-md-6">
                    <label class="form-control-label">Email</label>
                    <argon-input :model-value="teacher.email || ''" disabled />
                  </div>
                  <div class="col-md-6">
                    <label class="form-control-label">Điện thoại</label>
                    <argon-input :model-value="teacher.phone || '—'" disabled />
                  </div>
                  <div class="col-md-6">
                    <label class="form-control-label">Giới tính</label>
                    <argon-input :model-value="teacherGenderLabel" disabled />
                  </div>
                  <div class="col-md-6">
                    <label class="form-control-label">Trạng thái</label>
                    <argon-input :model-value="teacherStatusLabel" disabled />
                  </div>
                  <div class="col-12">
                    <label class="form-control-label">Địa chỉ</label>
                    <argon-input :model-value="teacher.address || '—'" disabled />
                  </div>
                </div>
              </template>

              <template v-else-if="user.role === 'teacher' && !teacher">
                <hr class="horizontal dark profile-divider" />
                <p class="text-sm text-secondary mb-0 profile-note">
                  Tài khoản giáo viên này chưa liên kết với bản ghi trong danh sách giáo viên.
                </p>
              </template>

              <template v-else-if="user.role === 'admin'">
                <hr class="horizontal dark profile-divider" />
                <p class="text-sm text-secondary mb-0 profile-note">
                  Tài khoản quản trị viên không gắn hồ sơ giáo viên. Bạn có thể chỉnh dữ liệu giáo viên
                  ở mục Trường học khi cần.
                </p>
              </template>
            </div>
          </div>
        </div>

        <div class="col-md-4 mt-4 mt-md-0">
          <profile-card
            :display-name="displayName"
            :role-label="roleLabel"
            :email="user.phone || user.email || ''"
            :user-id="user.id"
            :teacher-phone="teacher?.phone || ''"
            :teacher-address="teacher?.address || ''"
            :show-teacher-extras="Boolean(teacher)"
          />
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.profile-page {
  background:
    radial-gradient(circle at top left, rgba(20, 184, 166, 0.12), transparent 34%),
    linear-gradient(180deg, #f8fafc 0%, #eef6f7 22%, #f8fafc 100%);
}

.profile-hero {
  overflow: hidden;
  border-radius: 0 0 2rem 2rem;
}

.profile-hero-mask {
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.48), rgba(15, 118, 110, 0.52)) !important;
}

.profile-summary-card {
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 1.5rem;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.12) !important;
}

.avatar-xl {
  width: 80px;
  height: 80px;
}

.profile-avatar {
  background: linear-gradient(135deg, #0f766e, #14b8a6);
  box-shadow: 0 18px 36px rgba(20, 184, 166, 0.28);
}

.profile-name {
  color: #0f172a;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.profile-role {
  color: #0f766e !important;
}

.profile-email {
  color: #64748b !important;
}

.profile-info-card {
  border: 1px solid #e2e8f0;
  border-radius: 1.35rem;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
}

.profile-card-header {
  padding: 1.5rem 1.5rem 0;
}

.profile-card-title {
  color: #0f172a;
  font-size: 1rem;
}

.profile-card-subtitle {
  margin-top: 0.25rem;
  color: #64748b !important;
}

.profile-card-body {
  padding: 1.4rem 1.5rem 1.5rem;
}

.profile-section-title {
  color: #64748b !important;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.profile-divider {
  background-image: linear-gradient(90deg, rgba(15, 118, 110, 0.12), rgba(148, 163, 184, 0.28), rgba(15, 118, 110, 0.12));
}

.profile-note {
  padding: 1rem 1.1rem;
  border: 1px solid #dbeafe;
  border-radius: 1rem;
  background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);
  line-height: 1.6;
}

.profile-field-grid {
  --bs-gutter-x: 1rem;
  --bs-gutter-y: 0.95rem;
}

.profile-card-body .form-control-label {
  margin-bottom: 0.45rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #475569;
}

.profile-card-body :deep(.form-control) {
  min-height: 2.9rem;
  border: 1px solid #dbe4f0;
  border-radius: 0.9rem;
  background: #f8fafc;
  color: #0f172a;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.profile-card-body :deep(.form-control:disabled) {
  opacity: 1;
  color: #0f172a;
  -webkit-text-fill-color: #0f172a;
}

@media (max-width: 768px) {
  .profile-hero {
    min-height: 220px !important;
    margin-left: -0.75rem !important;
    margin-right: -0.75rem !important;
    border-radius: 0 0 1.5rem 1.5rem;
  }

  .profile-summary-card {
    border-radius: 1.25rem;
  }

  .profile-card-header,
  .profile-card-body {
    padding-left: 1rem;
    padding-right: 1rem;
  }
}
</style>
