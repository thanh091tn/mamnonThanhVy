<script setup>
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useStore } from "vuex";

import SidenavItem from "./SidenavItem.vue";
import ConfirmLogoutPopup from "@/components/ConfirmLogoutPopup.vue";

const store = useStore();
const router = useRouter();
const route = useRoute();
const showLogoutPopup = ref(false);
const isRTL = computed(() => store.state.isRTL);
const isAuthed = computed(() => Boolean(store.state.authToken));
const authUser = computed(() => store.state.authUser);

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

const getRoute = () => route.path.split("/")[1];
</script>

<template>
  <div
    class="collapse navbar-collapse w-auto h-auto h-100 sidenav-list-wrap"
    id="sidenav-collapse-main"
  >
    <div v-if="isAuthed" class="sidenav-user-card">
      <strong class="sidenav-user-name">{{ authUser?.name || authUser?.email }}</strong>
    </div>

    <ul class="navbar-nav sidenav-nav-list">
      <li class="nav-item sidenav-section-title">
        <h6
          class="text-xs text-uppercase font-weight-bolder mb-0"
          :class="isRTL ? 'me-2' : ''"
        >
          {{ isRTL ? "School" : "Trường học" }}
        </h6>
      </li>

      <li class="nav-item">
        <sidenav-item
          to="/school"
          :class="getRoute() === 'school' ? 'active' : ''"
          :navText="isRTL ? 'School' : 'Trường học'"
        >
          <template #icon>
            <i class="ni ni-building text-primary text-sm"></i>
          </template>
        </sidenav-item>
      </li>

      <li class="nav-item">
        <sidenav-item
          to="/attendance"
          :class="getRoute() === 'attendance' ? 'active' : ''"
          :navText="isRTL ? 'Attendance' : 'Điểm danh'"
        >
          <template #icon>
            <i class="ni ni-check-bold sidenav-attendance-icon text-sm"></i>
          </template>
        </sidenav-item>
      </li>

      <li v-if="authUser?.role === 'teacher'" class="nav-item">
        <sidenav-item
          to="/teacher-leave"
          :class="getRoute() === 'teacher-leave' ? 'active' : ''"
          :navText="isRTL ? 'Teacher Leave' : 'Xin nghỉ GV'"
        >
          <template #icon>
            <i class="ni ni-briefcase-24 text-warning text-sm"></i>
          </template>
        </sidenav-item>
      </li>

      <li v-if="authUser?.role === 'manager'" class="nav-item">
        <sidenav-item
          to="/leave-calendar"
          :class="getRoute() === 'leave-calendar' ? 'active' : ''"
          :navText="isRTL ? 'Leave Calendar' : 'Lịch nghỉ GV'"
        >
          <template #icon>
            <i class="ni ni-calendar-grid-58 text-success text-sm"></i>
          </template>
        </sidenav-item>
      </li>

      <li v-if="authUser?.role === 'manager'" class="nav-item sidenav-section-title">
        <h6
          class="text-xs text-uppercase font-weight-bolder mb-0"
          :class="isRTL ? 'me-2' : ''"
        >
          {{ isRTL ? "Fees" : "Học phí" }}
        </h6>
      </li>

      <li v-if="authUser?.role === 'manager'" class="nav-item">
        <sidenav-item
          to="/fee-items"
          :class="getRoute() === 'fee-items' ? 'active' : ''"
          :navText="isRTL ? 'Fee Items' : 'Khoản thu'"
        >
          <template #icon>
            <i class="ni ni-books text-primary text-sm"></i>
          </template>
        </sidenav-item>
      </li>

      <li v-if="authUser?.role === 'manager'" class="nav-item">
        <sidenav-item
          to="/fee-periods"
          :class="getRoute() === 'fee-periods' ? 'active' : ''"
          :navText="isRTL ? 'Fee Periods' : 'Kỳ thu'"
        >
          <template #icon>
            <i class="ni ni-calendar-grid-58 text-info text-sm"></i>
          </template>
        </sidenav-item>
      </li>

      <li v-if="authUser?.role === 'manager'" class="nav-item">
        <sidenav-item
          to="/fee-policies"
          :class="getRoute() === 'fee-policies' ? 'active' : ''"
          :navText="isRTL ? 'Discounts' : 'Miễn giảm'"
        >
          <template #icon>
            <i class="ni ni-tag text-success text-sm"></i>
          </template>
        </sidenav-item>
      </li>

      <li v-if="authUser?.role === 'manager'" class="nav-item">
        <sidenav-item
          to="/fee-services"
          :class="getRoute() === 'fee-services' ? 'active' : ''"
          :navText="isRTL ? 'Services' : 'ĐK dịch vụ'"
        >
          <template #icon>
            <i class="ni ni-bus-front-12 text-info text-sm"></i>
          </template>
        </sidenav-item>
      </li>

      <li v-if="authUser?.role === 'manager'" class="nav-item">
        <sidenav-item
          to="/fee-collection"
          :class="getRoute() === 'fee-collection' ? 'active' : ''"
          :navText="isRTL ? 'Statements' : 'Tính HP'"
        >
          <template #icon>
            <i class="ni ni-money-coins text-warning text-sm"></i>
          </template>
        </sidenav-item>
      </li>

      <li class="nav-item sidenav-section-title">
        <h6
          class="text-xs text-uppercase font-weight-bolder mb-0"
          :class="isRTL ? 'me-2' : ''"
        >
          {{ isRTL ? "Account" : "Tài khoản" }}
        </h6>
      </li>

      <li class="nav-item">
        <sidenav-item
          to="/profile"
          :class="getRoute() === 'profile' ? 'active' : ''"
          :navText="isRTL ? 'Profile' : 'Hồ sơ'"
        >
          <template #icon>
            <i class="ni ni-single-02 text-dark text-sm"></i>
          </template>
        </sidenav-item>
      </li>

      <li v-if="!isAuthed" class="nav-item">
        <sidenav-item
          to="/signin"
          :class="getRoute() === 'signin' ? 'active' : ''"
          :navText="isRTL ? 'Sign in' : 'Đăng nhập'"
        >
          <template #icon>
            <i class="ni ni-single-copy-04 text-danger text-sm"></i>
          </template>
        </sidenav-item>
      </li>

      <li v-if="!isAuthed" class="nav-item">
        <sidenav-item
          to="/signup"
          :class="getRoute() === 'signup' ? 'active' : ''"
          :navText="isRTL ? 'Sign up' : 'Đăng ký'"
        >
          <template #icon>
            <i class="ni ni-collection text-info text-sm"></i>
          </template>
        </sidenav-item>
      </li>

      <li v-if="isAuthed" class="nav-item mt-2">
        <a
          href="#"
          class="nav-link sidenav-logout-link"
          @click.prevent="openLogoutPopup"
        >
          <span class="sidenav-mini-icon sidenav-logout-icon">
            <i class="ni ni-button-power text-danger text-sm"></i>
          </span>
          <span class="nav-link-text ms-1">{{ isRTL ? "Logout" : "Đăng xuất" }}</span>
        </a>
      </li>
    </ul>

    <confirm-logout-popup
      :open="showLogoutPopup"
      @cancel="closeLogoutPopup"
      @confirm="confirmLogout"
    />
  </div>
</template>

<style scoped>
.sidenav-list-wrap {
  padding: 0 0.8rem 1rem;
}

.sidenav-user-card {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  margin: 0.15rem 0 0.85rem;
  padding: 0.85rem 0.95rem;
  border: 1px solid #d9e2ee;
  border-radius: 0.95rem;
  background: linear-gradient(180deg, #ffffff, #f3f6fb);
}

.sidenav-user-name {
  color: #1f2a44;
  font-size: 0.88rem;
  font-weight: 700;
  line-height: 1.35;
}

.sidenav-nav-list {
  gap: 0.25rem;
}

.sidenav-section-title {
  margin-top: 0.4rem;
  padding: 0.45rem 0.55rem 0.2rem;
}

.sidenav-section-title h6 {
  color: #64748b;
  letter-spacing: 0.08em;
}

.sidenav-logout-link {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 0.7rem 0.8rem;
  border-radius: 0.85rem;
  color: #b42318;
  border: 1px solid #f3d0cc;
  background: #fff8f7;
  transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}

.sidenav-logout-link:hover {
  background: #feeceb;
  border-color: #e9b4ae;
  color: #b91c1c;
}

.sidenav-logout-icon {
  width: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.sidenav-attendance-icon {
  color: #d97706;
}
</style>
