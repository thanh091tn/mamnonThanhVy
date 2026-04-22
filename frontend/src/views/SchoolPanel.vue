<script setup>
import { computed, ref, watch } from 'vue'
import { useStore } from 'vuex'
import StudentsPanel from './StudentsPanel.vue'
import TeachersPanel from './TeachersPanel.vue'
import ClassesPanel from './ClassesPanel.vue'

const store = useStore()
const activeTab = ref('students')
const isAdmin = computed(() => store.state.authUser?.role === 'admin')

const allTabs = [
  {
    key: 'students',
    label: 'Học sinh',
    icon: 'ni ni-hat-3',
    meta: 'Danh sách, hồ sơ và theo dõi lớp học',
  },
  {
    key: 'teachers',
    label: 'Giáo viên',
    icon: 'ni ni-badge',
    meta: 'Nhân sự giảng dạy và phân công',
  },
  {
    key: 'classes',
    label: 'Lớp học',
    icon: 'ni ni-books',
    meta: 'Tổ chức lớp và số lượng học sinh',
  },
]

const tabs = computed(() =>
  isAdmin.value ? allTabs : allTabs.filter((tab) => tab.key === 'students')
)

watch(tabs, (nextTabs) => {
  if (!nextTabs.some((tab) => tab.key === activeTab.value)) {
    activeTab.value = nextTabs[0]?.key || 'students'
  }
}, { immediate: true })
</script>

<template>
  <div class="page-fill">
    <div class="pt-4 pb-0 container-fluid school-tab-bar">
      <div class="school-hub">
        <div class="school-hub-copy">
          <span class="school-eyebrow">School Hub</span>
          <h4 class="school-title mb-1">Quản lý trường học</h4>
          <p class="school-subtitle mb-0">
            Chuyển nhanh giữa học sinh, giáo viên và lớp học trong cùng một không gian làm việc.
          </p>
        </div>

        <div class="school-badge">
          <i class="ni ni-building me-2"></i>
          <span>{{ tabs.find((t) => t.key === activeTab)?.label }}</span>
        </div>
      </div>

      <div class="school-tab-shell">
        <ul class="nav nav-pills school-tabs" role="tablist">
          <li v-for="t in tabs" :key="t.key" class="nav-item" role="presentation">
            <button
              class="nav-link mb-0"
              :class="{ active: activeTab === t.key }"
              type="button"
              role="tab"
              @click="activeTab = t.key"
            >
              <span class="school-tab-icon">
                <i :class="t.icon"></i>
              </span>
              <span class="school-tab-copy">
                <span class="school-tab-label">{{ t.label }}</span>
                <small class="school-tab-meta">{{ t.meta }}</small>
              </span>
            </button>
          </li>
        </ul>
      </div>
    </div>

    <StudentsPanel v-show="activeTab === 'students'" />
    <TeachersPanel v-if="isAdmin" v-show="activeTab === 'teachers'" />
    <ClassesPanel v-if="isAdmin" v-show="activeTab === 'classes'" />
  </div>
</template>

<style scoped>
.page-fill {
  gap: 0;
}

.school-tab-bar {
  flex: 0 0 auto;
  padding-top: 0.75rem !important;
  padding-bottom: 0.5rem !important;
  background:
    linear-gradient(180deg, rgba(248, 249, 250, 0.8), rgba(255, 255, 255, 0)),
    radial-gradient(circle at top right, rgba(130, 94, 228, 0.08), transparent 24%);
}

.school-hub {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem;
  padding: 0.9rem 1.1rem;
  margin-bottom: 0.6rem;
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 1rem;
  background:
    radial-gradient(circle at top left, rgba(94, 114, 228, 0.22), transparent 32%),
    linear-gradient(135deg, #ffffff 0%, #f8faff 48%, #eef3ff 100%);
  box-shadow: 0 1.25rem 2.5rem -2rem rgba(94, 114, 228, 0.45);
}

.school-hub-copy {
  max-width: 42rem;
}

.school-eyebrow {
  display: inline-block;
  margin-bottom: 0.25rem;
  color: #5e72e4;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.school-title {
  color: #1f2a44;
  font-size: 1.2rem;
  font-weight: 700;
  line-height: 1.25;
}

.school-subtitle {
  color: #67748e;
  font-size: 0.82rem;
  line-height: 1.45;
}

.school-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.55rem 0.8rem;
  border: 1px solid rgba(94, 114, 228, 0.14);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  color: #344767;
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
  box-shadow: 0 0.75rem 1.25rem -1rem rgba(94, 114, 228, 0.5);
}

.school-tab-shell {
  padding: 0.35rem;
  border: 1px solid #e9eef7;
  border-radius: 0.95rem;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 0.75rem 1.5rem -1.4rem rgba(15, 23, 42, 0.25);
}

.school-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-bottom: 0;
}

.school-tabs .nav-link {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.7rem;
  min-width: 0;
  min-height: 58px;
  padding: 0.7rem 0.9rem;
  border: 1px solid #edf1f7;
  border-radius: 0.75rem;
  background: linear-gradient(180deg, #fafcff, #f7f9fc);
  color: #67748e;
  font-size: 0.82rem;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease, transform 0.2s ease;
}

.school-tabs .nav-link:hover:not(.active) {
  border-color: #dbe4f2;
  background: #ffffff;
  color: #344767;
  transform: translateY(-1px);
}

.school-tabs .nav-link.active {
  border-color: transparent;
  background: linear-gradient(135deg, #5e72e4, #825ee4);
  color: #fff;
  box-shadow: 0 1rem 1.5rem -1rem rgba(94, 114, 228, 0.65);
}

.school-tab-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.65rem;
  background: rgba(94, 114, 228, 0.1);
  color: #5e72e4;
  flex-shrink: 0;
}

.school-tabs .nav-link.active .school-tab-icon {
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
}

.school-tab-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.school-tab-label {
  color: inherit;
  font-size: 0.84rem;
  font-weight: 700;
  line-height: 1.25;
}

.school-tab-meta {
  margin-top: 0.05rem;
  color: inherit;
  opacity: 0.72;
  font-size: 0.68rem;
  font-weight: 500;
  line-height: 1.25;
}

@media (max-width: 767.98px) {
  .school-tab-bar {
    padding-top: 0.6rem !important;
    padding-bottom: 0.45rem !important;
  }

  .school-hub {
    flex-direction: column;
    align-items: flex-start;
    padding: 0.85rem;
  }

  .school-tabs {
    gap: 0.4rem;
  }

  .school-tabs .nav-item {
    flex: 1 1 calc(50% - 0.4rem);
  }

  .school-tabs .nav-link {
    width: 100%;
    min-height: 56px;
    padding: 0.75rem 0.85rem;
  }
}

@media (max-width: 575.98px) {
  .school-title {
    font-size: 1.25rem;
  }

  .school-subtitle {
    font-size: 0.86rem;
  }

  .school-tabs .nav-item {
    flex-basis: 100%;
  }
}
</style>
