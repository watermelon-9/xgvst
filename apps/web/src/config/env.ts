export const APP_ENV = import.meta.env.MODE

const rawApiUrl = import.meta.env.VITE_API_URL as string | undefined

if (!rawApiUrl) {
  // 统一兜底，避免在业务代码里出现硬编码地址
  // 生产建议必须设置 VITE_API_URL
  console.warn('[xgvst] VITE_API_URL is not set, fallback to /api')
}

export const API_BASE_URL = (rawApiUrl?.trim() || '/api').replace(/\/$/, '')

export function buildApiUrl(path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalized}`
}
