<script setup>
import { ref, onBeforeUnmount, onBeforeMount } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useStore } from "vuex";
import Navbar from "@/examples/PageLayout/Navbar.vue";
import ArgonInput from "@/components/ArgonInput.vue";
import ArgonButton from "@/components/ArgonButton.vue";
import ArgonAlert from "@/components/ArgonAlert.vue";
import { api } from "@/api/client.js";

const body = document.getElementsByTagName("body")[0];
const store = useStore();
const route = useRoute();
const router = useRouter();

const login = ref("");
const password = ref("");
const err = ref("");
const loading = ref(false);

onBeforeMount(() => {
  store.state.hideConfigButton = true;
  store.state.showNavbar = false;
  store.state.showSidenav = false;
  store.state.showFooter = false;
  body.classList.remove("bg-gray-100");
});
onBeforeUnmount(() => {
  store.state.hideConfigButton = false;
  store.state.showNavbar = true;
  store.state.showSidenav = true;
  store.state.showFooter = true;
  body.classList.add("bg-gray-100");
});

async function submit() {
  err.value = "";
  loading.value = true;
  try {
    const loginValue = login.value.trim();
    const credential = loginValue.includes("@")
      ? { email: loginValue }
      : { phone: loginValue };
    const { data } = await api.post("/auth/login", {
      ...credential,
      password: password.value,
    });
    store.commit("setAuth", { token: data.token, user: data.user });
    const redir =
      typeof route.query.redirect === "string" ? route.query.redirect : "/dashboard";
    router.replace(redir);
  } catch (e) {
    err.value = e.response?.data?.error || e.message || "Đăng nhập thất bại";
  } finally {
    loading.value = false;
  }
}
</script>
<template>
  <div class="login-container">
    <!-- Remove navbar from login page for cleaner design -->
    <main class="login-main">
      <div class="login-page">
        <div class="container-fluid">
          <div class="row align-items-center justify-content-center min-vh-100 py-5 py-lg-0">
            <!-- Left side: Branding and welcome message -->
            <div class="col-lg-5 col-xl-4 d-none d-lg-flex login-brand-section">
              <div class="login-brand-content">
                <div class="brand-logo-placeholder">
                  <div class="school-logo">
                    <i class="fas fa-school text-white fa-4x"></i>
                  </div>
                </div>
                <h1 class="brand-title text-white mt-4">Mầm non Thanh Vy</h1>
                <p class="brand-subtitle text-white mt-3">
                  Hệ thống quản lý trường học thông minh
                </p>
                <div class="brand-features mt-5">
                  <div class="feature-item">
                    <i class="fas fa-check-circle text-success me-3"></i>
                    <span class="text-white">Quản lý học sinh & giáo viên</span>
                  </div>
                  <div class="feature-item mt-3">
                    <i class="fas fa-check-circle text-success me-3"></i>
                    <span class="text-white">Theo dõi điểm danh hàng ngày</span>
                  </div>
                  <div class="feature-item mt-3">
                    <i class="fas fa-check-circle text-success me-3"></i>
                    <span class="text-white">Tính toán học phí tự động</span>
                  </div>
                  <div class="feature-item mt-3">
                    <i class="fas fa-check-circle text-success me-3"></i>
                    <span class="text-white">Báo cáo chi tiết & thống kê</span>
                  </div>
                </div>
              </div>
              <div class="brand-overlay"></div>
            </div>

            <!-- Right side: Login form -->
            <div class="col-lg-5 col-xl-4 col-12 login-form-section">
              <div class="d-flex flex-column justify-content-center py-5 py-lg-0">
                <div class="login-form-container mx-auto w-100">
                  <div class="text-center mb-5">
                    <div class="form-logo mb-4">
                      <i class="fas fa-graduation-cap text-primary fa-3x"></i>
                    </div>
                    <h2 class="login-title">Chào mừng trở lại</h2>
                    <p class="login-subtitle text-muted">
                      Đăng nhập để tiếp tục quản lý trường học
                    </p>
                  </div>

                  <div class="login-card card border-0 shadow-lg">
                    <div class="card-body p-4 p-lg-5">
                      <argon-alert v-if="err" color="danger" icon="ni ni-fat-remove" class="mb-4">
                        {{ err }}
                      </argon-alert>
                      
                      <form role="form" @submit.prevent="submit" class="login-form">
                        <div class="mb-4">
                          <label for="login" class="form-label fw-semibold text-dark">
                            <i class="fas fa-user me-2 text-primary"></i>
                            Tên đăng nhập
                          </label>
                          <argon-input
                            id="login"
                            v-model="login"
                            type="text"
                            placeholder="Số điện thoại hoặc email"
                            name="login"
                            size="lg"
                            autocomplete="username"
                            class="form-control-lg w-100"
                          />
                          <div class="form-text text-muted mt-1">
                            Nhập số điện thoại hoặc email đã đăng ký
                          </div>
                        </div>
                        
                        <div class="mb-4">
                          <label for="password" class="form-label fw-semibold text-dark">
                            <i class="fas fa-lock me-2 text-primary"></i>
                            Mật khẩu
                          </label>
                          <argon-input
                            id="password"
                            v-model="password"
                            type="password"
                            placeholder="Nhập mật khẩu"
                            name="password"
                            size="lg"
                            autocomplete="current-password"
                            class="form-control-lg w-100"
                          />
                          <div class="d-flex justify-content-end mt-2">
                            <a href="#" class="text-decoration-none text-primary small">
                              <i class="fas fa-key me-1"></i>
                              Quên mật khẩu?
                            </a>
                          </div>
                        </div>

                        <div class="mb-4">
                          <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="rememberMe">
                            <label class="form-check-label text-muted" for="rememberMe">
                              Ghi nhớ đăng nhập
                            </label>
                          </div>
                        </div>

                        <div class="d-grid gap-2">
                          <argon-button
                            class="login-btn"
                            variant="gradient"
                            color="primary"
                            fullWidth
                            size="lg"
                            type="submit"
                            :disabled="loading"
                          >
                            <span v-if="loading">
                              <i class="fas fa-spinner fa-spin me-2"></i>
                              Đang xác thực...
                            </span>
                            <span v-else>
                              <i class="fas fa-sign-in-alt me-2"></i>
                              Đăng nhập
                            </span>
                          </argon-button>
                        </div>

                        <div class="text-center mt-4 pt-3 border-top">
                          <p class="text-muted mb-0">
                            <i class="fas fa-info-circle me-2 text-info"></i>
                            Tài khoản giáo viên được tạo bởi quản trị viên nhà trường
                          </p>
                          <p class="mt-2 mb-0">
                            <a href="#" class="text-decoration-none text-primary">
                              <i class="fas fa-question-circle me-1"></i>
                              Cần trợ giúp? Liên hệ quản trị viên
                            </a>
                          </p>
                        </div>
                      </form>
                    </div>
                  </div>

                  <div class="text-center mt-4">
                    <p class="text-muted">
                      &copy; 2024 Mầm non Thanh Vy. Phiên bản 2.0
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
