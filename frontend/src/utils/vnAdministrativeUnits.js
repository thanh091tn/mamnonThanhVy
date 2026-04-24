import units from '@/data/vnAdministrativeUnits.json'

export const VN_ADMIN_SOURCE =
  'Decision 19/2025/QD-TTg, updated with 2025 province/ward restructuring'

export const provinces = Array.isArray(units) ? units : []

function cleanName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^(tinh|thanh pho)\s+/i, '')
    .replace(/^(xa|phuong|dac khu)\s+/i, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

export function findProvinceByName(value) {
  const name = cleanName(value)
  if (!name) return null
  return provinces.find((province) => cleanName(province.FullName) === name) || null
}

export function wardsForProvinceName(value) {
  return findProvinceByName(value)?.Wards || []
}

export function hasWardInProvince(provinceName, wardName) {
  const ward = cleanName(wardName)
  if (!ward) return true
  return wardsForProvinceName(provinceName).some((item) => cleanName(item.FullName) === ward)
}
