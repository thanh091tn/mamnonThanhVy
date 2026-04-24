<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  maxVisible: { type: Number, default: 80 },
})

const emit = defineEmits(['update:modelValue'])

const root = ref(null)
const inputValue = ref(props.modelValue || '')
const open = ref(false)

watch(
  () => props.modelValue,
  (value) => {
    inputValue.value = value || ''
  }
)

watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) open.value = false
  }
)

function optionText(option) {
  if (typeof option === 'string') return option
  return option?.FullName || option?.label || option?.name || ''
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

const filteredOptions = computed(() => {
  const query = normalize(inputValue.value)
  const list = props.options.filter((option) => normalize(optionText(option)).includes(query))
  return list.slice(0, props.maxVisible)
})

function openMenu() {
  if (!props.disabled) open.value = true
}

function updateInput(event) {
  const value = event.target.value
  inputValue.value = value
  emit('update:modelValue', value)
  openMenu()
}

function selectOption(option) {
  const value = optionText(option)
  inputValue.value = value
  emit('update:modelValue', value)
  open.value = false
}

function clearValue() {
  inputValue.value = ''
  emit('update:modelValue', '')
  openMenu()
}

function onDocumentPointerDown(event) {
  if (!root.value || root.value.contains(event.target)) return
  open.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
})
</script>

<template>
  <div ref="root" class="searchable-dropdown" :class="{ 'is-disabled': disabled }">
    <div class="searchable-dropdown-control">
      <input
        :value="inputValue"
        class="form-control searchable-dropdown-input"
        type="text"
        :placeholder="placeholder"
        :disabled="disabled"
        autocomplete="off"
        @focus="openMenu"
        @click="openMenu"
        @input="updateInput"
      />
      <button
        v-if="inputValue && !disabled"
        type="button"
        class="searchable-dropdown-clear"
        aria-label="Xóa lựa chọn"
        @click="clearValue"
      >
        ×
      </button>
      <button
        type="button"
        class="searchable-dropdown-arrow"
        aria-label="Mở danh sách"
        :disabled="disabled"
        @click="open = !open"
      >
        <i class="ni ni-bold-down"></i>
      </button>
    </div>

    <div v-if="open" class="searchable-dropdown-menu">
      <button
        v-for="option in filteredOptions"
        :key="option.Code || optionText(option)"
        type="button"
        class="searchable-dropdown-option"
        @click="selectOption(option)"
      >
        {{ optionText(option) }}
      </button>
      <div v-if="!filteredOptions.length" class="searchable-dropdown-empty">
        Không có kết quả phù hợp
      </div>
    </div>
  </div>
</template>

<style scoped>
.searchable-dropdown {
  position: relative;
}

.searchable-dropdown-control {
  position: relative;
}

.searchable-dropdown-input {
  padding-right: 4.8rem;
}

.searchable-dropdown-clear,
.searchable-dropdown-arrow {
  position: absolute;
  top: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: 0.55rem;
  background: transparent;
  color: #8392ab;
  transform: translateY(-50%);
  cursor: pointer;
}

.searchable-dropdown-clear {
  right: 2.25rem;
  font-size: 1.25rem;
  line-height: 1;
}

.searchable-dropdown-arrow {
  right: 0.35rem;
  font-size: 0.72rem;
}

.searchable-dropdown-clear:hover,
.searchable-dropdown-arrow:hover {
  background: #f1f5f9;
  color: #344767;
}

.searchable-dropdown-arrow:disabled {
  cursor: default;
  opacity: 0.45;
}

.searchable-dropdown-menu {
  position: absolute;
  z-index: 10030;
  right: 0;
  left: 0;
  max-height: 16rem;
  margin-top: 0.35rem;
  overflow-y: auto;
  border: 1px solid #dbe4f0;
  border-radius: 0.85rem;
  background: #ffffff;
  box-shadow: 0 1rem 2.25rem rgba(15, 23, 42, 0.16);
}

.searchable-dropdown-option {
  display: block;
  width: 100%;
  border: 0;
  background: transparent;
  padding: 0.62rem 0.85rem;
  color: #344767;
  font-size: 0.84rem;
  line-height: 1.35;
  text-align: left;
  cursor: pointer;
}

.searchable-dropdown-option:hover {
  background: #eff6ff;
  color: #1d4ed8;
}

.searchable-dropdown-empty {
  padding: 0.75rem 0.85rem;
  color: #8392ab;
  font-size: 0.82rem;
}
</style>
