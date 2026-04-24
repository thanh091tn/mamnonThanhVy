import { createRouter, createWebHistory } from 'vue-router'
import store from '../store'
import Profile from '../views/Profile.vue'
import Signup from '../views/Signup.vue'
import Signin from '../views/Signin.vue'
import Dashboard from '../views/Dashboard.vue'
import SchoolPanel from '../views/SchoolPanel.vue'
import AttendancePanel from '../views/AttendancePanel.vue'
import TeacherLeaveCalendar from '../views/TeacherLeaveCalendar.vue'
import TeacherLeaveRequest from '../views/TeacherLeaveRequest.vue'
import FeeItems from '../views/FeeItems.vue'
import FeePeriods from '../views/FeePeriods.vue'
import FeePolicies from '../views/FeePolicies.vue'
import FeeCollection from '../views/FeeCollection.vue'
import FeeServices from '../views/FeeServices.vue'
import StudentDetail from '../views/StudentDetail.vue'

const routes = [
  {
    path: '/',
    name: '/',
    redirect: '/dashboard',
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    meta: { requiresAuth: true },
  },
  {
    path: '/school',
    name: 'School',
    component: SchoolPanel,
    meta: { requiresAuth: true },
  },
  {
    path: '/students/create',
    name: 'StudentCreate',
    component: StudentDetail,
    meta: { requiresAuth: true },
  },
  {
    path: '/students/:id/detail',
    name: 'StudentDetail',
    component: StudentDetail,
    meta: { requiresAuth: true },
  },
  { path: '/students', redirect: '/school' },
  { path: '/teachers', redirect: '/school' },
  { path: '/classes', redirect: '/school' },
  {
    path: '/attendance',
    name: 'Attendance',
    component: AttendancePanel,
    meta: { requiresAuth: true },
  },
  {
    path: '/leave-calendar',
    name: 'LeaveCalendar',
    component: TeacherLeaveCalendar,
    meta: { requiresAuth: true, requiresManager: true },
  },
  {
    path: '/fee-items',
    name: 'FeeItems',
    component: FeeItems,
    meta: { requiresAuth: true, requiresManager: true },
  },
  {
    path: '/fee-periods',
    name: 'FeePeriods',
    component: FeePeriods,
    meta: { requiresAuth: true, requiresManager: true },
  },
  {
    path: '/fee-policies',
    name: 'FeePolicies',
    component: FeePolicies,
    meta: { requiresAuth: true, requiresManager: true },
  },
  {
    path: '/fee-services',
    name: 'FeeServices',
    component: FeeServices,
    meta: { requiresAuth: true, requiresManager: true },
  },
  {
    path: '/fee-collection',
    name: 'FeeCollection',
    component: FeeCollection,
    meta: { requiresAuth: true, requiresManager: true },
  },
  {
    path: '/teacher-leave',
    name: 'TeacherLeaveRequest',
    component: TeacherLeaveRequest,
    meta: { requiresAuth: true, requiresTeacher: true },
  },
  {
    path: '/profile',
    name: 'Profile',
    component: Profile,
    meta: { requiresAuth: true },
  },
  {
    path: '/signin',
    name: 'Signin',
    component: Signin,
  },
  {
    path: '/signup',
    name: 'Signup',
    component: Signup,
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  linkActiveClass: 'active',
})

router.beforeEach((to, _from, next) => {
  const token =
    store.state.authToken ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('school_token') : null)

  if (to.meta.requiresAuth && !token) {
    next({ name: 'Signin', query: { redirect: to.fullPath } })
    return
  }

  if (to.meta.requiresManager) {
    const user = store.state.authUser
    if (!user || user.role !== 'admin') {
      next({ name: 'Dashboard' })
      return
    }
  }

  if (to.meta.requiresTeacher) {
    const user = store.state.authUser
    if (!user || user.role !== 'teacher' || user.teacherId == null) {
      next({ name: 'Dashboard' })
      return
    }
  }

  if ((to.name === 'Signin' || to.name === 'Signup') && token) {
    const redir = typeof to.query.redirect === 'string' ? to.query.redirect : '/dashboard'
    next(redir)
    return
  }

  next()
})

export default router
