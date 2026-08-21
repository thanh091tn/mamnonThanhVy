<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api/client.js'
import ArgonAlert from '@/components/ArgonAlert.vue'
import defaultAvatarMale from '@/assets/img/logos/betrai.png'
import defaultAvatarFemale from '@/assets/img/logos/begai.png'

const router = useRouter()

const MONTHS = [
  { value: 1, short: 'Th1', label: 'Tháng Một' },
  { value: 2, short: 'Th2', label: 'Tháng Hai' },
  { value: 3, short: 'Th3', label: 'Tháng Ba' },
  { value: 4, short: 'Th4', label: 'Tháng Tư' },
  { value: 5, short: 'Th5', label: 'Tháng Năm' },
  { value: 6, short: 'Th6', label: 'Tháng Sáu' },
  { value: 7, short: 'Th7', label: 'Tháng Bảy' },
  { value: 8, short: 'Th8', label: 'Tháng Tám' },
  { value: 9, short: 'Th9', label: 'Tháng Chín' },
  { value: 10, short: 'Th10', label: 'Tháng Mười' },
  { value: 11, short: 'Th11', label: 'Tháng Mười Một' },
  { value: 12, short: 'Th12', label: 'Tháng Mười Hai' },
]

const selectedMonth = ref(new Date().getMonth() + 1)
const year = ref(new Date().getFullYear())
const counts = ref(Array(12).fill(0))
const items = ref([])
const loading = ref(false)
const loadErr = ref('')
const exporting = ref(false)
const exportButtonLabel = computed(() => (exporting.value ? 'Đang tải...' : 'Xuất Excel'))

const todayDay = new Date().getDate()
const todayMonth = new Date().getMonth() + 1

const selectedClassKey = ref('all')

const selectedMeta = computed(() => MONTHS.find((m) => m.value === selectedMonth.value) || MONTHS[0])
const totalInMonth = computed(() => items.value.length)
const todayItems = computed(() => items.value.filter((row) => isTodayBirthday(row)))
const upcomingInMonth = computed(() => {
  if (selectedMonth.value !== todayMonth) return items.value.length
  return items.value.filter((row) => row.birthdayDay >= todayDay).length
})

function classKey(row) {
  if (row?.classId) return `class-${row.classId}`
  return 'unassigned'
}

const classGroups = computed(() => {
  const map = new Map()
  for (const row of items.value) {
    const key = classKey(row)
    if (!map.has(key)) {
      map.set(key, {
        key,
        classId: row.classId || null,
        className: String(row.className || '').trim() || 'Chưa xếp lớp',
        students: [],
      })
    }
    map.get(key).students.push(row)
  }
  return [...map.values()].map((group) => {
    group.students.sort((a, b) => (Number(a.birthdayDay) || 0) - (Number(b.birthdayDay) || 0))
    return {
      ...group,
      hasToday: group.students.some((row) => isTodayBirthday(row)),
      todayCount: group.students.filter((row) => isTodayBirthday(row)).length,
    }
  })
})

const visibleClassGroups = computed(() => {
  if (selectedClassKey.value === 'all') return classGroups.value
  return classGroups.value.filter((group) => group.key === selectedClassKey.value)
})

function selectClass(key) {
  selectedClassKey.value = selectedClassKey.value === key ? 'all' : key
}

function avatarSrc(row) {
  const custom = String(row.avatar || '').trim()
  if (custom) return custom
  return row.gender === 'female' ? defaultAvatarFemale : defaultAvatarMale
}

function onAvatarError(ev, row) {
  const el = ev?.target
  if (!el || el.dataset.fallbackApplied) return
  el.dataset.fallbackApplied = '1'
  el.src = row.gender === 'female' ? defaultAvatarFemale : defaultAvatarMale
}

function parseDobParts(value) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { y: value.getFullYear(), m: value.getMonth() + 1, d: value.getDate() }
  }
  const text = String(value).trim()
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return { y: Number(iso[1]), m: Number(iso[2]), d: Number(iso[3]) }
  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) {
    return { y: parsed.getFullYear(), m: parsed.getMonth() + 1, d: parsed.getDate() }
  }
  return null
}

function formatDob(value) {
  const parts = parseDobParts(value)
  if (!parts) return '—'
  return `${String(parts.d).padStart(2, '0')}/${String(parts.m).padStart(2, '0')}/${parts.y}`
}

function weekdayLabel(day) {
  const date = new Date(year.value, selectedMonth.value - 1, Number(day) || 1)
  if (Number.isNaN(date.getTime())) return ''
  const label = date.toLocaleDateString('vi-VN', { weekday: 'long' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function isTodayBirthday(row) {
  return selectedMonth.value === todayMonth && Number(row.birthdayDay) === todayDay
}

function openStudent(row) {
  if (!row?.id) return
  router.push({ name: 'StudentDetail', params: { id: row.id } })
}

function prevMonth() {
  selectedMonth.value = selectedMonth.value === 1 ? 12 : selectedMonth.value - 1
}

function nextMonth() {
  selectedMonth.value = selectedMonth.value === 12 ? 1 : selectedMonth.value + 1
}

function exportFileNameFromDisposition(disposition) {
  const fallback = `sinh-nhat-thang-${String(selectedMonth.value).padStart(2, '0')}-${year.value}.xls`
  const value = String(disposition || '')
  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match) return decodeURIComponent(utf8Match[1])
  const asciiMatch = value.match(/filename="?([^";]+)"?/i)
  return asciiMatch ? asciiMatch[1] : fallback
}

async function exportBirthdays() {
  if (!items.value.length || exporting.value) return
  exporting.value = true
  loadErr.value = ''
  try {
    const response = await api.get('/students/birthdays/export', {
      params: { month: selectedMonth.value },
      responseType: 'blob',
    })
    const blob = new Blob([response.data], {
      type: response.headers['content-type'] || 'application/vnd.ms-excel',
    })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = exportFileNameFromDisposition(response.headers['content-disposition'])
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  } catch (e) {
    loadErr.value = e.response?.data?.error || e.message || 'Không xuất được file Excel'
  } finally {
    exporting.value = false
  }
}

async function loadBirthdays() {
  loading.value = true
  loadErr.value = ''
  try {
    const { data } = await api.get('/students/birthdays', {
      params: { month: selectedMonth.value },
    })
    year.value = Number(data?.year) || new Date().getFullYear()
    counts.value = Array.isArray(data?.counts) ? data.counts : Array(12).fill(0)
    items.value = Array.isArray(data?.items) ? data.items : []
    if (Number(data?.month) >= 1 && Number(data?.month) <= 12) {
      selectedMonth.value = Number(data.month)
    }
    if (selectedClassKey.value !== 'all' && !items.value.some((row) => classKey(row) === selectedClassKey.value)) {
      selectedClassKey.value = 'all'
    }
  } catch (e) {
    loadErr.value = e.response?.data?.error || e.message || 'Không tải được danh sách sinh nhật'
    items.value = []
  } finally {
    loading.value = false
  }
}

watch(selectedMonth, () => {
  loadBirthdays()
})

onMounted(loadBirthdays)
</script>

<template>
  <div class="bday-page">
    <section class="bday-hero">
      <div class="bday-hero-glow" aria-hidden="true"></div>
      <div class="bday-hero-orb bday-hero-orb--a" aria-hidden="true"></div>
      <div class="bday-hero-orb bday-hero-orb--b" aria-hidden="true"></div>

      <div class="bday-hero-main">
        <p class="bday-kicker">Lịch sinh nhật · {{ year }}</p>
        <div class="bday-month-nav">
          <button type="button" class="bday-nav-btn" aria-label="Tháng trước" @click="prevMonth">
            <i class="ni ni-bold-left"></i>
          </button>
          <div class="bday-month-display">
            <span class="bday-month-num">{{ String(selectedMonth).padStart(2, '0') }}</span>
            <div>
              <h1>{{ selectedMeta.label }}</h1>
              <p>{{ totalInMonth }} bé có sinh nhật tháng này</p>
            </div>
          </div>
          <button type="button" class="bday-nav-btn" aria-label="Tháng sau" @click="nextMonth">
            <i class="ni ni-bold-right"></i>
          </button>
        </div>
        <button
          type="button"
          class="bday-export-btn"
          :disabled="exporting || !items.length"
          @click="exportBirthdays"
        >
          <i class="ni ni-cloud-download-95"></i>
          {{ exportButtonLabel }}
        </button>
      </div>

      <div class="bday-hero-metrics">
        <div class="bday-metric">
          <span>Tổng số</span>
          <strong>{{ totalInMonth }}</strong>
        </div>
        <div class="bday-metric">
          <span>Còn tới</span>
          <strong>{{ upcomingInMonth }}</strong>
        </div>
        <div class="bday-metric bday-metric--accent">
          <span>Hôm nay</span>
          <strong>{{ todayItems.length }}</strong>
        </div>
      </div>
    </section>

    <div class="bday-month-strip" role="tablist" aria-label="Chọn tháng">
      <button
        v-for="m in MONTHS"
        :key="m.value"
        type="button"
        role="tab"
        class="bday-strip-item"
        :class="{
          active: selectedMonth === m.value,
          current: m.value === todayMonth,
          empty: !(counts[m.value - 1] > 0),
        }"
        :aria-selected="selectedMonth === m.value"
        @click="selectedMonth = m.value"
      >
        <span class="bday-strip-short">{{ m.short }}</span>
        <em>{{ counts[m.value - 1] || 0 }}</em>
      </button>
    </div>

    <argon-alert v-if="loadErr" color="danger" icon="ni ni-fat-remove" class="mb-3">
      {{ loadErr }}
    </argon-alert>

    <section v-if="todayItems.length" class="bday-today-banner">
      <div class="bday-today-copy">
        <span class="bday-today-pill">Hôm nay</span>
        <h2>Chúc mừng sinh nhật!</h2>
        <p>{{ todayItems.map((s) => s.name).join(', ') }}</p>
      </div>
      <div class="bday-today-faces">
        <button
          v-for="row in todayItems.slice(0, 6)"
          :key="`today-${row.id}`"
          type="button"
          class="bday-today-face"
          :title="row.name"
          @click="openStudent(row)"
        >
          <img :src="avatarSrc(row)" alt="" @error="onAvatarError($event, row)" />
        </button>
      </div>
    </section>

    <div v-if="loading" class="bday-loading">
      <div class="bday-loading-dot"></div>
      <div class="bday-loading-dot"></div>
      <div class="bday-loading-dot"></div>
      <span>Đang tải danh sách...</span>
    </div>

    <div v-else-if="!classGroups.length" class="bday-empty">
      <div class="bday-empty-cake" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <h3>Chưa có sinh nhật trong {{ selectedMeta.label.toLowerCase() }}</h3>
      <p>Hãy chọn tháng khác, hoặc kiểm tra ngày sinh trên hồ sơ học sinh.</p>
    </div>

    <div v-else class="bday-class-board">
      <div v-if="classGroups.length > 1" class="bday-class-strip" role="tablist" aria-label="Lọc theo lớp">
        <button
          type="button"
          role="tab"
          class="bday-class-chip"
          :class="{ active: selectedClassKey === 'all' }"
          :aria-selected="selectedClassKey === 'all'"
          @click="selectedClassKey = 'all'"
        >
          Tất cả
          <em>{{ totalInMonth }}</em>
        </button>
        <button
          v-for="group in classGroups"
          :key="`chip-${group.key}`"
          type="button"
          role="tab"
          class="bday-class-chip"
          :class="{ active: selectedClassKey === group.key, today: group.hasToday }"
          :aria-selected="selectedClassKey === group.key"
          @click="selectClass(group.key)"
        >
          {{ group.className }}
          <em>{{ group.students.length }}</em>
        </button>
      </div>

      <article
        v-for="(group, gi) in visibleClassGroups"
        :key="group.key"
        class="bday-class-block"
        :class="{ 'has-today': group.hasToday }"
        :style="{ '--delay': `${gi * 50}ms` }"
      >
        <header class="bday-class-head">
          <div class="bday-class-mark" aria-hidden="true">{{ group.className.slice(0, 1) }}</div>
          <div class="bday-class-copy">
            <h3>
              {{ group.className }}
              <small v-if="group.hasToday">· {{ group.todayCount }} bé hôm nay</small>
            </h3>
            <p>{{ group.students.length }} sinh nhật trong {{ selectedMeta.label.toLowerCase() }}</p>
          </div>
          <span class="bday-class-count">{{ group.students.length }}</span>
        </header>

        <div class="bday-card-grid">
          <button
            v-for="row in group.students"
            :key="row.id"
            type="button"
            class="bday-card"
            :class="{ 'is-today': isTodayBirthday(row) }"
            @click="openStudent(row)"
          >
            <div class="bday-card-date" :class="{ 'is-today': isTodayBirthday(row) }">
              <strong>{{ String(row.birthdayDay).padStart(2, '0') }}</strong>
              <span>/{{ String(selectedMonth).padStart(2, '0') }}</span>
            </div>
            <div class="bday-card-media">
              <img
                :src="avatarSrc(row)"
                alt=""
                referrerpolicy="no-referrer"
                @error="onAvatarError($event, row)"
              />
              <span v-if="isTodayBirthday(row)" class="bday-card-spark" aria-hidden="true"></span>
            </div>
            <div class="bday-card-info">
              <strong>{{ row.name }}</strong>
              <span>{{ weekdayLabel(row.birthdayDay) }}</span>
              <div class="bday-card-meta">
                <em>{{ formatDob(row.dateOfBirth) }}</em>
                <b v-if="row.ageTurning != null">{{ row.ageTurning }} tuổi</b>
              </div>
            </div>
          </button>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@500;600;700;800&family=Fraunces:opsz,wght@9..144,650;9..144,700&display=swap');

.bday-page {
  --bday-ink: #1c2b3a;
  --bday-muted: #5f7185;
  --bday-mint: #0f9f7a;
  --bday-mint-soft: #e7f7f1;
  --bday-peach: #ff8f6b;
  --bday-display: 'Fraunces', 'Palatino Linotype', Palatino, serif;
  --bday-sans: 'Be Vietnam Pro', 'Nunito Sans', 'Segoe UI', sans-serif;
  min-height: calc(100vh - 1rem);
  margin: 0 -1.5rem;
  padding: 1.15rem 1.4rem 2.25rem;
  background:
    radial-gradient(1200px 420px at 8% -10%, rgba(255, 176, 140, 0.28), transparent 55%),
    radial-gradient(900px 380px at 95% 0%, rgba(111, 207, 181, 0.22), transparent 50%),
    linear-gradient(180deg, #f7fbff 0%, #f3f7fb 45%, #eef5f2 100%);
  color: var(--bday-ink);
  font-family: var(--bday-sans);
}

.bday-hero {
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) auto;
  gap: 1.25rem;
  align-items: center;
  padding: 1.35rem 1.45rem;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 1.35rem;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.88), rgba(255, 255, 255, 0.72));
  box-shadow: 0 1rem 2.5rem rgba(28, 43, 58, 0.06);
  backdrop-filter: blur(10px);
  animation: bday-rise 0.55s ease both;
}

.bday-hero-glow {
  position: absolute;
  inset: auto -10% -40% 35%;
  height: 70%;
  background: radial-gradient(circle, rgba(255, 143, 107, 0.18), transparent 70%);
  pointer-events: none;
}

.bday-hero-orb {
  position: absolute;
  border-radius: 999px;
  filter: blur(2px);
  pointer-events: none;
  opacity: 0.55;
  animation: bday-float 7s ease-in-out infinite;
}

.bday-hero-orb--a {
  top: -1.2rem;
  right: 28%;
  width: 4.5rem;
  height: 4.5rem;
  background: rgba(15, 159, 122, 0.2);
}

.bday-hero-orb--b {
  right: 1.2rem;
  bottom: -1.4rem;
  width: 5.5rem;
  height: 5.5rem;
  background: rgba(255, 143, 107, 0.22);
  animation-delay: -2.5s;
}

.bday-kicker {
  margin: 0 0 0.55rem;
  color: var(--bday-muted);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.bday-month-nav {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.bday-nav-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.4rem;
  height: 2.4rem;
  border: 1px solid #d7e5ee;
  border-radius: 999px;
  background: #ffffff;
  color: var(--bday-ink);
  transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease;
}

.bday-nav-btn:hover {
  transform: translateY(-1px);
  border-color: #9fd9c5;
  background: var(--bday-mint-soft);
  color: var(--bday-mint);
}

.bday-month-display {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.bday-month-num {
  font-family: var(--bday-display);
  font-size: clamp(2.8rem, 5vw, 3.6rem);
  font-weight: 700;
  line-height: 0.9;
  letter-spacing: -0.04em;
  background: linear-gradient(160deg, #ff8f6b 10%, #0f9f7a 90%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.bday-month-display h1 {
  margin: 0;
  font-family: var(--bday-display);
  font-size: clamp(1.35rem, 2.4vw, 1.8rem);
  font-weight: 700;
  letter-spacing: -0.02em;
}

.bday-month-display p {
  margin: 0.2rem 0 0;
  color: var(--bday-muted);
  font-size: 0.86rem;
  font-weight: 600;
}

.bday-export-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.85rem;
  min-height: 2.35rem;
  padding: 0.4rem 0.9rem;
  border: 0;
  border-radius: 999px;
  background: linear-gradient(160deg, #1aa884, #0f9f7a);
  color: #ffffff;
  font-size: 0.82rem;
  font-weight: 750;
  box-shadow: 0 0.45rem 1rem rgba(15, 159, 122, 0.22);
  transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
}

.bday-export-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 0.65rem 1.2rem rgba(15, 159, 122, 0.28);
}

.bday-export-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: none;
}

.bday-hero-metrics {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(3, minmax(4.8rem, 1fr));
  gap: 0.55rem;
}

.bday-metric {
  min-width: 5rem;
  padding: 0.7rem 0.8rem;
  border: 1px solid rgba(215, 229, 238, 0.9);
  border-radius: 0.95rem;
  background: rgba(255, 255, 255, 0.85);
  text-align: center;
}

.bday-metric span {
  display: block;
  margin-bottom: 0.2rem;
  color: var(--bday-muted);
  font-size: 0.68rem;
  font-weight: 750;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.bday-metric strong {
  font-family: var(--bday-display);
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--bday-ink);
}

.bday-metric--accent {
  border-color: rgba(255, 143, 107, 0.35);
  background: linear-gradient(180deg, #fff4ef, #ffe8df);
}

.bday-metric--accent strong {
  color: #d4572f;
}

.bday-month-strip {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 0.4rem;
  margin: 1rem 0 1.15rem;
  animation: bday-rise 0.6s ease 0.08s both;
}

.bday-strip-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  min-height: 3.35rem;
  padding: 0.4rem 0.2rem;
  border: 1px solid transparent;
  border-radius: 0.85rem;
  background: rgba(255, 255, 255, 0.72);
  color: var(--bday-muted);
  transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.bday-strip-item:hover {
  transform: translateY(-2px);
  border-color: #cfe4da;
  background: #ffffff;
}

.bday-strip-short {
  font-size: 0.72rem;
  font-weight: 750;
}

.bday-strip-item em {
  font-style: normal;
  font-size: 0.78rem;
  font-weight: 800;
  color: var(--bday-ink);
}

.bday-strip-item.empty em {
  color: #9aa8b8;
}

.bday-strip-item.current {
  box-shadow: inset 0 0 0 1px rgba(15, 159, 122, 0.25);
}

.bday-strip-item.active {
  border-color: transparent;
  background: linear-gradient(160deg, #1aa884, #0f9f7a);
  color: #ffffff;
  box-shadow: 0 0.55rem 1.2rem rgba(15, 159, 122, 0.28);
}

.bday-strip-item.active em {
  color: #ffffff;
}

.bday-today-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.15rem;
  padding: 1rem 1.15rem;
  border-radius: 1.15rem;
  background: linear-gradient(120deg, #fff1ea 0%, #ffe4d8 45%, #e8f8f2 100%);
  border: 1px solid rgba(255, 143, 107, 0.28);
  animation: bday-rise 0.55s ease 0.12s both;
}

.bday-today-pill {
  display: inline-flex;
  margin-bottom: 0.35rem;
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  background: rgba(212, 87, 47, 0.12);
  color: #d4572f;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.bday-today-copy h2 {
  margin: 0;
  font-family: var(--bday-display);
  font-size: 1.2rem;
  font-weight: 700;
}

.bday-today-copy p {
  margin: 0.25rem 0 0;
  color: var(--bday-muted);
  font-size: 0.86rem;
  font-weight: 600;
}

.bday-today-faces {
  display: flex;
  padding-right: 0.4rem;
}

.bday-today-face {
  width: 2.7rem;
  height: 2.7rem;
  margin-right: -0.55rem;
  padding: 0;
  border: 3px solid #ffffff;
  border-radius: 999px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 0.3rem 0.7rem rgba(28, 43, 58, 0.12);
  transition: transform 0.18s ease;
}

.bday-today-face:hover {
  transform: translateY(-3px) scale(1.04);
  z-index: 2;
}

.bday-today-face img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.bday-loading,
.bday-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  min-height: 14rem;
  padding: 2rem 1rem;
  border: 1px dashed #d5e3ec;
  border-radius: 1.2rem;
  background: rgba(255, 255, 255, 0.65);
  color: var(--bday-muted);
  text-align: center;
}

.bday-loading {
  flex-direction: row;
  gap: 0.45rem;
}

.bday-loading-dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  background: var(--bday-mint);
  animation: bday-bounce 0.9s ease-in-out infinite;
}

.bday-loading-dot:nth-child(2) { animation-delay: 0.12s; }
.bday-loading-dot:nth-child(3) { animation-delay: 0.24s; }

.bday-empty-cake {
  display: flex;
  align-items: flex-end;
  gap: 0.28rem;
  height: 2.4rem;
  margin-bottom: 0.2rem;
}

.bday-empty-cake span {
  width: 0.7rem;
  border-radius: 0.35rem 0.35rem 0.2rem 0.2rem;
  background: linear-gradient(180deg, #ffb199, #ff8f6b);
  animation: bday-bounce 1.2s ease-in-out infinite;
}

.bday-empty-cake span:nth-child(1) { height: 1.15rem; }
.bday-empty-cake span:nth-child(2) { height: 1.7rem; animation-delay: 0.12s; background: linear-gradient(180deg, #7ee0c4, #0f9f7a); }
.bday-empty-cake span:nth-child(3) { height: 1.35rem; animation-delay: 0.24s; }

.bday-empty h3 {
  margin: 0;
  color: var(--bday-ink);
  font-family: var(--bday-display);
  font-size: 1.2rem;
}

.bday-empty p {
  margin: 0;
  max-width: 26rem;
  font-size: 0.88rem;
  font-weight: 600;
}

.bday-class-board {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.bday-class-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-bottom: 0.15rem;
  animation: bday-rise 0.5s ease backwards;
}

.bday-class-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2.35rem;
  padding: 0.35rem 0.7rem;
  border: 1px solid #dce8f0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  color: var(--bday-muted);
  font-size: 0.78rem;
  font-weight: 700;
  transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.bday-class-chip em {
  min-width: 1.15rem;
  padding: 0.08rem 0.38rem;
  border-radius: 999px;
  background: #eef6f2;
  color: var(--bday-ink);
  font-style: normal;
  font-size: 0.7rem;
  font-weight: 800;
}

.bday-class-chip:hover {
  transform: translateY(-1px);
  border-color: #b7dfd0;
  color: var(--bday-ink);
}

.bday-class-chip.today em {
  background: #fff1ea;
  color: #d4572f;
}

.bday-class-chip.active {
  border-color: transparent;
  background: linear-gradient(160deg, #1aa884, #0f9f7a);
  color: #fff;
  box-shadow: 0 0.45rem 1rem rgba(15, 159, 122, 0.22);
}

.bday-class-chip.active em {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.bday-class-block {
  min-width: 0;
  padding: 0.95rem;
  border: 1px solid rgba(225, 235, 243, 0.95);
  border-radius: 1.25rem;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 0.55rem 1.4rem rgba(28, 43, 58, 0.035);
  animation: bday-rise 0.45s ease backwards;
  animation-delay: var(--delay);
}

.bday-class-block.has-today {
  border-color: rgba(255, 143, 107, 0.28);
  background: linear-gradient(180deg, #fffaf7, #ffffff);
}

.bday-class-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
}

.bday-class-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.7rem;
  height: 2.7rem;
  border-radius: 0.95rem;
  background: linear-gradient(160deg, #e8f8f2, #d7f1e8);
  color: var(--bday-mint);
  font-family: var(--bday-display);
  font-size: 1.15rem;
  font-weight: 700;
  flex-shrink: 0;
}

.bday-class-block.has-today .bday-class-mark {
  background: linear-gradient(160deg, #ff9d7a, #ff7d55);
  color: #fff;
}

.bday-class-copy {
  min-width: 0;
  flex: 1;
}

.bday-class-copy h3 {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 1.05rem;
  font-weight: 800;
}

.bday-class-copy small {
  color: #d4572f;
  font-size: 0.78rem;
  font-weight: 750;
}

.bday-class-copy p {
  margin: 0.15rem 0 0;
  color: var(--bday-muted);
  font-size: 0.78rem;
  font-weight: 650;
}

.bday-class-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.1rem;
  height: 2.1rem;
  padding: 0 0.55rem;
  border-radius: 999px;
  background: var(--bday-mint-soft);
  color: #0f766e;
  font-family: var(--bday-display);
  font-size: 1.05rem;
  font-weight: 700;
}

.bday-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16.5rem, 1fr));
  gap: 0.7rem;
}

.bday-card {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  padding: 0.7rem;
  border: 1px solid #e6eef5;
  border-radius: 1rem;
  background: #fbfcfe;
  text-align: left;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease;
}

.bday-card:hover {
  transform: translateY(-2px);
  border-color: #b7dfd0;
  background: #ffffff;
  box-shadow: 0 0.7rem 1.4rem rgba(15, 159, 122, 0.12);
}

.bday-card.is-today {
  border-color: rgba(255, 143, 107, 0.4);
  background: #fff8f4;
}

.bday-card-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 3.15rem;
  height: 3.15rem;
  border-radius: 0.9rem;
  background: #ffffff;
  border: 1px solid #e1ebf3;
  flex-shrink: 0;
}

.bday-card-date strong {
  font-family: var(--bday-display);
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1;
}

.bday-card-date span {
  color: var(--bday-muted);
  font-size: 0.66rem;
  font-weight: 700;
}

.bday-card-date.is-today {
  border-color: transparent;
  background: linear-gradient(160deg, #ff9d7a, #ff7d55);
  color: #fff;
}

.bday-card-date.is-today span {
  color: rgba(255, 255, 255, 0.85);
}

.bday-card-media {
  position: relative;
  flex-shrink: 0;
}

.bday-card-media img {
  width: 3.1rem;
  height: 3.1rem;
  object-fit: cover;
  border-radius: 999px;
  border: 2px solid #ffffff;
  background: #eef6f2;
  box-shadow: 0 0.25rem 0.6rem rgba(28, 43, 58, 0.1);
}

.bday-card-spark {
  position: absolute;
  right: -0.05rem;
  bottom: -0.05rem;
  width: 0.85rem;
  height: 0.85rem;
  border-radius: 999px;
  background: radial-gradient(circle at 35% 35%, #ffe08a, #ff8f6b);
  box-shadow: 0 0 0 3px #fff;
}

.bday-card-info {
  min-width: 0;
}

.bday-card-info strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--bday-ink);
  font-size: 0.9rem;
  font-weight: 800;
}

.bday-card-info > span {
  display: block;
  margin-top: 0.1rem;
  color: var(--bday-muted);
  font-size: 0.76rem;
  font-weight: 650;
}

.bday-card-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.35rem;
}

.bday-card-meta em {
  color: #7a8b9c;
  font-style: normal;
  font-size: 0.72rem;
  font-weight: 650;
}

.bday-card-meta b {
  padding: 0.12rem 0.45rem;
  border-radius: 999px;
  background: var(--bday-mint-soft);
  color: #0f766e;
  font-size: 0.7rem;
  font-weight: 800;
}

@keyframes bday-rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes bday-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

@keyframes bday-bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.45; }
  40% { transform: translateY(-5px); opacity: 1; }
}

@media (max-width: 991.98px) {
  .bday-page {
    margin: 0 -1rem;
    padding: 1rem;
  }

  .bday-hero {
    grid-template-columns: 1fr;
  }

  .bday-month-strip {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}

@media (max-width: 575.98px) {
  .bday-page {
    margin: 0;
  }

  .bday-month-nav {
    width: 100%;
    justify-content: space-between;
  }

  .bday-hero-metrics {
    grid-template-columns: repeat(3, 1fr);
  }

  .bday-month-strip {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .bday-today-banner {
    flex-direction: column;
    align-items: flex-start;
  }

  .bday-class-head {
    align-items: flex-start;
  }

  .bday-card-grid {
    grid-template-columns: 1fr;
  }
}
</style>
