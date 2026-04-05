<script setup>
defineProps({
  displayName: { type: String, default: "" },
  roleLabel: { type: String, default: "" },
  email: { type: String, default: "" },
  userId: { type: [Number, String], default: "" },
  teacherPhone: { type: String, default: "" },
  teacherAddress: { type: String, default: "" },
  showTeacherExtras: { type: Boolean, default: false },
});
</script>

<template>
  <div class="card card-profile profile-side-card">
    <div class="profile-cover-wrap">
      <img src="../../assets/img/bg-profile.jpg" alt="" class="card-img-top profile-cover" />
      <div class="profile-cover-mask"></div>
    </div>

    <div class="card-header text-center border-0 pt-4 pb-0 profile-side-header">
      <div class="profile-side-avatar">
        {{ displayName ? displayName.charAt(0).toUpperCase() : "—" }}
      </div>
      <h5 class="mb-1 profile-side-name">{{ displayName || "—" }}</h5>
      <p class="mb-2 text-sm profile-side-role">{{ roleLabel }}</p>
      <p class="mb-0 text-xs profile-side-email">
        <i class="ni ni-email-83 me-1"></i>{{ email || "—" }}
      </p>
      <p v-if="userId !== '' && userId != null" class="mb-0 mt-2 text-xs profile-side-id">
        ID tài khoản: {{ userId }}
      </p>
    </div>

    <div v-if="showTeacherExtras" class="card-body pt-2 border-top profile-side-body">
      <p class="text-xs text-uppercase mb-2 profile-side-section">Liên hệ giáo viên</p>
      <p v-if="teacherPhone" class="text-sm mb-2 profile-side-item">
        <i class="ni ni-mobile-button me-1"></i>{{ teacherPhone }}
      </p>
      <p v-if="teacherAddress" class="text-sm mb-0 profile-side-item profile-side-address">
        <i class="ni ni-pin-3 me-1"></i>{{ teacherAddress }}
      </p>
      <p v-if="!teacherPhone && !teacherAddress" class="text-sm mb-0 profile-side-empty">
        Chưa cập nhật số điện thoại hoặc địa chỉ trong danh sách giáo viên.
      </p>
    </div>
  </div>
</template>

<style scoped>
.profile-side-card {
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 1.35rem;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
}

.profile-cover-wrap {
  position: relative;
}

.profile-cover {
  height: 148px;
  object-fit: cover;
}

.profile-cover-mask {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.08), rgba(15, 118, 110, 0.34));
}

.profile-side-header {
  padding-left: 1.5rem;
  padding-right: 1.5rem;
  margin-top: -2.8rem;
  position: relative;
  z-index: 1;
}

.profile-side-avatar {
  width: 5rem;
  height: 5rem;
  margin: 0 auto 0.9rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f766e, #14b8a6);
  color: #ffffff;
  font-size: 1.5rem;
  font-weight: 700;
  border: 4px solid #ffffff;
  box-shadow: 0 16px 34px rgba(20, 184, 166, 0.28);
}

.profile-side-name {
  color: #0f172a;
  font-weight: 700;
}

.profile-side-role {
  color: #0f766e;
  font-weight: 700;
}

.profile-side-email,
.profile-side-id {
  color: #64748b;
}

.profile-side-body {
  padding: 1.1rem 1.5rem 1.4rem;
  border-top-color: #e2e8f0 !important;
}

.profile-side-section {
  color: #64748b;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.profile-side-item {
  color: #334155;
  line-height: 1.6;
}

.profile-side-address,
.profile-side-empty {
  color: #64748b;
}
</style>
