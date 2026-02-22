import { buildApiUrl } from '~/config/env'

export type ApiRequestOptions = RequestInit & {
  timeoutMs?: number
}

export async function requestJson<T>(path: string, options: ApiRequestOptions = {}) {
  const { timeoutMs = 6000, ...rest } = options
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(buildApiUrl(path), {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(rest.headers || {}),
      },
      signal: controller.signal,
    })

    if (!response.ok)
      throw new Error(`HTTP ${response.status}`)

    return await response.json() as T
  }
  finally {
    clearTimeout(timer)
  }
}

export async function checkApiHealth() {
  return requestJson<{
    status: string
    version: string
    tunnel: string
  }>('/v3/health', { method: 'GET' })
}
