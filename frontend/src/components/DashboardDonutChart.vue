<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ArcElement, Chart, Tooltip } from "chart.js";

Chart.register(ArcElement, Tooltip);

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
  centerValue: {
    type: [String, Number],
    default: "",
  },
  centerLabel: {
    type: String,
    default: "",
  },
});

const canvasEl = ref(null);
let chart = null;

const safeItems = computed(() =>
  props.items
    .map((item) => ({
      label: item.label,
      value: Number(item.value || 0),
      color: item.color || "#94a3b8",
    }))
    .filter((item) => item.value > 0)
);

const hasData = computed(() => safeItems.value.length > 0);

function destroyChart() {
  if (chart) {
    chart.destroy();
    chart = null;
  }
}

async function renderChart() {
  await nextTick();
  destroyChart();
  if (!canvasEl.value || !hasData.value) return;
  const ctx = canvasEl.value.getContext("2d");
  chart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: safeItems.value.map((item) => item.label),
      datasets: [
        {
          data: safeItems.value.map((item) => item.value),
          backgroundColor: safeItems.value.map((item) => item.color),
          borderColor: "#ffffff",
          borderWidth: 4,
          hoverOffset: 5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              const value = Number(context.parsed || 0).toLocaleString("vi-VN");
              return `${context.label}: ${value}`;
            },
          },
        },
      },
    },
  });
}

watch(() => props.items, renderChart, { deep: true });

onMounted(renderChart);
onBeforeUnmount(destroyChart);
</script>

<template>
  <div class="donut-card">
    <div class="donut-canvas-wrap">
      <canvas v-show="hasData" ref="canvasEl"></canvas>
      <div class="donut-center">
        <strong>{{ centerValue }}</strong>
        <span>{{ centerLabel }}</span>
      </div>
      <div v-if="!hasData" class="donut-empty">Chưa có dữ liệu</div>
    </div>
    <div class="donut-legend">
      <div v-for="item in items" :key="item.label" class="donut-legend-item">
        <span class="donut-dot" :style="{ backgroundColor: item.color }"></span>
        <span>{{ item.label }}</span>
        <strong>{{ Number(item.value || 0).toLocaleString("vi-VN") }}</strong>
      </div>
    </div>
  </div>
</template>

<style scoped>
.donut-card {
  display: grid;
  grid-template-columns: minmax(180px, 0.8fr) minmax(180px, 1fr);
  gap: 1rem;
  align-items: center;
}

.donut-canvas-wrap {
  position: relative;
  min-height: 230px;
}

.donut-canvas-wrap canvas {
  position: absolute;
  inset: 0;
  width: 100% !important;
  height: 100% !important;
}

.donut-center {
  position: absolute;
  inset: 50% auto auto 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  pointer-events: none;
}

.donut-center strong {
  color: #1f2a44;
  font-size: 1.5rem;
  font-weight: 800;
  line-height: 1.1;
}

.donut-center span {
  max-width: 90px;
  color: #8392ab;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.25;
}

.donut-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed #dce4ef;
  border-radius: 1rem;
  color: #8392ab;
  font-size: 0.85rem;
}

.donut-legend {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.donut-legend-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.55rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid #edf2f7;
  border-radius: 0.65rem;
  background: #f8fafc;
  color: #344767;
  font-size: 0.8rem;
  font-weight: 700;
}

.donut-dot {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 999px;
}

.donut-legend-item strong {
  color: #1f2a44;
  font-size: 0.82rem;
}

@media (max-width: 767.98px) {
  .donut-card {
    grid-template-columns: 1fr;
  }

  .donut-canvas-wrap {
    min-height: 210px;
  }
}
</style>
