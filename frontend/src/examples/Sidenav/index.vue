<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useStore } from "vuex";
import SidenavList from "./SidenavList.vue";
import logo from "@/assets/img/logo-ct-dark.png";
import logoWhite from "@/assets/img/logo-ct.png";

const store = useStore();
const sidenavRef = ref(null);
const isRTL = computed(() => store.state.isRTL);
const layout = computed(() => store.state.layout);
const sidebarType = computed(() => store.state.sidebarType);
const darkMode = computed(() => store.state.darkMode);

function closeMobileSidenav() {
  if (window.innerWidth < 1200 && store.state.isPinned) {
    store.commit("sidebarMinimize");
  }
}

function handleOutsideClick(event) {
  if (window.innerWidth >= 1200 || !store.state.isPinned) return;

  const target = event.target;
  const clickedSidenav = sidenavRef.value?.contains(target);
  const clickedToggle = target?.closest?.("#iconNavbarSidenav");

  if (!clickedSidenav && !clickedToggle) {
    closeMobileSidenav();
  }
}

function syncSidenavForViewport() {
  if (window.innerWidth >= 1200) {
    store.commit("resetSidebarForDesktop");
  }
}

onMounted(() => {
  syncSidenavForViewport();
  document.addEventListener("click", handleOutsideClick);
  window.addEventListener("resize", syncSidenavForViewport);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", handleOutsideClick);
  window.removeEventListener("resize", syncSidenavForViewport);
});
</script>
<template>
  <div
    v-show="layout === 'default'"
    class="min-height-300 position-absolute w-100 sidenav-backdrop"
    :class="`${darkMode ? 'bg-transparent' : ''}`"
  />

  <aside
    ref="sidenavRef"
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
  max-height: calc(100vh - 1.5rem);
  margin-top: 0.75rem !important;
  margin-bottom: 0.75rem !important;
  border-radius: 1rem !important;
  box-shadow: 0 1.25rem 2.5rem -1.9rem rgba(15, 23, 42, 0.28) !important;
}

.sidenav-clean .navbar-brand span {
  color: #344767;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidenav-brand {
  display: flex;
  align-items: center;
  min-width: 0;
  min-height: 48px;
  padding: 0 0.35rem;
}

.sidenav-clean .navbar-brand-img {
  max-height: 1.75rem;
  flex-shrink: 0;
}

.sidenav-clean .sidenav-header {
  height: auto;
  padding: 0.45rem 0.75rem 0.25rem;
}

.sidenav-clean .horizontal.dark {
  margin: 0.35rem 0.9rem 0.45rem;
  background-color: rgba(103, 116, 142, 0.18);
}

@media (max-width: 1199.98px) {
  .sidenav-clean {
    max-height: calc(100vh - 1rem);
    margin-top: 0.5rem !important;
    margin-bottom: 0.5rem !important;
  }
}

@media (max-width: 575.98px) {
  .sidenav-clean {
    width: min(18rem, calc(100vw - 1.5rem)) !important;
    max-width: min(18rem, calc(100vw - 1.5rem)) !important;
    margin-left: 0.75rem !important;
    margin-right: 0.75rem !important;
    border-radius: 0.85rem !important;
  }

  .sidenav-clean .sidenav-header {
    padding: 0.35rem 0.65rem 0.2rem;
  }

  .sidenav-brand {
    min-height: 44px;
  }

  .sidenav-clean .navbar-brand-img {
    max-height: 1.55rem;
  }

  .sidenav-clean .navbar-brand span {
    font-size: 0.84rem;
  }
}
</style>
