<!--
=========================================================
* Vue Argon Dashboard 2 - v4.0.0
=========================================================

* Product Page: https://creative-tim.com/product/vue-argon-dashboard
* Copyright 2024 Creative Tim (https://www.creative-tim.com)

Coded by www.creative-tim.com

=========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
-->
<script setup>
import { computed } from "vue";
import { useStore } from "vuex";
import Sidenav from "./examples/Sidenav/index.vue";
import AppFooter from "@/examples/Footer.vue";

const store = useStore();
const showSidenav = computed(() => store.state.showSidenav);
const layout = computed(() => store.state.layout);
const showFooter = computed(() => store.state.showFooter);

function toggleMobileSidenav() {
  store.commit("sidebarMinimize");
}
</script>
<template>
  <div
    v-show="layout === 'landing'"
    class="landing-bg h-100 bg-gradient-primary position-fixed w-100"
  ></div>

  <sidenav v-if="showSidenav" />

  <main
    class="main-content position-relative max-height-vh-100 h-100 border-radius-lg app-main"
  >
    <header v-if="showSidenav" class="app-mobile-bar">
      <button
        id="iconNavbarSidenav"
        type="button"
        class="app-mobile-toggle"
        aria-label="Mở menu"
        @click="toggleMobileSidenav"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>
      <strong>Mam Non Thanh Vy</strong>
    </header>

    <router-view />

    <app-footer v-show="showFooter" />
  </main>
</template>

<style scoped>
.app-main {
  min-width: 0;
  overflow-x: clip;
}

.app-mobile-bar {
  display: none;
}

@media (max-width: 1199.98px) {
  .app-mobile-bar {
    position: sticky;
    top: 0;
    z-index: 40;
    display: flex;
    align-items: center;
    gap: 0.7rem;
    min-height: 3.15rem;
    padding: 0.45rem 0.85rem;
    border-bottom: 1px solid #e4ebe7;
    background: rgba(255, 255, 255, 0.96);
  }

  .app-mobile-bar strong {
    color: #1c2b3a;
    font-size: 0.92rem;
    font-weight: 800;
  }

  .app-mobile-toggle {
    display: inline-flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.28rem;
    width: 2.5rem;
    height: 2.5rem;
    padding: 0.55rem;
    border: 1px solid #dce8e3;
    border-radius: 0.7rem;
    background: #fff;
  }

  .app-mobile-toggle span {
    display: block;
    height: 2px;
    border-radius: 999px;
    background: #1c2b3a;
  }
}
</style>
