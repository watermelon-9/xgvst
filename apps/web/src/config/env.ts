export const APP_ENV = import.meta.env.MODE

const rawApiBase = import.meta.env.VITE_API_BASE_URL as string | undefined
const rawWsBase = import.meta.env.VITE_WS_BASE_URL as string | undefined

if (!rawApiBase)
  console.warn('[xgvst] VITE_API_BASE_URL is not set, fallback to /api')

if (!rawWsBase)
  console.warn('[xgvst] VITE_WS_BASE_URL is not set, fallback to /ws')

export const API_BASE_URL = (rawApiBase?.trim() || '/api').replace(/\/$/, '')
export const WS_BASE_URL = (rawWsBase?.trim() || '/ws').replace(/\/$/, '')

export function buildApiUrl(path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalized}`
}

export function buildWsUrl(path = '/ws') {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${WS_BASE_URL}${normalized === '/ws' ? '' : normalized}`
}
