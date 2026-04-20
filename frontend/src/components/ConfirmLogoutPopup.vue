<script setup>
import { onBeforeUnmount, watch } from "vue";

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: "Xác nhận đăng xuất",
  },
  message: {
    type: String,
    default: "Bạn có chắc muốn đăng xuất không?",
  },
  confirmText: {
    type: String,
    default: "Đăng xuất",
  },
  cancelText: {
    type: String,
    default: "Hủy",
  },
  iconClass: {
    type: String,
    default: "ni ni-button-power",
  },
  danger: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits(["cancel", "confirm"]);

const overlayClass = "tw-fixed tw-inset-0 tw-z-[2000] tw-flex tw-items-center tw-justify-center tw-bg-slate-900/40 tw-p-4 tw-backdrop-blur-md";
const cardClass = "tw-w-[min(100%,28rem)] tw-rounded-[1.2rem] tw-border tw-border-slate-200 tw-bg-white tw-px-6 tw-pb-5 tw-pt-6 tw-text-center tw-shadow-[0_1.5rem_3rem_-1.8rem_rgba(15,23,42,0.45)] max-[575.98px]:tw-w-[min(100%,22rem)] max-[575.98px]:tw-px-4 max-[575.98px]:tw-pb-4 max-[575.98px]:tw-pt-5";
const iconWrapClass = "tw-mb-[0.8rem] tw-inline-flex tw-h-12 tw-w-12 tw-items-center tw-justify-center tw-rounded-full tw-bg-[#fff1f1] tw-text-[1.1rem] tw-text-red-600";
const messageClass = "tw-mx-auto tw-mb-0 tw-mt-[0.2rem] tw-max-w-[23rem] tw-text-center tw-text-[0.95rem] tw-leading-[1.65] tw-text-slate-500 tw-text-pretty max-[575.98px]:tw-max-w-none";
const actionsClass = "tw-mt-[1.35rem] tw-flex tw-justify-center tw-gap-3 max-[575.98px]:tw-flex-col";
const buttonClass = "tw-min-h-[2.65rem] tw-min-w-0 tw-flex-1 tw-whitespace-nowrap tw-rounded-[0.8rem] tw-border tw-border-transparent tw-px-4 tw-py-[0.65rem] tw-text-[0.88rem] tw-font-bold tw-transition-colors tw-duration-[180ms] max-[575.98px]:tw-w-full";
const ghostButtonClass = "tw-border-[#d7e0ec] tw-bg-white tw-text-slate-700 hover:tw-bg-slate-50";
const dangerButtonClass = "tw-bg-gradient-to-br tw-from-red-600 tw-to-red-500 tw-text-white hover:tw-from-red-700 hover:tw-to-red-600";
const primaryButtonClass = "tw-bg-gradient-to-br tw-from-blue-600 tw-to-blue-500 tw-text-white hover:tw-from-blue-700 hover:tw-to-blue-600";

watch(
  () => props.open,
  (isOpen) => {
    document.body.classList.toggle("logout-popup-open", isOpen);
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  document.body.classList.remove("logout-popup-open");
});
</script>

<template>
  <teleport to="body">
    <div v-if="open" :class="overlayClass" @click.self="emit('cancel')">
      <div
        :class="cardClass"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <div :class="iconWrapClass">
          <i :class="iconClass"></i>
        </div>
        <h5 class="mb-2 tw-text-[1.1rem] tw-font-bold tw-leading-[1.35] tw-text-[#1f2a44]">{{ title }}</h5>
        <p :class="messageClass">{{ message }}</p>
        <div :class="actionsClass">
          <button
            type="button"
            :class="[buttonClass, ghostButtonClass]"
            @click="emit('cancel')"
          >
            {{ cancelText }}
          </button>
          <button
            type="button"
            :class="[buttonClass, danger ? dangerButtonClass : primaryButtonClass]"
            @click="emit('confirm')"
          >
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
:global(body.logout-popup-open #sidenav-main),
:global(body.logout-popup-open .main-content) {
  filter: blur(3px);
  transition: filter 0.18s ease;
}

</style>
