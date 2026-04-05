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

const email = ref("");
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
    const { data } = await api.post("/auth/login", {
      email: email.value,
      password: password.value,
    });
    store.commit("setAuth", { token: data.token, user: data.user });
    const redir =
      typeof route.query.redirect === "string" ? route.query.redirect : "/school";
    router.replace(redir);
  } catch (e) {
    err.value = e.response?.data?.error || e.message || "Đăng nhập thất bại";
  } finally {
    loading.value = false;
  }
}
</script>
<template>
  <div class="container top-0 position-sticky z-index-sticky">
    <div class="row">
      <div class="col-12">
        <navbar
          isBlur="blur  border-radius-lg my-3 py-2 start-0 end-0 mx-4 shadow"
          v-bind:darkMode="true"
        />
      </div>
    </div>
  </div>
  <main class="mt-0 main-content">
    <section>
      <div class="page-header min-vh-100">
        <div class="container">
          <div class="row">
            <div
              class="mx-auto col-xl-4 col-lg-5 col-md-7 d-flex flex-column mx-lg-0"
            >
              <div class="card card-plain">
                <div class="pb-0 card-header text-start">
                  <h4 class="font-weight-bolder">Đăng nhập</h4>
                  <p class="mb-0">Nhập email và mật khẩu</p>
                </div>
                <div class="card-body">
                  <argon-alert v-if="err" color="danger" icon="ni ni-fat-remove" class="mb-3">
                    {{ err }}
                  </argon-alert>
                  <form role="form" @submit.prevent="submit">
                    <div class="mb-3">
                      <argon-input
                        id="email"
                        v-model="email"
                        type="email"
                        placeholder="Email"
                        name="email"
                        size="lg"
                        autocomplete="email"
                      />
                    </div>
                    <div class="mb-3">
                      <argon-input
                        id="password"
                        v-model="password"
                        type="password"
                        placeholder="Mật khẩu"
                        name="password"
                        size="lg"
                        autocomplete="current-password"
                      />
                    </div>
                    <div class="text-center">
                      <argon-button
                        class="mt-4"
                        variant="gradient"
                        color="success"
                        fullWidth
                        size="lg"
                        type="submit"
                        :disabled="loading"
                      >
                        {{ loading ? "Đang đăng nhập…" : "Đăng nhập" }}
                      </argon-button>
                    </div>
                  </form>
                </div>
                <div class="px-1 pt-0 text-center card-footer px-lg-2">
                  <p class="mx-auto mb-4 text-sm">
                    Chưa có tài khoản?
                    <router-link
                      :to="{ name: 'Signup', query: route.query }"
                      class="text-success text-gradient font-weight-bold"
                    >
                      Đăng ký
                    </router-link>
                  </p>
                </div>
              </div>
            </div>
            <div
              class="top-0 my-auto text-center col-6 d-lg-flex d-none h-100 pe-0 position-absolute end-0 justify-content-center flex-column"
            >
              <div
                class="position-relative bg-gradient-primary h-100 m-3 px-7 border-radius-lg d-flex flex-column justify-content-center overflow-hidden"
                style="
                  background-image: url(&quot;https://raw.githubusercontent.com/creativetimofficial/public-assets/master/argon-dashboard-pro/assets/img/signin-ill.jpg&quot;);
                  background-size: cover;
                "
              >
                <span class="mask bg-gradient-success opacity-6"></span>
                <h4 class="mt-5 text-white font-weight-bolder position-relative">
                  Mầm non Thanh Vy
                </h4>
                <p class="text-white position-relative">
                  Hệ thống quản lý trường học
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>
