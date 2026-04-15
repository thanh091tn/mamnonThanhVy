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
    <div v-if="open" class="confirm-popup-overlay" @click.self="emit('cancel')">
      <div
        class="confirm-popup-card"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <div class="confirm-popup-icon">
          <i :class="iconClass"></i>
        </div>
        <h5 class="confirm-popup-title mb-2">{{ title }}</h5>
        <p class="confirm-popup-message mb-0">{{ message }}</p>
        <div class="confirm-popup-actions">
          <button
            type="button"
            class="confirm-popup-btn confirm-popup-btn--ghost"
            @click="emit('cancel')"
          >
            {{ cancelText }}
          </button>
          <button
            type="button"
            class="confirm-popup-btn"
            :class="danger ? 'confirm-popup-btn--danger' : 'confirm-popup-btn--primary'"
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

.confirm-popup-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(6px);
}

.confirm-popup-card {
  width: min(100%, 28rem);
  padding: 1.5rem 1.5rem 1.2rem;
  border: 1px solid #e2e8f0;
  border-radius: 1.2rem;
  background: #fff;
  box-shadow: 0 1.5rem 3rem -1.8rem rgba(15, 23, 42, 0.45);
  text-align: center;
}

.confirm-popup-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  margin-bottom: 0.8rem;
  border-radius: 999px;
  background: #fff1f1;
  color: #dc2626;
  font-size: 1.1rem;
}

.confirm-popup-title {
  color: #1f2a44;
  font-weight: 700;
  font-size: 1.1rem;
  line-height: 1.35;
}

.confirm-popup-message {
  max-width: 23rem;
  margin: 0.2rem auto 0;
  color: #64748b;
  font-size: 0.95rem;
  line-height: 1.65;
  text-align: center;
  text-wrap: pretty;
}

.confirm-popup-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  margin-top: 1.35rem;
}

.confirm-popup-btn {
  flex: 1 1 0;
  min-width: 0;
  min-height: 2.65rem;
  padding: 0.65rem 1rem;
  border-radius: 0.8rem;
  border: 1px solid transparent;
  font-size: 0.88rem;
  font-weight: 700;
  white-space: nowrap;
  transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}

.confirm-popup-btn--ghost {
  border-color: #d7e0ec;
  background: #fff;
  color: #334155;
}

.confirm-popup-btn--ghost:hover {
  background: #f8fafc;
}

.confirm-popup-btn--danger {
  background: linear-gradient(135deg, #dc2626, #ef4444);
  color: #fff;
}

.confirm-popup-btn--danger:hover {
  background: linear-gradient(135deg, #b91c1c, #dc2626);
}

.confirm-popup-btn--primary {
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  color: #fff;
}

.confirm-popup-btn--primary:hover {
  background: linear-gradient(135deg, #1d4ed8, #2563eb);
}

@media (max-width: 575.98px) {
  .confirm-popup-card {
    width: min(100%, 22rem);
    padding: 1.25rem 1rem 1rem;
  }

  .confirm-popup-message {
    max-width: none;
  }

  .confirm-popup-actions {
    flex-direction: column;
  }

  .confirm-popup-btn {
    width: 100%;
  }
}
</style>
