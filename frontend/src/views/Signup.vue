<script setup>
import { ref, computed, onBeforeUnmount, onBeforeMount } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useStore } from "vuex";

import Navbar from "@/examples/PageLayout/Navbar.vue";
import AppFooter from "@/examples/PageLayout/Footer.vue";
import ArgonInput from "@/components/ArgonInput.vue";
import ArgonButton from "@/components/ArgonButton.vue";
import ArgonAlert from "@/components/ArgonAlert.vue";
import { api } from "@/api/client.js";

const body = document.getElementsByTagName("body")[0];
const store = useStore();
const route = useRoute();
const router = useRouter();

const showManagerRole = import.meta.env.VITE_ENABLE_MANAGER_REGISTER === "true";

const name = ref("");
const email = ref("");
const password = ref("");
const password2 = ref("");
const role = ref("teacher");
const err = ref("");
const loading = ref(false);

const roleOptions = computed(() => {
  const opts = [{ value: "teacher", label: "Giáo viên" }];
  if (showManagerRole) opts.push({ value: "manager", label: "Quản lý" });
  return opts;
});

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
  if (password.value !== password2.value) {
    err.value = "Mật khẩu xác nhận không khớp";
    return;
  }
  if (password.value.length < 8) {
    err.value = "Mật khẩu tối thiểu 8 ký tự";
    return;
  }
  loading.value = true;
  try {
    const { data } = await api.post("/auth/register", {
      name: name.value.trim(),
      email: email.value.trim(),
      password: password.value,
      role: role.value,
    });
    store.commit("setAuth", { token: data.token, user: data.user });
    const redir =
      typeof route.query.redirect === "string" ? route.query.redirect : "/school";
    router.replace(redir);
  } catch (e) {
    err.value = e.response?.data?.error || e.message || "Đăng ký thất bại";
  } finally {
    loading.value = false;
  }
}
</script>
<template>
  <div class="container top-0 position-sticky z-index-sticky">
    <div class="row">
      <div class="col-12">
        <navbar />
      </div>
    </div>
  </div>
  <main class="main-content mt-0">
    <div
      class="page-header align-items-start min-vh-50 pt-5 pb-11 m-3 border-radius-lg"
      style="
        background-image: url(&quot;https://raw.githubusercontent.com/creativetimofficial/public-assets/master/argon-dashboard-pro/assets/img/signup-cover.jpg&quot;);
        background-position: top;
      "
    >
      <span class="mask bg-gradient-dark opacity-6"></span>
      <div class="container">
        <div class="row justify-content-center">
          <div class="col-lg-5 text-center mx-auto">
            <h1 class="text-white mb-2 mt-5">Đăng ký</h1>
            <p class="text-lead text-white">
              Tạo tài khoản giáo viên hoặc quản lý (nếu được bật trên máy chủ).
            </p>
          </div>
        </div>
      </div>
    </div>
    <div class="container">
      <div class="row mt-lg-n10 mt-md-n11 mt-n10 justify-content-center">
        <div class="col-xl-4 col-lg-5 col-md-7 mx-auto">
          <div class="card z-index-0">
            <div class="card-header text-center pt-4">
              <h5>Tạo tài khoản</h5>
            </div>
            <div class="card-body">
              <argon-alert v-if="err" color="danger" icon="ni ni-fat-remove" class="mb-3">
                {{ err }}
              </argon-alert>
              <form role="form" @submit.prevent="submit">
                <div class="mb-3">
                  <label class="form-label text-sm">Họ tên</label>
                  <argon-input
                    id="name"
                    v-model="name"
                    type="text"
                    placeholder="Họ và tên"
                    aria-label="Name"
                  />
                </div>
                <div class="mb-3">
                  <label class="form-label text-sm">Email</label>
                  <argon-input
                    id="email"
                    v-model="email"
                    type="email"
                    placeholder="Email"
                    aria-label="Email"
                    autocomplete="email"
                  />
                </div>
                <div class="mb-3">
                  <label class="form-label text-sm">Vai trò</label>
                  <select v-model="role" class="form-select">
                    <option v-for="o in roleOptions" :key="o.value" :value="o.value">
                      {{ o.label }}
                    </option>
                  </select>
                </div>
                <div class="mb-3">
                  <label class="form-label text-sm">Mật khẩu (tối thiểu 8 ký tự)</label>
                  <argon-input
                    id="password"
                    v-model="password"
                    type="password"
                    placeholder="Mật khẩu"
                    aria-label="Password"
                    autocomplete="new-password"
                  />
                </div>
                <div class="mb-3">
                  <label class="form-label text-sm">Xác nhận mật khẩu</label>
                  <argon-input
                    id="password2"
                    v-model="password2"
                    type="password"
                    placeholder="Nhập lại mật khẩu"
                    aria-label="Confirm password"
                    autocomplete="new-password"
                  />
                </div>
                <div class="text-center">
                  <argon-button
                    fullWidth
                    color="dark"
                    variant="gradient"
                    class="my-4 mb-2"
                    type="submit"
                    :disabled="loading"
                  >
                    {{ loading ? "Đang xử lý…" : "Đăng ký" }}
                  </argon-button>
                </div>
                <p class="text-sm mt-3 mb-0 text-center">
                  Đã có tài khoản?
                  <router-link
                    :to="{ name: 'Signin', query: route.query }"
                    class="text-dark font-weight-bolder"
                  >
                    Đăng nhập
                  </router-link>
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
  <app-footer />
</template>
