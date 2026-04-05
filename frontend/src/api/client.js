import axios from 'axios'
import store from '../store'

const baseURL = import.meta.env.VITE_API_BASE || '/api'

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  const token = store.state.authToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('school_token') : null)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status
    const url = String(err.config?.url || '')
    if (status === 401 && !url.includes('/auth/login') && !url.includes('/auth/register')) {
      store.commit('clearAuth')
      if (typeof window !== 'undefined') {
        const path = window.location.pathname
        if (!path.includes('/signin')) {
          const q = encodeURIComponent(path + window.location.search)
          window.location.href = `/signin?redirect=${q}`
        }
      }
    }
    return Promise.reject(err)
  }
)
