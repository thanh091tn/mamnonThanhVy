<script setup>
import { computed, ref } from "vue";
import { useStore } from "vuex";
import { useRoute, useRouter } from "vue-router";
import Breadcrumbs from "../Breadcrumbs.vue";
import ConfirmLogoutPopup from "@/components/ConfirmLogoutPopup.vue";

const showMenu = ref(false);
const showLogoutPopup = ref(false);
const store = useStore();
const router = useRouter();
const isRTL = computed(() => store.state.isRTL);
const isAuthed = computed(() => Boolean(store.state.authToken));
const authUser = computed(() => store.state.authUser);

const displayName = computed(() => {
  return authUser.value?.name || authUser.value?.email || "Tài khoản";
});

const route = useRoute();

function logout() {
  store.commit("clearAuth");
  router.push({ name: "Signin" });
}

function openLogoutPopup() {
  showLogoutPopup.value = true;
}

function closeLogoutPopup() {
  showLogoutPopup.value = false;
}

function confirmLogout() {
  closeLogoutPopup();
  logout();
}

const currentRouteName = computed(() => route.name);
const currentDirectory = computed(() => {
  const dir = route.path.split("/")[1] || "";
  return dir ? dir.charAt(0).toUpperCase() + dir.slice(1) : "Trang chủ";
});

const minimizeSidebar = () => store.commit("sidebarMinimize");

const closeMenu = () => {
  setTimeout(() => {
    showMenu.value = false;
  }, 100);
};
</script>

<template>
  <nav
    class="navbar navbar-main navbar-expand-lg px-0 mx-4 shadow-none border-radius-xl app-navbar"
    :class="isRTL ? 'top-0 position-sticky z-index-sticky' : ''"
    v-bind="$attrs"
    id="navbarBlur"
    data-scroll="true"
  >
    <div class="px-3 py-2 container-fluid app-navbar-shell">
      <div class="app-navbar-left">
        <breadcrumbs
          :current-page="currentRouteName"
          :current-directory="currentDirectory"
        />
      </div>

      <div
        class="collapse navbar-collapse mt-sm-0 me-md-0 me-sm-4 app-navbar-right"
        :class="isRTL ? 'px-0' : ''"
        id="navbar"
      >
        <ul class="navbar-nav justify-content-end align-items-center app-navbar-actions">
          <li
            v-if="isAuthed"
            class="nav-item d-none d-md-flex align-items-center"
          >
            <div class="app-navbar-account">
              <strong class="app-navbar-account-name">{{ displayName }}</strong>
            </div>
          </li>

          <li v-if="!isAuthed" class="nav-item d-flex align-items-center">
            <router-link
              :to="{ name: 'Signin', query: { redirect: route.fullPath } }"
              class="nav-link font-weight-bold app-navbar-link app-navbar-link--button"
            >
              <i class="fa fa-user" :class="isRTL ? 'ms-sm-2' : 'me-sm-2'"></i>
              <span v-if="isRTL" class="d-sm-inline d-none">Đăng nhập</span>
              <span v-else class="d-sm-inline d-none">Đăng nhập</span>
            </router-link>
          </li>

          <li v-if="isAuthed" class="nav-item d-flex align-items-center">
            <a
              href="#"
              class="nav-link font-weight-bold app-navbar-link app-navbar-link--button"
              @click.prevent="openLogoutPopup"
            >
              <i class="fa fa-sign-out-alt" :class="isRTL ? 'ms-sm-2' : 'me-sm-2'"></i>
              <span v-if="isRTL" class="d-sm-inline d-none">Đăng xuất</span>
              <span v-else class="d-sm-inline d-none">Đăng xuất</span>
            </a>
          </li>

          <li class="nav-item d-xl-none d-flex align-items-center">
            <a
              href="#"
              @click="minimizeSidebar"
              class="nav-link app-navbar-icon-link"
              id="iconNavbarSidenav"
            >
              <div class="sidenav-toggler-inner">
                <i class="sidenav-toggler-line app-navbar-toggler-line"></i>
                <i class="sidenav-toggler-line app-navbar-toggler-line"></i>
                <i class="sidenav-toggler-line app-navbar-toggler-line"></i>
              </div>
            </a>
          </li>

          <li
            class="nav-item dropdown d-flex align-items-center"
            :class="isRTL ? 'ps-2' : ''"
          >
            <a
              href="#"
              class="nav-link app-navbar-icon-link"
              :class="[showMenu ? 'show' : '']"
              id="dropdownMenuButton"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              @click="showMenu = !showMenu"
              @blur="closeMenu"
            >
              <i class="cursor-pointer fa fa-bell"></i>
            </a>
            <ul
              class="px-2 py-3 dropdown-menu dropdown-menu-end me-sm-n4"
              :class="showMenu ? 'show' : ''"
              aria-labelledby="dropdownMenuButton"
            >
              <li class="mb-2">
                <a class="dropdown-item border-radius-md" href="javascript:;">
                  <div class="py-1 d-flex">
                    <div class="my-auto">
                      <img
                        src="../../assets/img/team-2.jpg"
                        class="avatar avatar-sm me-3"
                        alt="user image"
                      />
                    </div>
                    <div class="d-flex flex-column justify-content-center">
                      <h6 class="mb-1 text-sm font-weight-normal">
                        <span class="font-weight-bold">Tin nhắn mới</span> từ Laur
                      </h6>
                      <p class="mb-0 text-xs text-secondary">
                        <i class="fa fa-clock me-1"></i>
                        13 phút trước
                      </p>
                    </div>
                  </div>
                </a>
              </li>
              <li class="mb-2">
                <a class="dropdown-item border-radius-md" href="javascript:;">
                  <div class="py-1 d-flex">
                    <div class="my-auto">
                      <img
                        src="../../assets/img/small-logos/logo-spotify.svg"
                        class="avatar avatar-sm bg-gradient-dark me-3"
                        alt="logo spotify"
                      />
                    </div>
                    <div class="d-flex flex-column justify-content-center">
                      <h6 class="mb-1 text-sm font-weight-normal">
                        <span class="font-weight-bold">Album mới</span> của Travis Scott
                      </h6>
                      <p class="mb-0 text-xs text-secondary">
                        <i class="fa fa-clock me-1"></i>
                        1 ngày trước
                      </p>
                    </div>
                  </div>
                </a>
              </li>
              <li>
                <a class="dropdown-item border-radius-md" href="javascript:;">
                  <div class="py-1 d-flex">
                    <div
                      class="my-auto avatar avatar-sm bg-gradient-secondary me-3"
                    >
                      <svg
                        width="12px"
                        height="12px"
                        viewBox="0 0 43 36"
                        version="1.1"
                        xmlns="http://www.w3.org/2000/svg"
                        xmlns:xlink="http://www.w3.org/1999/xlink"
                      >
                        <title>credit-card</title>
                        <g
                          stroke="none"
                          stroke-width="1"
                          fill="none"
                          fill-rule="evenodd"
                        >
                          <g
                            transform="translate(-2169.000000, -745.000000)"
                            fill="#FFFFFF"
                            fill-rule="nonzero"
                          >
                            <g transform="translate(1716.000000, 291.000000)">
                              <g transform="translate(453.000000, 454.000000)">
                                <path
                                  class="color-background"
                                  d="M43,10.7482083 L43,3.58333333 C43,1.60354167 41.3964583,0 39.4166667,0 L3.58333333,0 C1.60354167,0 0,1.60354167 0,3.58333333 L0,10.7482083 L43,10.7482083 Z"
                                  opacity="0.593633743"
                                />
                                <path
                                  class="color-background"
                                  d="M0,16.125 L0,32.25 C0,34.2297917 1.60354167,35.8333333 3.58333333,35.8333333 L39.4166667,35.8333333 C41.3964583,35.8333333 43,34.2297917 43,32.25 L43,16.125 L0,16.125 Z M19.7083333,26.875 L7.16666667,26.875 L7.16666667,23.2916667 L19.7083333,23.2916667 L19.7083333,26.875 Z M35.8333333,26.875 L28.6666667,26.875 L28.6666667,23.2916667 L35.8333333,23.2916667 L35.8333333,26.875 Z"
                                />
                              </g>
                            </g>
                          </g>
                        </g>
                      </svg>
                    </div>
                    <div class="d-flex flex-column justify-content-center">
                      <h6 class="mb-1 text-sm font-weight-normal">
                        Thanh toán đã hoàn tất
                      </h6>
                      <p class="mb-0 text-xs text-secondary">
                        <i class="fa fa-clock me-1"></i>
                        2 ngày trước
                      </p>
                    </div>
                  </div>
                </a>
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </div>
    <confirm-logout-popup
      :open="showLogoutPopup"
      @cancel="closeLogoutPopup"
      @confirm="confirmLogout"
    />
  </nav>
</template>

<style scoped>
.app-navbar {
  margin-top: 1rem;
  border: 1px solid #d7e0ec;
  background: #ffffff;
  backdrop-filter: blur(12px);
  box-shadow: 0 1rem 2rem -1.7rem rgba(15, 23, 42, 0.28);
}

.app-navbar-shell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.app-navbar-left {
  min-width: 0;
}

.app-navbar-right {
  display: flex !important;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
}

.app-navbar-actions {
  gap: 0.65rem;
}

.app-navbar-account {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  padding: 0.45rem 0.9rem;
  border: 1px solid #d7e0ec;
  border-radius: 0.85rem;
  background: #f5f7fb;
  line-height: 1.25;
}

.app-navbar-account-name {
  color: #1f2a44;
  font-size: 0.85rem;
  font-weight: 700;
}

.app-navbar :deep(.breadcrumb-item),
.app-navbar :deep(.breadcrumb-item a),
.app-navbar :deep(h6),
.app-navbar :deep(.text-sm) {
  color: #344767 !important;
}

.app-navbar :deep(.breadcrumb-item + .breadcrumb-item::before) {
  color: #64748b !important;
}

.app-navbar-link,
.app-navbar-icon-link {
  color: #24324a !important;
}

.app-navbar-link:hover,
.app-navbar-icon-link:hover {
  color: #1d4ed8 !important;
}

.app-navbar-link--button {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.55rem 0.9rem !important;
  border: 1px solid #d7e0ec;
  border-radius: 0.85rem;
  background: #ffffff;
}

.app-navbar-link--button:hover {
  border-color: #b9c7d8;
  background: #f4f8ff;
}

.app-navbar-icon-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.4rem;
  height: 2.4rem;
  padding: 0 !important;
  border: 1px solid #d7e0ec;
  border-radius: 0.8rem;
  background: #ffffff;
}

.app-navbar-icon-link:hover {
  background: #f4f8ff;
  border-color: #b9c7d8;
}

.app-navbar-toggler-line {
  background: #24324a !important;
}

@media (max-width: 991.98px) {
  .app-navbar-shell {
    align-items: flex-start;
    flex-direction: column;
  }

  .app-navbar-right {
    width: 100%;
  }

  .app-navbar-actions {
    width: 100%;
    justify-content: flex-end;
  }
}

@media (max-width: 767.98px) {
  .app-navbar {
    margin-top: 0.75rem;
  }

  .app-navbar-shell {
    gap: 0.75rem;
  }

  .app-navbar-actions {
    gap: 0.5rem;
  }

  .app-navbar-link--button {
    padding: 0.5rem 0.8rem !important;
  }
}
</style>
