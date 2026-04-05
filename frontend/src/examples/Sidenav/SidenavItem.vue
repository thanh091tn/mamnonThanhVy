<script setup>
import { computed } from "vue";
import { useStore } from "vuex";

const store = useStore();
const isRTL = computed(() => store.state.isRTL);
const sidebarMinimize = () => store.commit("sidebarMinimize");

const minimizeSidebar = () => {
  if (window.innerWidth < 1200) {
    sidebarMinimize();
  }
};

defineProps({
  to: {
    type: String,
    required: true,
  },
  navText: {
    type: String,
    required: true,
  },
});
</script>
<template>
  <router-link :to="to" class="nav-link" @click="minimizeSidebar">
    <div
      class="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center"
    >
      <slot name="icon"></slot>
    </div>
    <span class="nav-link-text" :class="isRTL ? ' me-1' : 'ms-1'">{{
      navText
    }}</span>
  </router-link>
</template>

<style scoped>
.nav-link {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-height: 46px;
  margin: 0;
  padding: 0.72rem 0.8rem;
  border-radius: 0.85rem;
  color: #334155;
  transition: background 0.18s ease, box-shadow 0.18s ease, color 0.18s ease, border-color 0.18s ease;
  border: 1px solid transparent;
}

.nav-link:hover {
  background: #f5f8fc;
  border-color: #dbe4ef;
  color: #0f172a;
}

.nav-link.active {
  background: linear-gradient(135deg, #0f766e, #14b8a6);
  color: #fff;
  box-shadow: 0 0.85rem 1.4rem -1rem rgba(15, 118, 110, 0.55);
}

.icon {
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  border-radius: 0.7rem;
  background: #e3ebff;
}

.nav-link.active .icon {
  background: rgba(255, 255, 255, 0.22);
}

.nav-link :deep(i) {
  opacity: 1;
}

.nav-link.active :deep(i),
.nav-link.active .nav-link-text {
  color: #ffffff !important;
}

.nav-link-text {
  font-size: 0.84rem;
  font-weight: 700;
  line-height: 1.3;
  color: inherit;
}
</style>
