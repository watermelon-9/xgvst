import { checkApiHealth } from './client'

export type ApiHealth = {
  status: string
  version: string
  tunnel: string
}

export function fetchApiHealth() {
  return checkApiHealth() as Promise<ApiHealth>
}
