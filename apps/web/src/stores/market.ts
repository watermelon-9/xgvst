import { acceptHMRUpdate, defineStore } from 'pinia'
import { shallowRef } from 'vue'

export type MarketTick = {
  symbol: string
  price: number
  ts: number
}

export const useMarketStore = defineStore('market', () => {
  // 红线：高频数据必须 shallowRef，避免深层响应式开销
  const ticks = shallowRef<MarketTick[]>([])
  const watchlist = shallowRef<string[]>(['000001.SZ', '600519.SH', '000858.SZ'])

  let rafId = 0
  const pending: MarketTick[] = []

  function flushPending() {
    rafId = 0
    if (!pending.length)
      return

    // 仅替换顶层引用，避免深层追踪
    ticks.value = [...ticks.value, ...pending].slice(-500)
    pending.length = 0
  }

  function enqueueTick(tick: MarketTick) {
    pending.push(tick)
    if (!rafId)
      rafId = requestAnimationFrame(flushPending)
  }

  function setWatchlist(next: string[]) {
    watchlist.value = [...next]
  }

  return {
    ticks,
    watchlist,
    enqueueTick,
    setWatchlist,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useMarketStore as any, import.meta.hot))
