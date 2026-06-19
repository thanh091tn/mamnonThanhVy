<script setup>
import { computed } from "vue";
import { VueDatePicker } from "@vuepic/vue-datepicker";
import "@vuepic/vue-datepicker/dist/main.css";
import { vi } from "date-fns/locale";

const props = defineProps({
  modelValue: {
    type: String,
    default: "",
  },
  monthPicker: {
    type: Boolean,
    default: false,
  },
  min: {
    type: String,
    default: "",
  },
  max: {
    type: String,
    default: "",
  },
  placeholder: {
    type: String,
    default: "Chọn ngày",
  },
  inputClass: {
    type: String,
    default: "",
  },
  format: {
    type: String,
    default: "dd/MM/yyyy",
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  readonly: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:modelValue"]);

function normalizeMonthValue(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
  }
  const text = String(value).trim();
  const monthMatch = text.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
  if (monthMatch) {
    const month = Number(monthMatch[2]);
    if (month >= 1 && month <= 12) {
      return `${monthMatch[1]}-${String(month).padStart(2, "0")}`;
    }
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
}

function monthValueToPicker(value) {
  const normalized = normalizeMonthValue(value);
  const match = normalized.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]) - 1,
  };
}

function normalizeDateValue(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  const text = String(value).trim();
  const dateMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (dateMatch) {
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${dateMatch[1]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function isoToDate(value) {
  if (!value) return null;
  if (props.monthPicker) {
    return monthValueToPicker(value);
  }
  const normalized = normalizeDateValue(value);
  if (!normalized) return null;
  const d = new Date(`${normalized}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateToIso(value) {
  if (props.monthPicker) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
    }
    if (value && typeof value === "object") {
      const year = Number(value.year);
      const month = Number(value.month);
      if (Number.isInteger(year) && Number.isInteger(month)) {
        return `${year}-${String(month + 1).padStart(2, "0")}`;
      }
    }
    return "";
  }
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return "";
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatPickerDate(value) {
  if (props.monthPicker) {
    const month = Number(value?.month);
    const year = Number(value?.year);
    if (!Number.isInteger(month) || !Number.isInteger(year)) return "";
    return `${String(month + 1).padStart(2, "0")}/${year}`;
  }
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return "";
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  if (props.format === "dd-MM-yyyy") return `${d}-${m}-${y}`;
  return `${d}/${m}/${y}`;
}

const pickerValue = computed({
  get: () => isoToDate(props.modelValue),
  set: (value) => emit("update:modelValue", dateToIso(value)),
});

const minDate = computed(() => isoToDate(props.min));
const maxDate = computed(() => isoToDate(props.max));
</script>

<template>
  <VueDatePicker
    v-bind="$attrs"
    v-model="pickerValue"
    :min-date="minDate"
    :max-date="maxDate"
    :month-picker="monthPicker"
    :enable-time-picker="false"
    :auto-apply="true"
    :locale="vi"
    :format="formatPickerDate"
    select-text="Chọn"
    cancel-text="Hủy"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :input-class-name="`app-date-field-input ${inputClass}`.trim()"
    class="app-date-field"
  />
</template>

<style scoped>
.app-date-field {
  width: 100%;
}

.app-date-field :deep(.dp__main),
.app-date-field :deep(.dp__input_wrap) {
  width: 100%;
}

.app-date-field :deep(.dp__input) {
  min-height: 2.9rem;
  border: 1px solid #dbe4f0;
  border-radius: 0.9rem;
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  font-size: 0.92rem;
  padding-left: 2.75rem;
}

.app-date-field :deep(.dp__input:focus),
.app-date-field :deep(.dp__input_focus) {
  border-color: #38bdf8;
  box-shadow: 0 0 0 0.22rem rgba(56, 189, 248, 0.16);
}

.app-date-field :deep(.dp__input_icon) {
  left: 1rem;
  color: #0f766e;
}

.app-date-field :deep(.dp__menu) {
  border: 1px solid #e7edf5;
  border-radius: 1.1rem;
  background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
  box-shadow: 0 1.25rem 2.5rem rgba(15, 23, 42, 0.14);
}

.app-date-field :deep(.dp__arrow_top),
.app-date-field :deep(.dp__arrow_bottom) {
  display: none;
}

.app-date-field :deep(.dp__calendar_header_item) {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #94a3b8;
}

.app-date-field :deep(.dp__month_year_select) {
  border-radius: 0.8rem;
  font-weight: 700;
  color: #1f2a44;
}

.app-date-field :deep(.dp__month_year_select:hover),
.app-date-field :deep(.dp__button:hover) {
  background: #f8fafc;
}

.app-date-field :deep(.dp__cell_inner) {
  border-radius: 0.7rem;
  font-weight: 600;
}

.app-date-field :deep(.dp__cell_inner:hover) {
  background: #ecfeff;
  color: #115e59;
}

.app-date-field :deep(.dp__today) {
  border-color: #14b8a6;
  color: #0f766e;
}

.app-date-field :deep(.dp__active_date),
.app-date-field :deep(.dp__range_start),
.app-date-field :deep(.dp__range_end) {
  background: linear-gradient(135deg, #0f766e, #14b8a6);
  color: #ffffff;
}

.app-date-field :deep(.dp__range_between) {
  background: rgba(20, 184, 166, 0.14);
  color: #115e59;
}
</style>
