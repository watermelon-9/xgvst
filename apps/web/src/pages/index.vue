<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import LoadingSkeleton from '~/components/LoadingSkeleton.vue'
import { fetchApiHealth } from '~/api/status'
import { API_BASE_URL } from '~/config/env'
import { useMarketStore } from '~/stores/market'

defineOptions({ name: 'IndexPage' })

useHead({ title: '西瓜说股 v3' })

const market = useMarketStore()
const loading = ref(true)
const linkState = ref<'checking' | 'online' | 'offline'>('checking')
const linkMessage = ref('初始化中…')

onMounted(async () => {
  market.enqueueTick({
    symbol: '000001.SZ',
    price: 12.34,
    ts: Date.now(),
  })

  setTimeout(() => {
    loading.value = false
  }, 850)

  try {
    const result = await fetchApiHealth()
    if (result.status === 'ok') {
      linkState.value = 'online'
      linkMessage.value = `数据链路：在线 (${result.version} / ${result.tunnel})`
    }
    else {
      linkState.value = 'offline'
      linkMessage.value = `数据链路：异常 (${result.status || 'unknown'})`
    }
  }
  catch (error) {
    linkState.value = 'offline'
    linkMessage.value = '数据链路：离线（Tunnel/API 未连通）'
    console.warn('[xgvst] status check failed', error)
  }
})

const tickCount = computed(() => market.ticks.length)
const statusDotClass = computed(() => {
  if (linkState.value === 'online')
    return 'dot-online'
  if (linkState.value === 'offline')
    return 'dot-offline'
  return 'dot-checking'
})
</script>

<template>
  <section class="xg-landing bg-xg-bg text-xg-text border border-xg-border">
    <h1 class="text-3xl font-800">西瓜说股 v3</h1>
    <p>独立重构项目已启动（xgvst）。</p>
    <p class="hint">当前阶段：P1.3（API Tunnel 联通）</p>

    <div class="status-row mt-2">
      <span class="status-dot" :class="statusDotClass" />
      <span>{{ linkMessage }}</span>
    </div>

    <div class="mt-4 w-full max-w-190 rounded-lg border border-xg-border p-4 text-left text-sm">
      <template v-if="loading">
        <LoadingSkeleton />
      </template>
      <template v-else>
        <div class="mb-2 font-700">首屏验证块（Sub-B）</div>
        <div>Watchlist 数量：{{ market.watchlist.length }}</div>
        <div>Tick 缓冲后条数：{{ tickCount }}</div>
        <div>状态管理：<code>Pinia + shallowRef + requestAnimationFrame</code></div>
        <div>API 基址（env）：<code>{{ API_BASE_URL }}</code></div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.xg-landing {
  min-height: 78vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border-radius: 12px;
  padding: 24px;
}
.hint { opacity: .7; font-size: 14px; }
.status-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--xg-text-dim);
}
.status-dot {
  width: 9px;
  height: 9px;
  border-radius: 9999px;
  display: inline-block;
}
.dot-online { background: #22c55e; box-shadow: 0 0 6px rgba(34, 197, 94, .6); }
.dot-offline { background: #ef4444; box-shadow: 0 0 6px rgba(239, 68, 68, .5); }
.dot-checking { background: #f59e0b; box-shadow: 0 0 6px rgba(245, 158, 11, .5); }
</style>

<route lang="yaml">
meta:
  layout: market
</route>
