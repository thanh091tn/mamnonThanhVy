<script setup>
import { computed } from "vue";
import { useStore } from "vuex";
import SidenavList from "./SidenavList.vue";
import logo from "@/assets/img/logo-ct-dark.png";
import logoWhite from "@/assets/img/logo-ct.png";

const store = useStore();
const isRTL = computed(() => store.state.isRTL);
const layout = computed(() => store.state.layout);
const sidebarType = computed(() => store.state.sidebarType);
const darkMode = computed(() => store.state.darkMode);
</script>
<template>
  <div
    v-show="layout === 'default'"
    class="min-height-300 position-absolute w-100 sidenav-backdrop"
    :class="`${darkMode ? 'bg-transparent' : ''}`"
  />

  <aside
    class="my-3 overflow-auto border-0 sidenav navbar navbar-vertical navbar-expand-xs border-radius-xl sidenav-clean"
    :class="`${isRTL ? 'me-3 rotate-caret fixed-end' : 'fixed-start ms-3'}    
      ${
        layout === 'landing' ? 'bg-transparent shadow-none' : ' '
      } ${sidebarType}`"
    id="sidenav-main"
  >
    <div class="sidenav-header">
      <i
        class="top-0 p-3 cursor-pointer fas fa-times text-secondary opacity-5 position-absolute end-0 d-none d-xl-none"
        aria-hidden="true"
        id="iconSidenav"
      ></i>

      <router-link class="m-0 navbar-brand sidenav-brand" to="/">
        <img
          :src="darkMode || sidebarType === 'bg-default' ? logoWhite : logo"
          class="navbar-brand-img h-100"
          alt="main_logo"
        />

        <span class="ms-2 font-weight-bold me-2">Mam Non Thanh Vy</span>
      </router-link>
    </div>

    <hr class="mt-0 horizontal dark" />

    <sidenav-list />
  </aside>
</template>

<style scoped>
.sidenav-backdrop {
  background:
    linear-gradient(180deg, #f7f9fc 0%, #f4f7fb 46%, #f8fafc 100%);
}

.sidenav-clean {
  background: rgba(255, 255, 255, 0.95) !important;
  backdrop-filter: blur(10px);
  box-shadow: 0 1.25rem 2.5rem -1.9rem rgba(15, 23, 42, 0.28) !important;
}

.sidenav-clean .navbar-brand span {
  color: #344767;
}

.sidenav-brand {
  display: flex;
  align-items: center;
  min-height: 54px;
  padding: 0 0.5rem;
}

.sidenav-clean .navbar-brand-img {
  max-height: 2rem;
}

.sidenav-clean .sidenav-header {
  padding: 0.45rem 0.8rem 0.35rem;
}

.sidenav-clean .horizontal.dark {
  background-color: rgba(103, 116, 142, 0.18);
}
</style>
